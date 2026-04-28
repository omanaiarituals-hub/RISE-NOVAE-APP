'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Supabase envoie les tokens dans le hash de l'URL (#access_token=...&type=recovery)
    // On doit écouter l'événement PASSWORD_RECOVERY pour établir la session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true)
      }
    })

    // Vérifier si une session existe déjà
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess('Mot de passe mis à jour ! Redirection...')
      setTimeout(() => router.push('/'), 2000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: '#D4A090' }}>NOVAÉ</span>
          </Link>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #F0EAE2' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>🔐</span>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#1A1A1A', margin: '0 0 6px' }}>
              Nouveau mot de passe
            </h2>
            <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0 }}>
              Choisis un nouveau mot de passe sécurisé.
            </p>
          </div>

          {!sessionReady ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <p style={{ fontSize: 13, color: '#6B6B6B' }}>Vérification du lien en cours...</p>
              <p style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>
                Si ça prend trop longtemps,{' '}
                <button onClick={() => router.push('/auth')}
                  style={{ background: 'none', border: 'none', color: '#C4956A', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  demande un nouveau lien
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Nouveau mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="6 caractères minimum"
                    style={{ width: '100%', border: '1.5px solid #E8E4DF', borderRadius: 10, padding: '12px 44px 12px 14px', fontSize: 14, outline: 'none', color: '#1A1A1A', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
                    onFocus={e => e.target.style.borderColor = '#C4956A'}
                    onBlur={e => e.target.style.borderColor = '#E8E4DF'}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Répète ton mot de passe"
                  style={{ width: '100%', border: '1.5px solid #E8E4DF', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', color: '#1A1A1A', background: '#FAF7F2', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' as const }}
                  onFocus={e => e.target.style.borderColor = '#C4956A'}
                  onBlur={e => e.target.style.borderColor = '#E8E4DF'}
                />
              </div>

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

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading ? '#E8E4DF' : '#1A1A1A', color: loading ? '#aaa' : 'white', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}>
                {loading ? 'Mise à jour...' : 'Mettre à jour mon mot de passe →'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 20 }}>
          <Link href="/auth" style={{ color: '#C4956A', textDecoration: 'none' }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}