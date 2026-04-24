'use client'

import { useState, useEffect } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { initializeUserData } from '@/lib/supabase/userInit'

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Timeout de sécurité : 4 secondes max sur mobile
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 4000)

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)

        // Non-bloquant : on n'attend PAS initializeUserData
        if (session?.user) {
          initializeUserData(session.user).catch(console.error)
        }
      } catch (err) {
        console.error('Erreur getSession:', err)
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)

      // Non-bloquant
      if (event === 'SIGNED_IN' && session?.user) {
        initializeUserData(session.user).catch(console.error)
      }

      clearTimeout(timeout)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return { user, session, loading, signUp, signIn, signInWithMagicLink, signOut }
}