import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper OneSignal ──────────────────────────────────────────────────────────
async function sendToUser(
  userId: string,
  title: string,
  message: string,
  url: string,
  category: string // pour respecter les préférences
) {
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      // Cibler l'utilisateur par son user_id (tag OneSignal)
      filters: [
        { field: 'tag', key: 'user_id', relation: '=', value: userId },
        // Respecter la préférence : si le tag de désactivation est à 'false' → ne pas envoyer
        { operator: 'AND' },
        { field: 'tag', key: `notif_${category}`, relation: '!=', value: 'false' },
      ],
      headings: { fr: title },
      contents: { fr: message },
      url: `https://app.novae-by-omanaia.com${url}`,
      small_icon: 'ic_stat_novae',
      android_channel_id: 'novae-default',
    }),
  })
}

async function sendBroadcast(
  title: string,
  message: string,
  url: string,
  category: string
) {
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      filters: [
        { field: 'tag', key: 'user_id', relation: 'exists' },
        { operator: 'AND' },
        { field: 'tag', key: `notif_${category}`, relation: '!=', value: 'false' },
      ],
      headings: { fr: title },
      contents: { fr: message },
      url: `https://app.novae-by-omanaia.com${url}`,
    }),
  })
}

// ── Cron principal ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Heure FR = UTC+2 en été, UTC+1 en hiver
  // On utilise l'heure UTC et on laisse le cron tourner chaque heure
  const hourUTC = now.getUTCHours()
  const minuteUTC = now.getUTCMinutes()
  // Heure FR approximative (UTC+2)
  const hourFR = (hourUTC + 2) % 24

  const results: string[] = []

  try {
    // ── 1. MISSION DU JOUR — 9h FR (7h UTC) ────────────────────────────────
    if (hourUTC === 7) {
      const { data: users } = await supabaseAdmin
        .from('program_progress')
        .select('user_id, current_day')
        .not('user_id', 'is', null)

      for (const u of users || []) {
        await sendToUser(
          u.user_id,
          '🎯 Ta mission du jour t\'attend',
          `Jour ${u.current_day}/90 — Commence ta journée avec intention. ✦`,
          '/program',
          'routines'
        )
      }
      results.push(`Mission du jour: ${users?.length || 0} envois`)
    }

    // ── 2. ROUTINES DYNAMIQUES — toutes les heures ──────────────────────────
    // On cherche toutes les routines avec preferred_time dans la prochaine heure
    // Ex : cron à 8h UTC → on cherche les routines entre 08:00 et 08:59 UTC
    const { data: allRoutines } = await supabaseAdmin
      .from('routines')
      .select('user_id, title, description, preferred_time, duration_minutes, category, frequency, custom_days')
      .not('preferred_time', 'is', null)

    const todayDayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getUTCDay()]

    for (const routine of allRoutines || []) {
      if (!routine.preferred_time) continue

      // Vérifier si la routine est prévue aujourd'hui
      if (routine.frequency !== 'daily') {
        const days = parseDays(routine.custom_days)
        if (!days.includes(todayDayKey)) continue
      }

      // Comparer l'heure UTC de la routine avec l'heure actuelle UTC
      const [rH, rM] = routine.preferred_time.split(':').map(Number)
      // Convertir l'heure FR de la routine en UTC (routine.preferred_time est en heure locale FR)
      const rHourUTC = (rH - 2 + 24) % 24 // FR → UTC (approximation)

      // Envoyer si on est dans la bonne heure et les bonnes minutes (fenêtre ±5 min)
      if (rHourUTC === hourUTC && Math.abs(rM - minuteUTC) <= 5) {
        const emoji = routine.description || (routine.category === 'morning' ? '☀️' : '🌙')
        const durText = routine.duration_minutes ? ` (${routine.duration_minutes}min)` : ''
        await sendToUser(
          routine.user_id,
          `${emoji} ${routine.title}`,
          `Ton rituel ${routine.category === 'morning' ? 'du matin' : 'du soir'} t'attend${durText}. ✦`,
          '/routines',
          'routines'
        )
        results.push(`Routine "${routine.title}" → user ${routine.user_id}`)
      }
    }

    // ── 3. RDV & ÉVÉNEMENTS PLANNING — 15 min avant ─────────────────────────
    // Chercher tous les événements qui commencent dans 15 minutes
    const todayStr = now.toISOString().split('T')[0]
    const targetMinutesUTC = hourUTC * 60 + minuteUTC + 15 // dans 15 min
    const targetHourFR = Math.floor(((targetMinutesUTC / 60) + 2) % 24)

    const { data: upcomingTasks } = await supabaseAdmin
      .from('tasks')
      .select('user_id, title, start_hour, duration_hours, category')
      .eq('date', todayStr)
      .eq('status', 'pending')
      .eq('start_hour', targetHourFR)

    for (const task of upcomingTasks || []) {
      await sendToUser(
        task.user_id,
        `📅 Dans 15 min : ${task.title}`,
        `Ton événement commence à ${String(task.start_hour).padStart(2, '0')}h00. Prépare-toi ! ✦`,
        '/planner',
        'conflits' // catégorie "conflits" = notifications planning
      )
      results.push(`RDV "${task.title}" → user ${task.user_id}`)
    }

    // ── 4. ANNIVERSAIRES FAMILLE — J-7 à 9h FR ──────────────────────────────
    if (hourUTC === 7) {
      const in7Days = new Date(now)
      in7Days.setUTCDate(in7Days.getUTCDate() + 7)
      const targetMonth = in7Days.getUTCMonth() + 1
      const targetDay = in7Days.getUTCDate()

      const { data: birthdays } = await supabaseAdmin
        .from('family_members')
        .select('user_id, name, birthday')
        .not('birthday', 'is', null)

      for (const member of birthdays || []) {
        if (!member.birthday) continue
        const [, bMonth, bDay] = member.birthday.split('-').map(Number)
        if (bMonth === targetMonth && bDay === targetDay) {
          await sendToUser(
            member.user_id,
            `🎂 Anniversaire dans 7 jours`,
            `${member.name} fête son anniversaire le ${targetDay}/${targetMonth}. Pense à préparer quelque chose ! ✦`,
            '/family',
            'anniversaires'
          )
          results.push(`Anniversaire ${member.name} → user ${member.user_id}`)
        }
      }
    }

    // ── 5. INACTIVITÉ — 48h, J+5, J+10 ─────────────────────────────────────
    if (hourUTC === 8) { // 10h FR — vérification quotidienne
      const today = now.toISOString().split('T')[0]

      // Calculer les dates seuils
      const date2 = new Date(now); date2.setUTCDate(date2.getUTCDate() - 2)
      const date5 = new Date(now); date5.setUTCDate(date5.getUTCDate() - 5)
      const date10 = new Date(now); date10.setUTCDate(date10.getUTCDate() - 10)

      const str2  = date2.toISOString().split('T')[0]
      const str5  = date5.toISOString().split('T')[0]
      const str10 = date10.toISOString().split('T')[0]

      const { data: inactiveUsers } = await supabaseAdmin
        .from('user_progress')
        .select('user_id, last_active_date, current_streak')
        .lt('last_active_date', str2) // inactive depuis au moins 48h

      for (const u of inactiveUsers || []) {
        const lastDate = u.last_active_date
        const streakMsg = u.current_streak > 0
          ? `Tu avais ${u.current_streak} jour${u.current_streak > 1 ? 's' : ''} de streak. `
          : ''

        // J+10 — dernier message, ton "breakup"
        if (lastDate <= str10) {
          await sendToUser(
            u.user_id,
            '💌 Je te laisse partir (si c\'est ce que tu veux)',
            'Mais si quelque chose t\'a bloquée, NOVAÉ t\'attend sans jugement. ✦',
            '/',
            'inactivite'
          )
          results.push(`Inactivité J+10 → user ${u.user_id}`)

        // J+5 — ton plus direct
        } else if (lastDate <= str5) {
          await sendToUser(
            u.user_id,
            '🌿 5 jours. Tu nous manques.',
            `${streakMsg}Tu avais dit vouloir changer quelque chose. NOVAÉ est toujours là. ✦`,
            '/',
            'inactivite'
          )
          results.push(`Inactivité J+5 → user ${u.user_id}`)

        // J+2 — rappel doux
        } else if (lastDate <= str2) {
          await sendToUser(
            u.user_id,
            '🌸 On reprend ?',
            `${streakMsg}NOVAÉ t'attend exactement là où tu l'as laissée. ✦`,
            '/',
            'inactivite'
          )
          results.push(`Inactivité J+2 → user ${u.user_id}`)
        }
      }
    }

    // ── 6. BILAN HEBDOMADAIRE — Dimanche 9h FR (7h UTC) ─────────────────────
    const isSunday = now.getUTCDay() === 0
    if (isSunday && hourUTC === 7) {
      await sendBroadcast(
        '📊 Ton bilan de la semaine',
        'Prends 5 minutes pour voir le chemin parcouru. Ton débrief hebdo t\'attend. ✦',
        '/program',
        'bilan'
      )
      results.push('Bilan hebdomadaire broadcast')
    }

    // ── 7. NOUVEAUX POSTS COMMUNAUTÉ — résumé quotidien à 18h FR (16h UTC) ───
    if (hourUTC === 16) {
      const oneDayAgo = new Date(now)
      oneDayAgo.setUTCDate(oneDayAgo.getUTCDate() - 1)

      const { count: newPostsCount } = await supabaseAdmin
        .from('community_posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo.toISOString())

      if (newPostsCount && newPostsCount > 0) {
        const { data: activeUsers } = await supabaseAdmin
          .from('user_progress')
          .select('user_id')
          .not('user_id', 'is', null)

        for (const u of activeUsers || []) {
          const msg = newPostsCount === 1
            ? '1 nouveau message t\'attend dans la communauté NOVAÉ. ✦'
            : `${newPostsCount} nouveaux messages t\'attendent dans la communauté NOVAÉ. ✦`

          await sendToUser(
            u.user_id,
            '💬 La communauté s\'anime',
            msg,
            '/community',
            'communaute'
          )
        }
        results.push(`Communauté résumé: ${newPostsCount} posts → ${activeUsers?.length || 0} users`)
      }
    }

    // ── 8. RAPPEL ROUTINE SOIR — 20h FR (18h UTC) ───────────────────────────
    if (hourUTC === 18) {
      await sendBroadcast(
        '🌙 Ta routine du soir',
        'Prends 10 minutes pour toi avant de dormir. Tu le mérites. ✦',
        '/routines',
        'routines'
      )
      results.push('Routine soir broadcast')
    }

    return NextResponse.json({
      success: true,
      hourUTC,
      hourFR,
      executed: results,
    })

  } catch (error) {
    console.error('Notifications cron error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDays(custom_days: any): string[] {
  if (!custom_days) return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  if (Array.isArray(custom_days)) return custom_days
  if (typeof custom_days !== 'string') return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  if (custom_days.startsWith('{')) {
    return custom_days.replace(/[{}]/g, '').split(',').map((d: string) => d.trim()).filter(Boolean)
  }
  try { return JSON.parse(custom_days) } catch {
    return custom_days.split(',').map((d: string) => d.trim())
  }
}