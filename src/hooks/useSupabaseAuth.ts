'use client'

import { useState, useEffect } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ensureUserInitialized } from '@/lib/supabase/ensureUserInit'

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let resolved = false

    // Timeout de sÃ©curitÃ© : 8 secondes sur mobile PWA (Ã©tait 4s, trop court)
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        setLoading(false)
      }
    }, 8000)

    const getSession = async () => {
      try {
        // Premier essai
        let { data: { session } } = await supabase.auth.getSession()

        // Sur mobile PWA, le cookie peut ne pas Ãªtre lu au premier appel.
        // On retente une fois aprÃ¨s 800ms si la session est vide.
        if (!session) {
          await new Promise(r => setTimeout(r, 800))
          const retry = await supabase.auth.getSession()
          session = retry.data.session
        }

        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          ensureUserInitialized(session.user).catch(console.error)
        }
      } catch (err) {
        console.error('Erreur getSession:', err)
      } finally {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          setLoading(false)
        }
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN' && session?.user) {
        ensureUserInitialized(session.user).catch(console.error)
      }

      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        setLoading(false)
      } else {
        // Mise Ã  jour silencieuse aprÃ¨s rÃ©solution initiale
        setLoading(false)
      }
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
