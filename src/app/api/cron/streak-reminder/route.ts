// app/api/cron/streak-reminder/route.ts
// CORRECTIONS P0 :
//  1) Migration OneSignal → push natif Web Push (notifyUser). L'app a migré vers
//     le push natif ; l'ancien envoi OneSignal échouait silencieusement.
//  2) Ciblage corrigé : on relance les utilisatrices qui ont MANQUÉ un ou plusieurs
//     jours récents (de 1 à 10 jours), au lieu de ne viser que celles actives HIER.
//     L'ancienne logique excluait définitivement quelqu'un dès le premier jour manqué
//     — exactement l'inverse de l'objectif. Désormais on rattrape les absentes.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

export const runtime = 'nodejs'
export const maxDuration = 60

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET = process.env.CRON_SECRET!

// Renvoie la date à Paris décalée de `offsetDays` jours, au format YYYY-MM-DD.
function parisDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const p = fmt.formatToParts(d)
  const y = p.find((x) => x.type === 'year')?.value
  const m = p.find((x) => x.type === 'month')?.value
  const day = p.find((x) => x.type === 'day')?.value
  return `${y}-${m}-${day}`
}

export async function GET(req: NextRequest) {
  // Sécuriser le cron via header Authorization (Vercel l'ajoute automatiquement)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const yesterday = parisDate(-1) // a manqué AU MOINS aujourd'hui
  const tenDaysAgo = parisDate(-10) // borne basse : on ne harcèle pas les absentes de longue date

  // Cibler : dernière activité entre il y a 10 jours et hier (donc ABSENTE aujourd'hui).
  // On rattrape aussi bien celle qui a manqué un seul jour que celle qui décroche depuis quelques jours.
  const { data: candidates, error } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, last_activity_date')
    .gte('last_activity_date', tenDaysAgo)
    .lte('last_activity_date', yesterday)

  if (error) {
    console.error('[cron streak-reminder] query error', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No candidates' })
  }

  const messages = [
    'Ta flamme veille sur toi 🕯️ Une minute pour elle aujourd\'hui ?',
    'Un instant pour toi, un instant pour elle. ✦',
    'Ta flamme t\'attend doucement. Tu reviens quand tu veux.',
  ]

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const c of candidates) {
    const message = messages[Math.floor(Math.random() * messages.length)]
    try {
      const res = await notifyUser({
        userId: c.user_id,
        type: 'streak_reminder',
        title: 'NOVAÉ',
        body: message,
        url: '/',
        // Respecte la préférence de relance de l'utilisatrice si elle l'a désactivée.
        preferenceKey: 'notif_inactivite',
      })
      if ((res as any)?.skipped) skipped++
      else sent++
    } catch (e) {
      console.error('[cron streak-reminder] notify failed', c.user_id, e)
      failed++
    }
  }

  return NextResponse.json({
    candidates: candidates.length,
    sent,
    skipped,
    failed,
  })
}