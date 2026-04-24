'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from './useSupabaseAuth'

export interface ProgramProgress {
  id: string
  user_id: string
  current_day: number
  start_date: string
  last_access_date: string
  completed_missions: number
  mission_responses: any[]
  total_time_spent_minutes: number
  streak_days: number
  ai_personality_profile: {}
  last_ai_interaction: string | null
  created_at: string
  updated_at: string
}

export function useProgramProgress() {
  const { user } = useSupabaseAuth()
  const [progress, setProgress] = useState<ProgramProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentDay, setCurrentDay] = useState(1)
  const [isLoaded, setIsLoaded] = useState(false)

  // Charger la progression depuis Supabase
  useEffect(() => {
    if (!user) {
      setProgress(null)
      setCurrentDay(1)
      setLoading(false)
      setIsLoaded(true)
      return
    }

    const fetchProgress = async () => {
      try {
        console.log('Chargement progression depuis Supabase...')
        
        const { data, error } = await supabase
          .from('program_progress')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (error) {
          if (error.code === 'PGRST116') { // Not found
            console.log('Aucune progression trouvée, création...')
            await createInitialProgress()
          } else {
            console.error('Erreur chargement progression:', error)
          }
        } else {
          console.log('Progression chargée:', data.current_day)
          setProgress(data)
          setCurrentDay(data.current_day)
        }
      } catch (error) {
        console.error('Erreur critique:', error)
      } finally {
        setLoading(false)
        setIsLoaded(true)
      }
    }

    fetchProgress()
  }, [user])

  // Créer la progression initiale
  const createInitialProgress = async () => {
    if (!user) return

    try {
      const newProgress = {
        user_id: user.id,
        current_day: 1,
        start_date: new Date().toISOString(),
        last_access_date: new Date().toISOString(),
        completed_missions: 0,
        mission_responses: [],
        total_time_spent_minutes: 0,
        streak_days: 0,
        ai_personality_profile: {},
        last_ai_interaction: null
      }

      const { data, error } = await supabase
        .from('program_progress')
        .insert(newProgress)
        .select()
        .single()

      if (error) {
        console.error('Erreur création progression:', error)
      } else {
        console.log('Progression initiale créée:', data.current_day)
        setProgress(data)
        setCurrentDay(data.current_day)
      }
    } catch (error) {
      console.error('Erreur critique création:', error)
    }
  }

  // Mettre à jour le jour actuel
  const updateCurrentDay = async (newDay: number) => {
    if (!user || !progress) return

    try {
      console.log(`Mise à jour jour: ${progress.current_day} -> ${newDay}`)
      
      const { data, error } = await supabase
        .from('program_progress')
        .update({
          current_day: newDay,
          last_access_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Erreur mise à jour jour:', error)
        return false
      }

      console.log('Jour mis à jour avec succès:', data.current_day)
      setProgress(data)
      setCurrentDay(data.current_day)
      return true
    } catch (error) {
      console.error('Erreur critique mise à jour:', error)
      return false
    }
  }

  // Mettre à jour les missions complétées
  const updateCompletedMissions = async (completed: number) => {
    if (!user || !progress) return

    try {
      const { data, error } = await supabase
        .from('program_progress')
        .update({
          completed_missions: completed,
          last_access_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Erreur mise à jour missions:', error)
        return false
      }

      setProgress(data)
      return true
    } catch (error) {
      console.error('Erreur critique missions:', error)
      return false
    }
  }

  // Ajouter une réponse de mission
  const addMissionResponse = async (response: any) => {
    if (!user || !progress) return

    try {
      const updatedResponses = [...progress.mission_responses, response]
      
      const { data, error } = await supabase
        .from('program_progress')
        .update({
          mission_responses: updatedResponses,
          last_access_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Erreur ajout réponse:', error)
        return false
      }

      setProgress(data)
      return true
    } catch (error) {
      console.error('Erreur critique réponse:', error)
      return false
    }
  }

  // Mettre à jour le profil IA
  const updateAIProfile = async (profile: {}) => {
    if (!user || !progress) return

    try {
      const { data, error } = await supabase
        .from('program_progress')
        .update({
          ai_personality_profile: profile,
          last_ai_interaction: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Erreur mise à jour profil IA:', error)
        return false
      }

      setProgress(data)
      return true
    } catch (error) {
      console.error('Erreur critique profil IA:', error)
      return false
    }
  }

  return {
    progress,
    currentDay,
    setCurrentDay: updateCurrentDay,
    loading,
    isLoaded,
    updateCompletedMissions,
    addMissionResponse,
    updateAIProfile,
    refreshProgress: () => {
      if (user) {
        // Recharger la progression
        const fetchProgress = async () => {
          const { data } = await supabase
            .from('program_progress')
            .select('*')
            .eq('user_id', user.id)
            .single()
          if (data) {
            setProgress(data)
            setCurrentDay(data.current_day)
          }
        }
        fetchProgress()
      }
    }
  }
}
