// src/app/api/cron/reminder/route.ts
// CORRECTIFS (audit 02/07/2026) :
//  1) BUG TIMEZONE : l'heure de l'événement était reconstruite avec setHours()
//     dans le fuseau du serveur (UTC sur Vercel), alors que start_minutes est
//     une heure LOCALE Paris. Résultat : rappels envoyés 1h (hiver) ou 2h (été)
//     trop tard. On convertit désormais explicitement Paris → UTC.
//  2) BUG ICÔNE : le push référençait /icons/icon-192x192.png qui n'existe pas
//     (le fichier est à la racine : /icon-192x192.png). Icône cassée corrigée.
//  3) PERF : une seule requête planner_events pour tous les users au lieu
//     d'une requête par user (élimine N requêtes par exécution, le cron
//     tourne 288 fois/jour).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Convertit une date (YYYY-MM-DD) + des minutes locales Paris
 * en instant UTC exact, en tenant compte de l'heure d'été/hiver.
 * Compatible target ES5 (pas de regex unicode, pas de lib externe).
 */
function parisWallTimeToUtc(dateStr: string, minutesLocal: number): Date {
  const datePart = dateStr.indexOf('T') >= 0 ? dateStr.split('T')[0] : dateStr
  const parts = datePart.split('-')
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  const h = Math.floor(minutesLocal / 60)
  const mi = minutesLocal % 60

  // Première estimation : on suppose que l'heure locale = UTC
  let utcMs = Date.UTC(y, mo - 1, d, h, mi, 0)

  // On corrige (deux passes pour les bords de changement d'heure) :
  // on regarde quelle heure il est à Paris à cet instant estimé,
  // puis on décale de la différence avec l'heure voulue.
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
    const get = (t: string) => {
      const found = p.find((x) => x.type === t)
      return found ? Number(found.value) : 0
    }
    const wallMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    const desiredMs = Date.UTC(y, mo - 1, d, h, mi)
    utcMs += desiredMs - wallMs
  }
  return new Date(utcMs)
}

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

    const uniqueUserIds = Array.from(new Set(subs.map((s) => s.user_id)))

    // UNE seule requête pour tous les événements en attente de rappel,
    // au lieu d'une requête par utilisatrice.
    const { data: events } = await supabaseAdmin
      .from('planner_events')
      .select('id, user_id, title, start_date, start_minutes, end_minutes, reminder_minutes_before')
      .in('user_id', uniqueUserIds)
      .eq('reminder_sent', false)
      .not('reminder_minutes_before', 'eq', '{}')

    if (!events?.length) {
      return NextResponse.json({ sent: 0, message: 'Aucun rappel en attente' })
    }

    for (const ev of events) {
      const reminderMins: number = ev.reminder_minutes_before?.[0]
      if (!reminderMins) continue

      // Heure de début exacte : start_minutes est une heure LOCALE Paris
      const eventStart = parisWallTimeToUtc(ev.start_date, ev.start_minutes)

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
          userId: ev.user_id,
          type: 'planner_reminder',
          title: `🔔 ${ev.title}`,
          body: `Commence à ${h}:${m} (${delayLabel})`,
          url: '/planner',
          icon: '/icon-192x192.png',
          preferenceKey: 'notif_conflits',
        })

        // Marque comme envoyé pour ne pas re-notifier
        await supabaseAdmin
          .from('planner_events')
          .update({ reminder_sent: true, updated_at: new Date().toISOString() })
          .eq('id', ev.id)

        results.push(`${String(ev.user_id).slice(0, 8)}… → "${ev.title}" (${delayLabel})`)
      } catch (err: any) {
        errors.push(`${String(ev.user_id).slice(0, 8)}… → ${ev.title}: ${err?.message}`)
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
