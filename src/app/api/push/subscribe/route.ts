import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/request-auth'

const PREF_COLUMNS = [
  'notif_morning_brief',
  'notif_evening_prepare',
  'notif_weekly_review',
  'notif_planner_reminders',
  'notif_communaute',
  'notif_anniversaires',
] as const

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { endpoint, keys, userAgent } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Donnees souscription incompletes' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Les préférences sont globales à l'utilisatrice : un nouveau téléphone
    // reprend les choix déjà enregistrés sur ses autres souscriptions.
    const { data: existing } = await supabaseAdmin
      .from('push_subscriptions')
      .select(PREF_COLUMNS.join(','))
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const inheritedPrefs: Record<string, boolean> = {}
    const existingPrefs = existing as unknown as Partial<Record<(typeof PREF_COLUMNS)[number], boolean>> | null
    for (const key of PREF_COLUMNS) {
      const value = existingPrefs?.[key]
      if (typeof value === 'boolean') inheritedPrefs[key] = value
    }

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent || null,
          last_used_at: new Date().toISOString(),
          ...inheritedPrefs,
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single()

    if (error) {
      console.error('[push/subscribe] Erreur Supabase:', error.message)
      return NextResponse.json({ error: 'Impossible d\'enregistrer les notifications' }, { status: 500 })
    }

    return NextResponse.json({ success: true, subscription: data })
  } catch (err) {
    console.error('[push/subscribe] Exception:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
