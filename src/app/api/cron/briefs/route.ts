// src/app/api/cron/briefs/route.ts
// NOVAÉ V2 — briefs utiles, personnalisables et sans appel IA.
// Exécuté toutes les 5 minutes ; chaque utilisatrice reçoit le brief selon
// son heure locale. Les reçus en base rendent le traitement idempotent.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type UserPrefs = {
  notification_morning_time?: string
  notification_evening_time?: string
  notification_weekly_day?: number
  notification_weekly_time?: string
  timezone?: string
}

type PushPrefs = {
  user_id: string
  notif_morning_brief: boolean | null
  notif_evening_prepare: boolean | null
  notif_weekly_review: boolean | null
}

type PlannerRow = {
  user_id: string
  title: string | null
  start_minutes: number | null
  location: string | null
  status: string | null
}

type TaskRow = {
  user_id: string
  title: string | null
  description: string | null
  due_date: string | null
  due_time: string | null
  status: string | null
  completed_at?: string | null
}

type LocalClock = {
  date: string
  weekday: number
  minutes: number
}

const PREP_RE = /\b(prendre|apporter|prépar|prepar|document|dossier|papier|ordonnance|sac|affaires|tenue|matériel|materiel|équipement|equipement|imprimer|récupér|recuper|chercher)\b/i

function validTime(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^([0-1]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

function safeTimezone(value: unknown): string {
  const candidate = typeof value === 'string' ? value : 'Europe/Paris'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return 'Europe/Paris'
  }
}

function localClock(now: Date, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const hour = Number(get('hour')) % 24
  const minute = Number(get('minute'))

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: weekdays[get('weekday')] ?? 0,
    minutes: hour * 60 + minute,
  }
}

function addDays(date: string, count: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + count, 12, 0, 0))
  return dt.toISOString().slice(0, 10)
}

function dueNow(currentMinutes: number, configured: string): boolean {
  const target = timeToMinutes(configured)
  const diff = currentMinutes - target
  return diff >= 0 && diff < 5
}

function eventLabel(row: PlannerRow): string {
  const title = (row.title || 'Événement').trim()
  if (typeof row.start_minutes !== 'number') return title
  const h = String(Math.floor(row.start_minutes / 60)).padStart(2, '0')
  const m = String(row.start_minutes % 60).padStart(2, '0')
  return `${h}:${m} ${title}`
}

async function claimReceipt(userId: string, type: string, periodKey: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('scheduled_notification_receipts').insert({
    user_id: userId,
    notification_type: type,
    period_key: periodKey,
  })

  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`receipt:${error.message}`)
}

async function releaseReceipt(userId: string, type: string, periodKey: string) {
  await supabaseAdmin
    .from('scheduled_notification_receipts')
    .delete()
    .eq('user_id', userId)
    .eq('notification_type', type)
    .eq('period_key', periodKey)
}

async function loadDayData(date: string) {
  const nextDate = addDays(date, 1)
  const [eventsRes, tasksRes] = await Promise.all([
    supabaseAdmin
      .from('planner_events')
      .select('user_id,title,start_minutes,location,status')
      .gte('start_date', `${date}T00:00:00`)
      .lt('start_date', `${nextDate}T00:00:00`)
      .order('start_minutes', { ascending: true })
      .limit(5000),
    supabaseAdmin
      .from('todo_list')
      .select('user_id,title,description,due_date,due_time,status')
      .eq('due_date', date)
      .in('status', ['pending', 'in_progress'])
      .limit(5000),
  ])

  if (eventsRes.error) throw new Error(`planner:${eventsRes.error.message}`)
  if (tasksRes.error) throw new Error(`tasks:${tasksRes.error.message}`)

  const events = new Map<string, PlannerRow[]>()
  for (const row of (eventsRes.data || []) as PlannerRow[]) {
    if (row.status === 'cancelled') continue
    const list = events.get(String(row.user_id)) || []
    list.push(row)
    events.set(String(row.user_id), list)
  }

  const tasks = new Map<string, TaskRow[]>()
  for (const row of (tasksRes.data || []) as TaskRow[]) {
    const list = tasks.get(String(row.user_id)) || []
    list.push(row)
    tasks.set(String(row.user_id), list)
  }

  return { events, tasks }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: string[] = []
  const errors: string[] = []

  try {
    const [subsRes, usersRes] = await Promise.all([
      supabaseAdmin
        .from('push_subscriptions')
        .select('user_id,notif_morning_brief,notif_evening_prepare,notif_weekly_review')
        .limit(2000),
      supabaseAdmin
        .from('users')
        .select('id,preferences')
        .limit(1000),
    ])

    if (subsRes.error) throw new Error(`subscriptions:${subsRes.error.message}`)
    if (usersRes.error) throw new Error(`users:${usersRes.error.message}`)

    const pushPrefs = new Map<string, PushPrefs>()
    for (const row of (subsRes.data || []) as PushPrefs[]) {
      if (!pushPrefs.has(String(row.user_id))) pushPrefs.set(String(row.user_id), row)
    }

    const users = new Map<string, UserPrefs>()
    for (const row of (usersRes.data || []) as Array<{ id: string; preferences: UserPrefs | null }>) {
      if (pushPrefs.has(String(row.id))) users.set(String(row.id), row.preferences || {})
    }

    const morningDue: Array<{ userId: string; date: string }> = []
    const eveningDue: Array<{ userId: string; date: string; tomorrow: string }> = []
    const weeklyDue: Array<{ userId: string; date: string }> = []

    for (const [userId, prefs] of Array.from(users.entries())) {
      const push = pushPrefs.get(userId)
      if (!push) continue

      const tz = safeTimezone(prefs.timezone)
      const clock = localClock(now, tz)
      const morning = validTime(prefs.notification_morning_time, '07:00')
      const evening = validTime(prefs.notification_evening_time, '19:00')
      const weeklyTime = validTime(prefs.notification_weekly_time, '18:00')
      const weeklyDay = Number.isInteger(prefs.notification_weekly_day) ? Number(prefs.notification_weekly_day) : 0

      if ((push.notif_morning_brief ?? true) && dueNow(clock.minutes, morning)) {
        morningDue.push({ userId, date: clock.date })
      }
      if ((push.notif_evening_prepare ?? true) && dueNow(clock.minutes, evening)) {
        eveningDue.push({ userId, date: clock.date, tomorrow: addDays(clock.date, 1) })
      }
      if ((push.notif_weekly_review ?? true) && clock.weekday === weeklyDay && dueNow(clock.minutes, weeklyTime)) {
        weeklyDue.push({ userId, date: clock.date })
      }
    }

    const neededDates = new Set<string>()
    morningDue.forEach(x => neededDates.add(x.date))
    eveningDue.forEach(x => neededDates.add(x.tomorrow))
    const dayData = new Map<string, Awaited<ReturnType<typeof loadDayData>>>()
    for (const date of Array.from(neededDates)) dayData.set(date, await loadDayData(date))

    for (const item of morningDue) {
      const data = dayData.get(item.date)
      if (!data) continue
      const events = data.events.get(item.userId) || []
      const tasks = data.tasks.get(item.userId) || []
      const labels = [
        ...events.map(eventLabel),
        ...tasks.map(task => (task.title || 'Tâche').trim()),
      ].filter(Boolean)

      if (labels.length === 0) continue
      const type = 'morning_brief_v2'
      if (!(await claimReceipt(item.userId, type, item.date))) continue

      const shown = labels.slice(0, 4).join(' · ')
      const extra = labels.length > 4 ? ` +${labels.length - 4}` : ''
      try {
        await notifyUser({
          userId: item.userId,
          type,
          title: '☀️ Ton programme du jour',
          body: `Aujourd'hui : ${shown}${extra}.`,
          url: '/',
          icon: '/icon-192x192.png',
          preferenceKey: 'notif_morning_brief',
        })
        results.push(`morning:${item.userId}`)
      } catch (error) {
        await releaseReceipt(item.userId, type, item.date)
        errors.push(`morning:${item.userId}:${error instanceof Error ? error.message : String(error)}`)
      }
    }

    for (const item of eveningDue) {
      const data = dayData.get(item.tomorrow)
      if (!data) continue
      const events = (data.events.get(item.userId) || []).filter(event =>
        PREP_RE.test(`${event.title || ''} ${event.location || ''}`)
      )
      const tasks = (data.tasks.get(item.userId) || []).filter(task =>
        PREP_RE.test(`${task.title || ''} ${task.description || ''}`)
      )
      const labels = [
        ...events.map(event => (event.title || 'Événement').trim()),
        ...tasks.map(task => (task.title || 'Tâche').trim()),
      ].filter(Boolean)

      // Pas de notification du soir juste pour exister.
      if (labels.length === 0) continue
      const type = 'evening_prepare_v2'
      if (!(await claimReceipt(item.userId, type, item.date))) continue

      const shown = labels.slice(0, 3).join(' · ')
      const extra = labels.length > 3 ? ` +${labels.length - 3}` : ''
      try {
        await notifyUser({
          userId: item.userId,
          type,
          title: '🌙 Pour demain',
          body: `${shown}${extra}. Autant préparer ce qu'il faut ce soir ✦`,
          url: '/planner',
          icon: '/icon-192x192.png',
          preferenceKey: 'notif_evening_prepare',
        })
        results.push(`evening:${item.userId}`)
      } catch (error) {
        await releaseReceipt(item.userId, type, item.date)
        errors.push(`evening:${item.userId}:${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (weeklyDue.length > 0) {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [completedRes, openRes] = await Promise.all([
        supabaseAdmin
          .from('todo_list')
          .select('user_id,title,completed_at,status')
          .eq('status', 'completed')
          .gte('completed_at', oneWeekAgo)
          .limit(5000),
        supabaseAdmin
          .from('todo_list')
          .select('user_id,title,status')
          .in('status', ['pending', 'in_progress'])
          .limit(5000),
      ])

      if (completedRes.error) throw new Error(`weekly_completed:${completedRes.error.message}`)
      if (openRes.error) throw new Error(`weekly_open:${openRes.error.message}`)

      const completedByUser = new Map<string, number>()
      for (const row of completedRes.data || []) {
        const id = String(row.user_id)
        completedByUser.set(id, (completedByUser.get(id) || 0) + 1)
      }
      const openByUser = new Map<string, number>()
      for (const row of openRes.data || []) {
        const id = String(row.user_id)
        openByUser.set(id, (openByUser.get(id) || 0) + 1)
      }

      for (const item of weeklyDue) {
        const done = completedByUser.get(item.userId) || 0
        const open = openByUser.get(item.userId) || 0
        if (done === 0 && open === 0) continue

        const type = 'weekly_review_v2'
        if (!(await claimReceipt(item.userId, type, item.date))) continue
        try {
          await notifyUser({
            userId: item.userId,
            type,
            title: '✦ Ton point de semaine',
            body: `Cette semaine : ${done} tâche${done > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''}, ${open} encore ouverte${open > 1 ? 's' : ''}. Nova peut t'aider à replacer ce qui reste.`,
            url: '/nova-v2',
            icon: '/icon-192x192.png',
            preferenceKey: 'notif_weekly_review',
          })
          results.push(`weekly:${item.userId}`)
        } catch (error) {
          await releaseReceipt(item.userId, type, item.date)
          errors.push(`weekly:${item.userId}:${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      due: { morning: morningDue.length, evening: eveningDue.length, weekly: weeklyDue.length },
      sent: results.length,
      errors,
    })
  } catch (error) {
    console.error('[cron/briefs] Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Erreur cron briefs' }, { status: 500 })
  }
}
