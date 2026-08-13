// src/lib/supabase/userInit.ts
// Identique à l'original, console.log de debug supprimés (restent les console.error).
import { supabase } from './client'
import { User } from '@supabase/supabase-js'

export async function ensureUserEntry(user: User): Promise<{ success: boolean; error?: any }> {
  try {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const metadata = user.user_metadata || {}

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: user.email || '',
          full_name: metadata.full_name || metadata.name || null,
          avatar_url: metadata.avatar_url || metadata.picture || null,
          cgu_accepted_at: metadata.cgu_accepted_at || null,
          cgu_version: metadata.cgu_version || null,
          onboarding_data: {},
          preferences: {},
          subscription_tier: 'trial',
          subscription_status: 'active',
          trial_ends_at: trialEndsAt,
          timezone: 'UTC',
          language: 'fr',
          marketing_consent: false,
          onboarding_completed: false
        },
        {
          onConflict: 'id',
          ignoreDuplicates: true
        }
      )

    if (upsertError) {
      console.error('Erreur création utilisateur:', upsertError)
      return { success: false, error: upsertError }
    }

    return { success: true }
  } catch (error) {
    console.error('Erreur inattendue ensureUserEntry:', error)
    return { success: false, error }
  }
}

export async function ensureProgramProgress(userId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const { data: existingProgress, error: selectError } = await supabase
      .from('program_progress')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Erreur vérification program_progress:', selectError)
      return { success: false, error: selectError }
    }

    if (existingProgress) return { success: true }

    const { error: insertError } = await supabase
      .from('program_progress')
      .insert({
        user_id: userId,
        current_day: 1,
        start_date: new Date().toISOString(),
        last_access_date: new Date().toISOString(),
        completed_missions: 0,
        mission_responses: [],
        total_time_spent_minutes: 0,
        streak_days: 0,
        ai_personality_profile: {}
      })

    if (insertError) {
      console.error('Erreur création program_progress:', insertError)
      return { success: false, error: insertError }
    }

    return { success: true }
  } catch (error) {
    console.error('Erreur inattendue ensureProgramProgress:', error)
    return { success: false, error }
  }
}

export async function initializeUserData(user: User): Promise<{ success: boolean; error?: any }> {
  return ensureUserEntry(user)
}