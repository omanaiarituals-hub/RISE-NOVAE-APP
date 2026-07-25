import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { verifyVaultAccessToken } from '@/lib/vault/tokens'

export const runtime = 'nodejs'
export const maxDuration = 30

const SIGNED_URL_DURATION_SECONDS = 60

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
            // Server Component context: safe to ignore.
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

export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document manquant.' },
        { status: 400 }
      )
    }

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

    const { data: document, error: documentError } = await supabase
      .from('administrative_documents')
      .select('id, user_id, storage_bucket, storage_path, original_filename, file_mime_type, vault_protected, sensitivity_level')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (documentError || !document) {
      return NextResponse.json(
        { error: 'Document introuvable ou inaccessible.' },
        { status: 404 }
      )
    }

    if (!document.storage_path || !document.storage_bucket) {
      return NextResponse.json(
        { error: 'Chemin du document manquant.' },
        { status: 404 }
      )
    }

    if (document.vault_protected) {
  const vaultAccessToken = request.headers.get('x-vault-access-token')

  if (!verifyVaultAccessToken(vaultAccessToken, user.id)) {
    return NextResponse.json(
      {
        error: 'Code PIN coffre requis pour ouvrir ce document.',
        requiresVaultPin: true,
      },
      { status: 403 }
    )
  }
}

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, SIGNED_URL_DURATION_SECONDS)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('[admin documents view] signed url failed', signedUrlError)

      return NextResponse.json(
        { error: "Impossible d'ouvrir ce document pour le moment." },
        { status: 500 }
      )
    }

    return NextResponse.json({
  success: true,
  signedUrl: signedUrlData.signedUrl,
  expiresIn: SIGNED_URL_DURATION_SECONDS,
  filename: document.original_filename,
  mimeType: document.file_mime_type,
  vaultProtected: document.vault_protected,
  sensitivityLevel: document.sensitivity_level,
})
  } catch (error) {
    console.error('[admin documents view] unexpected error', error)

    return NextResponse.json(
      { error: "Erreur inattendue pendant l'ouverture du document." },
      { status: 500 }
    )
  }
}