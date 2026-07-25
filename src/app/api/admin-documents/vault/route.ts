import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { verifyVaultAccessToken } from '@/lib/vault/tokens'

export const runtime = 'nodejs'
export const maxDuration = 30

type SensitivityLevel = 'standard' | 'sensitive' | 'very_sensitive'

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

function isSensitivityLevel(value: unknown): value is SensitivityLevel {
  return value === 'standard' || value === 'sensitive' || value === 'very_sensitive'
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
    const vaultProtected = body?.vaultProtected
    const sensitivityLevel = body?.sensitivityLevel || 'sensitive'

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Document manquant.' },
        { status: 400 }
      )
    }

    if (typeof vaultProtected !== 'boolean') {
      return NextResponse.json(
        { error: 'Choix coffre invalide.' },
        { status: 400 }
      )
    }

    if (!isSensitivityLevel(sensitivityLevel)) {
      return NextResponse.json(
        { error: 'Niveau de sensibilité invalide.' },
        { status: 400 }
      )
    }

    if (vaultProtected) {
      const vaultAccessToken = request.headers.get('x-vault-access-token')

      if (!verifyVaultAccessToken(vaultAccessToken, user.id)) {
        return NextResponse.json(
          {
            error: 'Code PIN coffre requis pour protéger ce document.',
            requiresVaultPin: true,
          },
          { status: 403 }
        )
      }
    }

    const { data, error: updateError } = await supabase
      .from('administrative_documents')
      .update({
        vault_protected: vaultProtected,
        sensitivity_level: vaultProtected ? sensitivityLevel : 'standard',
        added_to_vault_at: vaultProtected ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', user.id)
      .select('id, vault_protected, sensitivity_level, added_to_vault_at')
      .single()

    if (updateError || !data) {
      console.error('[admin documents vault] update failed', updateError)

      return NextResponse.json(
        { error: 'Impossible de modifier la protection coffre de ce document.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: data,
    })
  } catch (error) {
    console.error('[admin documents vault] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la modification du coffre.' },
      { status: 500 }
    )
  }
}