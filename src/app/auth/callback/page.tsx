'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message] = useState('Connexion en cours…')

  useEffect(() => {
    let cancelled = false

    const finishOAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (!code) {
          throw new Error('Code OAuth manquant.')
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) throw error
        if (!data.session?.user) {
          throw new Error('Session Google introuvable.')
        }

        if (!cancelled) {
          // /auth possède désormais l'unique logique post-connexion :
          // initialisation déjà gérée par useSupabaseAuth, CGU, onboarding, accueil.
          router.replace('/auth?oauth=1')
        }
      } catch (caught) {
        console.error('[auth/callback] oauth failed', {
          message: caught instanceof Error ? caught.message : 'unknown',
        })

        if (!cancelled) {
          const safeMessage = encodeURIComponent(
            'La connexion Google n’a pas pu être finalisée. Réessaie.'
          )
          router.replace(`/auth?oauth_error=${safeMessage}`)
        }
      }
    }

    void finishOAuth()

    return () => {
      cancelled = true
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
