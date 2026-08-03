import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set([
  'nesserinesediri@gmail.com',
  'omanaiarituals@gmail.com',
])

type CountRow = { user_id?: string | null; created_at?: string | null }

type OptionalQueryResult<T> = {
  data: T[]
  error: string | null
}

async function optionalRows<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
): Promise<OptionalQueryResult<T>> {
  try {
    const { data, error } = await promise
    return { data: data || [], error: error?.message || null }
  } catch (error) {
    return {
      data: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

function uniqueUsers(rows: CountRow[]): number {
  return new Set(rows.map((row) => row.user_id).filter(Boolean)).size
}

export async function GET(request: NextRequest) {
  const token = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()

  if (!token) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Configuration Supabase serveur incomplète' },
      { status: 500 }
    )
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token)

  if (
    authError ||
    !user?.email ||
    !ADMIN_EMAILS.has(user.email.toLowerCase())
  ) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const url = new URL(request.url)
  const rawDays = Number.parseInt(url.searchParams.get('days') || '30', 10)
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30
  const now = Date.now()
  const since = new Date(now - days * 86_400_000).toISOString()
  const since24h = new Date(now - 86_400_000).toISOString()
  const since7d = new Date(now - 7 * 86_400_000).toISOString()

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [
    landingResult,
    waitlistResult,
    usersResult,
    novaResult,
    tasksResult,
    plannerResult,
    notesResult,
    mealsResult,
  ] = await Promise.all([
    optionalRows(
      db
        .from('landing_events')
        .select('event_type,event_label,session_id,referrer,utm_source,utm_medium,utm_campaign,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10_000)
    ),
    optionalRows(
      db
        .from('waitlist_signups')
        .select('email_normalized,source,status,consent_marketing,brevo_status,confirmation_sent_at,created_at,updated_at')
        .order('created_at', { ascending: false })
        .limit(5_000)
    ),
    optionalRows(
      db
        .from('users')
        .select('id,email,onboarding_completed,subscription_tier,subscription_status,created_at')
        .order('created_at', { ascending: false })
        .limit(5_000)
    ),
    optionalRows(
      db
        .from('nova_conversations')
        .select('user_id,created_at')
        .gte('created_at', since)
        .limit(10_000)
    ),
    optionalRows(
      db
        .from('todo_list')
        .select('user_id,created_at')
        .gte('created_at', since)
        .limit(10_000)
    ),
    optionalRows(
      db
        .from('planner_events')
        .select('user_id,created_at')
        .gte('created_at', since)
        .limit(10_000)
    ),
    optionalRows(
      db
        .from('notes')
        .select('user_id,created_at')
        .gte('created_at', since)
        .limit(10_000)
    ),
    optionalRows(
      db
        .from('meal_plan')
        .select('user_id,created_at')
        .gte('created_at', since)
        .limit(10_000)
    ),
  ])

  const landing = landingResult.data as Array<{
    event_type: string
    event_label: string | null
    session_id: string | null
    referrer: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    created_at: string
  }>
  const waitlist = waitlistResult.data as Array<{
    email_normalized: string | null
    source: string | null
    status: string | null
    consent_marketing: boolean | null
    brevo_status: string | null
    confirmation_sent_at: string | null
    created_at: string
    updated_at: string | null
  }>
  const users = usersResult.data as Array<{
    id: string
    email: string | null
    onboarding_completed: boolean | null
    subscription_tier: string | null
    subscription_status: string | null
    created_at: string
  }>

  const pageViews = landing.filter((row) => row.event_type === 'page_view')
  const clicks = landing.filter((row) => row.event_type === 'cta_click')
  const scrolls = landing.filter((row) => row.event_type === 'scroll_depth')
  const visitorSessions = new Set(pageViews.map((row) => row.session_id).filter(Boolean))
  const clickingSessions = new Set(clicks.map((row) => row.session_id).filter(Boolean))

  const ctaMap = new Map<string, number>()
  for (const row of clicks) {
    const key = row.event_label || 'non_renseigné'
    ctaMap.set(key, (ctaMap.get(key) || 0) + 1)
  }

  const sourceMap = new Map<string, number>()
  for (const row of pageViews) {
    const key = row.utm_source || 'direct / non attribué'
    sourceMap.set(key, (sourceMap.get(key) || 0) + 1)
  }

  const referrerMap = new Map<string, number>()
  for (const row of pageViews) {
    let key = 'direct'
    if (row.referrer) {
      try {
        key = new URL(row.referrer).hostname || row.referrer
      } catch {
        key = row.referrer
      }
    }
    referrerMap.set(key, (referrerMap.get(key) || 0) + 1)
  }

  const sessionDepth = new Map<string, number>()
  for (const row of scrolls) {
    if (!row.session_id) continue
    const depth = Number.parseInt(row.event_label || '0', 10)
    if (!Number.isFinite(depth)) continue
    sessionDepth.set(row.session_id, Math.max(sessionDepth.get(row.session_id) || 0, depth))
  }

  const waitlistEmails = new Set(
    waitlist.map((row) => row.email_normalized?.toLowerCase()).filter(Boolean)
  )
  const userEmails = new Set(users.map((row) => row.email?.toLowerCase()).filter(Boolean))
  const betaConverted = [...waitlistEmails].filter((email) => userEmails.has(email)).length

  const recentWaitlist = waitlist
    .slice(0, 50)
    .map((row) => ({
      email: row.email_normalized || '',
      source: row.source || 'non renseignée',
      status: row.status || 'inconnu',
      brevoStatus: row.brevo_status || 'non renseigné',
      consentMarketing: Boolean(row.consent_marketing),
      createdAt: row.created_at,
    }))

  const waitlistSources = new Map<string, number>()
  for (const row of waitlist) {
    const key = row.source || 'non renseignée'
    waitlistSources.set(key, (waitlistSources.get(key) || 0) + 1)
  }

  const createdInPeriod = users.filter((row) => row.created_at >= since)
  const onboardingCompleted = users.filter((row) => row.onboarding_completed).length
  const premiumUsers = users.filter(
    (row) => row.subscription_tier === 'premium' && row.subscription_status === 'active'
  ).length

  const warnings = [
    ['landing_events', landingResult.error],
    ['waitlist_signups', waitlistResult.error],
    ['users', usersResult.error],
    ['nova_conversations', novaResult.error],
    ['todo_list', tasksResult.error],
    ['planner_events', plannerResult.error],
    ['notes', notesResult.error],
    ['meal_plan', mealsResult.error],
  ]
    .filter(([, error]) => Boolean(error))
    .map(([table, error]) => `${table}: ${error}`)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    period: { days, since },
    landing: {
      pageViews: pageViews.length,
      uniqueVisitors: visitorSessions.size,
      totalClicks: clicks.length,
      clickingVisitors: clickingSessions.size,
      visitorToClickRate: pct(clickingSessions.size, visitorSessions.size),
      pageViews24h: pageViews.filter((row) => row.created_at >= since24h).length,
      pageViews7d: pageViews.filter((row) => row.created_at >= since7d).length,
      scroll50Rate: pct([...sessionDepth.values()].filter((depth) => depth >= 50).length, visitorSessions.size),
      scroll75Rate: pct([...sessionDepth.values()].filter((depth) => depth >= 75).length, visitorSessions.size),
      scroll100Rate: pct([...sessionDepth.values()].filter((depth) => depth >= 100).length, visitorSessions.size),
      ctaBreakdown: [...ctaMap.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      sources: [...sourceMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      referrers: [...referrerMap.entries()]
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    },
    beta: {
      total: waitlist.length,
      last24h: waitlist.filter((row) => row.created_at >= since24h).length,
      last7d: waitlist.filter((row) => row.created_at >= since7d).length,
      inPeriod: waitlist.filter((row) => row.created_at >= since).length,
      marketingConsentRate: pct(
        waitlist.filter((row) => row.consent_marketing).length,
        waitlist.length
      ),
      brevoSyncedRate: pct(
        waitlist.filter((row) => row.brevo_status === 'synced').length,
        waitlist.length
      ),
      convertedToAccount: betaConverted,
      betaToAccountRate: pct(betaConverted, waitlistEmails.size),
      sources: [...waitlistSources.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      recent: recentWaitlist,
    },
    product: {
      totalAccounts: users.length,
      accountsCreatedInPeriod: createdInPeriod.length,
      onboardingCompleted,
      onboardingRate: pct(onboardingCompleted, users.length),
      premiumUsers,
      premiumRate: pct(premiumUsers, users.length),
      nova: {
        actions: novaResult.data.length,
        activeUsers: uniqueUsers(novaResult.data as CountRow[]),
      },
      tasks: {
        actions: tasksResult.data.length,
        activeUsers: uniqueUsers(tasksResult.data as CountRow[]),
      },
      planner: {
        actions: plannerResult.data.length,
        activeUsers: uniqueUsers(plannerResult.data as CountRow[]),
      },
      notes: {
        actions: notesResult.data.length,
        activeUsers: uniqueUsers(notesResult.data as CountRow[]),
      },
      meals: {
        actions: mealsResult.data.length,
        activeUsers: uniqueUsers(mealsResult.data as CountRow[]),
      },
    },
    warnings,
  })
}
