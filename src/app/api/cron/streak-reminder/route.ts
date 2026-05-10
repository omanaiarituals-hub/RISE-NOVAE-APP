import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;

function yesterdayParis(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const p = fmt.formatToParts(now);
  const y = p.find((x) => x.type === 'year')?.value;
  const m = p.find((x) => x.type === 'month')?.value;
  const d = p.find((x) => x.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  // Sécuriser le cron via header Authorization
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const yesterday = yesterdayParis();

  // Cibler : dernière activité = hier, streak >= 1
  const { data: candidates, error } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, freezes_remaining')
    .eq('last_activity_date', yesterday)
    .gte('current_streak', 1);

  if (error) {
    console.error('[cron streak-reminder] query error', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No candidates' });
  }

  const userIds = candidates.map((c) => c.user_id);

  // Envoi OneSignal — un push à tous les userIds éligibles
  const messages = [
    'Ta flamme veille sur toi 🕯️ Une minute pour elle aujourd\'hui ?',
    'Un instant pour toi, un instant pour elle. ✦',
    'Ta flamme t\'attend doucement. Tu reviens ?',
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  const onesignalRes = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: userIds,
      headings: { fr: 'NOVAÉ', en: 'NOVAÉ' },
      contents: { fr: message, en: message },
      url: 'https://novae-by-omanaia.com/',
    }),
  });

  const onesignalData = await onesignalRes.json();

  return NextResponse.json({
    sent: userIds.length,
    onesignal: onesignalData,
  });
}