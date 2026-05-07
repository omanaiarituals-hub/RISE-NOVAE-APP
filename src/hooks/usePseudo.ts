// src/hooks/usePseudo.ts
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

/**
 * Récupère le pseudo de l'utilisateur depuis ai_personality_profile.pseudo
 * Avec fallback sur user_metadata puis email
 */
export function usePseudo(): string {
  const { user } = useSupabaseAuth()
  const [pseudo, setPseudo] = useState<string>('')

  useEffect(() => {
    if (!user) {
      setPseudo('')
      return
    }

    let cancelled = false
    ;(async () => {
      // 1. Essayer ai_personality_profile.pseudo
      const { data } = await supabase
        .from('ai_personality_profile')
        .select('pseudo')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (data?.pseudo && data.pseudo.trim()) {
        setPseudo(data.pseudo.trim())
        return
      }

      // 2. Fallback user_metadata
      const metaPseudo =
        user.user_metadata?.pseudo ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        ''

      setPseudo(metaPseudo)
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return pseudo
}