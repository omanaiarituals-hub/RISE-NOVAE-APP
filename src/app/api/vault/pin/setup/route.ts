import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { verifyVaultAccessToken } from '@/lib/vault/tokens'

export const runtime = 'nodejs'
export const maxDuration = 30

const PIN_REGEX = /^\d{4,8}$/

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

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString('hex')
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
        { error: 'Module coffre réservé à la phase de test.' },
        { status: 403 }
      )
    }

    const adminClient = getServiceRoleClient()

    const body = await request.json().catch(() => null)
    const pin = body?.pin
    const confirmPin = body?.confirmPin

    if (typeof pin !== 'string' || typeof confirmPin !== 'string') {
      return NextResponse.json(
        { error: 'Code PIN manquant.' },
        { status: 400 }
      )
    }

    if (pin !== confirmPin) {
      return NextResponse.json(
        { error: 'Les deux codes PIN ne correspondent pas.' },
        { status: 400 }
      )
    }

    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: 'Le code PIN doit contenir entre 4 et 8 chiffres.' },
        { status: 400 }
      )
    }

    // Si un PIN existe déjà, exiger l'ancien PIN ou un coffre déverrouillé
    // (jeton valide). Sans cela, n'importe quelle session pouvait écraser le PIN.
    const { data: existingSettings } = await adminClient
      .from('user_security_settings')
      .select('vault_pin_hash, vault_pin_salt')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingSettings?.vault_pin_hash && existingSettings?.vault_pin_salt) {
      const vaultToken = request.headers.get('x-vault-access-token')
      const hasValidToken = verifyVaultAccessToken(vaultToken, user.id)

      let currentPinValid = false
      const currentPin = body?.currentPin
      if (typeof currentPin === 'string' && PIN_REGEX.test(currentPin)) {
        const expected = Buffer.from(existingSettings.vault_pin_hash, 'hex')
        const received = Buffer.from(hashPin(currentPin, existingSettings.vault_pin_salt), 'hex')
        currentPinValid = expected.length === received.length && timingSafeEqual(expected, received)
      }

      if (!hasValidToken && !currentPinValid) {
        return NextResponse.json(
          { error: 'Un code PIN existe déjà. Fournis l’ancien code PIN ou déverrouille le coffre pour le modifier.' },
          { status: 403 }
        )
      }
    }

    const salt = randomBytes(32).toString('hex')
    const pinHash = hashPin(pin, salt)
    const now = new Date().toISOString()

    const { error: upsertError } = await adminClient
      .from('user_security_settings')
      .upsert({
        user_id: user.id,
        vault_pin_hash: pinHash,
        vault_pin_salt: salt,
        vault_pin_created_at: now,
        vault_pin_updated_at: now,
        vault_failed_attempts: 0,
        vault_locked_until: null,
        updated_at: now,
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('[vault pin setup] upsert failed', upsertError)

      return NextResponse.json(
        { error: 'Impossible de créer le code PIN du coffre.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Code PIN coffre créé.',
    })
  } catch (error) {
    console.error('[vault pin setup] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la création du code PIN.' },
      { status: 500 }
    )
  }
}