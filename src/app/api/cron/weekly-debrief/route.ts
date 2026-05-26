// src/app/api/cron/weekly-debrief/route.ts
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

  const today = new Date()
  const weekNumber = Math.ceil(today.getDate() / 7)
  const results: any[] = []

  try {
    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('user_id')
    const uniqueUserIds = Array.from(new Set((subs || []).map(s => s.user_id)))

    for (const userId of uniqueUserIds) {
      try {
        const [tasksRes, routinesRes, progressRes] = await Promise.all([
          supabaseAdmin.from('tasks').select('id').eq('user_id', userId).eq('status', 'completed'),
          supabaseAdmin.from('routines').select('id').eq('user_id', userId).eq('completed', true),
          supabaseAdmin.from('program_progress').select('current_day').eq('user_id', userId).maybeSingle(),
        ])

        const stats = {
          tasks_done: tasksRes.data?.length || 0,
          routines_done: routinesRes.data?.length || 0,
          program_day: progressRes.data?.current_day || 0,
        }

        // Génération via Claude Haiku
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: `Tu es NOVAÉ. Génère un bilan hebdomadaire court et motivant (max 150 mots) basé sur ces stats : ${JSON.stringify(stats)}. Donne 3 axes d'amélioration concrets. Tutoie l'utilisatrice.`,
            }],
          }),
        })
        const aiData = await aiResponse.json()
        const debriefText = aiData.content?.[0]?.text || 'Bilan non disponible'

        await supabaseAdmin.from('weekly_debriefs').upsert({
          user_id: userId,
          week_number: weekNumber,
          week_start: today.toISOString().split('T')[0],
          debrief_text: debriefText,
          stats,
          created_at: new Date().toISOString(),
        })

        await notifyUser({
          userId,
          type: 'weekly_debrief',
          title: '✦ Ton bilan de la semaine est prêt',
          body: `${stats.routines_done} routines · ${stats.tasks_done} tâches · Jour ${stats.program_day}/90`,
          url: '/profil?tab=bilans',
          preferenceKey: 'notif_bilan',
        })

        results.push({ user_id: userId, status: 'ok', stats })
      } catch (err) {
        results.push({ user_id: userId, status: 'error', error: String(err) })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}