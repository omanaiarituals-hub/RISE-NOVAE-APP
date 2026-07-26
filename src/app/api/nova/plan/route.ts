import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNovaActionPlan } from '@/lib/nova-ai/router'
import { NOVA_PROVIDER_IDS, type NovaProviderPreference } from '@/lib/nova-ai/types'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

function labEnabled(): boolean {
  return process.env.NOVA_V2_LAB_ENABLED === 'true'
}

function allowedEmails(): string[] {
  return (process.env.NOVA_V2_LAB_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function POST(request: NextRequest) {
  if (!labEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const allowlist = allowedEmails()
    const email = user.email?.toLowerCase() || ''
    if (allowlist.length > 0 && !allowlist.includes(email)) {
      return NextResponse.json({ error: 'Accès au laboratoire refusé.' }, { status: 403 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const rl = await rateLimit(supabaseAdmin, user.id, 'nova_v2_lab', { max: 30, windowMinutes: 60 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop de tests en peu de temps. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const body = (await request.json()) as { message?: unknown; provider?: unknown }
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'Le message est obligatoire.' }, { status: 400 })
    }
    if (message.length > 5_000) {
      return NextResponse.json({ error: 'Le message est trop long pour ce laboratoire.' }, { status: 400 })
    }

    const providerIsKnown =
      typeof body.provider === 'string' &&
      (body.provider === 'auto' || (NOVA_PROVIDER_IDS as readonly string[]).includes(body.provider))
    const provider: NovaProviderPreference = providerIsKnown
      ? (body.provider as NovaProviderPreference)
      : 'auto'

    const result = await createNovaActionPlan(
      {
        message,
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        nowIso: new Date().toISOString(),
      },
      provider
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/nova/plan] error', error)
    return NextResponse.json(
      {
        error: 'nova_plan_failed',
        message: error instanceof Error ? error.message : 'Impossible d’analyser la demande.',
      },
      { status: 502 }
    )
  }
}
