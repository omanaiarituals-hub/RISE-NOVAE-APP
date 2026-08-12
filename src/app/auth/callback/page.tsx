'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { initializeUserData } from '@/lib/supabase/userInit'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Connexion en cours…')

  useEffect(() => {
    let cancelled = false

    const finishOAuth = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const mode = params.get('mode')

        if (!code) {
          throw new Error('Code OAuth manquant.')
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) throw error
        if (!data.session?.user) {
          throw new Error('Session Google introuvable.')
        }

        const user = data.session.user

        // Garantit l'existence de la ligne public.users pour les nouveaux comptes OAuth.
        await initializeUserData(user)

        // En création de compte, les CGU ont été acceptées avant le départ vers Google.
        // On enregistre cette acceptation après création effective du compte.
        if (mode === 'signup') {
          const { error: cguError } = await supabase
            .from('users')
            .update({
              cgu_accepted_at: new Date().toISOString(),
              cgu_version: '1.0',
            })
            .eq('id', user.id)

          if (cguError) {
            console.error('[auth/callback] cgu update failed', {
              code: cguError.code,
              message: cguError.message,
            })
          }
        }

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('cgu_accepted_at')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('[auth/callback] profile check failed', {
            code: profileError.code,
            message: profileError.message,
          })
        }

        if (cancelled) return

        // Si les CGU ne sont pas encore acceptées (ancien compte Google par exemple),
        // on repasse par /auth : l'écran existant ouvre son modal CGU.
        if (!profile?.cgu_accepted_at) {
          router.replace('/auth')
          return
        }

        setMessage('Connexion réussie…')
        router.replace('/')
      } catch (err: any) {
        console.error('[auth/callback] oauth failed', {
          message: err?.message || 'unknown',
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
