'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'novae-onboarding-tour-v2-done'

interface OnboardingTourProps {
  forceShow?: boolean
  onClose?: () => void
}

const STEPS = [
  {
    eyebrow: '1 · LE BON RÉFLEXE',
    title: 'Commence par parler à Nova.',
    body:
      "Tu n’as pas besoin de chercher le bon module. Décris simplement la situation : un rendez-vous, un repas à prévoir, une tâche, un document ou quelque chose que tu ne veux pas oublier.",
    example: '« Vendredi je termine à 17h et je dois récupérer les enfants à 17h30. Est-ce que ça passe ? »',
  },
  {
    eyebrow: '2 · ELLE PRÉPARE, TU VALIDES',
    title: 'Nova peut transformer ta demande en action.',
    body:
      "Selon ta demande, elle peut préparer une tâche, un rappel, un événement Planner, une note, une recette ou des courses. Quand une écriture est nécessaire, tu gardes la main avant l’exécution.",
    example: 'Proposition → confirmation → exécution → résultat réel.',
  },
  {
    eyebrow: '3 · TON CONTEXTE COMPTE',
    title: 'Donne-lui les repères qui changent vraiment la réponse.',
    body:
      "Situation familiale, garde, lieux utiles, trajets connus, horaires ou préférences : Nova peut utiliser les informations que tu as choisi d’enregistrer pour proposer quelque chose de plus réaliste.",
    example: 'Plus de contexte utile, moins de réponses génériques.',
  },
  {
    eyebrow: '4 · TU RESTES AUX COMMANDES',
    title: 'NOVAÉ t’aide à décider, elle ne décide pas à ta place.',
    body:
      "Les actions sensibles demandent une confirmation. Tu peux modifier tes informations, tes modules d’accueil et tes préférences dans Profil / Personnalisation.",
    example: 'Le but : moins de charge mentale, sans perdre le contrôle.',
  },
]

export function OnboardingTour({ forceShow = false, onClose }: OnboardingTourProps = {}) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    try {
      const done = window.localStorage.getItem(STORAGE_KEY)
      if (forceShow || !done) {
        timer = setTimeout(() => setVisible(true), 650)
      }
    } catch {
      if (forceShow) timer = setTimeout(() => setVisible(true), 650)
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [forceShow])

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Le tutoriel reste fonctionnel sans stockage local.
    }
    setVisible(false)
    onClose?.()
  }

  return (
    <>
      <div className="novae-tour-overlay" />

      <section
        className="novae-tour-card"
        role="dialog"
        aria-modal="true"
        aria-label="Découvrir NOVAÉ"
      >
        <div className="novae-tour-topline">
          <div className="novae-tour-brand">NOVAÉ</div>
          <button type="button" onClick={finish} className="novae-tour-close" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="novae-tour-eyebrow">{current.eyebrow}</div>

        <h2>{current.title}</h2>
        <p className="novae-tour-body">{current.body}</p>

        <div className="novae-tour-example">{current.example}</div>

        <div className="novae-tour-progress" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
          {STEPS.map((_, index) => (
            <span key={index} className={index === step ? 'active' : ''} />
          ))}
        </div>

        <div className="novae-tour-actions">
          <button
            type="button"
            className="novae-tour-secondary"
            disabled={step === 0}
            onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
          >
            Retour
          </button>

          <button
            type="button"
            className="novae-tour-primary"
            onClick={() => {
              if (isLast) finish()
              else setStep((currentStep) => currentStep + 1)
            }}
          >
            {isLast ? 'J’ai compris' : 'Suivant'}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <button type="button" className="novae-tour-skip" onClick={finish}>
          Passer le tutoriel
        </button>
      </section>

      <style>{`
        .novae-tour-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(47, 38, 35, .46);
          backdrop-filter: blur(7px);
        }

        .novae-tour-card {
          position: fixed;
          z-index: 9999;
          left: 50%;
          top: 50%;
          width: min(calc(100vw - 28px), 520px);
          transform: translate(-50%, -50%);
          padding: 24px;
          border-radius: 26px;
          border: 1px solid rgba(196,149,106,.34);
          background:
            radial-gradient(circle at 100% 0%, rgba(196,149,106,.11), transparent 32%),
            #FFFDFC;
          box-shadow: 0 28px 90px rgba(46,30,27,.28);
          color: #352E2B;
          font-family: var(--novae-font-body, Inter, system-ui, sans-serif);
          animation: novaeTourIn .24s ease;
        }

        .novae-tour-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        }

        .novae-tour-brand {
          color: #C4956A;
          font-family: var(--novae-font-title, "Cormorant Garamond", Georgia, serif);
          font-size: 18px;
          font-weight: 600;
          letter-spacing: .24em;
        }

        .novae-tour-close {
          width: 44px;
          height: 44px;
          border: 1px solid #E8D9CF;
          border-radius: 14px;
          background: #FBF7F1;
          color: #6D625D;
          font-size: 24px;
          cursor: pointer;
        }

        .novae-tour-eyebrow {
          color: #C4956A;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .17em;
        }

        .novae-tour-card h2 {
          margin: 9px 0 12px;
          color: #6E1F3D;
          font-family: var(--novae-font-title, "Cormorant Garamond", Georgia, serif);
          font-size: clamp(31px, 7vw, 42px);
          line-height: 1.02;
          font-weight: 600;
          letter-spacing: -.02em;
        }

        .novae-tour-body {
          margin: 0;
          color: #6D625D;
          font-size: 14px;
          line-height: 1.65;
        }

        .novae-tour-example {
          margin-top: 18px;
          padding: 15px 16px;
          border-radius: 17px;
          border: 1px solid #E8D9CF;
          background: linear-gradient(135deg, #F8ECE9, #FFFDFC);
          color: #6E1F3D;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 700;
        }

        .novae-tour-progress {
          display: flex;
          justify-content: center;
          gap: 7px;
          margin: 22px 0 18px;
        }

        .novae-tour-progress span {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #EAD7C2;
        }

        .novae-tour-progress span.active {
          width: 25px;
          background: #6E1F3D;
        }

        .novae-tour-actions {
          display: flex;
          gap: 10px;
        }

        .novae-tour-secondary,
        .novae-tour-primary {
          min-height: 50px;
          border-radius: 15px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .novae-tour-secondary {
          width: 104px;
          border: 1px solid #E8D9CF;
          background: white;
          color: #6D625D;
        }

        .novae-tour-secondary:disabled {
          opacity: .35;
        }

        .novae-tour-primary {
          flex: 1;
          border: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: white;
          background: linear-gradient(135deg, #6E1F3D, #8A3455);
          box-shadow: 0 10px 28px rgba(110,31,61,.18);
        }

        .novae-tour-primary span {
          color: #EAD7C2;
          font-size: 18px;
        }

        .novae-tour-skip {
          width: 100%;
          min-height: 44px;
          margin-top: 5px;
          border: 0;
          background: transparent;
          color: #8A7D76;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        @keyframes novaeTourIn {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(.99); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @media (max-width: 420px) {
          .novae-tour-card {
            width: calc(100vw - 20px);
            padding: 20px;
            border-radius: 22px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .novae-tour-card { animation: none; }
        }
      `}</style>
    </>
  )
}
