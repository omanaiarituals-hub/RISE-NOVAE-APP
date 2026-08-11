// src/app/api/cron/morning/route.ts
// NOVAÉ V2 — brief matin recentré sur la vie réelle de l'utilisatrice.
// Les anciennes relances liées au programme 90 jours et aux phases ont été retirées.
// Ce cron ne fait plus d'appel IA ni d'email Brevo : coût borné et comportement prévisible.

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

function parisDate(offsetDays = 0): string {
  const now = new Date()
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted)

  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function makeTodayBounds(today: string) {
  return {
    start: `${today}T00:00:00+00:00`,
    end: `${today}T23:59:59+00:00`,
  }
}

type PlannerEventRow = {
  user_id: string
  title: string | null
  status: string | null
  start_minutes: number | null
}

type FamilyRow = {
  user_id: string
  data: Record<string, unknown> | null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = parisDate(0)
  const tomorrow = parisDate(1)
  const todayBounds = makeTodayBounds(today)
  const results: string[] = []
  const errors: string[] = []

  try {
    // 1. Reset quotidien des routines terminées les jours précédents.
    const { error: resetError } = await supabaseAdmin
      .from('routines')
      .update({ completed: false })
      .eq('completed', true)
      .lt('last_completed_at', `${today}T00:00:00+00:00`)

    if (resetError) {
      console.error('[cron/morning] routine reset failed:', resetError.message)
      errors.push(`routine_reset:${resetError.message}`)
    } else {
      results.push('routine_reset')
    }

    // 2. Utilisatrices qui ont au moins une souscription push.
    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
      .limit(1000)

    if (subsError) {
      throw new Error(`Push subscriptions unavailable: ${subsError.message}`)
    }

    const userIds = Array.from(
      new Set((subs || []).map((row) => String(row.user_id)).filter(Boolean))
    )

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, executed: results, errors, users: 0 })
    }

    // 3. Charger les événements du jour en une seule requête.
    // Pas de .in(userIds) ici : on évite de construire une grosse URL PostgREST.
    const { data: eventRows, error: eventsError } = await supabaseAdmin
      .from('planner_events')
      .select('user_id,title,status,start_minutes')
      .gte('start_date', todayBounds.start)
      .lte('start_date', todayBounds.end)
      .order('start_minutes', { ascending: true })
      .limit(5000)

    if (eventsError) {
      console.error('[cron/morning] planner events unavailable:', eventsError.message)
      errors.push(`planner_events:${eventsError.message}`)
    }

    const eventsByUser = new Map<string, PlannerEventRow[]>()
    const allowedUsers = new Set(userIds)

    for (const row of (eventRows || []) as PlannerEventRow[]) {
      if (!allowedUsers.has(String(row.user_id))) continue
      const list = eventsByUser.get(String(row.user_id)) || []
      list.push(row)
      eventsByUser.set(String(row.user_id), list)
    }

    // 4. Éviter un doublon de brief si le cron est rejoué le même jour.
    const { data: existingBriefRows } = await supabaseAdmin
      .from('notifications')
      .select('user_id,type')
      .eq('type', 'morning_brief')
      .gte('created_at', todayBounds.start)
      .lte('created_at', todayBounds.end)
      .limit(2000)

    const alreadyBriefed = new Set(
      (existingBriefRows || []).map((row) => String(row.user_id))
    )

    for (const userId of userIds) {
      if (alreadyBriefed.has(userId)) continue

      const pending = (eventsByUser.get(userId) || []).filter(
        (event) => event.status !== 'completed' && event.status !== 'cancelled'
      )

      let body: string
      if (pending.length === 0) {
        body = "Rien à signaler dans ton planning aujourd'hui. Tu peux garder de la place pour le reste ✦"
      } else {
        const titles = pending
          .slice(0, 3)
          .map((event) => (event.title || '').trim())
          .filter(Boolean)
          .join(' · ')
        const extra = pending.length > 3 ? ` +${pending.length - 3}` : ''
        body = titles
          ? `Aujourd'hui : ${titles}${extra}.`
          : `${pending.length} chose${pending.length > 1 ? 's' : ''} prévue${pending.length > 1 ? 's' : ''} aujourd'hui.`
      }

      try {
        const result = await notifyUser({
          userId,
          type: 'morning_brief',
          title: "☀️ Aujourd'hui",
          body,
          url: '/',
          icon: '/icon-192x192.png',
          preferenceKey: 'notif_routines',
        })

        if (!('skipped' in result) || !result.skipped) {
          results.push(`morning_brief:${userId}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[cron/morning] brief failed:', userId, message)
        errors.push(`morning_brief:${userId}:${message}`)
      }
    }

    // 5. Anniversaires : utile dans la V2, donc conservé.
    const { data: families, error: familyError } = await supabaseAdmin
      .from('family_data')
      .select('user_id,data')
      .eq('is_active', true)
      .limit(5000)

    if (familyError) {
      console.error('[cron/morning] family data unavailable:', familyError.message)
      errors.push(`family_data:${familyError.message}`)
    }

    const parseMonthDay = (dateStr: unknown) => {
      if (!dateStr) return null
      const parts = String(dateStr).split('-').map(Number)
      if (parts.length < 3 || !parts[1] || !parts[2]) return null
      return { month: parts[1], day: parts[2] }
    }

    const [, todayMonth, todayDay] = today.split('-').map(Number)
    const [, tomorrowMonth, tomorrowDay] = tomorrow.split('-').map(Number)
    const in7 = parisDate(7)
    const [, in7Month, in7Day] = in7.split('-').map(Number)

    // Note : tomorrowMonth/tomorrowDay est volontairement calculé ici pour garder
    // la fonction de date testable ; pas utilisé pour le moment.
    void tomorrowMonth
    void tomorrowDay

    for (const member of (families || []) as FamilyRow[]) {
      if (!allowedUsers.has(String(member.user_id))) continue

      const data = member.data || {}
      const date = parseMonthDay(data.birthDate || data.birthday)
      if (!date) continue

      const memberName = String(data.firstName || data.name || 'Un proche')

      if (date.month === in7Month && date.day === in7Day) {
        try {
          await notifyUser({
            userId: String(member.user_id),
            type: 'birthday_reminder_7',
            title: '🎁 Anniversaire dans 7 jours',
            body: `${memberName} fête bientôt son anniversaire. Pense au cadeau si besoin ✦`,
            url: '/family',
            icon: '/icon-192x192.png',
            preferenceKey: 'notif_anniversaires',
          })
          results.push(`birthday_7:${member.user_id}`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`birthday_7:${member.user_id}:${message}`)
        }
      }

      if (date.month === todayMonth && date.day === todayDay) {
        try {
          await notifyUser({
            userId: String(member.user_id),
            type: 'birthday_reminder_0',
            title: `🎂 Anniversaire de ${memberName}`,
            body: "C'est aujourd'hui ✦",
            url: '/family',
            icon: '/icon-192x192.png',
            preferenceKey: 'notif_anniversaires',
          })
          results.push(`birthday_0:${member.user_id}`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push(`birthday_0:${member.user_id}:${message}`)
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      users: userIds.length,
      executed: results.length,
      errors,
    })
  } catch (error) {
    console.error('[cron/morning] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
