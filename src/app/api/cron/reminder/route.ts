// src/app/api/cron/reminder/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  // Sécurité : vérifier le secret cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: string[] = []
  const errors: string[] = []

  try {
    // Récupère tous les users avec un abonnement push actif
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')

    if (!subs?.length) {
      return NextResponse.json({ sent: 0, message: 'Aucun abonnement push actif' })
    }

const uniqueUserIds = Array.from(new Set(subs.map(s => s.user_id)))

    for (const userId of uniqueUserIds) {
      // Cherche les événements avec rappel non encore envoyé
      const { data: events } = await supabaseAdmin
        .from('planner_events')
        .select('id, title, start_date, start_minutes, end_minutes, reminder_minutes_before')
        .eq('user_id', userId)
        .eq('reminder_sent', false)
        .not('reminder_minutes_before', 'eq', '{}')

      if (!events?.length) continue

      for (const ev of events) {
        const reminderMins: number = ev.reminder_minutes_before?.[0]
        if (!reminderMins) continue

        // Reconstruit l'heure de début exacte
        const eventStart = new Date(ev.start_date)
        eventStart.setHours(Math.floor(ev.start_minutes / 60))
        eventStart.setMinutes(ev.start_minutes % 60)
        eventStart.setSeconds(0)
        eventStart.setMilliseconds(0)

        // Heure à laquelle le rappel doit partir
        const reminderAt = new Date(eventStart.getTime() - reminderMins * 60 * 1000)

        // Fenêtre de ±3 minutes (le cron tourne toutes les 5 min)
        const diffMs = reminderAt.getTime() - now.getTime()
        if (diffMs < -3 * 60 * 1000 || diffMs > 3 * 60 * 1000) continue

        // Formatage du délai pour le message
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
            userId,
            type: 'planner_reminder',
            title: `🔔 ${ev.title}`,
            body: `Commence à ${h}:${m} (${delayLabel})`,
            url: '/planner',
            icon: '/icons/icon-192x192.png',
            preferenceKey: 'notify_reminders',
          })

          // Marque comme envoyé pour ne pas re-notifier
          await supabaseAdmin
            .from('planner_events')
            .update({ reminder_sent: true, updated_at: new Date().toISOString() })
            .eq('id', ev.id)

          results.push(`${userId.slice(0, 8)}… → "${ev.title}" (${delayLabel})`)
        } catch (err: any) {
          errors.push(`${userId.slice(0, 8)}… → ${ev.title}: ${err?.message}`)
        }
      }
    }

    return NextResponse.json({
      sent: results.length,
      errors: errors.length,
      details: results,
      ...(errors.length > 0 ? { errorDetails: errors } : {}),
    })

  } catch (err: any) {
    console.error('[cron/reminder] Erreur:', err)
    return NextResponse.json({ error: err?.message || 'Erreur inconnue' }, { status: 500 })
  }
}