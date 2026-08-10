'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { supabase } from '@/lib/supabase/client'
import { NovaeValueIntro } from '@/components/onboarding/NovaeValueIntro'
import {
  USER_THEME_ORDER,
  USER_THEME_PALETTES,
  getUserInterfacePreset,
  normalizeUserThemeKey,
  type UserThemeKey,
} from '@/lib/theme/user-themes'

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
  | 'single_parent'
  | 'blended_family'
  | 'shared_home'
  | 'other'
type CustodyMode = 'full_time' | 'shared' | 'other'
type CustodyPattern = 'weekly' | 'every_two_weeks' | 'one_weekend_month' | 'two_weekends_month' | 'custom'

type ThemeKey = UserThemeKey
type NovaMode = 'discreet' | 'balanced' | 'proactive'

type Answers = {
  display_name: string
  priorities: string[]
  usage_mode: UsageMode | ''
  work_rhythm: WorkRhythm | ''
  household_type: HouseholdType | ''
  household_context: HouseholdType[]
  has_children: boolean | null
  custody_mode: CustodyMode | ''
  custody_pattern: CustodyPattern | ''
  custody_start_day: number | null
  custody_end_day: number | null
  custody_reference_date: string
  custody_custom_interval: number | null
  custody_custom_unit: 'week' | 'month' | ''
  preferred_modules: string[]
  theme_key: ThemeKey
  nova_mode: NovaMode
  notification_channels: string[]
}

const TOTAL_STEPS = 4
const CURRENT_ONBOARDING_VERSION = 3

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

const MODULE_TO_PRIORITY: Record<string, string> = {
  planner: 'calendar',
  todo: 'tasks',
  notes: 'notes',
  documents: 'administrative',
  recipes: 'meals',
  family: 'family',
}

const THEMES = USER_THEME_ORDER.map((key) => USER_THEME_PALETTES[key])


const initialAnswers: Answers = {
  display_name: '',
  priorities: [],
  usage_mode: '',
  work_rhythm: '',
  household_type: '',
  household_context: [],
  has_children: null,
  custody_mode: '',
  custody_pattern: '',
  custody_start_day: null,
  custody_end_day: null,
  custody_reference_date: '',
  custody_custom_interval: null,
  custody_custom_unit: '',
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
  const [valueIntroPreview] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('preview') === '1'
  })
  const [showValueIntro, setShowValueIntro] = useState(() => {
    if (typeof window === 'undefined') return true
    const preview =
      new URLSearchParams(window.location.search).get('preview') === '1'
    if (preview) return true

    try {
      return window.localStorage.getItem('novae-value-intro-v3-seen') !== 'true'
    } catch {
      return true
    }
  })
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
    () => Math.round((Math.max(step, 0) / Math.max(1, TOTAL_STEPS - 1)) * 100),
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
          household_context: Array.isArray(data.household_context)
            ? data.household_context
            : data.household_type
              ? [data.household_type]
              : [],
          has_children:
            typeof data.has_children === 'boolean' ? data.has_children : null,
          custody_mode: data.custody_mode || '',
          custody_pattern: data.custody_pattern || '',
          custody_start_day:
            typeof data.custody_start_day === 'number'
              ? data.custody_start_day
              : null,
          custody_end_day:
            typeof data.custody_end_day === 'number'
              ? data.custody_end_day
              : null,
          custody_reference_date: data.custody_reference_date || '',
          custody_custom_interval:
            typeof data.custody_custom_interval === 'number'
              ? data.custody_custom_interval
              : null,
          custody_custom_unit: data.custody_custom_unit || '',
          preferred_modules: Array.isArray(data.preferred_modules)
            ? data.preferred_modules
            : [],
          theme_key: normalizeUserThemeKey(data.theme_key),
          nova_mode: data.nova_mode || 'balanced',
          notification_channels: Array.isArray(data.notification_channels)
            ? data.notification_channels
            : ['in_app'],
        })

        const storedOnboardingVersion = Number(data.onboarding_version || 1)
        const needsOnboardingRefresh =
          Boolean(data.completed_at) &&
          storedOnboardingVersion < CURRENT_ONBOARDING_VERSION

        if (valueIntroPreview) {
          setStep(0)
        } else if (needsOnboardingRefresh) {
          // L'app a fortement évolué : les anciens comptes revoient une fois
          // le nouvel onboarding, avec leurs réponses existantes préremplies.
          setShowValueIntro(true)
          setStep(0)
        } else if (data.completed_at) {
          setShowValueIntro(false)
          setStep(TOTAL_STEPS)
        } else {
          setStep(
            Math.max(
              0,
              Math.min(Number(data.current_step) || 0, TOTAL_STEPS - 1),
            ),
          )
        }
      } else {
        await track('onboarding_displayed', 0)
      }

      setLoadingProfile(false)
    })()
  }, [user, valueIntroPreview])

  async function track(
    eventName: string,
    eventStep: number,
    properties: Record<string, string | number | boolean | string[]> = {},
  ) {
    if (!user || valueIntroPreview) return

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

    if (valueIntroPreview) {
      setError('')
      return true
    }

    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      onboarding_version: CURRENT_ONBOARDING_VERSION,
      display_name: answers.display_name.trim() || null,
      priorities: answers.priorities,
      usage_mode: answers.usage_mode || null,
      work_rhythm: answers.work_rhythm || null,
      household_type:
        answers.household_context[0] || answers.household_type || null,
      household_context: answers.household_context,
      has_children:
        answers.household_context.includes('with_children') ||
        answers.household_context.includes('single_parent') ||
        answers.household_context.includes('blended_family'),
      custody_mode: answers.custody_mode || null,
      custody_pattern:
        answers.custody_mode === 'shared'
          ? answers.custody_pattern || null
          : null,
      custody_start_day:
        answers.custody_mode === 'shared'
          ? answers.custody_start_day
          : null,
      custody_end_day:
        answers.custody_mode === 'shared'
          ? answers.custody_end_day
          : null,
      custody_reference_date:
        answers.custody_mode === 'shared' && answers.custody_reference_date
          ? answers.custody_reference_date
          : null,
      custody_custom_interval:
        answers.custody_mode === 'shared' &&
        answers.custody_pattern === 'custom'
          ? answers.custody_custom_interval
          : null,
      custody_custom_unit:
        answers.custody_mode === 'shared' &&
        answers.custody_pattern === 'custom'
          ? answers.custody_custom_unit || null
          : null,
      preferred_modules: answers.preferred_modules,
      theme_key: 'deep_emerald',
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

    const preset = getUserInterfacePreset(answers.theme_key)
    const interfacePayload = {
      user_id: user.id,
      theme_key: preset.themeKey,
      font_style: preset.fontStyle,
      interface_density: preset.interfaceDensity,
      tile_style: preset.tileStyle,
      home_layout: preset.homeLayout,
      reduced_motion: preset.reducedMotion,
      high_contrast: preset.highContrast,
    }

    const { data: existingInterface, error: interfaceLookupError } = await supabase
      .from('user_interface_preferences')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (interfaceLookupError) {
      console.error('[onboarding-v3] interface lookup failed', interfaceLookupError)
      setError("Tes réponses sont enregistrées, mais l'ambiance n'a pas pu être appliquée.")
      setSaving(false)
      return false
    }

    const interfaceSave = existingInterface
      ? await supabase
          .from('user_interface_preferences')
          .update(interfacePayload)
          .eq('user_id', user.id)
      : await supabase
          .from('user_interface_preferences')
          .insert(interfacePayload)

    if (interfaceSave.error) {
      console.error('[onboarding-v3] interface save failed', interfaceSave.error)
      setError("Tes réponses sont enregistrées, mais l'ambiance n'a pas pu être appliquée.")
      setSaving(false)
      return false
    }

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

    if (!valueIntroPreview) {
      await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user?.id)
    }

    await track('onboarding_completed', TOTAL_STEPS, {
      priorities_count: answers.priorities.length,
      modules_count: answers.preferred_modules.length,
      usage_mode: answers.usage_mode,
      theme_key: answers.theme_key,
      nova_mode: answers.nova_mode,
    })

    setStep(TOTAL_STEPS)
  }

  const currentPalette =
    USER_THEME_PALETTES[normalizeUserThemeKey(answers.theme_key)]

  const onboardingThemeStyle = {
    '--ob-background': currentPalette.background,
    '--ob-surface': currentPalette.surface,
    '--ob-surface-alt': currentPalette.surfaceAlt,
    '--ob-primary': currentPalette.primary,
    '--ob-primary-soft': currentPalette.primarySoft,
    '--ob-secondary': currentPalette.secondary,
    '--ob-accent': currentPalette.accent,
    '--ob-metal': currentPalette.metal,
    '--ob-text': currentPalette.textMain,
    '--ob-muted': currentPalette.textMuted,
    '--ob-border': currentPalette.border,
    '--ob-shadow': currentPalette.shadow,
  } as CSSProperties

  const householdIsValid =
    answers.household_context.length > 0 &&
    (!answers.household_context.includes('single_parent') ||
      (Boolean(answers.custody_mode) &&
        (answers.custody_mode !== 'shared' ||
          (Boolean(answers.custody_pattern) &&
            answers.custody_start_day !== null &&
            answers.custody_end_day !== null &&
            Boolean(answers.custody_reference_date) &&
            (answers.custody_pattern !== 'custom' ||
              (Boolean(answers.custody_custom_interval) &&
                Boolean(answers.custody_custom_unit)))))))

  const canContinue =
    step === 0
      ? Boolean(answers.theme_key)
      : step === 1
        ? answers.display_name.trim().length > 0 &&
          Boolean(answers.usage_mode) &&
          Boolean(answers.work_rhythm) &&
          householdIsValid
        : step === 2
          ? answers.preferred_modules.length === 3
          : step === 3
            ? Boolean(answers.nova_mode)
            : true


  if (!authLoading && !loadingProfile && showValueIntro) {
    return (
      <NovaeValueIntro
        onDone={() => {
          try {
            window.localStorage.setItem('novae-value-intro-v3-seen', 'true')
          } catch {}
          setShowValueIntro(false)
          setStep(0)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    )
  }

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
    <main className="onboarding-shell" style={onboardingThemeStyle}>
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
            <span className="step-label">{step}/3</span>
          </header>
        ) : null}

        {step === 0 ? (
          <div className="welcome-screen configuration-start">
            <p className="eyebrow">Ton espace, à ton image</p>
            <h1>
              Avant de commencer,
              <em> choisis ton ambiance.</em>
            </h1>
            <p className="lead">
              Ce sont exactement les univers de Personnalisation. L’onboarding
              et l’application utilisent la même source : si une palette évolue,
              cet écran évolue avec elle.
            </p>

            <div className="theme-grid configuration-theme-grid">
              {THEMES.map(theme => {
                const selected =
                  normalizeUserThemeKey(answers.theme_key) === theme.key

                return (
                  <button
                    key={theme.key}
                    type="button"
                    className={`theme-card ${selected ? 'selected' : ''}`}
                    onClick={() =>
                      setAnswers(current => ({
                        ...current,
                        theme_key: theme.key,
                      }))
                    }
                  >
                    <div
                      className="theme-preview"
                      style={{
                        background: theme.background,
                        borderColor: theme.border,
                        color: theme.textMain,
                      }}
                    >
                      <i style={{ background: theme.primary }} />
                      <b style={{ background: theme.surfaceAlt }} />
                      <b style={{ background: theme.primarySoft }} />
                      <b style={{ background: theme.accent }} />
                    </div>
                    <strong style={{ color: theme.textMain }}>{theme.name}</strong>
                    <small style={{ color: theme.textMuted }}>
                      {theme.description}
                    </small>
                    <span className="theme-status">
                      {selected ? 'Ambiance sélectionnée' : 'Choisir'}
                    </span>
                  </button>
                )
              })}
            </div>

            <p className="privacy-note">
              Tu pourras changer ce choix plus tard depuis Personnalisation.
            </p>

            <button
              className="primary-button"
              type="button"
              disabled={!canContinue}
              onClick={next}
            >
              Continuer
            </button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="step-screen">
            <p className="eyebrow">1 · Les repères essentiels</p>
            <h2>Quelques réponses pour que Nova sache à qui elle parle.</h2>
            <p className="intro">
              On ne te demande que ce qui change réellement ses propositions :
              comment t’appeler, ton rythme, ta situation et la présence des enfants.
            </p>

            <h3>Comment Nova doit-elle t’appeler&nbsp;?</h3>
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
            />

            <h3>Nova va surtout t’aider pour…</h3>
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

            <h3>Qui fait partie de ton quotidien&nbsp;?</h3>
            <p className="helper">
              Choisis toutes les situations qui correspondent.
            </p>
            <div className="choice-grid two-columns">
              {[
                ['alone', 'Je vis seul·e'],
                ['couple', 'Je vis en couple'],
                ['with_children', 'Je vis avec enfant(s)'],
                ['single_parent', 'Je suis parent solo'],
                ['blended_family', 'Je vis dans une famille recomposée'],
                ['shared_home', 'Je vis en colocation ou dans un foyer partagé'],
                ['other', 'Une autre situation'],
              ].map(([value, label]) => {
                const householdValue = value as HouseholdType
                const selected =
                  answers.household_context.includes(householdValue)

                return (
                  <button
                    key={value}
                    type="button"
                    className={`choice-card ${selected ? 'selected' : ''}`}
                    onClick={() =>
                      setAnswers(current => {
                        let nextContext = current.household_context

                        if (selected) {
                          nextContext = nextContext.filter(
                            item => item !== householdValue,
                          )
                        } else if (householdValue === 'alone') {
                          nextContext = ['alone']
                        } else {
                          nextContext = [
                            ...nextContext.filter(item => item !== 'alone'),
                            householdValue,
                          ]
                        }

                        const isSingleParent =
                          nextContext.includes('single_parent')

                        return {
                          ...current,
                          household_context: nextContext,
                          household_type: nextContext[0] || '',
                          has_children:
                            nextContext.includes('with_children') ||
                            isSingleParent ||
                            nextContext.includes('blended_family'),
                          custody_mode: isSingleParent
                            ? current.custody_mode
                            : '',
                          custody_pattern: isSingleParent
                            ? current.custody_pattern
                            : '',
                          custody_start_day: isSingleParent
                            ? current.custody_start_day
                            : null,
                          custody_end_day: isSingleParent
                            ? current.custody_end_day
                            : null,
                          custody_reference_date: isSingleParent
                            ? current.custody_reference_date
                            : '',
                          custody_custom_interval: isSingleParent
                            ? current.custody_custom_interval
                            : null,
                          custody_custom_unit: isSingleParent
                            ? current.custody_custom_unit
                            : '',
                        }
                      })
                    }
                  >
                    <span>{label}</span>
                    <small>{selected ? 'Sélectionné' : 'Choisir'}</small>
                  </button>
                )
              })}
            </div>

            <p className="selection-count">
              {answers.household_context.length} choix sélectionné
              {answers.household_context.length > 1 ? 's' : ''}
            </p>

            {answers.household_context.includes('single_parent') ? (
              <div className="conditional-panel">
                <h3>Quel est ton rythme de garde&nbsp;?</h3>
                <p className="helper">
                  Cela permettra plus tard d’afficher automatiquement les
                  périodes avec enfants dans le Planner.
                </p>

                <div className="choice-grid three-columns">
                  {[
                    ['full_time', 'Avec moi à temps plein'],
                    ['shared', 'Garde alternée'],
                    ['other', 'Un autre rythme'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`choice-card compact ${
                        answers.custody_mode === value ? 'selected' : ''
                      }`}
                      onClick={() =>
                        setAnswers(current => ({
                          ...current,
                          custody_mode: value as CustodyMode,
                          custody_pattern:
                            value === 'shared'
                              ? current.custody_pattern
                              : '',
                          custody_start_day:
                            value === 'shared'
                              ? current.custody_start_day
                              : null,
                          custody_end_day:
                            value === 'shared'
                              ? current.custody_end_day
                              : null,
                          custody_reference_date:
                            value === 'shared'
                              ? current.custody_reference_date
                              : '',
                          custody_custom_interval:
                            value === 'shared'
                              ? current.custody_custom_interval
                              : null,
                          custody_custom_unit:
                            value === 'shared'
                              ? current.custody_custom_unit
                              : '',
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {answers.custody_mode === 'shared' ? (
                  <>
                    <h3>À quelle fréquence as-tu les enfants&nbsp;?</h3>
                    <div className="choice-grid two-columns">
                      {[
                        ['weekly', 'Chaque semaine'],
                        ['every_two_weeks', 'Une semaine sur deux'],
                        ['one_weekend_month', 'Un week-end par mois'],
                        ['two_weekends_month', 'Deux week-ends par mois'],
                        ['custom', 'Autre fréquence'],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`choice-card compact ${
                            answers.custody_pattern === value
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            setAnswers(current => ({
                              ...current,
                              custody_pattern: value as CustodyPattern,
                              custody_custom_interval:
                                value === 'custom'
                                  ? current.custody_custom_interval
                                  : null,
                              custody_custom_unit:
                                value === 'custom'
                                  ? current.custody_custom_unit
                                  : '',
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {answers.custody_pattern === 'custom' ? (
                      <div className="custom-frequency-grid">
                        <label>
                          <span>Tous les</span>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            className="text-input"
                            value={answers.custody_custom_interval ?? ''}
                            onChange={event =>
                              setAnswers(current => ({
                                ...current,
                                custody_custom_interval:
                                  event.target.value === ''
                                    ? null
                                    : Math.max(
                                        1,
                                        Math.min(
                                          12,
                                          Number(event.target.value),
                                        ),
                                      ),
                              }))
                            }
                          />
                        </label>

                        <label>
                          <span>Période</span>
                          <select
                            className="text-input"
                            value={answers.custody_custom_unit}
                            onChange={event =>
                              setAnswers(current => ({
                                ...current,
                                custody_custom_unit:
                                  event.target.value as 'week' | 'month',
                              }))
                            }
                          >
                            <option value="">Choisir</option>
                            <option value="week">semaine(s)</option>
                            <option value="month">mois</option>
                          </select>
                        </label>
                      </div>
                    ) : null}

                    <h3>Quel jour les récupères-tu généralement&nbsp;?</h3>
                    <div className="day-grid">
                      {[
                        [1, 'Lun'],
                        [2, 'Mar'],
                        [3, 'Mer'],
                        [4, 'Jeu'],
                        [5, 'Ven'],
                        [6, 'Sam'],
                        [0, 'Dim'],
                      ].map(([value, label]) => (
                        <button
                          key={`start-${value}`}
                          type="button"
                          className={`day-button ${
                            answers.custody_start_day === value
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            setAnswers(current => ({
                              ...current,
                              custody_start_day: value as number,
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <h3>Quel jour repartent-ils généralement&nbsp;?</h3>
                    <div className="day-grid">
                      {[
                        [1, 'Lun'],
                        [2, 'Mar'],
                        [3, 'Mer'],
                        [4, 'Jeu'],
                        [5, 'Ven'],
                        [6, 'Sam'],
                        [0, 'Dim'],
                      ].map(([value, label]) => (
                        <button
                          key={`end-${value}`}
                          type="button"
                          className={`day-button ${
                            answers.custody_end_day === value
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() =>
                            setAnswers(current => ({
                              ...current,
                              custody_end_day: value as number,
                            }))
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <h3>Quand commence ta prochaine période avec les enfants&nbsp;?</h3>
                    <input
                      type="date"
                      className="text-input"
                      value={answers.custody_reference_date}
                      onChange={event =>
                        setAnswers(current => ({
                          ...current,
                          custody_reference_date: event.target.value,
                        }))
                      }
                    />

                    <div className="validation-note">
                      Exemple : « chaque semaine, du mercredi au samedi ».
                      Cette date sert uniquement de point de départ pour
                      générer les futurs bandeaux du Planner.
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="validation-note">
              « Je vis seul·e » est exclusif. Les autres choix peuvent être
              combinés, par exemple « En couple » et « Avec enfant(s) ».
            </div>

          </div>
        ) : null}

        {step === 2 ? (
          <div className="step-screen">
            <p className="eyebrow">2 · Ton espace</p>
            <h2>Choisis les 3 espaces que tu veux voir en premier.</h2>
            <p className="intro">
              Cette sélection sert aussi à donner à Nova tes premières priorités.
              Les autres modules restent accessibles à tout moment.
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
                      setAnswers(current => {
                        const preferredModules = toggleLimited(
                          current.preferred_modules,
                          value,
                          3,
                        )

                        return {
                          ...current,
                          preferred_modules: preferredModules,
                          priorities: preferredModules
                            .map(module => MODULE_TO_PRIORITY[module])
                            .filter(Boolean),
                        }
                      })
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

            <div className="validation-note">
              Pas de doublon : ce sont ces trois tuiles qui définissent tes
              modules principaux et tes priorités de départ.
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="step-screen">
            <p className="eyebrow">3 · Ton équilibre avec Nova</p>
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
              Nova a maintenant les premiers repères
              <em> pour t’aider sans repartir de zéro.</em>
            </h1>
            <p className="lead">
              Tes nouveaux repères sont enregistrés. Tu pourras les compléter ou
              les modifier plus tard ; pour l’instant, tu peux simplement parler à Nova.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => router.replace('/nova-v2')}
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
            {step === 3 ? (
              <button
                type="button"
                className="primary-button"
                disabled={!canContinue || saving}
                onClick={finish}
              >
                {saving ? 'Préparation…' : 'Créer mon espace'}
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

  .conditional-panel {
    margin-top: 28px;
    padding: 22px;
    border: 1px solid rgba(23, 63, 52, 0.12);
    border-radius: 20px;
    background: rgba(23, 63, 52, 0.035);
  }

  .custom-frequency-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }

  .custom-frequency-grid label {
    display: grid;
    gap: 7px;
    color: rgba(36, 52, 47, 0.68);
    font-size: 12px;
    font-weight: 700;
  }

  .day-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }

  .day-button {
    min-height: 46px;
    border: 1px solid rgba(23, 63, 52, 0.12);
    border-radius: 12px;
    background: white;
    color: #24342f;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
  }

  .day-button.selected {
    border-color: #d09a59;
    background: rgba(208, 154, 89, 0.12);
    box-shadow: 0 0 0 3px rgba(208, 154, 89, 0.1);
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

    .day-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .custom-frequency-grid {
      grid-template-columns: 1fr;
    }

    h3 {
      font-size: 20px;
    }
  }

  /* V3 — configuration synchronisée avec la personnalisation réelle */
  .onboarding-shell {
    background:
      radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--ob-accent) 16%, transparent), transparent 30%),
      radial-gradient(circle at 90% 88%, color-mix(in srgb, var(--ob-primary) 10%, transparent), transparent 34%),
      var(--ob-background);
    color: var(--ob-text);
  }

  .loading-shell p,
  .lead,
  .intro,
  .helper,
  .selection-count,
  .step-label,
  .choice-card small,
  .module-card small,
  .custom-frequency-grid label {
    color: var(--ob-muted);
  }

  .ambient-one {
    background: color-mix(in srgb, var(--ob-accent) 16%, transparent);
  }

  .ambient-two {
    background: color-mix(in srgb, var(--ob-primary) 10%, transparent);
  }

  .onboarding-card {
    border-color: var(--ob-border);
    background: color-mix(in srgb, var(--ob-surface) 94%, transparent);
    box-shadow: 0 32px 90px var(--ob-shadow);
  }

  .back-button,
  .choice-card,
  .module-card,
  .theme-card,
  .text-input,
  .day-button {
    border-color: var(--ob-border);
    color: var(--ob-text);
  }

  .back-button {
    color: var(--ob-primary);
    background: var(--ob-surface);
  }

  .progress-track {
    background: var(--ob-primary-soft);
  }

  .progress-value {
    background: linear-gradient(90deg, var(--ob-primary), var(--ob-accent));
  }

  .brand-mark,
  .loading-mark,
  .module-icon {
    border-color: var(--ob-metal);
    background: var(--ob-primary);
    color: var(--ob-metal);
    box-shadow: 0 16px 35px var(--ob-shadow);
  }

  .eyebrow {
    color: var(--ob-accent);
  }

  h1,
  h2,
  h3,
  .choice-card.descriptive strong,
  .module-card strong {
    color: var(--ob-primary);
  }

  h1 em {
    color: var(--ob-accent);
  }

  .privacy-note,
  .validation-note,
  .conditional-panel {
    border-color: var(--ob-border);
    background: var(--ob-surface-alt);
    color: var(--ob-muted);
  }

  .text-input {
    background: var(--ob-surface);
    color: var(--ob-text);
  }

  .text-input:focus,
  .choice-card.selected,
  .module-card.selected,
  .theme-card.selected,
  .day-button.selected {
    border-color: var(--ob-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ob-accent) 14%, transparent);
  }

  .choice-card,
  .module-card,
  .theme-card,
  .day-button {
    background: color-mix(in srgb, var(--ob-surface) 94%, transparent);
  }

  .choice-card:hover,
  .module-card:hover,
  .theme-card:hover {
    border-color: var(--ob-accent);
  }

  .primary-button {
    background: linear-gradient(135deg, var(--ob-primary), var(--ob-secondary));
    box-shadow: 0 14px 30px var(--ob-shadow);
  }

  .secondary-button {
    border-color: var(--ob-border);
    color: var(--ob-primary);
  }

  .configuration-start {
    min-height: auto;
  }

  .configuration-theme-grid {
    margin: 26px 0 22px;
  }

  .configuration-theme-grid .theme-card {
    position: relative;
  }

  .theme-status {
    margin-top: auto;
    color: var(--ob-primary);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .05em;
    text-transform: uppercase;
  }

  .setup-preview-card {
    margin: 4px 0 20px;
    padding: 20px;
    display: grid;
    gap: 15px;
    border: 1px solid var(--ob-border);
    border-radius: 20px;
    background: var(--ob-surface-alt);
  }

  .setup-preview-card > div:first-child {
    display: grid;
    gap: 5px;
  }

  .setup-preview-card span {
    color: var(--ob-muted);
    font-size: 12px;
  }

  .setup-preview-card strong {
    color: var(--ob-primary);
    font-family: var(--novae-font-title, Georgia, serif);
    font-size: 20px;
    font-weight: 600;
  }

  .setup-preview-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .setup-preview-chips span {
    padding: 8px 11px;
    border: 1px solid var(--ob-border);
    border-radius: 999px;
    background: var(--ob-surface);
    color: var(--ob-text);
    font-size: 11px;
    font-weight: 700;
  }

  @media (max-width: 720px) {
    .configuration-theme-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .configuration-theme-grid .theme-card {
      min-height: 155px;
      padding: 12px;
    }

    .configuration-theme-grid .theme-preview {
      height: 82px;
    }
  }

  @media (max-width: 390px) {
    .configuration-theme-grid {
      grid-template-columns: 1fr;
    }
  }

  .step-screen > h3 {
    margin-top: 28px;
  }

  .step-screen .conditional-panel {
    margin-bottom: 6px;
  }

  @media (max-width: 720px) {
    .step-screen {
      padding-bottom: 6px;
    }
  }
`
