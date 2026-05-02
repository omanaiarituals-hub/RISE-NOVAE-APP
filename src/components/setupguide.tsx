'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// ── ÉTAPES DU SETUP ───────────────────────────────────────────
const SETUP_STEPS = [
  {
    id: 0,
    title: 'Ton profil NOVAÉ',
    emoji: '✨',
    description: 'Dis-nous qui tu es pour que NOVAÉ puisse te connaître vraiment.',
    instruction: 'Remplis ton profil ci-dessous — prénom, objectif principal, et ce que tu veux transformer.',
    href: '/onboarding',
    color: '#C4956A',
    duration: '5 min',
    tips: 'Plus tu es précise, plus NOVAÉ sera pertinente dans ses analyses.',
  },
  {
    id: 1,
    title: 'Ta famille & tes proches',
    emoji: '💛',
    description: 'Ajoute tes proches pour que l\'agent ne rate jamais un anniversaire et évite les allergies.',
    instruction: 'Clique sur "+ Ajouter un proche" et remplis les infos essentielles : prénom, date de naissance, allergies.',
    href: '/family',
    color: '#E8A87C',
    duration: '10 min',
    tips: 'Les allergies sont cruciales — l\'agent les croise avec tes recettes automatiquement.',
  },
  {
    id: 2,
    title: 'Tes routines matin & soir',
    emoji: '☀️',
    description: 'Crée tes rituels quotidiens. L\'agent détecte les conflits avec ton planning.',
    instruction: 'Crée au moins 3 routines matin et 2 routines soir. Indique l\'heure pour qu\'elles apparaissent dans le Planner.',
    href: '/routines',
    color: '#C4956A',
    duration: '10 min',
    tips: 'Ajoute une heure à chaque routine — elles s\'intégreront automatiquement dans ton Planner.',
  },
  {
    id: 3,
    title: 'Ton planning type',
    emoji: '📅',
    description: 'Planifie ta semaine type pour que l\'agent gère les conflits intelligemment.',
    instruction: 'Crée quelques tâches récurrentes : travail, école des enfants, sport... L\'agent s\'en souviendra.',
    href: '/planner',
    color: '#4A90D9',
    duration: '10 min',
    tips: 'Pas besoin d\'être exhaustive — juste les grands blocs de ta semaine type.',
  },
  {
    id: 4,
    title: 'Tes premières recettes',
    emoji: '🥗',
    description: 'Configure quelques recettes favorites pour que l\'agent planifie tes repas.',
    instruction: 'Ajoute 3 à 5 recettes que ta famille aime. L\'agent pourra générer des listes de courses automatiquement.',
    href: '/recipes',
    color: '#7CB87A',
    duration: '10 min',
    tips: 'L\'agent croisera les allergies de tes proches avec tes recettes pour t\'alerter.',
  },
  {
    id: 5,
    title: 'Tes objectifs 90 jours',
    emoji: '🎯',
    description: 'Définis ce que tu veux transformer en 90 jours. C\'est le cœur de NOVAÉ.',
    instruction: 'Lance le Programme 90j et remplis ta mission du Jour 1 : le Scanner 360°.',
    href: '/program',
    color: '#7B6FA0',
    duration: '15 min',
    tips: 'Sois honnête avec toi-même — c\'est ta boussole pour les 90 prochains jours.',
  },
]

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────
export function SetupGuide() {
  const { user } = useSupabaseAuth()
  const router = useRouter()
  const pathname = usePathname()

  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepsDone, setStepsDone] = useState<number[]>([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showResume, setShowResume] = useState(false)

  // Pages exclues (ne pas afficher le guide)
  const excludedPaths = ['/auth', '/onboarding', '/demo']
  const isExcluded = excludedPaths.some(p => pathname?.startsWith(p))

  // ── Charger la progression depuis Supabase ────────────────
  const loadProgress = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('setup_progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setCurrentStep(data.current_step || 0)
      setStepsDone(data.steps_done || [])
      setCompleted(data.completed || false)
      // Si setup non terminé, proposer de reprendre
      if (!data.completed) {
        setShowResume(true)
      }
    } else {
      // Première connexion — déclencher après 30 secondes
      setTimeout(() => {
        if (!isExcluded) setVisible(true)
      }, 30000)
    }
    setLoading(false)
  }, [user, isExcluded])

  useEffect(() => {
    if (user && !loading) return
    if (user) loadProgress()
  }, [user])

  // ── Sauvegarder la progression ────────────────────────────
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

  // ── Marquer l'étape comme faite et passer à la suivante ──
  const markDoneAndNext = async () => {
    const newDone = stepsDone.includes(currentStep)
      ? stepsDone
      : [...stepsDone, currentStep]
    const nextStep = currentStep + 1

    if (nextStep >= SETUP_STEPS.length) {
      // Setup terminé !
      setCompleted(true)
      setStepsDone(newDone)
      await saveProgress(currentStep, newDone, true)
      setVisible(false)
    } else {
      setStepsDone(newDone)
      setCurrentStep(nextStep)
      await saveProgress(nextStep, newDone)
      // Naviguer vers la prochaine page
      router.push(SETUP_STEPS[nextStep].href)
    }
  }

  // ── Aller à l'étape courante ──────────────────────────────
  const goToCurrentStep = () => {
    setShowResume(false)
    setVisible(true)
    setMinimized(false)
    router.push(SETUP_STEPS[currentStep].href)
  }

  // ── Reprendre plus tard ───────────────────────────────────
  const pauseSetup = async () => {
    await saveProgress(currentStep, stepsDone)
    setVisible(false)
    setShowResume(true)
  }

  // ── Démarrer le setup ─────────────────────────────────────
  const startSetup = () => {
    setVisible(true)
    setMinimized(false)
    setShowResume(false)
    router.push(SETUP_STEPS[0].href)
  }

  if (loading || isExcluded || completed) return null

  const step = SETUP_STEPS[currentStep]
  const progressPercent = Math.round((stepsDone.length / SETUP_STEPS.length) * 100)

  // ── BANDEAU "REPRENDRE" (discret en haut) ─────────────────
  if (showResume && !visible) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: `linear-gradient(135deg, ${step.color}EE, ${step.color}CC)`,
        backdropFilter: 'blur(12px)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: 18 }}>{step.emoji}</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'white' }}>
            Installation NOVAÉ en cours — Étape {currentStep + 1}/{SETUP_STEPS.length}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
            {step.title} · {progressPercent}% complété
          </p>
        </div>
        <button
          onClick={goToCurrentStep}
          style={{
            padding: '6px 14px', background: 'white', border: 'none',
            borderRadius: 20, fontSize: 12, fontWeight: 700, color: step.color,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          Reprendre →
        </button>
        <button
          onClick={() => setShowResume(false)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
        >
          ×
        </button>
      </div>
    )
  }

  // ── MODAL DE DÉMARRAGE (première fois) ────────────────────
  if (visible && currentStep === 0 && stepsDone.length === 0 && pathname === '/') {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
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
              fontSize: 28, color: '#1A1A1A', margin: '0 0 8px',
            }}>
              Installe ton NOVAÉ
            </h2>
            <p style={{ fontSize: 14, color: '#6B6560', lineHeight: 1.7, margin: 0 }}>
              Une session de <strong>deep work d'1 heure</strong> pour configurer toute ton app. Tu peux t'arrêter à tout moment et reprendre plus tard.
            </p>
          </div>

          {/* Les 6 étapes en aperçu */}
          <div style={{ marginBottom: 24 }}>
            {SETUP_STEPS.map((s, i) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
                borderBottom: i < SETUP_STEPS.length - 1 ? '1px solid rgba(26,26,26,0.06)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: s.color + '20', border: `1px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  {s.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{s.title}</p>
                </div>
                <span style={{ fontSize: 11, color: '#6B6560', flexShrink: 0 }}>{s.duration}</span>
              </div>
            ))}
          </div>

          <button
            onClick={startSetup}
            style={{
              width: '100%', padding: '14px', background: '#C4956A',
              border: 'none', borderRadius: 14, color: 'white',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            ⚡ Commencer l'installation
          </button>
          <button
            onClick={() => setVisible(false)}
            style={{
              width: '100%', padding: '12px', background: 'transparent',
              border: '1px solid rgba(26,26,26,0.1)', borderRadius: 14,
              color: '#6B6560', fontSize: 13, cursor: 'pointer',
            }}
          >
            Plus tard
          </button>
        </div>
      </div>
    )
  }

  // ── BANDEAU COPILOTE FLOTTANT ─────────────────────────────
  if (!visible) return null

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 200,
          background: step.color, borderRadius: 20, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18 }}>{step.emoji}</span>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'white' }}>Setup {currentStep + 1}/{SETUP_STEPS.length}</p>
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{progressPercent}% complété</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 200,
      padding: '0 12px 8px',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        boxShadow: '0 -4px 30px rgba(0,0,0,0.15), 0 8px 30px rgba(0,0,0,0.1)',
        border: `2px solid ${step.color}40`,
        overflow: 'hidden',
        pointerEvents: 'all',
        maxWidth: 640,
        margin: '0 auto',
      }}>
        {/* Barre de progression globale */}
        <div style={{ height: 4, background: 'rgba(26,26,26,0.06)' }}>
          <div style={{
            height: '100%', width: `${progressPercent}%`,
            background: step.color, transition: 'width 0.5s ease',
          }} />
        </div>

        <div style={{ padding: '16px 18px' }}>
          {/* Header étape */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: step.color + '20', border: `1.5px solid ${step.color}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {step.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: step.color,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>
                  Étape {currentStep + 1}/{SETUP_STEPS.length}
                </span>
                <span style={{ fontSize: 10, color: '#6B6560' }}>· {step.duration}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                {step.title}
              </p>
            </div>
            <button
              onClick={() => setMinimized(true)}
              style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: 4 }}
            >
              _
            </button>
          </div>

          {/* Instruction */}
          <div style={{
            background: step.color + '12',
            borderRadius: 12, padding: '10px 14px',
            marginBottom: 12,
            border: `1px solid ${step.color}25`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: step.color }}>
              👉 Quoi faire maintenant
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#4A4A4A', lineHeight: 1.6 }}>
              {step.instruction}
            </p>
          </div>

          {/* Tip */}
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#6B6560', lineHeight: 1.5 }}>
            💡 <em>{step.tips}</em>
          </p>

          {/* Pastilles étapes */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {SETUP_STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: stepsDone.includes(i)
                    ? s.color
                    : i === currentStep
                      ? step.color + '60'
                      : 'rgba(26,26,26,0.08)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={pauseSetup}
              style={{
                padding: '10px 14px', background: 'transparent',
                border: '1px solid rgba(26,26,26,0.12)', borderRadius: 10,
                color: '#6B6560', fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
              }}
            >
              ⏸ Pause
            </button>
            <button
              onClick={markDoneAndNext}
              style={{
                flex: 1, padding: '10px',
                background: step.color, border: 'none',
                borderRadius: 10, color: 'white',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {currentStep === SETUP_STEPS.length - 1
                ? '🎉 Terminer l\'installation'
                : `✓ Étape faite → ${SETUP_STEPS[currentStep + 1]?.title}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}