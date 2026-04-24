'use client'

import { useState, useEffect } from 'react'

interface TourStep {
  id: string
  emoji: string
  title: string
  tagline: string
  description: string
  color: string
  border: string
  textColor: string
  premium?: boolean
  position: 'top' | 'bottom' | 'center'
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    emoji: '✨',
    title: 'Bienvenue dans NOVAÉ',
    tagline: 'Ton compagnon de transformation',
    description: 'NOVAÉ n\'est pas une simple application. C\'est un espace pensé pour toi — une femme qui a décidé de reprendre les rênes de sa vie, à son rythme, avec intelligence.',
    color: 'rgba(196,149,106,0.12)',
    border: '#C4956A',
    textColor: '#7A4A1A',
    position: 'center',
  },
  {
    id: 'planner',
    emoji: '📅',
    title: 'Planner & To-do',
    tagline: 'Ton agenda qui pense avant toi',
    description: 'Avant même que tu ouvres ton agenda, NOVAÉ a déjà repéré les conflits, les surcharges et les moments volés à toi-même. Pas un calendrier de plus — un gardien de ton énergie.',
    color: 'rgba(160,190,220,0.15)',
    border: '#A0BEDC',
    textColor: '#2C5F8A',
    position: 'bottom',
  },
  {
    id: 'routines',
    emoji: '☀️',
    title: 'Routines',
    tagline: 'Tes rituels deviennent une force',
    description: 'Tes rituels deviennent des habitudes solides. NOVAÉ veille à ce que rien ne les efface — ni les imprévus, ni la fatigue, ni les journées qui débordent.',
    color: 'rgba(232,208,128,0.15)',
    border: '#E8D080',
    textColor: '#7A6010',
    position: 'bottom',
  },
  {
    id: 'recipes',
    emoji: '🛒',
    title: 'Recettes & Courses',
    tagline: 'La charge mentale en moins',
    description: 'Fini la liste sur un coin de table. NOVAÉ cumule, organise et t\'alerte si une recette ne convient pas à toute ta famille. Le quotidien, simplifié.',
    color: 'rgba(196,149,106,0.12)',
    border: '#D4A090',
    textColor: '#8A4A3A',
    position: 'bottom',
  },
  {
    id: 'family',
    emoji: '💛',
    title: 'Famille',
    tagline: 'Ceux qui comptent, jamais oubliés',
    description: 'Les anniversaires, les allergies, les besoins de chacune et chacun — NOVAÉ s\'en souvient pour toi. Parce que prendre soin des autres commence par avoir de l\'espace dans ta tête.',
    color: 'rgba(232,208,128,0.15)',
    border: '#E8D080',
    textColor: '#7A6010',
    position: 'bottom',
  },
  {
    id: 'defis',
    emoji: '⚡',
    title: 'Défis',
    tagline: 'Petites victoires, grande transformation',
    description: 'Chaque défi est une petite victoire programmée. NOVAÉ calibre la difficulté pour que tu ne lâches jamais avant d\'avoir gagné. La progression, pas la perfection.',
    color: 'rgba(224,160,184,0.15)',
    border: '#E0A0B8',
    textColor: '#8A3050',
    position: 'bottom',
  },
  {
    id: 'tracker',
    emoji: '📊',
    title: 'Tracker',
    tagline: 'Ta vraie progression, visible',
    description: 'Visualise ta vraie progression — pas juste des cases cochées, mais une transformation qui se construit jour après jour. Parce que tu mérites de voir jusqu\'où tu es allée.',
    color: 'rgba(144,200,168,0.15)',
    border: '#90C8A8',
    textColor: '#2A6A48',
    position: 'bottom',
  },
  {
    id: 'community',
    emoji: '👥',
    title: 'Communauté',
    tagline: 'Seule mais jamais isolée',
    description: 'Tu n\'es pas seule dans ta transformation. Partage, inspire et reçois l\'élan des autres NOVAÉ en chemin. Parce que les femmes qui s\'élèvent s\'élèvent ensemble.',
    color: 'rgba(224,160,184,0.15)',
    border: '#E0A0B8',
    textColor: '#8A3050',
    position: 'bottom',
  },
  {
    id: 'program',
    emoji: '🎯',
    title: 'Programme 90 jours',
    tagline: 'Ton parcours sur-mesure',
    description: 'Pas un simple programme. NOVAÉ t\'accompagne jour après jour avec des missions calibrées selon qui tu es — et ajuste le rythme si tu décroches. 90 jours pour te retrouver.',
    color: 'rgba(123,111,160,0.12)',
    border: '#7B6FA0',
    textColor: '#4A3A7A',
    premium: true,
    position: 'top',
  },
  {
    id: 'agent',
    emoji: '🤖',
    title: 'Agent NOVAÉ IA',
    tagline: 'Ton chef d\'orchestre intelligent',
    description: 'Elle lit ton Planner, tes Routines, tes Recettes, ta Famille. Elle détecte ce que tu n\'as pas encore vu. Elle agit avant que tu subisses. Ce n\'est pas un chatbot — c\'est ton alliée la plus précieuse.',
    color: 'rgba(44,44,44,0.06)',
    border: '#2C2C2C',
    textColor: '#2C2C2C',
    premium: true,
    position: 'top',
  },
]

const STORAGE_KEY = 'novae-onboarding-done'

export function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) {
      // Délai court pour laisser la page se charger
      setTimeout(() => setVisible(true), 800)
    }
  }, [])

  const currentStep = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1
  const progress = ((step + 1) / TOUR_STEPS.length) * 100

  const goNext = () => {
    if (animating) return
    setAnimating(true)
    setLeaving(true)
    setTimeout(() => {
      if (isLast) {
        finish()
      } else {
        setStep(s => s + 1)
        setLeaving(false)
        setAnimating(false)
      }
    }, 280)
  }

  const goPrev = () => {
    if (animating || step === 0) return
    setAnimating(true)
    setLeaving(true)
    setTimeout(() => {
      setStep(s => s - 1)
      setLeaving(false)
      setAnimating(false)
    }, 280)
  }

  const finish = () => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  if (!visible) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={finish}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,26,26,0.55)',
          backdropFilter: 'blur(3px)',
          zIndex: 999,
          animation: 'fadeIn 0.4s ease',
        }}
      />

      {/* Bulle centrale */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        width: '90%',
        maxWidth: 440,
        animation: leaving ? 'bubbleOut 0.28s ease forwards' : 'bubbleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}>
        {/* Carte principale */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.08)',
          border: `1.5px solid ${currentStep.border}`,
        }}>
          {/* Header coloré */}
          <div style={{
            background: currentStep.color,
            borderBottom: `1px solid ${currentStep.border}33`,
            padding: '28px 28px 20px',
            position: 'relative',
          }}>
            {/* Badge premium */}
            {currentStep.premium && (
              <div style={{
                position: 'absolute', top: 16, right: 16,
                background: 'linear-gradient(135deg, #C4956A, #7B6FA0)',
                color: 'white', fontSize: 9, fontWeight: 700,
                padding: '3px 8px', borderRadius: 20,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                ✦ Premium
              </div>
            )}

            {/* Emoji */}
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: '#FFFFFF',
              border: `2px solid ${currentStep.border}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, marginBottom: 16,
              boxShadow: `0 4px 16px ${currentStep.border}22`,
            }}>
              {currentStep.emoji}
            </div>

            <h2 style={{
              margin: '0 0 4px',
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 700,
              color: '#1A1A1A', lineHeight: 1.2,
            }}>
              {currentStep.title}
            </h2>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 600,
              color: currentStep.textColor,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {currentStep.tagline}
            </p>
          </div>

          {/* Corps */}
          <div style={{ padding: '20px 28px 24px' }}>
            <p style={{
              margin: '0 0 24px',
              fontSize: 15, color: '#3A3A3A',
              lineHeight: 1.7,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {currentStep.description}
            </p>

            {/* Barre de progression */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                height: 3, background: '#F0EDE8', borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, #C4956A, ${currentStep.border})`,
                  borderRadius: 10,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{
                margin: '6px 0 0', fontSize: 10,
                color: '#9B9B9B', textAlign: 'right',
                fontFamily: "'DM Sans', sans-serif",
              }}>
                {step + 1} / {TOUR_STEPS.length}
              </p>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {step > 0 && (
                <button onClick={goPrev} style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: '1.5px solid #E8E4DF', background: '#FFFFFF',
                  cursor: 'pointer', fontSize: 16, color: '#6B6B6B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  ‹
                </button>
              )}

              <button onClick={goNext} style={{
                flex: 1, padding: '13px 0',
                borderRadius: 14, border: 'none',
               background: isLast
  ? 'linear-gradient(135deg, #C4956A, #7B6FA0)'
  : currentStep.color,
outline: `1.5px solid ${currentStep.border}`,
color: isLast ? '#FFFFFF' : currentStep.textColor,
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.03em',
                transition: 'opacity 0.15s',
              }}>
                {isLast ? "C'est parti ! ✨" : "Découvrir →"}
              </button>

              <button onClick={finish} style={{
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 11,
                color: '#BBBBBB', padding: '0 4px',
                fontFamily: "'DM Sans', sans-serif",
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                Passer
              </button>
            </div>
          </div>
        </div>

        {/* Points de navigation */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          gap: 6, marginTop: 16,
        }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6,
              height: 6, borderRadius: 10,
              background: i === step ? '#C4956A' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }} onClick={() => { if (!animating) setStep(i) }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bubbleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes bubbleOut {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to   { opacity: 0; transform: translate(-50%, -50%) scale(0.92) translateY(-8px); }
        }
      `}</style>
    </>
  )
}