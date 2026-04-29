'use client'

import { useState, useEffect, useContext } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { NovaeContext } from '@/context/NovaeContext'
import missionsData from '@/data/missions.json'

// ── Images thématiques ──────────────────────────────────────────
const THEME_IMAGES: Record<string, string> = {
  mindset: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80',
  mental: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80',
  corps: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
  mouvement: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
  sport: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
  nutrition: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80',
  alimentation: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80',
  sommeil: 'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=600&q=80',
  repos: 'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=600&q=80',
  relations: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80',
  vision: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
  objectifs: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
  gratitude: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  routine: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
  discipline: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80',
}

const PHASE_META = [
  { num: 1, label: 'Reprogrammation', days: 'J1 — J30', color: '#C4956A', bg: '#1A1A1A', image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80' },
  { num: 2, label: 'Action & Discipline', days: 'J31 — J60', color: '#7CB87A', bg: '#1D2E28', image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80' },
  { num: 3, label: 'Expansion', days: 'J61 — J90', color: '#9B8EC4', bg: '#1E1830', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
]

function getMissionImage(title: string, phaseNum: number): string {
  const t = title?.toLowerCase() || ''
  for (const [key, url] of Object.entries(THEME_IMAGES)) {
    if (t.includes(key)) return url
  }
  const fallbacks = [
    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
  ]
  return fallbacks[phaseNum - 1] || fallbacks[0]
}

export default function ProgramPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  
  // Utilisation sécurisée du contexte avec un fallback à 1 si currentDay n'est pas trouvé
  const context = useContext(NovaeContext) as any
  const currentDay = context?.currentDay || 1

  const [activePhase, setActivePhase] = useState(1)
  const [completedDays, setCompletedDays] = useState<number[]>([])
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [reflections, setReflections] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    if (currentDay <= 30) setActivePhase(1)
    else if (currentDay <= 60) setActivePhase(2)
    else setActivePhase(3)
  }, [currentDay])

  useEffect(() => {
    if (user) loadProgress()
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
  }

  const getMissionsForPhase = (phase: number) => {
    const start = (phase - 1) * 30 + 1
    const end = phase * 30
    const missions = (missionsData as any[]).filter(m => m.day >= start && m.day <= end)
    return missions
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
      setExpandedDay(null)
    } finally {
      setSaving(null)
    }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(26,26,26,0.3)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  const phaseMeta = PHASE_META[activePhase - 1]
  const missions = getMissionsForPhase(activePhase)
  const phaseCompleted = completedDays.filter(d => {
    const start = (activePhase - 1) * 30 + 1
    return d >= start && d <= start + 29
  }).length

  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF7', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
        <img
          src={phaseMeta.image}
          alt={phaseMeta.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.65) saturate(0.8)' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, ${phaseMeta.bg}ee 100%)`
        }} />

        <Link href="/" style={{
          position: 'absolute', top: 52, left: 20,
          color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 22
        }}>←</Link>

        <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: phaseMeta.color, fontWeight: 700,
            background: `${phaseMeta.color}22`,
            padding: '4px 10px', borderRadius: 20,
            border: `1px solid ${phaseMeta.color}44`,
            marginBottom: 8
          }}>
            Phase {phaseMeta.num} · {phaseMeta.days}
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 30, fontWeight: 500,
            color: 'white', margin: '0 0 4px',
            letterSpacing: '0.02em'
          }}>
            {phaseMeta.label}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
              <div style={{
                width: `${(phaseCompleted / 30) * 100}%`,
                height: '100%',
                background: phaseMeta.color,
                borderRadius: 2,
                transition: 'width 0.6s ease'
              }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
              {phaseCompleted}/30 jours
            </span>
          </div>
        </div>
      </div>

      {/* Sélecteur de phase */}
      <div style={{
        display: 'flex', gap: 8, padding: '16px 20px 12px',
        background: 'white',
        borderBottom: '1px solid rgba(196,149,106,0.1)'
      }}>
        {PHASE_META.map(p => (
          <button key={p.num} onClick={() => setActivePhase(p.num)}
            style={{
              flex: 1, padding: '8px 4px',
              background: activePhase === p.num ? p.bg : 'transparent',
              border: `1px solid ${activePhase === p.num ? p.color : 'rgba(26,26,26,0.1)'}`,
              borderRadius: 10,
              color: activePhase === p.num ? p.color : 'rgba(26,26,26,0.4)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: "'DM Sans', sans-serif"
            }}>
            P{p.num}
          </button>
        ))}
      </div>

      {/* Jour courant */}
      {activePhase === (currentDay <= 30 ? 1 : currentDay <= 60 ? 2 : 3) && (
        <div style={{ padding: '16px 20px 0' }}>
          {missions.filter(m => m.day === currentDay).map(mission => (
            <div key={mission.day} style={{
              borderRadius: 20, overflow: 'hidden',
              border: `1px solid ${phaseMeta.color}44`,
              marginBottom: 16,
              boxShadow: `0 4px 24px ${phaseMeta.color}22`
            }}>
              <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
                <img
                  src={getMissionImage(mission.theme || mission.title, activePhase)}
                  alt={mission.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.3) 0%, transparent 60%)' }} />
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  background: phaseMeta.color,
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 10, fontWeight: 700, color: 'white', letterSpacing: '0.1em'
                }}>
                  AUJOURD'HUI · JOUR {mission.day}
                </div>
              </div>
              <div style={{ padding: '14px 16px', background: phaseMeta.bg }}>
                <h3 style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 22, fontWeight: 500,
                  color: 'white', margin: '0 0 6px'
                }}>
                  {mission.title}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  {mission.description}
                </p>
                <button
                  onClick={() => setExpandedDay(expandedDay === mission.day ? null : mission.day)}
                  style={{
                    padding: '9px 18px',
                    background: phaseMeta.color,
                    border: 'none', borderRadius: 10,
                    color: 'white', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
                  }}>
                  {completedDays.includes(mission.day) ? '✓ Réflexion complétée' : 'Écrire ma réflexion →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste des jours */}
      <div style={{ padding: '4px 20px 100px' }}>
        <p style={{
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.3)', fontWeight: 600, margin: '8px 0 12px'
        }}>
          Les 30 jours de la phase
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missions.filter(m => m.day !== currentDay).map(mission => {
            const isDone = completedDays.includes(mission.day)
            const isExpanded = expandedDay === mission.day
            const isFuture = mission.day > currentDay

            return (
              <div key={mission.day} style={{
                borderRadius: 14,
                border: `1px solid ${isDone ? 'rgba(76,175,80,0.2)' : 'rgba(196,149,106,0.12)'}`,
                background: isDone ? 'rgba(76,175,80,0.04)' : 'white',
                overflow: 'hidden',
                opacity: isFuture ? 0.6 : 1,
                transition: 'all 0.2s'
              }}>
                <div
                  onClick={() => !isFuture && setExpandedDay(isExpanded ? null : mission.day)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: isFuture ? 'default' : 'pointer' }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={getMissionImage(mission.theme || mission.title, activePhase)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isDone ? 'grayscale(0.3)' : 'none' }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, color: 'rgba(26,26,26,0.3)', fontWeight: 600 }}>
                        J{mission.day}
                      </span>
                      {isDone && <span style={{ fontSize: 10, color: '#4CAF50' }}>✓</span>}
                      {isFuture && <span style={{ fontSize: 9, color: 'rgba(26,26,26,0.25)' }}>🔒</span>}
                    </div>
                    <p style={{
                      fontWeight: 500,
                      color: isFuture ? 'rgba(26,26,26,0.35)' : '#1A1A1A',
                      margin: 0,
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 15
                    }}>
                      {mission.title}
                    </p>
                  </div>

                  {!isFuture && (
                    <span style={{ color: 'rgba(26,26,26,0.2)', fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                      ›
                    </span>
                  )}
                </div>

                {isExpanded && !isFuture && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(196,149,106,0.08)' }}>
                    <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.6)', lineHeight: 1.6, margin: '12px 0 10px' }}>
                      {mission.description}
                    </p>
                    {mission.exercise && (
                      <div style={{
                        background: 'rgba(196,149,106,0.07)',
                        borderRadius: 10, padding: '10px 12px',
                        borderLeft: `3px solid ${phaseMeta.color}`,
                        marginBottom: 10
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: phaseMeta.color, marginBottom: 4, letterSpacing: '0.08em' }}>
                          EXERCICE
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(26,26,26,0.65)', lineHeight: 1.5, margin: 0 }}>
                          {mission.exercise}
                        </p>
                      </div>
                    )}
                    <textarea
                      value={reflections[mission.day] || ''}
                      onChange={e => setReflections(prev => ({ ...prev, [mission.day]: e.target.value }))}
                      placeholder="Ta réflexion du jour..."
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'rgba(26,26,26,0.03)',
                        border: '1px solid rgba(196,149,106,0.2)',
                        borderRadius: 10, padding: '10px 12px',
                        fontSize: 13, color: '#1A1A1A',
                        fontFamily: "'DM Sans', sans-serif",
                        resize: 'none', outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={() => saveReflection(mission.day, reflections[mission.day] || '')}
                      disabled={saving === mission.day || !reflections[mission.day]?.trim()}
                      style={{
                        marginTop: 8, width: '100%',
                        padding: '10px',
                        background: reflections[mission.day]?.trim() ? phaseMeta.color : 'rgba(26,26,26,0.08)',
                        border: 'none', borderRadius: 10,
                        color: reflections[mission.day]?.trim() ? 'white' : 'rgba(26,26,26,0.3)',
                        fontSize: 13, fontWeight: 600,
                        cursor: reflections[mission.day]?.trim() ? 'pointer' : 'not-allowed',
                        fontFamily: "'DM Sans', sans-serif"
                      }}>
                      {saving === mission.day ? 'Enregistrement...' : isDone ? '✓ Mettre à jour' : 'Valider ce jour'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}