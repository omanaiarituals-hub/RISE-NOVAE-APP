// src/app/api/cron/reminder/route.ts
// Envoie les rappels du planner et les rappels Nova rattachés aux tâches.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parisWallTimeToUtc(dateStr: string, minutesLocal: number): Date {
  const datePart = dateStr.indexOf('T') >= 0 ? dateStr.split('T')[0] : dateStr
  const parts = datePart.split('-')
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  const h = Math.floor(minutesLocal / 60)
  const mi = minutesLocal % 60

  let utcMs = Date.UTC(y, mo - 1, d, h, mi, 0)
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  for (let i = 0; i < 2; i++) {
    const p = fmt.formatToParts(new Date(utcMs))
    const get = (type: string) => {
      const found = p.find((item) => item.type === type)
      return found ? Number(found.value) : 0
    }
    const wallMs = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute')
    )
    const desiredMs = Date.UTC(y, mo - 1, d, h, mi)
    utcMs += desiredMs - wallMs
  }

  return new Date(utcMs)
}

async function processPlannerReminders(now: Date, userIds: string[]) {
  const sent: string[] = []
  const errors: string[] = []
  if (userIds.length === 0) return { sent, errors }

  const { data: events, error } = await supabaseAdmin
    .from('planner_events')
    .select('id, user_id, title, start_date, start_minutes, end_minutes, reminder_minutes_before')
    .in('user_id', userIds)
    .eq('reminder_sent', false)
    .not('reminder_minutes_before', 'eq', '{}')

  if (error) throw new Error(`Lecture des rappels planner impossible : ${error.message}`)

  for (const ev of events || []) {
    const reminderMins: number = ev.reminder_minutes_before?.[0]
    if (!reminderMins) continue

    const eventStart = parisWallTimeToUtc(ev.start_date, ev.start_minutes)
    const reminderAt = new Date(eventStart.getTime() - reminderMins * 60 * 1000)
    const diffMs = reminderAt.getTime() - now.getTime()
    if (diffMs < -3 * 60 * 1000 || diffMs > 3 * 60 * 1000) continue

    let delayLabel = ''
    if (reminderMins >= 10080) delayLabel = 'dans 1 semaine'
    else if (reminderMins >= 2880) delayLabel = 'dans 2 jours'
    else if (reminderMins >= 1440) delayLabel = 'demain'
    else if (reminderMins >= 120) delayLabel = `dans ${Math.round(reminderMins / 60)}h`
    else if (reminderMins >= 60) delayLabel = 'dans 1h'
    else delayLabel = `dans ${reminderMins} min`

    const h = String(Math.floor(ev.start_minutes / 60)).padStart(2, '0')
    const m = String(ev.start_minutes % 60).padStart(2, '0')

    try {
      await notifyUser({
        userId: ev.user_id,
        type: 'planner_reminder',
        title: `🔔 ${ev.title}`,
        body: `Commence à ${h}:${m} (${delayLabel})`,
        url: '/planner',
        icon: '/icon-192x192.png',
        preferenceKey: 'notif_conflits',
      })

      await supabaseAdmin
        .from('planner_events')
        .update({ reminder_sent: true, updated_at: new Date().toISOString() })
        .eq('id', ev.id)

      sent.push(`planner:${ev.id}`)
    } catch (err) {
      errors.push(`planner:${ev.id}:${err instanceof Error ? err.message : String(err)}`)
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

type TaskRow = {
  id: string
  title: string
  status: string
}

async function updateTaskReminder(
  reminderId: string,
  updates: Record<string, string | null>
) {
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

  if (error) throw new Error(`Lecture des rappels de tâches impossible : ${error.message}`)

  const reminders = (data || []) as TaskReminderRow[]
  if (reminders.length === 0) return { sent, errors }

  const taskIds = Array.from(new Set(reminders.map((reminder) => reminder.todo_id)))
  const { data: taskData, error: taskError } = await supabaseAdmin
    .from('todo_list')
    .select('id,title,status')
    .in('id', taskIds)

  if (taskError) throw new Error(`Lecture des tâches impossible : ${taskError.message}`)

  const tasks = new Map<string, TaskRow>()
  for (const task of (taskData || []) as TaskRow[]) tasks.set(task.id, task)

  for (const reminder of reminders) {
    const task = tasks.get(reminder.todo_id)
    if (!task) {
      await updateTaskReminder(reminder.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        failure_reason: 'task_missing',
      })
      continue
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      await updateTaskReminder(reminder.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        failure_reason: `task_${task.status}`,
      })
      continue
    }

    try {
      const notificationResult = await notifyUser({
        userId: reminder.user_id,
        type: 'task_reminder',
        title: `🔔 ${task.title}`,
        body: reminder.message || 'Tu voulais que je te rappelle cette tâche.',
        url: '/planner',
        icon: '/icon-192x192.png',
        preferenceKey: 'notif_conflits',
        metadata: {
          todoId: task.id,
          reminderId: reminder.id,
          scheduledFor: reminder.scheduled_for,
        },
      })

      if ('skipped' in notificationResult && notificationResult.skipped) {
        await updateTaskReminder(reminder.id, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          failure_reason: 'notification_preference_disabled',
        })
        continue
      }

      await updateTaskReminder(reminder.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        failure_reason: null,
      })
      sent.push(`task:${reminder.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`task:${reminder.id}:${message}`)
      await updateTaskReminder(reminder.id, {
        status: 'failed',
        failure_reason: message.slice(0, 500),
      })
    }
  }

  return { sent, errors }
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  try {
    const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')

    if (subscriptionError) {
      console.warn('[cron/reminder] push subscriptions unavailable', subscriptionError.message)
    }

    const subscriptionRows = (subscriptions || []) as Array<{ user_id: string }>
    const userIds: string[] = Array.from(
      new Set(subscriptionRows.map((subscription: { user_id: string }) => String(subscription.user_id)))
    )

    const planner = await processPlannerReminders(now, userIds)
    const tasks = await processTaskReminders(now)

    return NextResponse.json({
      sent: planner.sent.length + tasks.sent.length,
      errors: planner.errors.length + tasks.errors.length,
      planner: {
        sent: planner.sent.length,
        errors: planner.errors,
      },
      taskReminders: {
        sent: tasks.sent.length,
        errors: tasks.errors,
      },
    })
  } catch (err) {
    console.error('[cron/reminder] Erreur:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inconnue' },
      { status: 500 }
    )
  }
}
