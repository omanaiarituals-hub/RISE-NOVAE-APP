import type { SupabaseClient } from '@supabase/supabase-js'

export interface StruggleState {
  active: boolean
  reason: 'inactivity' | null
  daysSinceLastResponse?: number
  lastResponseDay?: number
}

export async function detectStruggleMode(
  supabase: SupabaseClient,
  userId: string
): Promise<StruggleState> {
  try {
    // Programme démarré ?
    const { data: progress } = await supabase
      .from('program_progress')
      .select('current_day')
      .eq('user_id', userId)
      .maybeSingle()

    if (!progress || (progress.current_day || 0) === 0) {
      return { active: false, reason: null }
    }

    // Dernière réflexion enregistrée ?
    const { data: lastResponse } = await supabase
      .from('mission_responses')
      .select('completed_at, day_number')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastResponse || !lastResponse.completed_at) {
      return { active: false, reason: null }
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(lastResponse.completed_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSince >= 4) {
      return {
        active: true,
        reason: 'inactivity',
        daysSinceLastResponse: daysSince,
        lastResponseDay: lastResponse.day_number,
      }
    }

    return { active: false, reason: null }
  } catch (err) {
    console.error('[struggle] detect error:', err)
    return { active: false, reason: null }
  }
}