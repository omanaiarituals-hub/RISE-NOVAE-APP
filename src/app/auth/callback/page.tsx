'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message] = useState('Connexion en cours…')

  useEffect(() => {
    let cancelled = false
    let finished = false

    const goToAuth = () => {
      if (cancelled || finished) return
      finished = true
      router.replace('/auth?oauth=1')
    }

    const goToError = () => {
      if (cancelled || finished) return
      finished = true

      const safeMessage = encodeURIComponent(
        'La connexion Google n’a pas pu être finalisée. Réessaie.',
      )
      router.replace(`/auth?oauth_error=${safeMessage}`)
    }

    // IMPORTANT :
    // createBrowserClient + detectSessionInUrl:true gère déjà automatiquement
    // l'échange PKCE du ?code= contre une session.
    // Ne jamais rappeler exchangeCodeForSession() ici.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        goToAuth()
      }
    })

    const checkExistingSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[auth/callback] session check failed', {
            message: error.message,
          })
          return
        }

        if (data.session?.user) {
          goToAuth()
        }
      } catch (caught) {
        console.error('[auth/callback] session check failed', {
          message: caught instanceof Error ? caught.message : 'unknown',
        })
      }
    }

    void checkExistingSession()

    const timeout = window.setTimeout(() => {
      goToError()
    }, 10000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#FAF7F2',
        color: '#4A4A4A',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ textAlign: 'center', padding: 24 }}>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            color: '#C4956A',
            marginBottom: 10,
          }}
        >
          NOVAÉ
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
      </div>
    </main>
  )
}
