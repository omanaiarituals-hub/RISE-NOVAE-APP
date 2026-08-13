'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { ensureUserEntry } from '@/lib/supabase/userInit'

export default function AuthPage() {
  const router = useRouter()
  const { user } = useSupabaseAuth()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pseudo, setPseudo] = useState('')
  const [acceptCGU, setAcceptCGU] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCGUModal, setShowCGUModal] = useState(false)
  const [cguModalAccepted, setCguModalAccepted] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('oauth_error')
    if (oauthError) {
      setError(oauthError)
      window.history.replaceState({}, '', '/auth')
    }
  }, [])

  // Ref pour éviter les doubles redirections
  const redirecting = useRef(false)

  // Fallback : si useSupabaseAuth remonte un user (déjà connecté ou callback terminée)
  useEffect(() => {
    if (!user || redirecting.current) return

    redirecting.current = true

    const finishSignIn = async () => {
      try {
        // La session Auth existe déjà à ce stade. On garantit ici que public.users
        // existe avant toute décision CGU/onboarding. ensureUserEntry est idempotent
        // (UPSERT ON CONFLICT DO NOTHING depuis AUTH-2), donc cet appel est sûr même
        // si useSupabaseAuth lance la même initialisation en parallèle.
        const initResult = await ensureUserEntry(user)

        if (!initResult.success) {
          const detail =
            initResult.error?.message ||
            initResult.error?.details ||
            initResult.error?.code ||
            'erreur inconnue'
          throw new Error(`Initialisation du profil impossible : ${detail}`)
        }

        let profile: { cgu_accepted_at?: string | null; onboarding_completed?: boolean | null } | null = null

        for (let attempt = 0; attempt < 10; attempt += 1) {
          const { data, error: profileError } = await supabase
            .from('users')
            .select('cgu_accepted_at,onboarding_completed')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError) {
            console.error('[auth] profile read failed', {
              message: profileError.message,
              code: profileError.code,
            })
          }

          if (!profileError && data) {
            profile = data
            break
          }

          await new Promise(resolve => setTimeout(resolve, 300))
        }

        if (!profile) {
          throw new Error('Le profil NOVAÉ n’a pas pu être chargé après sa création.')
        }

        const oauthCguAccepted =
          window.sessionStorage.getItem('novae_oauth_signup_cgu') === '1'

        if (oauthCguAccepted && !profile.cgu_accepted_at) {
          const acceptedAt = new Date().toISOString()
          const { error: cguError } = await supabase
            .from('users')
            .update({
              cgu_accepted_at: acceptedAt,
              cgu_version: '1.0',
            })
            .eq('id', user.id)

          if (cguError) throw cguError
          profile = { ...profile, cgu_accepted_at: acceptedAt }
        }

        window.sessionStorage.removeItem('novae_oauth_signup_cgu')

        if (!profile.cgu_accepted_at) {
          redirecting.current = false
          setShowCGUModal(true)
          return
        }

        if (!profile.onboarding_completed) {
          router.replace('/onboarding')
          return
        }

        router.replace('/')
      } catch (caught) {
        redirecting.current = false
        setError(
          caught instanceof Error
            ? caught.message
            : 'La connexion n’a pas pu être finalisée. Réessaie.'
        )
      }
    }

    void finishSignIn()
  }, [router, user])


  const acceptCGUForExisting = async () => {
    if (!user || !cguModalAccepted) return
    setLoading(true)
    try {
      await supabase
        .from('users')
        .update({
          cgu_accepted_at: new Date().toISOString(),
          cgu_version: '1.0',
        })
        .eq('id', user.id)
      setShowCGUModal(false)

      const { data: profile } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

      router.replace(profile?.onboarding_completed ? '/' : '/onboarding')
    } catch {
      setError('Erreur lors de la validation. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'signup' && !acceptCGU) {
      setError('Tu dois accepter les CGU et la politique de confidentialité pour continuer.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const acceptedAt = new Date().toISOString()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              pseudo: pseudo || email.split('@')[0],
              cgu_accepted_at: acceptedAt,
              cgu_version: '1.0',
            }
          }
        })
        if (signUpError) throw signUpError

        // Confirm Email est actif : data.session est normalement null ici.
        // On ne tente plus d'écrire public.users / ai_personality_profile sans session.
        // Les metadata ci-dessus seront persistées dans public.users à la première
        // session authentifiée via initializeUserData().
        if (data.session) {
          router.replace('/auth')
        } else {
          setSuccess('Compte créé ! Vérifie ton email pour confirmer ton inscription.')
        }

      } else {
        // LOGIN — onAuthStateChange va déclencher la redirect automatiquement
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        // Pas de router.push ici — onAuthStateChange s'en charge
        // Cela évite le race condition sur mobile PWA
      }
    } catch (err: any) {
      redirecting.current = false
      const msg = err?.message || 'Une erreur est survenue'
      if (msg.includes('already registered')) setError('Cet email est déjà utilisé. Connecte-toi.')
      else if (msg.includes('Invalid login')) setError('Email ou mot de passe incorrect. Vérifie ta saisie.')
      else if (msg.includes('Password should be at least')) setError('Le mot de passe doit faire au moins 6 caractères.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setError('')
    setSuccess('')

    // En création de compte, les CGU restent obligatoires même via Google.
    if (mode === 'signup' && !acceptCGU) {
      setError('Tu dois accepter les CGU et la politique de confidentialité pour continuer.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup' && acceptCGU) {
        window.sessionStorage.setItem('novae_oauth_signup_cgu', '1')
      } else {
        window.sessionStorage.removeItem('novae_oauth_signup_cgu')
      }

      const redirectTo = `${window.location.origin}/auth/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (oauthError) throw oauthError
      // La navigation vers Google est gérée par Supabase.
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Impossible de démarrer la connexion Google. Réessaie.')
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email) { setError('Saisis ton email pour recevoir le lien de réinitialisation.'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://app.novae-by-omanaia.com/auth/reset-password`,
      })
      if (error) throw error
      setSuccess('Email envoyé ! Vérifie ta boîte mail (et tes spams) pour réinitialiser ton mot de passe.')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    border: '1.5px solid #E8E4DF',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    outline: 'none',
    color: '#1A1A1A',
    background: '#FAF7F2',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box' as const
  }

  return (
    <>
      {/* ── MODAL CGU ANCIENS UTILISATEURS ── */}
      {showCGUModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, maxWidth: 480, width: '100%', padding: '40px 36px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>📋</span>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1A1A1A', marginBottom: 10 }}>
                Mise à jour importante
              </h2>
              <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.7 }}>
                Pour continuer à utiliser NOVAÉ, tu dois accepter nos Conditions Générales d'Utilisation et notre Politique de Confidentialité.
              </p>
            </div>
            <div style={{ background: '#FAF7F2', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🔒', text: 'Tes données sont sécurisées et ne sont jamais vendues' },
                { icon: '🗑️', text: 'Tu peux supprimer ton compte et tes données à tout moment' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 24 }}>
              <input type="checkbox" checked={cguModalAccepted} onChange={e => setCguModalAccepted(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#C4956A', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#4A4A4A', lineHeight: 1.6 }}>
                J'ai lu et j'accepte les{' '}
                <Link href="/cgu" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>CGU</Link>
                {' '}et la{' '}
                <Link href="/confidentialite" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>Politique de Confidentialité</Link>
                {' '}de NOVAÉ.
              </span>
            </label>
            <button onClick={acceptCGUForExisting} disabled={!cguModalAccepted || loading}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: cguModalAccepted ? '#C4956A' : '#E8E4DF', color: cguModalAccepted ? 'white' : '#aaa', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: cguModalAccepted ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
              {loading ? 'Validation...' : 'Accepter et continuer →'}
            </button>
          </div>
        </div>
      )}

      {/* ── PAGE AUTH ── */}
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: '#D4A090' }}>NOVAÉ</span>
            </Link>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 6, fontStyle: 'italic' }}>Ton deuxième cerveau pour alléger le quotidien</p>
          </div>

          {/* Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #F0EAE2' }}>

            {mode !== 'forgot' && (
              <div style={{ display: 'flex', background: '#FAF7F2', borderRadius: 10, padding: 4, marginBottom: 16 }}>
                {(['signup', 'login'] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? '#FFFFFF' : 'transparent', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: mode === m ? 600 : 400, color: mode === m ? '#1A1A1A' : '#6B6B6B', cursor: 'pointer', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
                    {m === 'signup' ? 'Créer un compte' : 'Se connecter'}
                  </button>
                ))}
              </div>
            )}

            {mode !== 'forgot' && (
              <>
                {mode === 'signup' && (
                  <div style={{
                    background: '#FAF7F2',
                    borderRadius: 10,
                    padding: '10px 12px',
                    border: '1px solid #F0EAE2',
                    marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 11.5, color: '#4A4A4A', margin: '0 0 7px', lineHeight: 1.4 }}>
                      🔒 Tes données sont sécurisées et ne sont jamais vendues
                    </p>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acceptCGU}
                        onChange={e => setAcceptCGU(e.target.checked)}
                        style={{ marginTop: 1, width: 14, height: 14, accentColor: '#C4956A', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 11.5, color: '#4A4A4A', lineHeight: 1.45 }}>
                        J'accepte les{' '}
                        <Link href="/cgu" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>CGU</Link>
                        {' '}et la{' '}
                        <Link href="/confidentialite" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>Politique de Confidentialité</Link>.
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #E8E4DF',
                    background: '#FFFFFF',
                    color: '#1A1A1A',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.55 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.877 2.684-6.614Z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"/>
                    <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.45.347 2.824.956 4.038l3.007-2.332Z"/>
                    <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.442 1.346l2.581-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"/>
                  </svg>
                  Continuer avec Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 14px' }}>
                  <div style={{ flex: 1, height: 1, background: '#E8E4DF' }} />
                  <span style={{ fontSize: 10.5, color: '#9A928A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    ou avec ton email
                  </span>
                  <div style={{ flex: 1, height: 1, background: '#E8E4DF' }} />
                </div>
              </>
            )}

            {mode === 'forgot' ? (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>🔑</span>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#1A1A1A', margin: '0 0 6px' }}>Mot de passe oublié</h2>
                  <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0, lineHeight: 1.6 }}>Saisis ton email et on t'envoie un lien pour le réinitialiser.</p>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="sophie@mail.com" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = '#E8E4DF'} />
                </div>
                {error && <div style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C04040' }}>{error}</div>}
                {success && <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2A7A30' }}>{success}</div>}
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading ? '#E8E4DF' : '#1A1A1A', color: loading ? '#aaa' : 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {loading ? 'Envoi...' : 'Envoyer le lien →'}
                </button>
                <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                  style={{ background: 'none', border: 'none', color: '#C4956A', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>
                  ← Retour à la connexion
                </button>
              </form>

            ) : (
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {mode === 'signup' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prénom ou pseudo</label>
                    <input type="text" value={pseudo} onChange={e => setPseudo(e.target.value)}
                      placeholder="Sophie" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#C4956A'}
                      onBlur={e => e.target.style.borderColor = '#E8E4DF'} />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="sophie@mail.com" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = '#E8E4DF'} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="6 caractères minimum"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => e.target.style.borderColor = '#C4956A'}
                      onBlur={e => e.target.style.borderColor = '#E8E4DF'} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', fontSize: 16, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: -6 }}>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', color: '#C4956A', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {error && (
                  <div style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C04040' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2A7A30' }}>
                    {success}
                  </div>
                )}

                {/* Indicateur de chargement connexion mobile */}
                {loading && mode === 'login' && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#8B6F55', fontStyle: 'italic' }}>
                    Connexion en cours...
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading || (mode === 'signup' && !acceptCGU) ? '#E8E4DF' : '#1A1A1A', color: loading || (mode === 'signup' && !acceptCGU) ? '#aaa' : 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}>
                  {loading ? 'Chargement...' : mode === 'signup' ? 'Créer mon compte →' : 'Me connecter →'}
                </button>



              </form>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 20 }}>
            © 2026 OMANAÏA · SIREN 100305218 ·{' '}
            <Link href="/cgu" style={{ color: '#C4956A', textDecoration: 'none' }}>CGU & Confidentialité</Link>
          </p>
        </div>
      </div>
    </>
  )
}