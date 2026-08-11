// src/app/api/cron/reminder/route.ts
// NOVAÉ V2 — rappels Planner + rappels Nova rattachés aux tâches.
// Aucun .in(userIds) massif : on ne charge que les événements susceptibles
// d'avoir un rappel dans les 8 prochains jours, puis chaque rappel est idempotent.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parisDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function parisWallTimeToUtc(dateStr: string, minutesLocal: number): Date {
  const datePart = dateStr.indexOf('T') >= 0 ? dateStr.split('T')[0] : dateStr
  const [y, mo, d] = datePart.split('-').map(Number)
  const h = Math.floor(minutesLocal / 60)
  const mi = minutesLocal % 60

  let utcMs = Date.UTC(y, mo - 1, d, h, mi, 0)
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

  for (let i = 0; i < 2; i++) {
    const p = fmt.formatToParts(new Date(utcMs))
    const get = (type: string) => Number(p.find(item => item.type === type)?.value || 0)
    const wallMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    const desiredMs = Date.UTC(y, mo - 1, d, h, mi)
    utcMs += desiredMs - wallMs
  }

  return new Date(utcMs)
}

function delayLabel(minutes: number): string {
  if (minutes >= 10080) return 'dans 1 semaine'
  if (minutes >= 2880) return `dans ${Math.round(minutes / 1440)} jours`
  if (minutes >= 1440) return 'demain'
  if (minutes >= 120) return `dans ${Math.round(minutes / 60)}h`
  if (minutes >= 60) return 'dans 1h'
  return `dans ${minutes} min`
}

type PlannerRow = {
  id: string
  user_id: string
  title: string
  start_date: string
  start_minutes: number
  reminder_minutes_before: number[] | null
  status: string | null
}

async function claimPlannerReminder(event: PlannerRow, reminderMinutes: number): Promise<boolean> {
  const { error } = await supabaseAdmin.from('planner_event_reminder_receipts').insert({
    event_id: event.id,
    user_id: event.user_id,
    reminder_minutes_before: reminderMinutes,
    event_start: event.start_date,
  })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(error.message)
}

async function releasePlannerReminder(event: PlannerRow, reminderMinutes: number) {
  await supabaseAdmin
    .from('planner_event_reminder_receipts')
    .delete()
    .eq('event_id', event.id)
    .eq('reminder_minutes_before', reminderMinutes)
    .eq('event_start', event.start_date)
}

async function processPlannerReminders(now: Date) {
  const sent: string[] = []
  const errors: string[] = []
  const start = `${parisDate(0)}T00:00:00`
  const end = `${parisDate(8)}T23:59:59`

  const { data, error } = await supabaseAdmin
    .from('planner_events')
    .select('id,user_id,title,start_date,start_minutes,reminder_minutes_before,status')
    .gte('start_date', start)
    .lte('start_date', end)
    .not('reminder_minutes_before', 'eq', '{}')
    .order('start_date', { ascending: true })
    .limit(2000)

  if (error) throw new Error(`Lecture rappels planner impossible : ${error.message}`)

  for (const ev of (data || []) as PlannerRow[]) {
    if (ev.status === 'cancelled') continue
    const reminders = Array.from(new Set((ev.reminder_minutes_before || []).filter(v => Number.isFinite(v) && v > 0)))
    if (reminders.length === 0) continue

    const eventStart = parisWallTimeToUtc(ev.start_date, ev.start_minutes)
    for (const reminderMins of reminders) {
      const reminderAt = new Date(eventStart.getTime() - reminderMins * 60 * 1000)
      const diffMs = reminderAt.getTime() - now.getTime()
      if (diffMs < -3 * 60 * 1000 || diffMs > 3 * 60 * 1000) continue
      if (!(await claimPlannerReminder(ev, reminderMins))) continue

      const h = String(Math.floor(ev.start_minutes / 60)).padStart(2, '0')
      const m = String(ev.start_minutes % 60).padStart(2, '0')
      try {
        await notifyUser({
          userId: ev.user_id,
          type: 'planner_reminder',
          title: `🔔 ${ev.title}`,
          body: `Commence à ${h}:${m} (${delayLabel(reminderMins)})`,
          url: '/planner',
          icon: '/icon-192x192.png',
          preferenceKey: 'notif_planner_reminders',
          metadata: { eventId: ev.id, reminderMinutes: reminderMins },
        })
        sent.push(`planner:${ev.id}:${reminderMins}`)
      } catch (err) {
        await releasePlannerReminder(ev, reminderMins)
        errors.push(`planner:${ev.id}:${reminderMins}:${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return { sent, errors }
}

type TaskReminderRow = {
  id: string
  user_id: string
  todo_id: string
  scheduled_for: string
  message: string | null
}

type TaskRow = { id: string; title: string; status: string }

async function updateTaskReminder(reminderId: string, updates: Record<string, string | null>) {
  const { error } = await supabaseAdmin
    .from('task_reminders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', reminderId)
  if (error) throw new Error(error.message)
}

async function processTaskReminders(now: Date) {
  const sent: string[] = []
  const errors: string[] = []
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 3 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('task_reminders')
    .select('id,user_id,todo_id,scheduled_for,message')
    .eq('status', 'pending')
    .gte('scheduled_for', windowStart)
    .lte('scheduled_for', windowEnd)
    .order('scheduled_for', { ascending: true })
    .limit(200)

  if (error) throw new Error(`Lecture rappels tâches impossible : ${error.message}`)
  const reminders = (data || []) as TaskReminderRow[]
  if (reminders.length === 0) return { sent, errors }

  const taskIds = Array.from(new Set(reminders.map(r => r.todo_id)))
  const { data: taskData, error: taskError } = await supabaseAdmin
    .from('todo_list')
    .select('id,title,status')
    .in('id', taskIds)
  if (taskError) throw new Error(`Lecture tâches impossible : ${taskError.message}`)

  const tasks = new Map<string, TaskRow>()
  for (const task of (taskData || []) as TaskRow[]) tasks.set(task.id, task)

  for (const reminder of reminders) {
    const task = tasks.get(reminder.todo_id)
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      await updateTaskReminder(reminder.id, {
        status: 'cancelled', cancelled_at: new Date().toISOString(),
        failure_reason: task ? `task_${task.status}` : 'task_missing',
      })
      continue
    }

    try {
      const result = await notifyUser({
        userId: reminder.user_id,
        type: 'task_reminder',
        title: `🔔 ${task.title}`,
        body: reminder.message || 'Tu voulais que je te rappelle cette tâche.',
        url: '/planner',
        icon: '/icon-192x192.png',
        preferenceKey: 'notif_planner_reminders',
        metadata: { todoId: task.id, reminderId: reminder.id, scheduledFor: reminder.scheduled_for },
      })

      if ('skipped' in result && result.skipped) {
        await updateTaskReminder(reminder.id, {
          status: 'cancelled', cancelled_at: new Date().toISOString(),
          failure_reason: 'notification_preference_disabled',
        })
        continue
      }

      await updateTaskReminder(reminder.id, {
        status: 'sent', sent_at: new Date().toISOString(), failure_reason: null,
      })
      sent.push(`task:${reminder.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`task:${reminder.id}:${message}`)
      await updateTaskReminder(reminder.id, { status: 'failed', failure_reason: message.slice(0, 500) })
    }
  }

  return { sent, errors }
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  try {
    const [planner, tasks] = await Promise.all([
      processPlannerReminders(now),
      processTaskReminders(now),
    ])

    return NextResponse.json({
      sent: planner.sent.length + tasks.sent.length,
      errors: planner.errors.length + tasks.errors.length,
      planner: { sent: planner.sent.length, errors: planner.errors },
      taskReminders: { sent: tasks.sent.length, errors: tasks.errors },
    })
  } catch (err) {
    console.error('[cron/reminder] Erreur:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erreur cron reminder' }, { status: 500 })
  }
}
