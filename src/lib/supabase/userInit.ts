// src/lib/supabase/userInit.ts
// Identique à l'original, console.log de debug supprimés (restent les console.error).
import { supabase } from './client'
import { User } from '@supabase/supabase-js'

export async function ensureUserEntry(user: User): Promise<{ success: boolean; error?: any }> {
  try {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    // Création idempotente : plusieurs événements Auth peuvent arriver presque
    // simultanément. ON CONFLICT DO NOTHING évite le 23505 users_pkey sans
    // écraser un profil existant.
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
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
  // Le flux Auth initialise uniquement le profil utilisateur de base.
  // program_progress appartient au programme V1 et ne doit plus être créé
  // à chaque connexion.
  return ensureUserEntry(user)
}