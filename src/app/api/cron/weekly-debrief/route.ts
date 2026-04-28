import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: users } = await supabase
      .from('program_progress')
      .select('user_id')
      .not('user_id', 'is', null)

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users found' })
    }

    const today = new Date()
    const weekNumber = Math.ceil(today.getDate() / 7)
    const results = []

    for (const { user_id } of users) {
      try {
        const [tasksRes, routinesRes, progressRes] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', user_id).eq('status', 'completed'),
          supabase.from('routines').select('*').eq('user_id', user_id).eq('completed', true),
          supabase.from('program_progress').select('*').eq('user_id', user_id).single()
        ])

        const stats = {
          tasks_done: tasksRes.data?.length || 0,
          routines_done: routinesRes.data?.length || 0,
          program_day: progressRes.data?.current_day || 0
        }

        // Génère le bilan via Claude
        const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: `Tu es NOVAÉ. Génère un bilan hebdomadaire court et motivant (max 150 mots) basé sur ces stats : ${JSON.stringify(stats)}. Donne 3 axes d'amélioration concrets. Tutoie l'utilisatrice.`
            }]
          })
        })

        const aiData = await aiResponse.json()
        const debriefText = aiData.content?.[0]?.text || 'Bilan non disponible'

        // Sauvegarde en base
        await supabase.from('weekly_debriefs').upsert({
          user_id,
          week_number: weekNumber,
          week_start: today.toISOString().split('T')[0],
          debrief_text: debriefText,
          stats,
          created_at: new Date().toISOString()
        })

        // Notif OneSignal
        await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
          },
          body: JSON.stringify({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            filters: [{ field: 'tag', key: 'user_id', relation: '=', value: user_id }],
            headings: { fr: '✦ Ton bilan de la semaine est prêt' },
            contents: { fr: `${stats.routines_done} routines · ${stats.tasks_done} tâches · Jour ${stats.program_day}/90 ✦` },
            url: 'https://novae-by-omanaia.com/agent',
            web_buttons: [{
              id: 'voir-bilan',
              text: 'Voir mon bilan',
              url: 'https://novae-by-omanaia.com/agent'
            }]
          })
        })

        results.push({ user_id, status: 'ok', stats })
      } catch (err) {
        results.push({ user_id, status: 'error', error: String(err) })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}