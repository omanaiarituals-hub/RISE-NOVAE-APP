import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const preferences = await req.json()
    const allowedKeys = [
      'notif_morning_brief',
      'notif_evening_prepare',
      'notif_weekly_review',
      'notif_planner_reminders',
      'notif_communaute',
      'notif_anniversaires',
      // Compatibilité avec les anciennes clés pendant la transition.
      'notif_routines',
      'notif_conflits',
      'notif_inactivite',
      'notif_bilan',
    ]

    const updates: Record<string, boolean> = {}
    for (const key of allowedKeys) {
      if (key in preferences && typeof preferences[key] === 'boolean') {
        updates[key] = preferences[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune preference valide' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .update(updates)
      .eq('user_id', user.id)
      .select('id')

    if (error) {
      console.error('[push/preferences] Erreur Supabase:', error.message)
      return NextResponse.json({ error: 'Impossible de mettre à jour les notifications' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: data?.length || 0 })
  } catch (err) {
    console.error('[push/preferences] Exception:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
