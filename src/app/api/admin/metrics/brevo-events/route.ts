import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ Doit correspondre à la liste dans app/admin/page.tsx
const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/metrics/brevo-events?days=14&limit=500
 *
 * Liste des events Brevo (envois, ouvertures, clics, bounces) sur la période.
 * Auth : Bearer token Supabase + email dans ADMIN_EMAILS.
 */
export async function GET(request: NextRequest) {
  // ─── 1) Auth Supabase (même pattern que brevo/route.ts) ───
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ─── 2) Params ───
  const url = new URL(request.url)
  const limit = url.searchParams.get('limit') || '500'
  const days = url.searchParams.get('days') || '14'

  // ─── 3) Appel Brevo events ───
  const brevoApiKey = process.env.BREVO_API_KEY
  if (!brevoApiKey) {
    return NextResponse.json({ error: 'BREVO_API_KEY non configurée' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/events?limit=${limit}&days=${days}&sort=desc`,
      {
        headers: {
          'api-key': brevoApiKey,
          accept: 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Erreur Brevo (${response.status})`, detail: text.slice(0, 300) },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json({
      events: data.events || [],
      count: (data.events || []).length,
    })
  } catch (err: any) {
    console.error('[admin/brevo-events] error', err)
    return NextResponse.json(
      { error: 'Échec appel Brevo', detail: err?.message || String(err) },
      { status: 502 }
    )
  }
}