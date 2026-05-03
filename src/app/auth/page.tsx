'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

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
    if (user) {
      checkCGUAcceptance()
    }
  }, [user])

  const checkCGUAcceptance = async () => {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('cgu_accepted_at')
      .eq('id', user.id)
      .single()

    if (data?.cgu_accepted_at) {
      router.push('/')
    } else {
      setShowCGUModal(true)
    }
  }

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
      router.push('/')
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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              pseudo: pseudo || email.split('@')[0],
              cgu_accepted_at: new Date().toISOString(),
              cgu_version: '1.0',
            }
          }
        })
        if (signUpError) throw signUpError

        if (data.user) {
          await supabase.from('users').upsert({
            id: data.user.id,
            email: data.user.email,
            pseudo: pseudo || email.split('@')[0],
            cgu_accepted_at: new Date().toISOString(),
            cgu_version: '1.0',
          })
          // Sauvegarde aussi le pseudo dans ai_personality_profile si existe
          await supabase
            .from('ai_personality_profile')
            .update({ pseudo: pseudo || email.split('@')[0] })
            .eq('user_id', data.user.id)

          // Ajout automatique dans Brevo selon la date
          const isBeta = new Date() < new Date('2026-06-02')
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.user.email,
              prenom: pseudo || email.split('@')[0],
              listId: isBeta ? 7 : 9,
              SOURCE: isBeta ? 'inscription_beta' : 'inscription_membre'
            })
          })
        }
        setSuccess('Compte créé ! Vérifie ton email pour confirmer ton inscription.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err: any) {
      const msg = err?.message || 'Une erreur est survenue'
      if (msg.includes('already registered')) setError('Cet email est déjà utilisé. Connecte-toi.')
      else if (msg.includes('Invalid login')) setError('Email ou mot de passe incorrect. Vérifie ta saisie.')
      else if (msg.includes('Password should be at least')) setError('Le mot de passe doit faire au moins 6 caractères.')
      else setError(msg)
    } finally {
      setLoading(false)
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
        redirectTo: `${window.location.origin}/auth/reset-password`,
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
                { icon: '🤖', text: "L'Agent IA est un guide, pas un professionnel de santé" },
                { icon: '🎯', text: 'NOVAÉ ne garantit aucun résultat sans ton implication' },
                { icon: '🔒', text: 'Tes données ne sont jamais vendues ni partagées' },
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
                <Link href="/cgu#confidentialite" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>Politique de Confidentialité</Link>
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
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: '#D4A090' }}>NOVAÉ</span>
            </Link>
            <p style={{ fontSize: 13, color: '#6B6B6B', marginTop: 6, fontStyle: 'italic' }}>Ton compagnon de transformation</p>
          </div>

          {/* Card */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #F0EAE2' }}>

            {/* Toggle — masqué en mode forgot */}
            {mode !== 'forgot' && (
              <div style={{ display: 'flex', background: '#FAF7F2', borderRadius: 10, padding: 4, marginBottom: 28 }}>
                {(['signup', 'login'] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: mode === m ? '#FFFFFF' : 'transparent', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: mode === m ? 600 : 400, color: mode === m ? '#1A1A1A' : '#6B6B6B', cursor: 'pointer', boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.2s' }}>
                    {m === 'signup' ? 'Créer un compte' : 'Se connecter'}
                  </button>
                ))}
              </div>
            )}

            {/* ── MODE MOT DE PASSE OUBLIÉ ── */}
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
              /* ── MODE LOGIN / SIGNUP ── */
              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

                {/* Mot de passe avec œil */}
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
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', fontSize: 16, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showPassword ? (
                        // Œil barré
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        // Œil ouvert
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Lien mot de passe oublié — uniquement en mode login */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: -6 }}>
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                      style={{ background: 'none', border: 'none', color: '#C4956A', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {/* CGU inscription */}
                {mode === 'signup' && (
                  <div style={{ background: '#FAF7F2', borderRadius: 10, padding: '14px 16px', border: '1px solid #F0EAE2' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>À savoir avant de commencer</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      {[
                        '🎯 NOVAÉ est un guide — les résultats dépendent de ton implication',
                        '🤖 L\'Agent IA ne remplace pas un professionnel de santé',
                        '🔒 Tes données sont sécurisées et ne sont jamais vendues',
                      ].map((txt, i) => (
                        <p key={i} style={{ fontSize: 12, color: '#4A4A4A', margin: 0, lineHeight: 1.5 }}>{txt}</p>
                      ))}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={acceptCGU} onChange={e => setAcceptCGU(e.target.checked)}
                        style={{ marginTop: 2, width: 15, height: 15, accentColor: '#C4956A', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#4A4A4A', lineHeight: 1.6 }}>
                        J'accepte les{' '}
                        <Link href="/cgu" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>CGU</Link>
                        {' '}et la{' '}
                        <Link href="/cgu" target="_blank" style={{ color: '#C4956A', textDecoration: 'underline' }}>Politique de Confidentialité</Link>.
                      </span>
                    </label>
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

                <button type="submit" disabled={loading || (mode === 'signup' && !acceptCGU)}
                  style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading || (mode === 'signup' && !acceptCGU) ? '#E8E4DF' : '#1A1A1A', color: loading || (mode === 'signup' && !acceptCGU) ? '#aaa' : 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: loading || (mode === 'signup' && !acceptCGU) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}
                  onMouseEnter={e => { if (!loading && (mode === 'login' || acceptCGU)) (e.target as HTMLButtonElement).style.background = '#C4956A' }}
                  onMouseLeave={e => { if (!loading && (mode === 'login' || acceptCGU)) (e.target as HTMLButtonElement).style.background = '#1A1A1A' }}>
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