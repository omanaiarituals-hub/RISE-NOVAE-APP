// app/api/admin/metrics/landing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ⚠️ Doit correspondre à la liste dans app/admin/page.tsx
const ADMIN_EMAILS = ['nesserinesediri@gmail.com', 'omanaiarituals@gmail.com']

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/metrics/landing?days=7
 *
 * Retourne les stats agrégées de la landing page (page views, CTA clicks, etc.)
 * Auth : Bearer token Supabase dans le header Authorization.
 * L'email du user doit être dans ADMIN_EMAILS.
 */
export async function GET(request: NextRequest) {
  // ─── 1) Auth admin via Supabase ───
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

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await authClient.auth.getUser(token)
  if (authError || !user || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ─── 2) Période ───
  const url = new URL(request.url)
  const daysParam = parseInt(url.searchParams.get('days') || '7', 10)
  const days = isNaN(daysParam) || daysParam < 1 ? 7 : Math.min(daysParam, 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // ─── 3) Client Supabase authentifié (utilise le token user → respecte RLS admin) ───
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  try {
    // Récupère tous les events sur la période (max 5000 — largement suffisant)
    const { data: events, error: eventsError } = await supabase
      .from('landing_events')
      .select('event_type, event_label, session_id, referrer, utm_source, utm_medium, utm_campaign, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (eventsError) {
      return NextResponse.json({ error: 'Erreur Supabase', detail: eventsError.message }, { status: 500 })
    }

    const rows = events || []

    // Leads du quiz "charge mentale" (table à part, écrite par /api/test-charge-mentale)
    const { data: quizLeadsRows, error: quizError } = await supabase
      .from('quiz_leads')
      .select('email, total_score, profil, score_label, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200)

    if (quizError) {
      console.error('[admin/metrics/landing] Erreur quiz_leads:', quizError.message)
    }
    const quizLeads = quizLeadsRows || []

    // ─── 4) Agrégations ───
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    const pageViews = rows.filter(r => r.event_type === 'page_view')
    const ctaClicks = rows.filter(r => r.event_type === 'cta_click')
    const scrollEvents = rows.filter(r => r.event_type === 'scroll_depth')

    // Leads quiz : volumétrie + liste détaillée (la plus récente d'abord)
    const quizLeads24h = quizLeads.filter(l => new Date(l.created_at).getTime() > oneDayAgo).length
    const quizLeads7d  = quizLeads.filter(l => new Date(l.created_at).getTime() > sevenDaysAgo).length
    const quizProfilCount: Record<string, number> = {}
    quizLeads.forEach(l => {
      const p = l.profil || 'Non déterminé'
      quizProfilCount[p] = (quizProfilCount[p] || 0) + 1
    })

    // Page views par période
    const pageViews24h = pageViews.filter(r => new Date(r.created_at).getTime() > oneDayAgo).length
    const pageViews7d  = pageViews.filter(r => new Date(r.created_at).getTime() > sevenDaysAgo).length
    const pageViewsAll = pageViews.length

    // Unique visitors (par session_id distinct)
    const uniqueIn = (events: typeof rows, after: number) =>
      new Set(events.filter(r => new Date(r.created_at).getTime() > after && r.session_id).map(r => r.session_id)).size

    const uniqueVisitors24h = uniqueIn(pageViews, oneDayAgo)
    const uniqueVisitors7d  = uniqueIn(pageViews, sevenDaysAgo)
    const uniqueVisitorsAll = new Set(pageViews.filter(r => r.session_id).map(r => r.session_id)).size

    // CTA clicks breakdown par label
    const ctaByLabel: Record<string, number> = {}
    ctaClicks.forEach(r => {
      const label = r.event_label || 'unknown'
      ctaByLabel[label] = (ctaByLabel[label] || 0) + 1
    })
    const ctaBreakdown = Object.entries(ctaByLabel)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)

    // Top referrers
    const referrerCount: Record<string, number> = {}
    pageViews.forEach(r => {
      if (!r.referrer) return
      try {
        const host = new URL(r.referrer).hostname
        referrerCount[host] = (referrerCount[host] || 0) + 1
      } catch {
        referrerCount[r.referrer] = (referrerCount[r.referrer] || 0) + 1
      }
    })
    const topReferrers = Object.entries(referrerCount)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    const directVisits = pageViews.filter(r => !r.referrer).length

    // UTM breakdown
    const utmCount: Record<string, number> = {}
    pageViews.forEach(r => {
      if (!r.utm_source) return
      const key = `${r.utm_source}/${r.utm_medium || '–'}/${r.utm_campaign || '–'}`
      utmCount[key] = (utmCount[key] || 0) + 1
    })
    const utmBreakdown = Object.entries(utmCount)
      .map(([key, count]) => {
        const [source, medium, campaign] = key.split('/')
        return { source, medium, campaign, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // Conversion : sessions ayant fait au moins un cta_click
    const clickerSessions = new Set(ctaClicks.filter(r => r.session_id).map(r => r.session_id))
    const visitorSessions = new Set(pageViews.filter(r => r.session_id).map(r => r.session_id))
    const conversionRate = visitorSessions.size > 0
      ? (clickerSessions.size / visitorSessions.size) * 100
      : 0

    // Funnel principal : nav → hero_primary → final_primary
    const sessionEvents: Record<string, Set<string>> = {}
    ctaClicks.forEach(r => {
      if (!r.session_id || !r.event_label) return
      if (!sessionEvents[r.session_id]) sessionEvents[r.session_id] = new Set()
      sessionEvents[r.session_id].add(r.event_label)
    })
    const sessionsClickedHero  = Object.values(sessionEvents).filter(s => s.has('hero_primary')).length
    const sessionsClickedFinal = Object.values(sessionEvents).filter(s => s.has('final_primary')).length
    const sessionsClickedQuiz  = Object.values(sessionEvents).filter(s => s.has('hero_test')).length
    const sessionsClickedBlog  = Object.values(sessionEvents).filter(s => s.has('hero_blog')).length
    const sessionsClickedContact = Object.values(sessionEvents).filter(s => s.has('footer_contact')).length
    const sessionsClickedAnyMain = Object.values(sessionEvents).filter(s =>
      s.has('hero_primary') || s.has('final_primary') || s.has('mirror_cta') || s.has('community_cta') || s.has('nav_cta')
    ).length

    // Scroll depth — pourcentage de sessions qui ont scrollé jusqu'à X%
    const sessionDepth: Record<string, number> = {}
    scrollEvents.forEach(r => {
      if (!r.session_id || !r.event_label) return
      const d = parseInt(r.event_label, 10)
      if (!isNaN(d)) {
        sessionDepth[r.session_id] = Math.max(sessionDepth[r.session_id] || 0, d)
      }
    })
    const depthBuckets = { 25: 0, 50: 0, 75: 0, 100: 0 }
    Object.values(sessionDepth).forEach(d => {
      if (d >= 25) depthBuckets[25]++
      if (d >= 50) depthBuckets[50]++
      if (d >= 75) depthBuckets[75]++
      if (d >= 100) depthBuckets[100]++
    })

    return NextResponse.json({
      period: { days, since },
      pageViews: {
        last24h: pageViews24h,
        last7d:  pageViews7d,
        total:   pageViewsAll,
      },
      uniqueVisitors: {
        last24h: uniqueVisitors24h,
        last7d:  uniqueVisitors7d,
        total:   uniqueVisitorsAll,
      },
      cta: {
        totalClicks: ctaClicks.length,
        breakdown: ctaBreakdown,
        conversionRate,
        sessionsClickedAnyMain,
        sessionsClickedHero,
        sessionsClickedFinal,
        sessionsClickedQuiz,
        sessionsClickedBlog,
        sessionsClickedContact,
        totalSessions: visitorSessions.size,
      },
      traffic: {
        directVisits,
        topReferrers,
        utmBreakdown,
      },
      scrollDepth: {
        totalSessions: Object.keys(sessionDepth).length,
        reachedQuarter: depthBuckets[25],
        reachedHalf:    depthBuckets[50],
        reachedThreeQuarters: depthBuckets[75],
        reachedFull:    depthBuckets[100],
      },
      quiz: {
        total: quizLeads.length,
        last24h: quizLeads24h,
        last7d: quizLeads7d,
        profilBreakdown: Object.entries(quizProfilCount)
          .map(([profil, count]) => ({ profil, count }))
          .sort((a, b) => b.count - a.count),
        leads: quizLeads.map(l => ({
          email: l.email,
          score: l.total_score,
          profil: l.profil,
          scoreLabel: l.score_label,
          date: l.created_at,
        })),
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Échec calcul métriques', detail: err?.message || String(err) },
      { status: 500 }
    )
  }
}