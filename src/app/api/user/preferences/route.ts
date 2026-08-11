import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([0-1]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

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

    const body = await req.json()
    const updates: Record<string, string | number> = {}

    if (isValidTime(body.notification_morning_time)) {
      updates.notification_morning_time = body.notification_morning_time
    }
    if (isValidTime(body.notification_evening_time)) {
      updates.notification_evening_time = body.notification_evening_time
    }
    if (isValidTime(body.notification_weekly_time)) {
      updates.notification_weekly_time = body.notification_weekly_time
    }
    if (Number.isInteger(body.notification_weekly_day) && body.notification_weekly_day >= 0 && body.notification_weekly_day <= 6) {
      updates.notification_weekly_day = body.notification_weekly_day
    }
    if (isValidTimezone(body.timezone)) {
      updates.timezone = body.timezone
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune preference valide' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: currentUser, error: readError } = await supabaseAdmin
      .from('users')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (readError) {
      return NextResponse.json({ error: 'Impossible de lire les preferences' }, { status: 500 })
    }

    const newPrefs = { ...(currentUser?.preferences || {}), ...updates }
    const { error } = await supabaseAdmin
      .from('users')
      .update({ preferences: newPrefs, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      console.error('[user/preferences] Error:', error.message)
      return NextResponse.json({ error: 'Impossible de mettre à jour les preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true, preferences: newPrefs })
  } catch (err) {
    console.error('[user/preferences] Exception:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
