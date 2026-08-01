import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { verifyVaultAccessToken } from '@/lib/vault/tokens'

export const runtime = 'nodejs'
export const maxDuration = 30

async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Safe to ignore in server context.
          }
        },
      },
    }
  )
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [type, token] = header.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null

  return token
}

function getSupabaseBearerClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const bearerToken = getBearerToken(request)
    const supabase = bearerToken
      ? getSupabaseBearerClient(bearerToken)
      : await getSupabaseServerClient()

    const { data: { user }, error: authError } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Session expirée. Reconnecte-toi puis réessaie.' },
        { status: 401 }
      )
    }

    if (!canAccessAdminDocuments(user.email)) {
      return NextResponse.json(
        { error: 'Module administratif réservé à la phase de test.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const documentId = body?.documentId

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Document manquant.' },
        { status: 400 }
      )
    }

    const { data: document, error: documentError } = await supabase
      .from('administrative_documents')
      .select('id, user_id, storage_bucket, storage_path, vault_protected')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (documentError || !document) {
      return NextResponse.json(
        { error: 'Document introuvable ou inaccessible.' },
        { status: 404 }
      )
    }

    if (document.vault_protected) {
      const vaultAccessToken = request.headers.get('x-vault-access-token')
      if (!verifyVaultAccessToken(vaultAccessToken, user.id)) {
        return NextResponse.json(
          { error: 'Ce document est dans le coffre. Déverrouille le coffre avec ton code PIN avant de le supprimer.' },
          { status: 403 }
        )
      }
    }

    if (document.storage_bucket && document.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(document.storage_bucket)
        .remove([document.storage_path])

      if (storageError) {
        console.error('[admin documents delete] storage remove failed', storageError)

        return NextResponse.json(
          { error: 'Impossible de supprimer le fichier associé.' },
          { status: 500 }
        )
      }
    }

    const { error: deleteError } = await supabase
      .from('administrative_documents')
      .delete()
      .eq('id', document.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[admin documents delete] row delete failed', deleteError)

      return NextResponse.json(
        { error: 'Le fichier a été supprimé, mais la ligne en base n’a pas pu être supprimée.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document supprimé.',
    })
  } catch (error) {
    console.error('[admin documents delete] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la suppression du document.' },
      { status: 500 }
    )
  }
}