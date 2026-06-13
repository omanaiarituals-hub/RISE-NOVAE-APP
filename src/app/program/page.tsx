'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProgramProgress } from '@/hooks/useProgramProgress'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { AuthGuard } from '@/components/AuthGuard'
import missionsData from '@/data/missions.json'
import { supabase } from '@/lib/supabase/client'
import { DemoBanner } from '@/components/DemoBanner'
import Navigation from '@/components/Navigation'
import { logEvent } from '@/lib/events'

// ── Identité par phase : une famille pastel dominante ───────────
const PHASES = [
  { num: 1, label: 'Reprogrammation',     days: 'J1 — J30',  rgb: '243,205,182', ink: '#C77E52', soft: '#FBEDE3' },
  { num: 2, label: 'Action & Discipline', days: 'J31 — J60', rgb: '197,211,180', ink: '#7E9460', soft: '#EDF1E6' },
  { num: 3, label: 'Expansion',           days: 'J61 — J90', rgb: '212,196,226', ink: '#8A6FB0', soft: '#F0EAF6' },
]

const MISSIONS_BY_DAY: Record<number, any> = {}
;(missionsData as any[]).forEach(m => { MISSIONS_BY_DAY[m.day] = m })

export default function ProgramPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const { currentDay, isLoaded, refreshProgress } = useProgramProgress()
  const [activePhase, setActivePhase] = useState(1)
  const [completedDays, setCompletedDays] = useState<number[]>([])
  const [phaseLetters, setPhaseLetters] = useState<{ phase: number; read_at: string | null }[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [reflections, setReflections] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (currentDay <= 30) setActivePhase(1)
    else if (currentDay <= 60) setActivePhase(2)
    else setActivePhase(3)
  }, [currentDay, isLoaded])

  useEffect(() => {
    if (user) loadProgress()
  }, [user])

  useEffect(() => {
    refreshProgress()
  }, [])

  useEffect(() => {
  if (!user) return
  logEvent(supabase, user.id, 'module_programme')
}, [user])

  const loadProgress = async () => {
    if (!user) return
    const { data } = await supabase
      .from('mission_responses')
      .select('day_number, reflection')
      .eq('user_id', user.id)
    if (data) {
      setCompletedDays(data.map(d => d.day_number))
      const refMap: Record<number, string> = {}
      data.forEach(d => { if (d.reflection) refMap[d.day_number] = d.reflection })
      setReflections(refMap)
    }
    const { data: lettersData } = await supabase
      .from('phase_letters')
      .select('phase, read_at')
      .eq('user_id', user.id)
    setPhaseLetters((lettersData as any[]) || [])
  }

  const saveReflection = async (day: number, text: string) => {
    if (!user || !text.trim()) return
    setSaving(day)
    try {
      await supabase.from('mission_responses').upsert({
        user_id: user.id,
        day_number: day,
        reflection: text.trim(),
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id,day_number' })
      setCompletedDays(prev => prev.includes(day) ? prev : [...prev, day])
      setReflections(prev => ({ ...prev, [day]: text.trim() }))
      setSelectedDay(null)
    } finally {
      setSaving(null)
    }
  }

  const goToDay = (day: number) => router.push(`/program/${day}`)

  if (authLoading || !isLoaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F1E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(61,38,24,0.3)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  const currentPhasNum = currentDay <= 30 ? 1 : currentDay <= 60 ? 2 : 3
  const curPhase = PHASES[currentPhasNum - 1]
  const todayMission = MISSIONS_BY_DAY[currentDay]
  const overall = Math.round((currentDay / 90) * 100)

  const selPhase = selectedDay ? PHASES[Math.ceil(selectedDay / 30) - 1] : null
  const selectedMission = selectedDay ? MISSIONS_BY_DAY[selectedDay] : null

  // ── Rendu d'une phase (en-tête + grille 30 tuiles) ──
  const renderPhase = (p: typeof PHASES[number]) => {
    const start = (p.num - 1) * 30 + 1
    const done = completedDays.filter(d => d >= start && d <= start + 29).length
    return (
      <div key={p.num} className={`phase-block ${activePhase === p.num ? 'is-active' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: p.ink, fontWeight: 700 }}>
              Phase {p.num} · {p.days}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#3D2618', fontWeight: 600 }}>
              {p.label}
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#6B5B4E', flexShrink: 0 }}>{done}/30</span>
        </div>
        <div style={{ height: 3, background: 'rgba(61,38,24,0.08)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ width: `${(done / 30) * 100}%`, height: '100%', background: p.ink, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const day = start + i
            const mission = MISSIONS_BY_DAY[day]
            const isDone = completedDays.includes(day)
            const isToday = day === currentDay
            const isFuture = day > currentDay
            const t = i / 29
            const bg = isFuture
              ? 'rgba(61,38,24,0.05)'
              : isDone
                ? `rgba(${p.rgb},0.95)`
                : `rgba(${p.rgb},${(0.2 + t * 0.55).toFixed(2)})`
            const txt = isFuture ? 'rgba(61,38,24,0.3)' : isDone ? '#fff' : p.ink
            return (
              <button
                key={day}
                className="daytile"
                disabled={isFuture}
                title={mission?.title || `Jour ${day}`}
                onClick={() => !isFuture && setSelectedDay(day)}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 12,
                  border: isToday ? `2px solid ${p.ink}` : '1px solid rgba(61,38,24,0.06)',
                  background: bg,
                  color: txt,
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: "'Cormorant Garamond', serif",
                  cursor: isFuture ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: isToday ? `0 0 0 3px ${p.ink}22` : 'none',
                }}
              >
                {isFuture ? '🔒' : isDone ? '✓' : day}
                {isToday && (
                  <span style={{ position: 'absolute', bottom: 3, fontSize: 6.5, letterSpacing: '0.1em', color: p.ink, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                    AUJ.
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <>
        <DemoBanner />
        <div style={{ minHeight: '100vh', background: '#F8F1E5', fontFamily: "'DM Sans', sans-serif" }}>
          <main className="prog-main">

            {/* ── EN-TÊTE (sans photo) ── */}
            <div style={{
              position: 'relative',
              borderRadius: 22,
              padding: '20px 22px',
              marginBottom: 18,
              background: 'linear-gradient(135deg, #FBEDE3 0%, #EDF1E6 50%, #F0EAF6 100%)',
              border: '1px solid rgba(61,38,24,0.06)',
              boxShadow: '0 6px 22px rgba(139,90,60,0.08)',
            }}>
              <Link href="/" style={{ position: 'absolute', top: 16, right: 18, color: 'rgba(61,38,24,0.4)', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
              <div style={{ fontSize: 9.5, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9C7C4E', fontWeight: 700, marginBottom: 6 }}>
                Ton programme
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: '#3D2618', margin: '0 0 4px', letterSpacing: '0.01em' }}>
                90 jours pour devenir toi
              </h1>
              <p style={{ fontSize: 13.5, color: '#6B5B4E', margin: '0 0 14px', lineHeight: 1.55, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                Tu n'as pas besoin de tout changer d'un coup. Juste un pas aujourd'hui — et la suite vient d'elle-même.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(61,38,24,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${overall}%`, height: '100%', background: 'linear-gradient(90deg, #C77E52, #8A6FB0)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 11.5, color: '#6B5B4E', flexShrink: 0, fontWeight: 600 }}>Jour {currentDay > 0 ? currentDay : '—'} / 90</span>
              </div>
            </div>

            {/* ── ONGLETS DE PHASE (mobile uniquement) ── */}
            <div className="phase-tabs">
              {PHASES.map(p => (
                <button key={p.num} onClick={() => setActivePhase(p.num)}
                  style={{
                    flex: 1, padding: '9px 4px',
                    background: activePhase === p.num ? p.ink : 'transparent',
                    border: `1px solid ${activePhase === p.num ? p.ink : 'rgba(61,38,24,0.12)'}`,
                    borderRadius: 10,
                    color: activePhase === p.num ? '#fff' : '#6B5B4E',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                  P{p.num}
                </button>
              ))}
            </div>

            {/* ── CARTE AUJOURD'HUI (sans photo) ── */}
            {todayMission && (
              <div
                onClick={() => setSelectedDay(currentDay)}
                style={{
                  cursor: 'pointer', marginBottom: 16, borderRadius: 18, padding: '16px 18px',
                  background: `linear-gradient(135deg, ${curPhase.soft}, #ffffff)`,
                  border: `1.5px solid ${curPhase.ink}33`,
                  boxShadow: `0 6px 20px ${curPhase.ink}14`,
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: curPhase.ink, fontWeight: 700, marginBottom: 6 }}>
                  Aujourd'hui · Jour {currentDay}
                </div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, color: '#3D2618', margin: '0 0 6px', fontWeight: 600 }}>
                  {todayMission.title}
                </h3>
                <p style={{ fontSize: 13, color: '#6B5B4E', margin: '0 0 12px', lineHeight: 1.5 }}>
                  {todayMission.guide || todayMission.description}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); goToDay(currentDay) }}
                  style={{ padding: '9px 18px', background: curPhase.ink, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {completedDays.includes(currentDay) ? '✓ Revoir la mission' : 'Commencer la mission →'}
                </button>
              </div>
            )}

            {/* ── BANNIÈRES LETTRES DE FIN DE PHASE ── */}
            {[1, 2, 3].map(phaseNum => {
              const requiredDay = phaseNum * 30
              if (currentDay < requiredDay) return null
              const meta = PHASES[phaseNum - 1]
              const letterRow = phaseLetters.find(l => l.phase === phaseNum)
              const isUnread = !letterRow?.read_at
              const isFinal = phaseNum === 3
              return (
                <Link
                  key={`letter-${phaseNum}`}
                  href={`/program/lettre/${phaseNum}`}
                  style={{
                    display: 'block', textDecoration: 'none', marginBottom: 14,
                    padding: '16px 18px', borderRadius: 16,
                    background: `linear-gradient(135deg, ${meta.soft}, #ffffff)`,
                    border: `1.5px solid ${meta.ink}55`,
                    boxShadow: isUnread ? `0 0 24px ${meta.ink}33` : `0 2px 12px ${meta.ink}11`,
                    position: 'relative',
                  }}
                >
                  {isUnread && (
                    <span style={{ position: 'absolute', top: 8, right: 8, background: meta.ink, color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Nouveau
                    </span>
                  )}
                  <p style={{ fontSize: 9, color: meta.ink, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 6px' }}>
                    ✦ Lettre de fin de phase {phaseNum}{isFinal ? ' — Finale' : ''}
                  </p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#3D2618', fontWeight: 500, margin: '0 0 6px' }}>
                    {meta.label}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B5B4E', margin: 0 }}>
                    {isUnread ? 'NOVAÉ a écrit une lettre rien que pour toi →' : 'Relire ta lettre →'}
                  </p>
                </Link>
              )
            })}

            {/* ── LES 3 PHASES (3 colonnes ordi · onglet mobile) ── */}
            <div className="phases">
              {PHASES.map(p => renderPhase(p))}
            </div>

          </main>
          <Navigation />
        </div>

        {/* ── FENÊTRE D'UN JOUR ── */}
        {selectedDay && selectedMission && selPhase && (
          <div
            onClick={() => setSelectedDay(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', padding: '22px 22px 26px', boxShadow: '0 12px 48px rgba(0,0,0,0.22)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: selPhase.ink, fontWeight: 700 }}>
                  Jour {selectedDay} · {selPhase.label}
                </span>
                <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9C8C7E', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 23, color: '#3D2618', margin: '4px 0 10px', fontWeight: 600 }}>
                {selectedMission.title}
              </h3>
              <p style={{ fontSize: 13.5, color: '#6B5B4E', lineHeight: 1.6, margin: '0 0 16px' }}>
                {selectedMission.guide || selectedMission.description}
              </p>
              <button
                onClick={() => goToDay(selectedDay)}
                style={{ width: '100%', padding: '11px', background: selPhase.ink, border: 'none', borderRadius: 12, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>
                {completedDays.includes(selectedDay) ? '✓ Revoir ce jour' : 'Aller à ce jour →'}
              </button>
              <p style={{ fontSize: 11, color: '#9C8C7E', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em' }}>RÉFLEXION RAPIDE</p>
              <textarea
                value={reflections[selectedDay] || ''}
                onChange={e => setReflections(prev => ({ ...prev, [selectedDay]: e.target.value }))}
                placeholder={selectedMission.question || 'Ta réflexion du jour...'}
                rows={4}
                style={{ width: '100%', background: '#FBF6EE', border: `1px solid ${selPhase.ink}33`, borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#3D2618', fontFamily: "'DM Sans', sans-serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => saveReflection(selectedDay, reflections[selectedDay] || '')}
                disabled={saving === selectedDay || !reflections[selectedDay]?.trim()}
                style={{ marginTop: 10, width: '100%', padding: '11px', background: reflections[selectedDay]?.trim() ? '#6B8F71' : 'rgba(61,38,24,0.08)', border: 'none', borderRadius: 12, color: reflections[selectedDay]?.trim() ? '#fff' : 'rgba(61,38,24,0.3)', fontSize: 13.5, fontWeight: 600, cursor: reflections[selectedDay]?.trim() ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}>
                {saving === selectedDay ? 'Enregistrement...' : completedDays.includes(selectedDay) ? '✓ Mettre à jour' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          .prog-main { max-width: 720px; margin: 0 auto; padding: 16px 20px 110px; }
          .phase-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
          .phases { display: block; }
          .phase-block { margin-bottom: 24px; }
          .daytile { transition: transform .12s ease; }
          .daytile:not(:disabled):hover { transform: scale(1.08); }
          @media (min-width: 900px) {
            .prog-main { max-width: 1320px; }
            .phase-tabs { display: none; }
            .phases { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; align-items: start; }
            .phase-block { margin-bottom: 0; }
          }
          @media (max-width: 899px) {
            .phase-block { display: none; }
            .phase-block.is-active { display: block; }
          }
        `}</style>
      </>
    </AuthGuard>
  )
}