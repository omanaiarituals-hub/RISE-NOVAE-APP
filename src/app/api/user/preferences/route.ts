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
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const body = await req.json()
    const isValidTime = (t: string) => /^([0-1]\d|2[0-3]):[0-5]\d$/.test(t)

    const updates: Record<string, any> = {}
    if (body.routine_morning_time && isValidTime(body.routine_morning_time)) {
      updates.routine_morning_time = body.routine_morning_time
    }
    if (body.routine_evening_time && isValidTime(body.routine_evening_time)) {
      updates.routine_evening_time = body.routine_evening_time
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune preference valide' }, { status: 400 })
    }

    // Service role pour bypass RLS sur users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Merge avec les prefs existantes
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    const newPrefs = { ...(currentUser?.preferences || {}), ...updates }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ preferences: newPrefs, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      console.error('[user/preferences] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, preferences: newPrefs })
  } catch (err) {
    console.error('[user/preferences] Exception:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}