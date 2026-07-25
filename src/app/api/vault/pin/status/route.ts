import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'

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
          } catch {}
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
        { error: 'Module coffre réservé à la phase de test.' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('user_security_settings')
      .select('vault_pin_hash, vault_locked_until')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Impossible de vérifier le statut du coffre.' },
        { status: 500 }
      )
    }

    const lockedUntil = data?.vault_locked_until ? new Date(data.vault_locked_until) : null
    const isLocked = lockedUntil ? lockedUntil.getTime() > Date.now() : false

    return NextResponse.json({
      success: true,
      hasPin: Boolean(data?.vault_pin_hash),
      isLocked,
      lockedUntil: data?.vault_locked_until || null,
    })
  } catch (error) {
    console.error('[vault pin status] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la vérification du coffre.' },
      { status: 500 }
    )
  }
}