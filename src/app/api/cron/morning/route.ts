// src/app/api/cron/morning/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push/notify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const results: string[] = []

  try {
    // Users uniques avec au moins une souscription push
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
    const uniqueUserIds = Array.from(new Set((subs || []).map(s => s.user_id)))

    // ─── 1. BRIEF MATIN AVEC RÉCAP DU JOUR ──────────────────────────────
    for (const userId of uniqueUserIds) {
      // Tâches du jour (on lit la table `tasks`, celle qu'affiche le Planner)
      const { data: todayTasks } = await supabaseAdmin
        .from('tasks')
        .select('title, status, start_hour')
        .eq('user_id', userId)
        .eq('date', today)
        .order('start_hour', { ascending: true })

      const pending = (todayTasks || []).filter(t => t.status !== 'completed')

      // Jour de programme
      const { data: progress } = await supabaseAdmin
        .from('program_progress')
        .select('current_day')
        .eq('user_id', userId)
        .maybeSingle()

      // Construction du récap (court, lisible dans une notif)
      let body = ''
      if (progress?.current_day) body += `Jour ${progress.current_day}/90. `

      if (pending.length > 0) {
        const titles = pending
          .slice(0, 3)
          .map(t => (t.title || '').trim())
          .filter(Boolean)
          .join(', ')
        const extra = pending.length > 3 ? ` +${pending.length - 3}` : ''
        body += `Au programme : ${titles}${extra}. `
      } else {
        body += "Aucune tâche prévue, journée libre. "
      }
      body += "Bon rituel du matin ✦"

      await notifyUser({
        userId,
        type: 'morning_brief',
        title: '☀️ Ton récap du jour',
        body,
        url: '/program',
        preferenceKey: 'notif_routines',
      })
      results.push(`Brief matin → ${userId} (${pending.length} tâches)`)
    }

    // ─── 2. ANNIVERSAIRES (J-7 et J) ───────────────────────────────────
    const { data: families } = await supabaseAdmin
      .from('family_data')
      .select('user_id, data')
      .eq('is_active', true)

    const todayMonth = now.getUTCMonth() + 1
    const todayDay = now.getUTCDate()
    const in7 = new Date(now); in7.setUTCDate(in7.getUTCDate() + 7)
    const t7Month = in7.getUTCMonth() + 1
    const t7Day = in7.getUTCDate()

    for (const member of families || []) {
      const data = member.data as any
      const dateStr = data?.birthDate || data?.birthday
      if (!dateStr) continue
      const parts = String(dateStr).split('-').map(Number)
      if (parts.length < 3) continue
      const [, bMonth, bDay] = parts
      const memberName = data.firstName || data.name || 'Un proche'

      if (bMonth === t7Month && bDay === t7Day) {
        await notifyUser({
          userId: member.user_id,
          type: 'birthday_reminder_7',
          title: '🎁 Anniversaire dans 7 jours',
          body: `${memberName} fête son anniversaire le ${t7Day}/${t7Month}. Pense au cadeau ! ✦`,
          url: '/family',
          preferenceKey: 'notif_anniversaires',
        })
        results.push(`Anniv J-7 ${memberName} → ${member.user_id}`)
      }
      if (bMonth === todayMonth && bDay === todayDay) {
        await notifyUser({
          userId: member.user_id,
          type: 'birthday_reminder_0',
          title: `🎂 C'est l'anniversaire de ${memberName}`,
          body: `Pense à lui souhaiter aujourd'hui ! ✦`,
          url: '/family',
          preferenceKey: 'notif_anniversaires',
        })
        results.push(`Anniv J ${memberName} → ${member.user_id}`)
      }
    }

    // ─── 3. INACTIVITÉ J+2, J+5, J+10 → redirige vers agent IA ─────────
    const date2 = new Date(now); date2.setUTCDate(date2.getUTCDate() - 2)
    const date5 = new Date(now); date5.setUTCDate(date5.getUTCDate() - 5)
    const date10 = new Date(now); date10.setUTCDate(date10.getUTCDate() - 10)
    const str2 = date2.toISOString().split('T')[0]
    const str5 = date5.toISOString().split('T')[0]
    const str10 = date10.toISOString().split('T')[0]

    const { data: inactives } = await supabaseAdmin
      .from('user_progress')
      .select('user_id, last_active_date, current_streak')
      .lt('last_active_date', str2)

    for (const u of inactives || []) {
      const last = u.last_active_date
      const streakMsg = u.current_streak > 0
        ? `Tu avais ${u.current_streak} jour${u.current_streak > 1 ? 's' : ''} de streak. `
        : ''

      if (last <= str10) {
        await notifyUser({
          userId: u.user_id,
          type: 'inactivity_10',
          title: '💌 NOVAÉ t\'attend toujours',
          body: 'Si quelque chose te bloque, parle-en à ton coach IA, il a une solution douce ✦',
          url: '/agent',
          preferenceKey: 'notif_inactivite',
        })
        results.push(`Inactivité J+10 → ${u.user_id}`)
      } else if (last <= str5) {
        await notifyUser({
          userId: u.user_id,
          type: 'inactivity_5',
          title: '🌿 5 jours sans toi',
          body: `${streakMsg}Ton coach IA peut t'aider à reprendre en douceur ✦`,
          url: '/agent',
          preferenceKey: 'notif_inactivite',
        })
        results.push(`Inactivité J+5 → ${u.user_id}`)
      } else if (last <= str2) {
        await notifyUser({
          userId: u.user_id,
          type: 'inactivity_2',
          title: '🌸 On reprend le rythme ?',
          body: `${streakMsg}Ton coach IA t'attend pour démarrer ✦`,
          url: '/agent',
          preferenceKey: 'notif_inactivite',
        })
        results.push(`Inactivité J+2 → ${u.user_id}`)
      }
    }

    return NextResponse.json({ success: true, executed: results, count: results.length })
  } catch (error) {
    console.error('[cron/morning] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}