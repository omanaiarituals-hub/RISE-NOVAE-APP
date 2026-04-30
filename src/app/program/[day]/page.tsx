'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProgramProgress } from '@/hooks/useProgramProgress'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { AuthGuard } from '@/components/AuthGuard'
import missionsData from '@/data/missions.json'
import { supabase } from '@/lib/supabase/client'

// ── Images par jour (même mapping que la page programme) ────────
const DAY_IMAGES: Record<number, string> = {
  1:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  2:  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
  3:  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  4:  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
  5:  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80',
  6:  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80',
  7:  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&q=80',
  8:  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80',
  9:  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
  10: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
  11: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
  12: 'https://images.unsplash.com/photo-1512273222628-4daea6e55abb?w=800&q=80',
  13: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
  14: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  15: 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=800&q=80',
  16: 'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80',
  17: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
  18: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=800&q=80',
  19: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80',
  20: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&q=80',
  21: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80',
  22: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=800&q=80',
  23: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
  24: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  25: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80',
  26: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  27: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80',
  28: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
  29: 'https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=800&q=80',
  30: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
}
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'

const PHASE_META = [
  { num: 1, color: '#C4956A', bg: '#1A1A1A', label: 'Reprogrammation' },
  { num: 2, color: '#7CB87A', bg: '#1D2E28', label: 'Action & Discipline' },
  { num: 3, color: '#9B8EC4', bg: '#1E1830', label: 'Expansion' },
]

export default function DayPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useSupabaseAuth()
  const { currentDay } = useProgramProgress()

  const dayNumber = parseInt(params.day as string)
  const mission = (missionsData as any[]).find(m => m.day === dayNumber)

  const phaseIndex = dayNumber <= 30 ? 0 : dayNumber <= 60 ? 1 : 2
  const phase = PHASE_META[phaseIndex]

  const [completedTasks, setCompletedTasks] = useState<number[]>([])
  const [reflection, setReflection] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    if (user && dayNumber) loadProgress()
  }, [user, dayNumber])

  const loadProgress = async () => {
    if (!user) return
    const { data } = await supabase
      .from('mission_responses')
      .select('*')
      .eq('user_id', user.id)
      .eq('day_number', dayNumber)
      .single()

    if (data) {
      setReflection(data.reflection || '')
      setCompletedTasks(data.completed_tasks || [])
      setIsCompleted(!!data.completed_at)
    }
  }

  const toggleTask = (index: number) => {
    setCompletedTasks(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const saveProgress = async () => {
    if (!user || !reflection.trim()) return
    setSaving(true)
    try {
      await supabase.from('mission_responses').upsert({
        user_id: user.id,
        day_number: dayNumber,
        reflection: reflection.trim(),
        completed_tasks: completedTasks,
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id,day_number' })
      setIsCompleted(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const tasks = mission?.tasks || []
  const progressPct = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0

  if (!mission) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'rgba(26,26,26,0.4)', fontSize: 14 }}>Mission introuvable</p>
        <button onClick={() => router.push('/program')} style={{ padding: '10px 20px', background: '#C4956A', border: 'none', borderRadius: 10, color: 'white', fontSize: 13, cursor: 'pointer' }}>
          ← Retour au programme
        </button>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div style={{ minHeight: '100vh', background: '#FDFAF7', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── HERO IMAGE ── */}
        <div style={{ position: 'relative', height: 260, overflow: 'hidden' }}>
          <img
            src={DAY_IMAGES[dayNumber] || DEFAULT_IMAGE}
            alt={mission.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.6) saturate(0.85)' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, ${phase.bg}f0 100%)`
          }} />

          {/* Navigation */}
          <div style={{ position: 'absolute', top: 52, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => router.push('/program')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}>
              ← Programme
            </button>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 14px', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}>
              Accueil
            </button>
          </div>

          {/* Infos jour */}
          <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: phase.color, fontWeight: 700,
                background: `${phase.color}25`, padding: '4px 10px', borderRadius: 20,
                border: `1px solid ${phase.color}50`
              }}>
                {phase.label}
              </div>
              <div style={{
                fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)', fontWeight: 600,
                padding: '4px 10px'
              }}>
                Jour {dayNumber} / 90
              </div>
              {isCompleted && (
                <div style={{
                  fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: '#4CAF50', fontWeight: 700,
                  background: 'rgba(76,175,80,0.15)', padding: '4px 10px', borderRadius: 20,
                  border: '1px solid rgba(76,175,80,0.3)'
                }}>
                  ✓ Complété
                </div>
              )}
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28, fontWeight: 500, color: 'white',
              margin: 0, letterSpacing: '0.02em', lineHeight: 1.2
            }}>
              {mission.title}
            </h1>
          </div>
        </div>

        {/* ── CONTENU ── */}
        <div style={{ padding: '24px 20px 120px', maxWidth: 640, margin: '0 auto' }}>

          {/* Guide / Description */}
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(196,149,106,0.12)',
            padding: '20px', marginBottom: 16
          }}>
            <p style={{
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: phase.color, fontWeight: 700, margin: '0 0 10px'
            }}>
              ✦ Ta mission du jour
            </p>
            <p style={{ fontSize: 14, color: 'rgba(26,26,26,0.75)', lineHeight: 1.75, margin: 0 }}>
              {mission.guide || mission.description}
            </p>
          </div>

          {/* Tâches à accomplir */}
          {tasks.length > 0 && (
            <div style={{
              background: 'white', borderRadius: 16,
              border: '1px solid rgba(196,149,106,0.12)',
              padding: '20px', marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: phase.color, fontWeight: 700, margin: 0 }}>
                  ☑ Tâches
                </p>
                <span style={{ fontSize: 11, color: 'rgba(26,26,26,0.35)', fontWeight: 600 }}>
                  {completedTasks.length}/{tasks.length}
                </span>
              </div>

              {/* Barre de progression tâches */}
              {tasks.length > 0 && (
                <div style={{ height: 4, background: 'rgba(196,149,106,0.15)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{
                    width: `${progressPct}%`, height: '100%',
                    background: progressPct === 100 ? '#4CAF50' : phase.color,
                    borderRadius: 2, transition: 'width 0.4s ease'
                  }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map((task: any, index: number) => {
                  const taskLabel = typeof task === 'string' ? task : task.label
                  const done = completedTasks.includes(index)
                  return (
                    <div
                      key={index}
                      onClick={() => toggleTask(index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        background: done ? `${phase.color}0D` : 'rgba(26,26,26,0.02)',
                        borderRadius: 12,
                        border: `1px solid ${done ? `${phase.color}30` : 'rgba(26,26,26,0.06)'}`,
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${done ? phase.color : 'rgba(26,26,26,0.2)'}`,
                        background: done ? phase.color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}>
                        {done && (
                          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                            <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        color: done ? 'rgba(26,26,26,0.4)' : '#1A1A1A',
                        textDecoration: done ? 'line-through' : 'none',
                        transition: 'all 0.2s', flex: 1
                      }}>
                        {taskLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Question de réflexion */}
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid rgba(196,149,106,0.12)',
            padding: '20px', marginBottom: 16
          }}>
            <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: phase.color, fontWeight: 700, margin: '0 0 10px' }}>
              ✍ Réflexion
            </p>
            {(mission.question || mission.reflection?.question) && (
              <p style={{
                fontSize: 14, fontFamily: "'Cormorant Garamond', serif",
                fontStyle: 'italic', color: 'rgba(26,26,26,0.6)',
                lineHeight: 1.6, margin: '0 0 14px',
                borderLeft: `3px solid ${phase.color}`,
                paddingLeft: 12
              }}>
                {mission.question || mission.reflection?.question}
              </p>
            )}
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder="Écris ta réflexion ici..."
              rows={5}
              style={{
                width: '100%',
                background: 'rgba(26,26,26,0.02)',
                border: `1px solid rgba(196,149,106,0.2)`,
                borderRadius: 12, padding: '14px',
                fontSize: 14, color: '#1A1A1A',
                fontFamily: "'DM Sans', sans-serif",
                resize: 'none', outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box' as const,
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = phase.color}
              onBlur={e => e.target.style.borderColor = 'rgba(196,149,106,0.2)'}
            />
          </div>

          {/* Bouton sauvegarder */}
          <button
            onClick={saveProgress}
            disabled={saving || !reflection.trim()}
            style={{
              width: '100%', padding: '16px',
              background: saved ? '#4CAF50' : reflection.trim() ? phase.color : 'rgba(26,26,26,0.08)',
              border: 'none', borderRadius: 14,
              color: reflection.trim() ? 'white' : 'rgba(26,26,26,0.3)',
              fontSize: 14, fontWeight: 700,
              cursor: reflection.trim() ? 'pointer' : 'not-allowed',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.05em',
              transition: 'all 0.3s'
            }}>
            {saving ? 'Enregistrement...' : saved ? '✓ Sauvegardé !' : isCompleted ? '✓ Mettre à jour' : 'Valider cette journée →'}
          </button>

          {/* Navigation jour suivant/précédent */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {dayNumber > 1 && (
              <button
                onClick={() => router.push(`/program/${dayNumber - 1}`)}
                style={{
                  flex: 1, padding: '12px',
                  background: 'white',
                  border: '1px solid rgba(196,149,106,0.2)',
                  borderRadius: 12, color: 'rgba(26,26,26,0.5)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif"
                }}>
                ← Jour {dayNumber - 1}
              </button>
            )}
            {dayNumber < 90 && dayNumber < currentDay && (
              <button
                onClick={() => router.push(`/program/${dayNumber + 1}`)}
                style={{
                  flex: 1, padding: '12px',
                  background: 'white',
                  border: '1px solid rgba(196,149,106,0.2)',
                  borderRadius: 12, color: 'rgba(26,26,26,0.5)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif"
                }}>
                Jour {dayNumber + 1} →
              </button>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}