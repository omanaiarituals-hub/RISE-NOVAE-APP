'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

const SETUP_STEPS = [
  {
    id: 0,
    title: 'Ta famille & tes proches',
    emoji: '💛',
    instruction: 'Clique sur "+ Ajouter un proche" et remplis : prénom, date de naissance, allergies.',
    href: '/family',
    color: '#E8A87C',
    duration: '10 min',
    tips: 'Les allergies sont cruciales, l\'agent les croise avec tes recettes automatiquement.',
  },
  {
    id: 1,
    title: 'Tes routines matin & soir',
    emoji: '☀️',
    instruction: 'Crée au moins 3 routines matin et 2 routines soir. Indique l\'heure pour qu\'elles apparaissent dans le Planner.',
    href: '/routines',
    color: '#C4956A',
    duration: '10 min',
    tips: 'Ajoute une heure à chaque routine, elles s\'intègrent automatiquement dans le Planner.',
  },
  {
    id: 2,
    title: 'Ton planning type',
    emoji: '📅',
    instruction: 'Crée tes tâches récurrentes : travail, école, sport... L\'agent s\'en souviendra pour éviter les conflits.',
    href: '/planner',
    color: '#4A90D9',
    duration: '10 min',
    tips: 'Pas besoin d\'être exhaustive, juste les grands blocs de ta semaine type.',
  },
  {
    id: 3,
    title: 'Tes premières recettes',
    emoji: '🥗',
    instruction: 'Ajoute 3 à 5 recettes que ta famille aime. L\'agent génèrera les listes de courses automatiquement.',
    href: '/recipes',
    color: '#7CB87A',
    duration: '10 min',
    tips: 'L\'agent croisera les allergies de tes proches avec tes recettes pour t\'alerter.',
  },
  {
    id: 4,
    title: 'Tes objectifs 90 jours',
    emoji: '🎯',
    instruction: 'Lance le Programme 90j et remplis ta mission du Jour 1 : le Scanner 360°.',
    href: '/program',
    color: '#7B6FA0',
    duration: '15 min',
    tips: 'Sois honnête avec toi-même, c\'est ta boussole pour les 90 prochains jours.',
  },
]

export function SetupGuide() {
  const { user } = useSupabaseAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [showModal, setShowModal] = useState(false)
  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepsDone, setStepsDone] = useState<number[]>([])
  const [completed, setCompleted] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const excludedPaths = ['/auth', '/demo', '/onboarding']
  const isExcluded = excludedPaths.some(p => pathname?.startsWith(p))

  useEffect(() => {
    if (!user || initialized || isExcluded) return
    setInitialized(true)
    ;(async () => {
      const { data } = await supabase
        .from('setup_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!data) {
        // Nouvelle utilisatrice — afficher le modal immédiatement
        setShowModal(true)
      } else if (!data.completed) {
        // Setup en cours — proposer de reprendre
        setCurrentStep(data.current_step || 0)
        setStepsDone(data.steps_done || [])
        setShowResume(true)
      } else {
        setCompleted(true)
      }
    })()
  }, [user, initialized, isExcluded])

  const saveProgress = async (step: number, done: number[], isCompleted = false) => {
    if (!user) return
    await supabase.from('setup_progress').upsert({
      user_id: user.id,
      current_step: step,
      steps_done: done,
      completed: isCompleted,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  const startSetup = async () => {
    setShowModal(false)
    setVisible(true)
    setMinimized(false)
    await saveProgress(0, [])
    router.push(SETUP_STEPS[0].href)
  }

  const markDoneAndNext = async () => {
    const newDone = stepsDone.includes(currentStep) ? stepsDone : [...stepsDone, currentStep]
    const nextStep = currentStep + 1
    if (nextStep >= SETUP_STEPS.length) {
      setCompleted(true)
      setVisible(false)
      await saveProgress(currentStep, newDone, true)
    } else {
      setStepsDone(newDone)
      setCurrentStep(nextStep)
      await saveProgress(nextStep, newDone)
      router.push(SETUP_STEPS[nextStep].href)
    }
  }

  const goToCurrentStep = () => {
    setShowResume(false)
    setVisible(true)
    setMinimized(false)
    router.push(SETUP_STEPS[currentStep].href)
  }

  const pauseSetup = async () => {
    await saveProgress(currentStep, stepsDone)
    setVisible(false)
    setShowResume(true)
  }

  if (!user || isExcluded || completed) return null

  const step = SETUP_STEPS[currentStep]
  const progressPercent = Math.round((stepsDone.length / SETUP_STEPS.length) * 100)

  // ── MODAL DÉMARRAGE ───────────────────────────────────────
  if (showModal) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          background: 'white', borderRadius: 24, padding: '32px 28px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28, color: '#1A1A1A', margin: '0 0 10px',
            }}>
              Installe ton NOVAÉ
            </h2>
            <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.7, margin: 0 }}>
              Une session de <strong>deep work d'1h</strong> pour configurer toute ton app.
              Tu peux t'arrêter à tout moment et reprendre plus tard.
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            {SETUP_STEPS.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0',
                borderBottom: i < SETUP_STEPS.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: s.color + '20', border: `1px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, flexShrink: 0,
                }}>{s.emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{s.title}</p>
                </div>
                <span style={{ fontSize: 11, color: '#6B6560', flexShrink: 0 }}>{s.duration}</span>
              </div>
            ))}
          </div>

          <button onClick={startSetup} style={{
            width: '100%', padding: '14px', background: '#C4956A',
            border: 'none', borderRadius: 14, color: 'white',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            ⚡ Commencer l'installation
          </button>
          <button onClick={() => setShowModal(false)} style={{
            width: '100%', padding: '12px', background: 'transparent',
            border: '1px solid rgba(26,26,26,0.1)', borderRadius: 14,
            color: '#6B6560', fontSize: 13, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Plus tard
          </button>
        </div>
      </div>
    )
  }

  // ── BANDEAU REPRENDRE ─────────────────────────────────────
  if (showResume && !visible) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: `${step.color}F2`,
        backdropFilter: 'blur(12px)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: 18 }}>{step.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'white' }}>
            Installation en cours, étape {currentStep + 1}/{SETUP_STEPS.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
            {step.title} · {progressPercent}% complété
          </p>
        </div>
        <button onClick={goToCurrentStep} style={{
          padding: '6px 14px', background: 'white', border: 'none',
          borderRadius: 20, fontSize: 12, fontWeight: 700, color: step.color,
          cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
        }}>Reprendre →</button>
        <button onClick={() => setShowResume(false)} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: 18, flexShrink: 0,
        }}>×</button>
      </div>
    )
  }

  // ── BANDEAU MINIMISÉ ──────────────────────────────────────
  if (visible && minimized) {
    return (
      <div onClick={() => setMinimized(false)} style={{
        position: 'fixed', bottom: 80, right: 16, zIndex: 200,
        background: step.color, borderRadius: 20, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 18 }}>{step.emoji}</span>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'white' }}>Setup {currentStep + 1}/{SETUP_STEPS.length}</p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{progressPercent}% complété</p>
        </div>
      </div>
    )
  }

  // ── BANDEAU COPILOTE ──────────────────────────────────────
  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 200,
      padding: '0 12px 8px', pointerEvents: 'none',
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        boxShadow: '0 -4px 30px rgba(0,0,0,0.15), 0 8px 30px rgba(0,0,0,0.1)',
        border: `2px solid ${step.color}40`,
        overflow: 'hidden', pointerEvents: 'all',
        maxWidth: 640, margin: '0 auto',
      }}>
        <div style={{ height: 4, background: 'rgba(26,26,26,0.06)' }}>
          <div style={{ height: '100%', width: `${progressPercent}%`, background: step.color, transition: 'width 0.5s ease' }} />
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: step.color + '20', border: `1.5px solid ${step.color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>{step.emoji}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: step.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Étape {currentStep + 1}/{SETUP_STEPS.length} · {step.duration}
              </span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{step.title}</p>
            </div>
            <button onClick={() => setMinimized(true)} style={{
              background: 'none', border: 'none', color: '#6B6560',
              cursor: 'pointer', fontSize: 18, padding: 4, flexShrink: 0,
            }}>_</button>
          </div>

          <div style={{
            background: step.color + '12', borderRadius: 10,
            padding: '10px 12px', marginBottom: 10,
            border: `1px solid ${step.color}25`,
          }}>
            <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: step.color }}>👉 Quoi faire maintenant</p>
            <p style={{ margin: 0, fontSize: 12, color: '#4A4A4A', lineHeight: 1.6 }}>{step.instruction}</p>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#6B6560', lineHeight: 1.5 }}>
            💡 <em>{step.tips}</em>
          </p>

          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {SETUP_STEPS.map((s, i) => (
              <div key={s.id} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: stepsDone.includes(i) ? s.color : i === currentStep ? step.color + '50' : 'rgba(26,26,26,0.08)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={pauseSetup} style={{
              padding: '10px 14px', background: 'transparent',
              border: '1px solid rgba(26,26,26,0.12)', borderRadius: 10,
              color: '#6B6560', fontSize: 12, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
            }}>⏸ Pause</button>
            <button onClick={markDoneAndNext} style={{
              flex: 1, padding: '10px', background: step.color,
              border: 'none', borderRadius: 10, color: 'white',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {currentStep === SETUP_STEPS.length - 1
                ? '🎉 Terminer l\'installation'
                : `✓ C'est fait → ${SETUP_STEPS[currentStep + 1]?.title}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}