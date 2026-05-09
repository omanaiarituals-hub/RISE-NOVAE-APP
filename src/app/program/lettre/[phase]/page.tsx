'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/lib/supabase/client'

const PHASE_INFO: Record<number, {
  name: string
  days: string
  color: string
  bg: string
  next: { num: number; name: string } | null
}> = {
  1: { name: 'Reprogrammation', days: 'J1 — J30', color: '#C4956A', bg: '#1A1A1A', next: { num: 2, name: 'Action & Discipline' } },
  2: { name: 'Action & Discipline', days: 'J31 — J60', color: '#7CB87A', bg: '#1D2E28', next: { num: 3, name: 'Expansion' } },
  3: { name: 'Expansion & Pérennité', days: 'J61 — J90', color: '#9B8EC4', bg: '#1E1830', next: null },
}

export default function PhaseLetterPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useSupabaseAuth()
  const phase = parseInt(params.phase as string)
  const phaseInfo = PHASE_INFO[phase]

  const [letter, setLetter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string>('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth')
      return
    }
    if (![1, 2, 3].includes(phase)) {
      router.push('/program')
      return
    }
    fetchLetter()
  }, [user, authLoading, phase])

  const fetchLetter = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/phase-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur de génération')
        return
      }
      setLetter(data.letter)
      setGeneratedAt(data.generatedAt)

      // Marquer comme lue (en background, non-bloquant)
      if (user) {
        supabase.from('phase_letters')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('phase', phase)
          .is('read_at', null)
          .then(() => { })
      }
    } catch (err) {
      setError('Erreur réseau. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !phaseInfo) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(26,26,26,0.3)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF7', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ position: 'relative', height: 200, background: phaseInfo.bg, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at 30% 30%, ${phaseInfo.color}33, transparent 50%), radial-gradient(circle at 70% 70%, ${phaseInfo.color}22, transparent 60%)`,
        }} />
        <Link href="/program" style={{
          position: 'absolute', top: 52, left: 20,
          color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22, lineHeight: 1, zIndex: 2
        }}>←</Link>
        <div style={{ position: 'absolute', bottom: 28, left: 20, right: 20 }}>
          <p style={{
            fontSize: 9, color: phaseInfo.color, letterSpacing: '0.3em', fontWeight: 700,
            textTransform: 'uppercase', margin: '0 0 8px'
          }}>
            ✦ Lettre de fin de phase {phase}{phase === 3 ? ' — Finale' : ''}
          </p>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32, color: 'white', margin: 0, fontWeight: 500, letterSpacing: '0.01em'
          }}>
            {phaseInfo.name}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {phaseInfo.days}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px 60px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 28, marginBottom: 18, animation: 'pulse 2s ease-in-out infinite' }}>✦</div>
            <p style={{
              color: 'rgba(26,26,26,0.5)', fontSize: 15,
              fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'
            }}>
              NOVAÉ écrit ta lettre...
            </p>
            <p style={{ color: 'rgba(26,26,26,0.3)', fontSize: 11, marginTop: 8 }}>
              Cela peut prendre 10 à 15 secondes la première fois
            </p>
            <style>{`
              @keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }
            `}</style>
          </div>
        )}

        {error && !loading && (
          <div style={{
            padding: 24, background: 'rgba(196,71,87,0.08)',
            borderRadius: 12, border: '1px solid rgba(196,71,87,0.25)', textAlign: 'center'
          }}>
            <p style={{ color: '#c44757', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button
              onClick={fetchLetter}
              style={{
                padding: '10px 18px', background: '#c44757', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {letter && !loading && (
          <article style={{
            background: 'white',
            borderRadius: 20,
            padding: '40px 30px',
            boxShadow: '0 4px 32px rgba(196,149,106,0.08)',
            border: '1px solid rgba(196,149,106,0.15)',
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 17,
              lineHeight: 1.85,
              color: '#3d2618',
              whiteSpace: 'pre-wrap',
            }}>
              {letter}
            </div>

            {generatedAt && (
              <p style={{
                marginTop: 32, fontSize: 11, color: 'rgba(26,26,26,0.3)',
                textAlign: 'right', fontStyle: 'italic'
              }}>
                Écrite le {new Date(generatedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            )}

            <Link
              href={phaseInfo.next ? '/program' : '/'}
              style={{
                display: 'block',
                marginTop: 32,
                padding: '14px',
                background: phaseInfo.color,
                color: 'white',
                textDecoration: 'none',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
                letterSpacing: '0.02em',
              }}
            >
              {phaseInfo.next
                ? `Continuer vers la Phase ${phaseInfo.next.num} : ${phaseInfo.next.name} →`
                : "Retour à l'accueil"}
            </Link>
          </article>
        )}
      </div>
    </div>
  )
}