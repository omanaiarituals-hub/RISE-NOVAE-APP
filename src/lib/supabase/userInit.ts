import { supabase } from './client'
import { User } from '@supabase/supabase-js'

export async function ensureUserEntry(user: User): Promise<{ success: boolean; error?: any }> {
  try {
    console.log('Vérification entrée utilisateur pour:', user.id)
    
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Erreur vérification utilisateur:', selectError)
      return { success: false, error: selectError }
    }

    // Si l'utilisateur existe déjà, retourner succès
    if (existingUser) {
      console.log('Entrée utilisateur existe déjà')
      return { success: true }
    }

    // Calcul du trial : minimum 14 jours, prolongé jusqu'au 1er juin 2026
    // pendant l'avant-première
    const now = new Date()
    const launchCutoff = new Date('2026-06-01T00:00:00Z')
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const trialEndsAt = new Date(
      Math.max(launchCutoff.getTime(), fourteenDaysLater.getTime())
    ).toISOString()

    console.log(`[userInit] Trial fixé jusqu'au : ${trialEndsAt}`)

    // Créer l'entrée utilisateur
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        onboarding_data: {},
        preferences: {},
        subscription_tier: 'trial',          // ← trial auto à l'inscription
        subscription_status: 'active',
        trial_ends_at: trialEndsAt,           // ← minimum 14j, étendu pendant avant-première
        timezone: 'UTC',
        language: 'fr',
        marketing_consent: false,
        onboarding_completed: false
      })

    if (insertError) {
      console.error('Erreur création utilisateur:', insertError)
      return { success: false, error: insertError }
    }

    console.log('Entrée utilisateur créée avec succès')
    return { success: true }
  } catch (error) {
    console.error('Erreur inattendue ensureUserEntry:', error)
    return { success: false, error }
  }
}

export async function ensureProgramProgress(userId: string): Promise<{ success: boolean; error?: any }> {
  try {
    console.log('Vérification program_progress pour:', userId)
    
    // Vérifier si program_progress existe déjà
    const { data: existingProgress, error: selectError } = await supabase
      .from('program_progress')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Erreur vérification program_progress:', selectError)
      return { success: false, error: selectError }
    }

    // Si program_progress existe déjà, retourner succès
    if (existingProgress) {
      console.log('Program_progress existe déjà')
      return { success: true }
    }

    // Créer l'entrée program_progress
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

    console.log('Program_progress créé avec succès')
    return { success: true }
  } catch (error) {
    console.error('Erreur inattendue ensureProgramProgress:', error)
    return { success: false, error }
  }
}

export async function initializeUserData(user: User): Promise<{ success: boolean; error?: any }> {
  console.log('Initialisation données utilisateur pour:', user.id)
  
  // Créer l'entrée utilisateur
  const userResult = await ensureUserEntry(user)
  if (!userResult.success) {
    return userResult
  }

  // Créer program_progress
  const progressResult = await ensureProgramProgress(user.id)
  if (!progressResult.success) {
    return progressResult
  }

  console.log('Initialisation données utilisateur terminée')
  return { success: true }
}
