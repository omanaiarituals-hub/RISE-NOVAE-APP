'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/lib/supabase/client'

type UsageMode = 'personal' | 'professional' | 'mixed'
type WorkRhythm =
  | 'regular'
  | 'variable'
  | 'shift'
  | 'remote'
  | 'independent'
  | 'not_working'
  | 'other'
type HouseholdType =
  | 'alone'
  | 'couple'
  | 'with_children'
  | 'blended_family'
  | 'shared_home'
  | 'other'
type ThemeKey =
  | 'deep_emerald'
  | 'midnight_blue'
  | 'calm_lavender'
  | 'soft_graphite'
type NovaMode = 'discreet' | 'balanced' | 'proactive'

type Answers = {
  display_name: string
  priorities: string[]
  usage_mode: UsageMode | ''
  work_rhythm: WorkRhythm | ''
  household_type: HouseholdType | ''
  has_children: boolean | null
  preferred_modules: string[]
  theme_key: ThemeKey
  nova_mode: NovaMode
  notification_channels: string[]
}

const TOTAL_STEPS = 7

const PRIORITIES = [
  ['calendar', 'Mon temps et mon agenda'],
  ['tasks', 'Mes tâches et ce que je ne veux plus oublier'],
  ['administrative', 'Mes démarches et mes documents'],
  ['family', 'Mon organisation familiale'],
  ['meals', 'Mes repas et mes courses'],
  ['work', 'Mon organisation professionnelle'],
  ['notes', 'Mes notes et mes idées dispersées'],
  ['budget', 'Mon budget du quotidien'],
] as const

const MODULES = [
  ['planner', 'Planner'],
  ['todo', 'To-do'],
  ['notes', 'Notes'],
  ['documents', 'Documents'],
  ['recipes', 'Repas'],
  ['family', 'Famille'],
] as const

const THEMES: Array<{
  key: ThemeKey
  name: string
  description: string
  background: string
  foreground: string
  accent: string
}> = [
  {
    key: 'deep_emerald',
    name: 'Nature',
    description: 'Élégant et apaisant',
    background: '#F4F0E8',
    foreground: '#173F34',
    accent: '#D09A59',
  },
  {
    key: 'midnight_blue',
    name: 'Bleu nuit',
    description: 'Profond et structuré',
    background: '#EAF0F6',
    foreground: '#172A40',
    accent: '#B88A52',
  },
  {
    key: 'calm_lavender',
    name: 'Clair',
    description: 'Doux et éditorial',
    background: '#F5F0F5',
    foreground: '#4D3E57',
    accent: '#B8878D',
  },
  {
    key: 'soft_graphite',
    name: 'Signature',
    description: 'Sobre et affirmé',
    background: '#E8E8E6',
    foreground: '#1E1F21',
    accent: '#B68B58',
  },
]

const initialAnswers: Answers = {
  display_name: '',
  priorities: [],
  usage_mode: '',
  work_rhythm: '',
  household_type: '',
  has_children: null,
  preferred_modules: [],
  theme_key: 'deep_emerald',
  nova_mode: 'balanced',
  notification_channels: ['in_app'],
}

function toggleLimited(
  values: string[],
  value: string,
  limit: number,
): string[] {
  if (values.includes(value)) return values.filter(item => item !== value)
  if (values.length >= limit) return values
  return [...values, value]
}

export default function OnboardingPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>(initialAnswers)
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError] = useState('')
  const sessionId = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-000000000000',
  )

  const progress = useMemo(
    () => Math.round((Math.max(step, 0) / TOTAL_STEPS) * 100),
    [step],
  )

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth')
  }, [authLoading, router, user])

  useEffect(() => {
    if (!user) return

    void (async () => {
      const { data, error: loadError } = await supabase
        .from('onboarding_v2_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (loadError) {
        console.error('[onboarding-v2] load failed', loadError)
        setError("Impossible de charger ton espace pour le moment.")
        setLoadingProfile(false)
        return
      }

      if (data) {
        setAnswers({
          display_name: data.display_name || '',
          priorities: Array.isArray(data.priorities) ? data.priorities : [],
          usage_mode: data.usage_mode || '',
          work_rhythm: data.work_rhythm || '',
          household_type: data.household_type || '',
          has_children:
            typeof data.has_children === 'boolean' ? data.has_children : null,
          preferred_modules: Array.isArray(data.preferred_modules)
            ? data.preferred_modules
            : [],
          theme_key: data.theme_key || 'deep_emerald',
          nova_mode: data.nova_mode || 'balanced',
          notification_channels: Array.isArray(data.notification_channels)
            ? data.notification_channels
            : ['in_app'],
        })

        if (data.completed_at) {
          setStep(TOTAL_STEPS)
        } else {
          setStep(Math.max(0, Math.min(Number(data.current_step) || 0, 6)))
        }
      } else {
        await track('onboarding_displayed', 0)
      }

      setLoadingProfile(false)
    })()
  }, [user])

  async function track(
    eventName: string,
    eventStep: number,
    properties: Record<string, string | number | boolean | string[]> = {},
  ) {
    if (!user) return

    const safeProperties = {
      ...properties,
      viewport:
        typeof window !== 'undefined'
          ? window.innerWidth < 640
            ? 'mobile'
            : window.innerWidth < 1024
              ? 'tablet'
              : 'desktop'
          : 'unknown',
    }

    const { error: trackError } = await supabase
      .from('onboarding_v2_events')
      .insert({
        user_id: user.id,
        session_id: sessionId.current,
        event_name: eventName,
        step: eventStep,
        properties: safeProperties,
      })

    if (trackError) {
      console.error('[onboarding-v2] event failed', trackError)
    }
  }

  async function saveProgress(nextStep: number, completed = false) {
    if (!user) return false

    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      onboarding_version: 2,
      display_name: answers.display_name.trim() || null,
      priorities: answers.priorities,
      usage_mode: answers.usage_mode || null,
      work_rhythm: answers.work_rhythm || null,
      household_type: answers.household_type || null,
      has_children: answers.has_children,
      preferred_modules: answers.preferred_modules,
      theme_key: answers.theme_key,
      nova_mode: answers.nova_mode,
      notification_channels: answers.notification_channels,
      current_step: completed ? TOTAL_STEPS : nextStep,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase
      .from('onboarding_v2_profiles')
      .upsert(payload, { onConflict: 'user_id' })

    if (saveError) {
      console.error('[onboarding-v2] save failed', saveError)
      setError("Tes réponses n'ont pas pu être enregistrées. Réessaie.")
      setSaving(false)
      return false
    }

    if (answers.display_name.trim()) {
      await supabase
        .from('ai_personality_profile')
        .upsert({
          user_id: user.id,
          pseudo: answers.display_name.trim(),
          updated_at: new Date().toISOString(),
        })
    }

    await supabase
      .from('user_interface_preferences')
      .upsert(
        {
          user_id: user.id,
          theme_key: answers.theme_key,
        },
        { onConflict: 'user_id' },
      )

    try {
      window.localStorage.setItem(
        'novae-interface-preferences',
        JSON.stringify({ theme_key: answers.theme_key }),
      )
      window.dispatchEvent(
        new CustomEvent('novae-theme-updated', {
          detail: { theme_key: answers.theme_key },
        }),
      )
    } catch {}

    setSaving(false)
    return true
  }

  async function next() {
    const nextStep = Math.min(step + 1, TOTAL_STEPS)
    const ok = await saveProgress(nextStep)
    if (!ok) return
    await track(step === 0 ? 'onboarding_started' : 'onboarding_step_completed', step)
    setStep(nextStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function previous() {
    const previousStep = Math.max(step - 1, 0)
    await track('onboarding_back_clicked', step)
    setStep(previousStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function finish() {
    const ok = await saveProgress(TOTAL_STEPS, true)
    if (!ok) return

    await supabase
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', user?.id)

    await track('onboarding_completed', TOTAL_STEPS, {
      priorities_count: answers.priorities.length,
      modules_count: answers.preferred_modules.length,
      usage_mode: answers.usage_mode,
      theme_key: answers.theme_key,
      nova_mode: answers.nova_mode,
    })

    setStep(TOTAL_STEPS)
  }

  const canContinue =
    step === 0
      ? true
      : step === 1
        ? answers.display_name.trim().length > 0 &&
          answers.priorities.length > 0
        : step === 2
          ? Boolean(answers.usage_mode) && Boolean(answers.work_rhythm)
          : step === 3
            ? Boolean(answers.household_type) &&
              answers.has_children !== null
            : step === 4
              ? answers.preferred_modules.length === 3
              : step === 5
                ? Boolean(answers.theme_key)
                : step === 6
                  ? Boolean(answers.nova_mode)
                  : true

  if (authLoading || loadingProfile) {
    return (
      <main className="onboarding-shell loading-shell">
        <div className="loading-mark">NO</div>
        <p>Nova prépare ton espace…</p>
        <style jsx>{styles}</style>
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="onboarding-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="onboarding-card">
        {step > 0 && step < TOTAL_STEPS ? (
          <header className="progress-header">
            <button
              type="button"
              className="back-button"
              onClick={previous}
              aria-label="Revenir à l'étape précédente"
            >
              ←
            </button>
            <div className="progress-track" aria-hidden="true">
              <div
                className="progress-value"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="step-label">{step}/6</span>
          </header>
        ) : null}

        {step === 0 ? (
          <div className="welcome-screen">
            <div className="brand-mark">NO</div>
            <p className="eyebrow">Bienvenue dans NOVAÉ</p>
            <h1>
              Bienvenue dans la moitié de ton cerveau qui va gérer ce
              qui t’encombre,
              <em> pour te rendre du temps à vivre.</em>
            </h1>
            <p className="lead">
              En quelques minutes, Nova va préparer un espace qui
              comprend ton quotidien, tes priorités et la manière dont
              tu souhaites être accompagné·e.
            </p>
            <div className="promise-grid">
              <span>Comprendre</span>
              <span>Organiser</span>
              <span>Anticiper</span>
            </div>
            <p className="privacy-note">
              Nous demandons uniquement des informations générales et
              utiles. Pas de données intimes, pas de profilage sensible.
              Tes choix restent modifiables.
            </p>
            <button className="primary-button" type="button" onClick={next}>
              Préparer mon espace
            </button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="step-screen">
            <p className="eyebrow">Pour commencer</p>
            <h2>Comment Nova doit-elle t’appeler&nbsp;?</h2>
            <p className="intro">
              Ton prénom d’usage ou un pseudonyme suffit.
            </p>
            <input
              className="text-input"
              value={answers.display_name}
              onChange={event =>
                setAnswers(current => ({
                  ...current,
                  display_name: event.target.value.slice(0, 40),
                }))
              }
              placeholder="Ton prénom ou ton pseudo"
              autoFocus
            />

            <h3>Qu’est-ce qui te prend le plus de place aujourd’hui&nbsp;?</h3>
            <p className="helper">Choisis jusqu’à 3 priorités.</p>
            <div className="choice-grid two-columns">
              {PRIORITIES.map(([value, label]) => {
                const selected = answers.priorities.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    className={`choice-card ${selected ? 'selected' : ''}`}
                    onClick={() =>
                      setAnswers(current => ({
                        ...current,
                        priorities: toggleLimited(
                          current.priorities,
                          value,
                          3,
                        ),
                      }))
                    }
                  >
                    <span>{label}</span>
                    <small>{selected ? 'Sélectionné' : 'Choisir'}</small>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="step-screen">
            <p className="eyebrow">Ton quotidien</p>
            <h2>Nova va surtout t’aider pour…</h2>
            <div className="choice-grid three-columns">
              {[
                ['personal', 'Ma vie personnelle'],
                ['professional', 'Ma vie professionnelle'],
                ['mixed', 'Les deux'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card ${
                    answers.usage_mode === value ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setAnswers(current => ({
                      ...current,
                      usage_mode: value as UsageMode,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <h3>À quoi ressemble ton rythme principal&nbsp;?</h3>
            <div className="choice-grid two-columns">
              {[
                ['regular', 'Horaires réguliers'],
                ['variable', 'Horaires variables'],
                ['shift', 'Travail posté'],
                ['remote', 'Télétravail'],
                ['independent', 'Indépendant·e'],
                ['not_working', 'Sans activité actuellement'],
                ['other', 'Autre'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card compact ${
                    answers.work_rhythm === value ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setAnswers(current => ({
                      ...current,
                      work_rhythm: value as WorkRhythm,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="step-screen">
            <p className="eyebrow">Ton foyer</p>
            <h2>Qui fait partie de ton quotidien&nbsp;?</h2>
            <p className="intro">
              Une vue générale suffit. Aucun nom ni détail personnel
              n’est demandé.
            </p>
            <div className="choice-grid two-columns">
              {[
                ['alone', 'Je vis seul·e'],
                ['couple', 'En couple'],
                ['with_children', 'Avec enfant(s)'],
                ['blended_family', 'Famille recomposée'],
                ['shared_home', 'Colocation ou foyer partagé'],
                ['other', 'Autre'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card ${
                    answers.household_type === value ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setAnswers(current => ({
                      ...current,
                      household_type: value as HouseholdType,
                      has_children:
                        value === 'with_children' ||
                        value === 'blended_family'
                          ? true
                          : current.has_children,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <h3>Ton organisation comprend-elle des enfants&nbsp;?</h3>
            <div className="choice-grid three-columns">
              <button
                type="button"
                className={`choice-card ${
                  answers.has_children === true ? 'selected' : ''
                }`}
                onClick={() =>
                  setAnswers(current => ({
                    ...current,
                    has_children: true,
                  }))
                }
              >
                Oui
              </button>
              <button
                type="button"
                className={`choice-card ${
                  answers.has_children === false ? 'selected' : ''
                }`}
                onClick={() =>
                  setAnswers(current => ({
                    ...current,
                    has_children: false,
                  }))
                }
              >
                Non
              </button>
              <button
                type="button"
                className={`choice-card ${
                  answers.has_children === null ? 'selected' : ''
                }`}
                onClick={() =>
                  setAnswers(current => ({
                    ...current,
                    has_children: null,
                  }))
                }
              >
                Je préfère ne pas répondre
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="step-screen">
            <p className="eyebrow">Ton espace</p>
            <h2>Choisis les 3 modules que tu veux voir en premier.</h2>
            <p className="intro">
              Les autres resteront accessibles à tout moment.
            </p>
            <div className="module-grid">
              {MODULES.map(([value, label]) => {
                const selected = answers.preferred_modules.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    className={`module-card ${selected ? 'selected' : ''}`}
                    onClick={() =>
                      setAnswers(current => ({
                        ...current,
                        preferred_modules: toggleLimited(
                          current.preferred_modules,
                          value,
                          3,
                        ),
                      }))
                    }
                  >
                    <span className="module-icon">{label.slice(0, 1)}</span>
                    <strong>{label}</strong>
                    <small>{selected ? 'Visible sur l’accueil' : 'Ajouter'}</small>
                  </button>
                )
              })}
            </div>
            <p className="selection-count">
              {answers.preferred_modules.length}/3 sélectionnés
            </p>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="step-screen">
            <p className="eyebrow">Ton univers</p>
            <h2>Dans quelle ambiance veux-tu évoluer&nbsp;?</h2>
            <p className="intro">
              Le thème s’appliquera immédiatement à ton interface.
            </p>
            <div className="theme-grid">
              {THEMES.map(theme => (
                <button
                  key={theme.key}
                  type="button"
                  className={`theme-card ${
                    answers.theme_key === theme.key ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setAnswers(current => ({
                      ...current,
                      theme_key: theme.key,
                    }))
                  }
                  style={{
                    background: theme.background,
                    color: theme.foreground,
                  }}
                >
                  <span
                    className="theme-preview"
                    style={{
                      background: theme.foreground,
                      borderColor: theme.accent,
                    }}
                  >
                    <i style={{ background: theme.accent }} />
                    <b />
                    <b />
                    <b />
                  </span>
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="step-screen">
            <p className="eyebrow">Ton équilibre avec Nova</p>
            <h2>Comment veux-tu qu’elle t’accompagne&nbsp;?</h2>
            <div className="choice-grid">
              {[
                [
                  'discreet',
                  'Discrète',
                  'Nova intervient principalement quand tu la sollicites.',
                ],
                [
                  'balanced',
                  'Équilibrée',
                  'Nova propose son aide quand cela peut réellement t’être utile.',
                ],
                [
                  'proactive',
                  'Proactive',
                  'Nova t’aide à anticiper davantage, sans jamais agir sans validation.',
                ],
              ].map(([value, label, description]) => (
                <button
                  key={value}
                  type="button"
                  className={`choice-card descriptive ${
                    answers.nova_mode === value ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setAnswers(current => ({
                      ...current,
                      nova_mode: value as NovaMode,
                    }))
                  }
                >
                  <strong>{label}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>

            <h3>Comment souhaites-tu être prévenu·e&nbsp;?</h3>
            <p className="helper">
              Les permissions système seront demandées plus tard, au bon
              moment.
            </p>
            <div className="choice-grid three-columns">
              {[
                ['in_app', 'Dans l’application'],
                ['push', 'Notifications push'],
                ['email', 'E-mail'],
              ].map(([value, label]) => {
                const selected =
                  answers.notification_channels.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    className={`choice-card compact ${
                      selected ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setAnswers(current => ({
                        ...current,
                        notification_channels:
                          current.notification_channels.includes(value)
                            ? current.notification_channels.filter(
                                item => item !== value,
                              )
                            : [...current.notification_channels, value],
                      }))
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="validation-note">
              Nova ne crée, ne modifie et n’envoie rien sans ta validation
              explicite.
            </div>
          </div>
        ) : null}

        {step === TOTAL_STEPS ? (
          <div className="welcome-screen completion-screen">
            <div className="brand-mark">NO</div>
            <p className="eyebrow">Ton espace est prêt</p>
            <h1>
              Nova peut maintenant commencer à
              <em> te rendre de l’espace mental.</em>
            </h1>
            <p className="lead">
              Parle-lui d’une chose à organiser, d’une tâche à ne pas
              oublier ou d’un document qui te préoccupe. Elle comprendra,
              proposera, puis attendra ta validation.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={async () => {
                if (!saving) {
                  await track('first_nova_cta_clicked', TOTAL_STEPS)
                  router.replace('/nova-v2')
                }
              }}
            >
              Parler à Nova maintenant
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => router.replace('/')}
            >
              Découvrir mon accueil
            </button>
          </div>
        ) : null}

        {step > 0 && step < TOTAL_STEPS ? (
          <footer className="step-footer">
            {error ? <p className="error-message">{error}</p> : null}
            {step === 6 ? (
              <button
                type="button"
                className="primary-button"
                disabled={!canContinue || saving}
                onClick={finish}
              >
                {saving ? 'Préparation…' : 'Terminer et préparer Nova'}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={!canContinue || saving}
                onClick={next}
              >
                {saving ? 'Enregistrement…' : 'Continuer'}
              </button>
            )}
          </footer>
        ) : null}
      </section>

      <style jsx>{styles}</style>
    </main>
  )
}

const styles = `
  :global(*) {
    box-sizing: border-box;
  }

  .onboarding-shell {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    display: grid;
    place-items: center;
    padding: 32px 18px;
    background:
      radial-gradient(circle at 15% 10%, rgba(208, 154, 89, 0.15), transparent 30%),
      radial-gradient(circle at 90% 85%, rgba(23, 63, 52, 0.12), transparent 34%),
      #f4f0e8;
    color: #24342f;
    font-family: var(--novae-font-body, Inter, Arial, sans-serif);
  }

  .loading-shell {
    align-content: center;
    gap: 16px;
  }

  .loading-shell p {
    margin: 0;
    color: rgba(36, 52, 47, 0.62);
  }

  .ambient {
    position: fixed;
    border-radius: 999px;
    filter: blur(18px);
    pointer-events: none;
  }

  .ambient-one {
    width: 280px;
    height: 280px;
    left: -120px;
    top: -100px;
    background: rgba(208, 154, 89, 0.15);
  }

  .ambient-two {
    width: 360px;
    height: 360px;
    right: -160px;
    bottom: -160px;
    background: rgba(23, 63, 52, 0.12);
  }

  .onboarding-card {
    width: min(100%, 860px);
    min-height: 620px;
    position: relative;
    z-index: 1;
    border: 1px solid rgba(23, 63, 52, 0.12);
    border-radius: 30px;
    padding: clamp(24px, 5vw, 54px);
    background: rgba(255, 253, 249, 0.93);
    box-shadow: 0 32px 90px rgba(39, 47, 43, 0.13);
    backdrop-filter: blur(16px);
  }

  .progress-header {
    display: grid;
    grid-template-columns: 42px 1fr 48px;
    align-items: center;
    gap: 14px;
    margin-bottom: 38px;
  }

  .back-button {
    width: 40px;
    height: 40px;
    border: 1px solid rgba(23, 63, 52, 0.14);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    color: #173f34;
    cursor: pointer;
    font-size: 18px;
  }

  .progress-track {
    height: 5px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(23, 63, 52, 0.09);
  }

  .progress-value {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #173f34, #d09a59);
    transition: width 240ms ease;
  }

  .step-label {
    text-align: right;
    color: rgba(36, 52, 47, 0.56);
    font-size: 12px;
    font-weight: 700;
  }

  .welcome-screen,
  .completion-screen {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }

  .brand-mark,
  .loading-mark {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(208, 154, 89, 0.75);
    border-radius: 22px;
    margin-bottom: 28px;
    background: #173f34;
    color: #d09a59;
    font-family: Georgia, serif;
    font-size: 24px;
    letter-spacing: -3px;
    box-shadow: 0 16px 35px rgba(23, 63, 52, 0.18);
  }

  .eyebrow {
    margin: 0 0 12px;
    color: #a36f35;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3 {
    font-family: var(--novae-font-title, Georgia, serif);
    color: #173f34;
  }

  h1 {
    max-width: 760px;
    margin: 0;
    font-size: clamp(38px, 6vw, 66px);
    font-weight: 500;
    line-height: 1.04;
    letter-spacing: -0.045em;
  }

  h1 em {
    color: #a36f35;
    font-style: normal;
  }

  h2 {
    max-width: 700px;
    margin: 0 0 12px;
    font-size: clamp(32px, 5vw, 50px);
    font-weight: 500;
    line-height: 1.08;
    letter-spacing: -0.035em;
  }

  h3 {
    margin: 34px 0 8px;
    font-size: 22px;
    font-weight: 600;
  }

  .lead,
  .intro {
    max-width: 680px;
    color: rgba(36, 52, 47, 0.7);
    line-height: 1.72;
  }

  .lead {
    margin: 24px 0;
    font-size: 17px;
  }

  .intro {
    margin: 0 0 26px;
    font-size: 15px;
  }

  .helper,
  .selection-count {
    margin: 0 0 14px;
    color: rgba(36, 52, 47, 0.54);
    font-size: 12px;
  }

  .promise-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 4px 0 22px;
  }

  .promise-grid span {
    padding: 9px 14px;
    border: 1px solid rgba(23, 63, 52, 0.12);
    border-radius: 999px;
    background: rgba(23, 63, 52, 0.05);
    color: #173f34;
    font-size: 12px;
    font-weight: 700;
  }

  .privacy-note,
  .validation-note {
    max-width: 690px;
    border: 1px solid rgba(23, 63, 52, 0.11);
    border-radius: 16px;
    padding: 15px 17px;
    background: rgba(23, 63, 52, 0.045);
    color: rgba(36, 52, 47, 0.68);
    font-size: 12px;
    line-height: 1.6;
  }

  .privacy-note {
    margin: 0 0 28px;
  }

  .validation-note {
    margin-top: 28px;
  }

  .text-input {
    width: 100%;
    min-height: 58px;
    border: 1px solid rgba(23, 63, 52, 0.16);
    border-radius: 16px;
    padding: 0 18px;
    outline: none;
    background: white;
    color: #24342f;
    font: inherit;
    font-size: 16px;
  }

  .text-input:focus {
    border-color: #d09a59;
    box-shadow: 0 0 0 4px rgba(208, 154, 89, 0.13);
  }

  .choice-grid,
  .module-grid,
  .theme-grid {
    display: grid;
    gap: 12px;
  }

  .two-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three-columns {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .choice-card,
  .module-card,
  .theme-card {
    min-height: 82px;
    border: 1px solid rgba(23, 63, 52, 0.12);
    border-radius: 17px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.88);
    color: #24342f;
    cursor: pointer;
    text-align: left;
    transition:
      transform 150ms ease,
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .choice-card:hover,
  .module-card:hover,
  .theme-card:hover {
    transform: translateY(-2px);
    border-color: rgba(208, 154, 89, 0.7);
  }

  .choice-card.selected,
  .module-card.selected,
  .theme-card.selected {
    border-color: #d09a59;
    box-shadow: 0 0 0 3px rgba(208, 154, 89, 0.12);
  }

  .choice-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 7px;
    font: inherit;
    font-size: 14px;
    font-weight: 650;
  }

  .choice-card small {
    color: rgba(36, 52, 47, 0.48);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .choice-card.compact {
    min-height: 62px;
  }

  .choice-card.descriptive {
    min-height: 92px;
  }

  .choice-card.descriptive strong {
    color: #173f34;
    font-family: var(--novae-font-title, Georgia, serif);
    font-size: 20px;
  }

  .choice-card.descriptive span {
    color: rgba(36, 52, 47, 0.64);
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
  }

  .module-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .module-card {
    min-height: 148px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 9px;
    font: inherit;
    text-align: center;
  }

  .module-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(208, 154, 89, 0.55);
    border-radius: 15px;
    background: #173f34;
    color: #d09a59;
    font-family: Georgia, serif;
    font-size: 20px;
  }

  .module-card strong {
    color: #173f34;
    font-family: var(--novae-font-title, Georgia, serif);
    font-size: 19px;
  }

  .module-card small {
    color: rgba(36, 52, 47, 0.48);
    font-size: 10px;
  }

  .theme-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .theme-card {
    min-height: 190px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font: inherit;
  }

  .theme-preview {
    height: 102px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-content: end;
    gap: 7px;
    border: 2px solid;
    border-radius: 15px;
    padding: 12px;
    margin-bottom: 6px;
  }

  .theme-preview i {
    grid-column: 1 / -1;
    width: 56%;
    height: 8px;
    border-radius: 999px;
  }

  .theme-preview b {
    height: 38px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
  }

  .theme-card strong {
    font-family: var(--novae-font-title, Georgia, serif);
    font-size: 20px;
  }

  .theme-card small {
    opacity: 0.67;
    font-size: 11px;
  }

  .step-footer {
    margin-top: 34px;
  }

  .primary-button,
  .secondary-button {
    min-height: 54px;
    border-radius: 999px;
    padding: 0 26px;
    font: inherit;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }

  .primary-button {
    border: 0;
    background: #173f34;
    color: white;
    box-shadow: 0 14px 30px rgba(23, 63, 52, 0.18);
  }

  .primary-button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
    box-shadow: none;
  }

  .secondary-button {
    margin-top: 12px;
    border: 1px solid rgba(23, 63, 52, 0.17);
    background: transparent;
    color: #173f34;
  }

  .error-message {
    margin: 0 0 12px;
    color: #9f3f3f;
    font-size: 12px;
  }

  @media (max-width: 720px) {
    .onboarding-shell {
      align-items: stretch;
      padding: 0;
      overflow: visible;
    }

    .onboarding-card {
      min-height: 100vh;
      border: 0;
      border-radius: 0;
      padding: 26px 18px 34px;
      box-shadow: none;
    }

    .welcome-screen,
    .completion-screen {
      min-height: calc(100vh - 60px);
    }

    .two-columns,
    .three-columns,
    .module-grid,
    .theme-grid {
      grid-template-columns: 1fr;
    }

    .module-card {
      min-height: 112px;
    }

    .theme-card {
      min-height: 170px;
    }

    h3 {
      font-size: 20px;
    }
  }
`
