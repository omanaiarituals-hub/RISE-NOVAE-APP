import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { scryptSync, timingSafeEqual } from 'crypto'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { createVaultAccessToken } from '@/lib/vault/tokens'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

const PIN_REGEX = /^\d{4,8}$/
const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 10
const PIN_VERIFY_MAX_PER_HOUR = 10

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

function hashPin(pin: string, salt: string): Buffer {
  return scryptSync(pin, salt, 64)
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

    const rl = await rateLimit(adminClient, user.id, 'vault_pin_verify', {
      max: PIN_VERIFY_MAX_PER_HOUR,
      windowMinutes: 60,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives de déverrouillage. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const pin = body?.pin

    if (typeof pin !== 'string' || !PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: 'Code PIN invalide.' },
        { status: 400 }
      )
    }

    const { data: settings, error: settingsError } = await adminClient
      .from('user_security_settings')
      .select('user_id, vault_pin_hash, vault_pin_salt, vault_failed_attempts, vault_locked_until')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      return NextResponse.json(
        { error: 'Impossible de vérifier le code PIN.' },
        { status: 500 }
      )
    }

    if (!settings?.vault_pin_hash || !settings?.vault_pin_salt) {
      return NextResponse.json(
        { error: 'Aucun code PIN coffre n’a encore été créé.' },
        { status: 404 }
      )
    }

    const lockedUntil = settings.vault_locked_until
      ? new Date(settings.vault_locked_until)
      : null

    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: 'Coffre temporairement bloqué après plusieurs erreurs de code PIN.',
          lockedUntil: settings.vault_locked_until,
        },
        { status: 423 }
      )
    }

    const expectedHash = Buffer.from(settings.vault_pin_hash, 'hex')
    const receivedHash = hashPin(pin, settings.vault_pin_salt)

    const isValid =
      expectedHash.length === receivedHash.length &&
      timingSafeEqual(expectedHash, receivedHash)

    if (!isValid) {
      const { data: failureState, error: failureError } = await adminClient.rpc(
        'record_vault_pin_failure',
        {
          p_user_id: user.id,
          p_max_attempts: MAX_FAILED_ATTEMPTS,
          p_lock_minutes: LOCK_DURATION_MINUTES,
        }
      )

      if (failureError) {
        console.error('[vault pin verify] failed to record PIN failure', failureError.message)
        return NextResponse.json({ error: 'Impossible de vérifier le code PIN.' }, { status: 500 })
      }

      const state = Array.isArray(failureState) ? failureState[0] : failureState
      const failedAttempts = Number(state?.failed_attempts || MAX_FAILED_ATTEMPTS)
      const lockedUntilValue = typeof state?.locked_until === 'string' ? state.locked_until : null
      const shouldLock = Boolean(lockedUntilValue)

      return NextResponse.json(
        {
          error: shouldLock
            ? 'Trop de codes incorrects. Le coffre est bloqué temporairement.'
            : 'Code PIN incorrect.',
          remainingAttempts: shouldLock ? 0 : Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts),
          lockedUntil: lockedUntilValue,
        },
        { status: shouldLock ? 423 : 401 }
      )
    }

    await adminClient
      .from('user_security_settings')
      .update({
        vault_failed_attempts: 0,
        vault_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({
  success: true,
  unlockDurationMinutes: 5,
  vaultAccessToken: createVaultAccessToken(user.id),
  message: 'Coffre déverrouillé.',
})
  } catch (error) {
    console.error('[vault pin verify] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la vérification du code PIN.' },
      { status: 500 }
    )
  }
}