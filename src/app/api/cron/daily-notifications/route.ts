import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sendNotification = async (filters: any[], title: string, message: string, url: string) => {
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      filters,
      headings: { fr: title },
      contents: { fr: message },
      url: `https://novae-by-omanaia.com${url}`,
    })
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const hour = new Date().getUTCHours()

  try {
    // 7h UTC = 9h FR — Mission du jour
    if (hour === 7) {
      const { data: users } = await supabase
        .from('program_progress')
        .select('user_id, current_day')
        .not('user_id', 'is', null)

      for (const u of users || []) {
        await sendNotification(
          [{ field: 'tag', key: 'user_id', relation: '=', value: u.user_id }],
          '🎯 Ta mission du jour t\'attend',
          `Jour ${u.current_day}/90 — Commence ta journée avec intention. ✦`,
          '/program'
        )
      }
    }

    // 18h UTC = 20h FR — Rappel routine soir
    if (hour === 18) {
      await sendNotification(
        [{ field: 'tag', key: 'user_id', relation: 'exists' }],
        '🌙 Ta routine du soir',
        'Prends 10 minutes pour toi avant de dormir. Tu le mérites. ✦',
        '/routines'
      )
    }

    // 7h30 UTC = 9h30 FR — Défi du jour
    if (hour === 7) {
      await sendNotification(
        [{ field: 'tag', key: 'user_id', relation: 'exists' }],
        '🏆 Le défi du jour est lancé',
        'Un petit pas aujourd\'hui, une grande transformation demain. ✦',
        '/defis'
      )
    }

    return NextResponse.json({ success: true, hour })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}