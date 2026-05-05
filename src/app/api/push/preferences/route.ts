import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { cookie: cookieHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const preferences = await req.json()

    // Filtrer pour ne garder que les colonnes valides
    const allowedKeys = [
      'notif_routines',
      'notif_conflits',
      'notif_communaute',
      'notif_anniversaires',
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

    // Update toutes les souscriptions de cet user
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .update(updates)
      .eq('user_id', user.id)
      .select()

    if (error) {
      console.error('[push/preferences] Erreur Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[push/preferences] Preferences mises a jour pour user:', user.id, updates)
    return NextResponse.json({ success: true, count: data?.length || 0 })
  } catch (err) {
    console.error('[push/preferences] Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}