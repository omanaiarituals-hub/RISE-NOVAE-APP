// app/api/admin/metrics/brevo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ Doit correspondre à la liste dans app/admin/page.tsx + components/AdminTile.tsx
const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/metrics/brevo?days=7
 *
 * Récupère les stats agrégées Brevo pour la période.
 * Auth : Bearer token Supabase dans le header Authorization.
 * L'email du user doit être dans ADMIN_EMAILS.
 *
 * Retourne :
 * {
 *   period: { startDate, endDate, days },
 *   raw: { requests, delivered, uniqueOpens, uniqueClicks, hardBounces, softBounces },
 *   computed: { openRate, clickRate, bounceRate, deliveryRate }
 * }
 */
export async function GET(request: NextRequest) {
  // ─── 1) Vérification du token admin via Supabase ───
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

  // ─── 2) Période demandée (par défaut 7 jours) ───
  const url = new URL(request.url)
  const daysParam = parseInt(url.searchParams.get('days') || '7', 10)
  const days = isNaN(daysParam) || daysParam < 1 ? 7 : Math.min(daysParam, 90)

  const today = new Date()
  const endDate = today.toISOString().slice(0, 10)
  const startDateObj = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const startDate = startDateObj.toISOString().slice(0, 10)

  // ─── 3) Appel Brevo ───
  const brevoApiKey = process.env.BREVO_API_KEY
  if (!brevoApiKey) {
    return NextResponse.json({ error: 'BREVO_API_KEY non configurée' }, { status: 500 })
  }

  const brevoUrl = `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${startDate}&endDate=${endDate}`

  try {
    const response = await fetch(brevoUrl, {
      headers: {
        'api-key': brevoApiKey,
        'accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Erreur Brevo (${response.status})`, detail: text.slice(0, 300) },
        { status: 502 }
      )
    }

    const data = await response.json()

    const requests = Number(data.requests || 0)
    const delivered = Number(data.delivered || 0)
    const uniqueOpens = Number(data.uniqueOpens || 0)
    const uniqueClicks = Number(data.uniqueClicks || 0)
    const hardBounces = Number(data.hardBounces || 0)
    const softBounces = Number(data.softBounces || 0)
    const totalBounces = hardBounces + softBounces

    return NextResponse.json({
      period: { startDate, endDate, days },
      raw: {
        requests,
        delivered,
        uniqueOpens,
        uniqueClicks,
        hardBounces,
        softBounces,
        totalBounces,
      },
      computed: {
        openRate: delivered > 0 ? (uniqueOpens / delivered) * 100 : 0,
        clickRate: delivered > 0 ? (uniqueClicks / delivered) * 100 : 0,
        bounceRate: requests > 0 ? (totalBounces / requests) * 100 : 0,
        deliveryRate: requests > 0 ? (delivered / requests) * 100 : 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Échec appel Brevo', detail: err?.message || String(err) },
      { status: 502 }
    )
  }
}