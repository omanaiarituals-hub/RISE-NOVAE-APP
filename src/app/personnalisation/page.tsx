'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  USER_DENSITY_OPTIONS,
  USER_DENSITY_ORDER,
  USER_FONT_OPTIONS,
  USER_FONT_ORDER,
  USER_THEME_ORDER,
  USER_THEME_PALETTES,
  getUserThemePalette,
  type UserFontStyle,
  type UserHomeLayout,
  type UserInterfaceDensity,
  type UserThemeKey,
  type UserTileStyle,
} from '@/lib/theme/user-themes'

type NovaTone = 'soft' | 'balanced' | 'direct' | 'coach' | 'minimal'
type ReminderStyle = 'gentle' | 'normal' | 'insistent' | 'minimal' | 'urgent_only'
type MentalLoadLevel = 'low' | 'medium' | 'high' | 'overloaded'
type LifeContext =
  | 'not_specified'
  | 'single'
  | 'couple'
  | 'parent'
  | 'solo_parent'
  | 'caregiver'
  | 'student'
  | 'other'
type HouseholdContext =
  | 'not_specified'
  | 'alone'
  | 'with_partner'
  | 'with_children'
  | 'shared_custody'
  | 'family_home'
  | 'other'

type NovaProfileForm = {
  display_name: string
  life_context: LifeContext
  household_context: HouseholdContext
  nova_tone: NovaTone
  reminder_style: ReminderStyle
  mental_load_level: MentalLoadLevel
  main_priorities: string[]
  quiet_hours_start: string
  quiet_hours_end: string
  prefers_push_reminders: boolean
  prefers_email_reminders: boolean
  admin_documents_enabled: boolean
  finance_help_enabled: boolean
  family_help_enabled: boolean
  meals_help_enabled: boolean
  extra_instructions: string
}

type InterfacePreferencesForm = {
  theme_key: UserThemeKey
  font_style: UserFontStyle
  interface_density: UserInterfaceDensity
  tile_style: UserTileStyle
  home_layout: UserHomeLayout
  reduced_motion: boolean
  high_contrast: boolean
}

const DEFAULT_NOVA_PROFILE: NovaProfileForm = {
  display_name: '',
  life_context: 'not_specified',
  household_context: 'not_specified',
  nova_tone: 'balanced',
  reminder_style: 'gentle',
  mental_load_level: 'medium',
  main_priorities: ['admin', 'family', 'planner'],
  quiet_hours_start: '21:00',
  quiet_hours_end: '07:00',
  prefers_push_reminders: true,
  prefers_email_reminders: false,
  admin_documents_enabled: true,
  finance_help_enabled: false,
  family_help_enabled: true,
  meals_help_enabled: true,
  extra_instructions: '',
}

const DEFAULT_INTERFACE_PREFERENCES: InterfacePreferencesForm = {
  theme_key: 'novae_bordeaux',
  font_style: 'modern',
  interface_density: 'comfort',
  tile_style: 'soft_transparent',
  home_layout: 'universe_cards',
  reduced_motion: false,
  high_contrast: false,
}

const LIFE_CONTEXT_OPTIONS: { value: LifeContext; label: string }[] = [
  { value: 'not_specified', label: 'Je préfère ne pas préciser' },
  { value: 'single', label: 'Seule / célibataire' },
  { value: 'couple', label: 'En couple' },
  { value: 'parent', label: 'Parent' },
  { value: 'solo_parent', label: 'Parent solo' },
  { value: 'caregiver', label: 'Aidant / aidante' },
  { value: 'student', label: 'Étudiant / étudiante' },
  { value: 'other', label: 'Autre' },
]

const HOUSEHOLD_CONTEXT_OPTIONS: { value: HouseholdContext; label: string }[] = [
  { value: 'not_specified', label: 'Je préfère ne pas préciser' },
  { value: 'alone', label: 'Je vis seul(e)' },
  { value: 'with_partner', label: 'Je vis avec mon/ma partenaire' },
  { value: 'with_children', label: 'Je vis avec mes enfants' },
  { value: 'shared_custody', label: 'Garde alternée / organisation partagée' },
  { value: 'family_home', label: 'Foyer familial' },
  { value: 'other', label: 'Autre' },
]

const NOVA_TONE_OPTIONS: { value: NovaTone; label: string; description: string }[] = [
  {
    value: 'soft',
    label: 'Douce',
    description: 'Nova rassure, encourage et évite de mettre trop de pression.',
  },
  {
    value: 'balanced',
    label: 'Équilibrée',
    description: 'Nova est claire, aidante et garde un ton naturel.',
  },
  {
    value: 'direct',
    label: 'Directe',
    description: 'Nova va droit au but et t’aide à prioriser sans tourner autour.',
  },
  {
    value: 'coach',
    label: 'Coach',
    description: 'Nova motive, cadre et pousse davantage au passage à l’action.',
  },
  {
    value: 'minimal',
    label: 'Minimaliste',
    description: 'Nova répond court, simple, avec le minimum d’informations utile.',
  },
]

const REMINDER_STYLE_OPTIONS: { value: ReminderStyle; label: string; description: string }[] = [
  {
    value: 'gentle',
    label: 'Doux',
    description: 'Rappels discrets, sans pression inutile.',
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Rappels équilibrés pour ne pas oublier l’essentiel.',
  },
  {
    value: 'insistent',
    label: 'Insistant',
    description: 'Relances plus visibles quand une action importante approche.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Peu de rappels, seulement quand c’est vraiment utile.',
  },
  {
    value: 'urgent_only',
    label: 'Urgences seulement',
    description: 'Nova ne relance que pour les dates importantes ou critiques.',
  },
]

const MENTAL_LOAD_OPTIONS: { value: MentalLoadLevel; label: string; description: string }[] = [
  {
    value: 'low',
    label: 'Faible',
    description: 'Je suis plutôt disponible mentalement.',
  },
  {
    value: 'medium',
    label: 'Moyenne',
    description: 'J’ai besoin d’aide, mais je peux encore gérer.',
  },
  {
    value: 'high',
    label: 'Élevée',
    description: 'J’ai beaucoup de choses en tête.',
  },
  {
    value: 'overloaded',
    label: 'Surcharge',
    description: 'J’ai besoin que Nova simplifie au maximum.',
  },
]

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Administratif' },
  { value: 'finance', label: 'Finances' },
  { value: 'family', label: 'Famille' },
  { value: 'planner', label: 'Planner' },
  { value: 'meals', label: 'Repas / courses' },
  { value: 'routines', label: 'Routines' },
  { value: 'mental_load', label: 'Charge mentale' },
  { value: 'transformation', label: 'Transformation personnelle' },
]

const TILE_STYLE_OPTIONS: { value: UserTileStyle; label: string; description: string }[] = [
  {
    value: 'soft_transparent',
    label: 'Tuiles transparentes',
    description: 'Des cartes douces, légèrement colorées selon les catégories.',
  },
  {
    value: 'solid_cards',
    label: 'Cartes pleines',
    description: 'Des blocs plus visibles, avec plus de présence couleur.',
  },
  {
    value: 'minimal_lines',
    label: 'Lignes minimalistes',
    description: 'Interface plus sobre, avec moins de fonds colorés.',
  },
]

const HOME_LAYOUT_OPTIONS: { value: UserHomeLayout; label: string; description: string }[] = [
  {
    value: 'universe_cards',
    label: 'Univers',
    description: 'Accueil organisé par grands univers de vie.',
  },
  {
    value: 'focus_today',
    label: 'Focus aujourd’hui',
    description: 'Accueil centré sur ce qui compte maintenant.',
  },
  {
    value: 'dashboard',
    label: 'Dashboard',
    description: 'Vue plus complète, avec plusieurs informations visibles.',
  },
]

function isUserThemeKey(value: string | null | undefined): value is UserThemeKey {
  return (
    value === 'novae_bordeaux' ||
    value === 'deep_emerald' ||
    value === 'midnight_blue' ||
    value === 'terracotta_sun' ||
    value === 'soft_graphite' ||
    value === 'calm_lavender'
  )
}

function isUserFontStyle(value: string | null | undefined): value is UserFontStyle {
  return value === 'modern' || value === 'soft_elegant' || value === 'focus_pro'
}

function isUserInterfaceDensity(
  value: string | null | undefined
): value is UserInterfaceDensity {
  return value === 'comfort' || value === 'compact' || value === 'focus'
}

function isUserTileStyle(value: string | null | undefined): value is UserTileStyle {
  return (
    value === 'soft_transparent' ||
    value === 'solid_cards' ||
    value === 'minimal_lines'
  )
}

function isUserHomeLayout(value: string | null | undefined): value is UserHomeLayout {
  return (
    value === 'universe_cards' ||
    value === 'focus_today' ||
    value === 'dashboard'
  )
}

function normalizeTimeValue(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  return value.slice(0, 5)
}

export default function PersonnalisationPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [novaProfile, setNovaProfile] = useState<NovaProfileForm>(DEFAULT_NOVA_PROFILE)
  const [interfacePreferences, setInterfacePreferences] =
    useState<InterfacePreferencesForm>(DEFAULT_INTERFACE_PREFERENCES)

  const selectedTheme = getUserThemePalette(interfacePreferences.theme_key)
  const selectedDensity = USER_DENSITY_OPTIONS[interfacePreferences.interface_density]

  useEffect(() => {
    const loadPersonalisation = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Session introuvable. Reconnecte-toi pour personnaliser NOVAÉ.')
        }

        const { data: profileData, error: profileError } = await supabase
          .from('user_nova_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (profileError) {
          throw new Error(profileError.message)
        }

        const { data: interfaceData, error: interfaceError } = await supabase
          .from('user_interface_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (interfaceError) {
          throw new Error(interfaceError.message)
        }

        if (profileData) {
          setNovaProfile({
            display_name: profileData.display_name || '',
            life_context: profileData.life_context || 'not_specified',
            household_context: profileData.household_context || 'not_specified',
            nova_tone: profileData.nova_tone || 'balanced',
            reminder_style: profileData.reminder_style || 'gentle',
            mental_load_level: profileData.mental_load_level || 'medium',
            main_priorities: Array.isArray(profileData.main_priorities)
              ? profileData.main_priorities
              : [],
            quiet_hours_start: normalizeTimeValue(profileData.quiet_hours_start, '21:00'),
            quiet_hours_end: normalizeTimeValue(profileData.quiet_hours_end, '07:00'),
            prefers_push_reminders: Boolean(profileData.prefers_push_reminders),
            prefers_email_reminders: Boolean(profileData.prefers_email_reminders),
            admin_documents_enabled: Boolean(profileData.admin_documents_enabled),
            finance_help_enabled: Boolean(profileData.finance_help_enabled),
            family_help_enabled: Boolean(profileData.family_help_enabled),
            meals_help_enabled: Boolean(profileData.meals_help_enabled),
            extra_instructions: profileData.extra_instructions || '',
          })
        }

        if (interfaceData) {
          setInterfacePreferences({
            theme_key: isUserThemeKey(interfaceData.theme_key)
              ? interfaceData.theme_key
              : 'novae_bordeaux',
            font_style: isUserFontStyle(interfaceData.font_style)
              ? interfaceData.font_style
              : 'modern',
            interface_density: isUserInterfaceDensity(interfaceData.interface_density)
              ? interfaceData.interface_density
              : 'comfort',
            tile_style: isUserTileStyle(interfaceData.tile_style)
              ? interfaceData.tile_style
              : 'soft_transparent',
            home_layout: isUserHomeLayout(interfaceData.home_layout)
              ? interfaceData.home_layout
              : 'universe_cards',
            reduced_motion: Boolean(interfaceData.reduced_motion),
            high_contrast: Boolean(interfaceData.high_contrast),
          })
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger la personnalisation.'
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadPersonalisation()
  }, [])

  const updateNovaProfile = <Key extends keyof NovaProfileForm>(
    key: Key,
    value: NovaProfileForm[Key]
  ) => {
    setNovaProfile((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const updateInterfacePreferences = <Key extends keyof InterfacePreferencesForm>(
    key: Key,
    value: InterfacePreferencesForm[Key]
  ) => {
    setInterfacePreferences((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const togglePriority = (priority: string) => {
    setNovaProfile((current) => {
      const alreadySelected = current.main_priorities.includes(priority)

      return {
        ...current,
        main_priorities: alreadySelected
          ? current.main_priorities.filter((item) => item !== priority)
          : [...current.main_priorities, priority],
      }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Session introuvable. Reconnecte-toi avant d’enregistrer.')
      }

      const { error: profileSaveError } = await supabase
        .from('user_nova_profiles')
        .upsert({
          user_id: user.id,
          display_name: novaProfile.display_name.trim() || null,
          life_context: novaProfile.life_context,
          household_context: novaProfile.household_context,
          nova_tone: novaProfile.nova_tone,
          reminder_style: novaProfile.reminder_style,
          mental_load_level: novaProfile.mental_load_level,
          main_priorities: novaProfile.main_priorities,
          quiet_hours_start: novaProfile.quiet_hours_start,
          quiet_hours_end: novaProfile.quiet_hours_end,
          prefers_push_reminders: novaProfile.prefers_push_reminders,
          prefers_email_reminders: novaProfile.prefers_email_reminders,
          admin_documents_enabled: novaProfile.admin_documents_enabled,
          finance_help_enabled: novaProfile.finance_help_enabled,
          family_help_enabled: novaProfile.family_help_enabled,
          meals_help_enabled: novaProfile.meals_help_enabled,
          extra_instructions: novaProfile.extra_instructions.trim() || null,
        })

      if (profileSaveError) {
        throw new Error(profileSaveError.message)
      }

      const { error: interfaceSaveError } = await supabase
        .from('user_interface_preferences')
        .upsert({
          user_id: user.id,
          theme_key: interfacePreferences.theme_key,
          font_style: interfacePreferences.font_style,
          interface_density: interfacePreferences.interface_density,
          tile_style: interfacePreferences.tile_style,
          home_layout: interfacePreferences.home_layout,
          reduced_motion: interfacePreferences.reduced_motion,
          high_contrast: interfacePreferences.high_contrast,
        })

      if (interfaceSaveError) {
        throw new Error(interfaceSaveError.message)
      }

      window.localStorage.setItem(
  'novae-interface-preferences',
  JSON.stringify({
    theme_key: interfacePreferences.theme_key,
    interface_density: interfacePreferences.interface_density,
    reduced_motion: interfacePreferences.reduced_motion,
    high_contrast: interfacePreferences.high_contrast,
  })
)

window.dispatchEvent(new Event('novae-theme-updated'))

      setSuccessMessage('Personnalisation enregistrée. Nova pourra utiliser ces préférences progressivement.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Impossible d’enregistrer la personnalisation.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main style={{
        minHeight: '100vh',
        background: '#FBF7F2',
        padding: '32px 16px',
        color: '#2B2320',
      }}>
        <section style={{
          maxWidth: 920,
          margin: '0 auto',
          background: '#FFFFFF',
          border: '1px solid #EADDD2',
          borderRadius: 24,
          padding: 24,
        }}>
          Chargement de ta personnalisation...
        </section>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: selectedTheme.background,
      padding: '32px 16px',
      color: selectedTheme.textMain,
    }}>
      <section style={{
        maxWidth: 980,
        margin: '0 auto',
        background: selectedTheme.surface,
        border: `1px solid ${selectedTheme.border}`,
        borderRadius: selectedDensity.radius + 4,
        padding: selectedDensity.cardPadding + 4,
        boxShadow: '0 18px 45px rgba(55, 35, 25, 0.08)',
      }}>
        <div style={{ marginBottom: 14 }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: selectedTheme.primary,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← Retour à l’accueil
          </Link>
        </div>

        <p style={{
          margin: '0 0 8px',
          fontSize: 13,
          color: selectedTheme.secondary,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          Personnalisation
        </p>

        <h1 style={{
          margin: '0 0 12px',
          fontSize: 32,
          lineHeight: 1.12,
          color: selectedTheme.primary,
        }}>
          Adapter NOVAÉ à ma vie
        </h1>

        <p style={{
          margin: '0 0 24px',
          color: selectedTheme.textMuted,
          fontSize: 15,
          lineHeight: 1.6,
          maxWidth: 760,
        }}>
          Règle le comportement de Nova, la façon dont elle te rappelle les choses,
          et l’ambiance visuelle de ton application. Pour l’instant, ces préférences
          sont enregistrées et seront appliquées progressivement dans toute l’app.
        </p>

        {error && (
          <MessageBox
            type="error"
            message={error}
            theme={selectedTheme}
          />
        )}

        {successMessage && (
          <MessageBox
            type="success"
            message={successMessage}
            theme={selectedTheme}
          />
        )}

        <div style={{ display: 'grid', gap: selectedDensity.gap + 6 }}>
          <section style={{
            border: `1px solid ${selectedTheme.border}`,
            borderRadius: selectedDensity.radius,
            padding: selectedDensity.cardPadding,
            background: selectedTheme.surfaceAlt,
          }}>
            <h2 style={{ margin: '0 0 8px', color: selectedTheme.primary, fontSize: 24 }}>
              Comment Nova m’aide
            </h2>

            <p style={{ margin: '0 0 18px', color: selectedTheme.textMuted, lineHeight: 1.55 }}>
              Ces réglages serviront à adapter les réponses, les rappels et la priorisation.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: selectedDensity.gap,
            }}>
              <Field label="Comment Nova peut t’appeler ?" theme={selectedTheme}>
                <input
                  value={novaProfile.display_name}
                  onChange={(event) => updateNovaProfile('display_name', event.target.value)}
                  placeholder="Ex : Ness"
                  style={inputStyle(selectedTheme)}
                />
              </Field>

              <Field label="Contexte de vie" theme={selectedTheme}>
                <select
                  value={novaProfile.life_context}
                  onChange={(event) => updateNovaProfile('life_context', event.target.value as LifeContext)}
                  style={inputStyle(selectedTheme)}
                >
                  {LIFE_CONTEXT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Organisation du foyer" theme={selectedTheme}>
                <select
                  value={novaProfile.household_context}
                  onChange={(event) => updateNovaProfile('household_context', event.target.value as HouseholdContext)}
                  style={inputStyle(selectedTheme)}
                >
                  {HOUSEHOLD_CONTEXT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Charge mentale actuelle" theme={selectedTheme}>
                <select
                  value={novaProfile.mental_load_level}
                  onChange={(event) => updateNovaProfile('mental_load_level', event.target.value as MentalLoadLevel)}
                  style={inputStyle(selectedTheme)}
                >
                  {MENTAL_LOAD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <ChoiceSection title="Ton de Nova" theme={selectedTheme}>
              {NOVA_TONE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={novaProfile.nova_tone === option.value}
                  title={option.label}
                  description={option.description}
                  theme={selectedTheme}
                  onClick={() => updateNovaProfile('nova_tone', option.value)}
                />
              ))}
            </ChoiceSection>

            <ChoiceSection title="Style de rappels" theme={selectedTheme}>
              {REMINDER_STYLE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={novaProfile.reminder_style === option.value}
                  title={option.label}
                  description={option.description}
                  theme={selectedTheme}
                  onClick={() => updateNovaProfile('reminder_style', option.value)}
                />
              ))}
            </ChoiceSection>

            <ChoiceSection title="Mes priorités" theme={selectedTheme}>
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePriority(option.value)}
                  style={{
                    border: novaProfile.main_priorities.includes(option.value)
                      ? `1px solid ${selectedTheme.primary}`
                      : `1px solid ${selectedTheme.border}`,
                    borderRadius: 999,
                    padding: '10px 14px',
                    background: novaProfile.main_priorities.includes(option.value)
                      ? selectedTheme.primary
                      : selectedTheme.surface,
                    color: novaProfile.main_priorities.includes(option.value)
                      ? '#FFFFFF'
                      : selectedTheme.primary,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </ChoiceSection>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: selectedDensity.gap,
              marginTop: 18,
            }}>
              <Field label="Ne pas déranger à partir de" theme={selectedTheme}>
                <input
                  type="time"
                  value={novaProfile.quiet_hours_start}
                  onChange={(event) => updateNovaProfile('quiet_hours_start', event.target.value)}
                  style={inputStyle(selectedTheme)}
                />
              </Field>

              <Field label="Reprendre les rappels à" theme={selectedTheme}>
                <input
                  type="time"
                  value={novaProfile.quiet_hours_end}
                  onChange={(event) => updateNovaProfile('quiet_hours_end', event.target.value)}
                  style={inputStyle(selectedTheme)}
                />
              </Field>
            </div>

            <ToggleGrid>
              <ToggleRow
                label="Rappels push"
                description="Recevoir les notifications importantes."
                checked={novaProfile.prefers_push_reminders}
                onChange={(value) => updateNovaProfile('prefers_push_reminders', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Rappels email"
                description="Recevoir certains rappels par email."
                checked={novaProfile.prefers_email_reminders}
                onChange={(value) => updateNovaProfile('prefers_email_reminders', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Aide administrative"
                description="Documents, échéances, rappels administratifs."
                checked={novaProfile.admin_documents_enabled}
                onChange={(value) => updateNovaProfile('admin_documents_enabled', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Aide financière"
                description="Préparer le futur module finances."
                checked={novaProfile.finance_help_enabled}
                onChange={(value) => updateNovaProfile('finance_help_enabled', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Aide famille"
                description="Rendez-vous, enfants, organisation familiale."
                checked={novaProfile.family_help_enabled}
                onChange={(value) => updateNovaProfile('family_help_enabled', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Aide repas"
                description="Repas, courses, charge mentale alimentaire."
                checked={novaProfile.meals_help_enabled}
                onChange={(value) => updateNovaProfile('meals_help_enabled', value)}
                theme={selectedTheme}
              />
            </ToggleGrid>

            <Field label="Instructions personnelles pour Nova" theme={selectedTheme}>
              <textarea
                value={novaProfile.extra_instructions}
                onChange={(event) => updateNovaProfile('extra_instructions', event.target.value)}
                placeholder="Ex : Quand je suis surchargée, donne-moi seulement les 3 actions les plus importantes."
                rows={4}
                style={{
                  ...inputStyle(selectedTheme),
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
            </Field>
          </section>

          <section style={{
            border: `1px solid ${selectedTheme.border}`,
            borderRadius: selectedDensity.radius,
            padding: selectedDensity.cardPadding,
            background: selectedTheme.surface,
          }}>
            <h2 style={{ margin: '0 0 8px', color: selectedTheme.primary, fontSize: 24 }}>
              Comment je veux que mon app soit visuellement
            </h2>

            <p style={{ margin: '0 0 18px', color: selectedTheme.textMuted, lineHeight: 1.55 }}>
              Ces préférences préparent le futur système de thèmes de NOVAÉ.
            </p>

            <h3 style={{ margin: '0 0 12px', color: selectedTheme.primary, fontSize: 17 }}>
              Ambiance couleur
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: selectedDensity.gap,
              marginBottom: 22,
            }}>
              {USER_THEME_ORDER.map((themeKey) => {
                const theme = USER_THEME_PALETTES[themeKey]

                return (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => updateInterfacePreferences('theme_key', theme.key)}
                    style={{
                      textAlign: 'left',
                      border: interfacePreferences.theme_key === theme.key
                        ? `2px solid ${theme.primary}`
                        : `1px solid ${theme.border}`,
                      borderRadius: 18,
                      padding: 14,
                      background: theme.background,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <ColorDot color={theme.primary} />
                      <ColorDot color={theme.primarySoft} />
                      <ColorDot color={theme.secondary} />
                      <ColorDot color={theme.accent} />
                    </div>

                    <p style={{ margin: '0 0 4px', color: theme.primary, fontWeight: 900 }}>
                      {theme.name}
                    </p>

                    <p style={{ margin: 0, color: theme.textMuted, fontSize: 13, lineHeight: 1.4 }}>
                      {theme.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <ChoiceSection title="Typographie" theme={selectedTheme}>
              {USER_FONT_ORDER.map((fontKey) => {
                const font = USER_FONT_OPTIONS[fontKey]

                return (
                  <ChoiceCard
                    key={font.key}
                    selected={interfacePreferences.font_style === font.key}
                    title={font.name}
                    description={font.description}
                    theme={selectedTheme}
                    onClick={() => updateInterfacePreferences('font_style', font.key)}
                  />
                )
              })}
            </ChoiceSection>

            <ChoiceSection title="Densité de l’interface" theme={selectedTheme}>
              {USER_DENSITY_ORDER.map((densityKey) => {
                const density = USER_DENSITY_OPTIONS[densityKey]

                return (
                  <ChoiceCard
                    key={density.key}
                    selected={interfacePreferences.interface_density === density.key}
                    title={density.name}
                    description={density.description}
                    theme={selectedTheme}
                    onClick={() => updateInterfacePreferences('interface_density', density.key)}
                  />
                )
              })}
            </ChoiceSection>

            <ChoiceSection title="Style des tuiles" theme={selectedTheme}>
              {TILE_STYLE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={interfacePreferences.tile_style === option.value}
                  title={option.label}
                  description={option.description}
                  theme={selectedTheme}
                  onClick={() => updateInterfacePreferences('tile_style', option.value)}
                />
              ))}
            </ChoiceSection>

            <ChoiceSection title="Accueil préféré" theme={selectedTheme}>
              {HOME_LAYOUT_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={interfacePreferences.home_layout === option.value}
                  title={option.label}
                  description={option.description}
                  theme={selectedTheme}
                  onClick={() => updateInterfacePreferences('home_layout', option.value)}
                />
              ))}
            </ChoiceSection>

            <ToggleGrid>
              <ToggleRow
                label="Réduire les animations"
                description="Utile si tu veux une interface plus calme."
                checked={interfacePreferences.reduced_motion}
                onChange={(value) => updateInterfacePreferences('reduced_motion', value)}
                theme={selectedTheme}
              />

              <ToggleRow
                label="Contraste renforcé"
                description="Prépare une meilleure lisibilité visuelle."
                checked={interfacePreferences.high_contrast}
                onChange={(value) => updateInterfacePreferences('high_contrast', value)}
                theme={selectedTheme}
              />
            </ToggleGrid>
          </section>

          <section style={{
            border: `1px solid ${selectedTheme.border}`,
            borderRadius: selectedDensity.radius,
            padding: selectedDensity.cardPadding,
            background: selectedTheme.surfaceAlt,
          }}>
            <h2 style={{ margin: '0 0 8px', color: selectedTheme.primary, fontSize: 22 }}>
              Aperçu rapide
            </h2>

            <p style={{ margin: '0 0 16px', color: selectedTheme.textMuted, lineHeight: 1.5 }}>
              Voici comment les couleurs pourraient se répartir par univers.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: selectedDensity.gap,
            }}>
              <PreviewTile label="Quotidien" color={selectedTheme.categories.daily} theme={selectedTheme} />
              <PreviewTile label="Administratif" color={selectedTheme.categories.admin} theme={selectedTheme} />
              <PreviewTile label="Finances" color={selectedTheme.categories.finance} theme={selectedTheme} />
              <PreviewTile label="Famille" color={selectedTheme.categories.family} theme={selectedTheme} />
              <PreviewTile label="Repas" color={selectedTheme.categories.meals} theme={selectedTheme} />
              <PreviewTile label="Coffre" color={selectedTheme.categories.vault} theme={selectedTheme} />
            </div>
          </section>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'wrap',
            position: 'sticky',
            bottom: 14,
            padding: 12,
            background: selectedTheme.surface,
            border: `1px solid ${selectedTheme.border}`,
            borderRadius: 999,
            boxShadow: '0 12px 30px rgba(55, 35, 25, 0.10)',
          }}>
            <Link
              href="/"
              style={{
                border: `1px solid ${selectedTheme.border}`,
                borderRadius: 999,
                padding: '11px 16px',
                color: selectedTheme.primary,
                textDecoration: 'none',
                fontWeight: 800,
                background: selectedTheme.surface,
              }}
            >
              Annuler
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '11px 18px',
                color: '#FFFFFF',
                background: isSaving ? selectedTheme.secondary : selectedTheme.primary,
                fontWeight: 900,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer ma personnalisation'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function inputStyle(theme: ReturnType<typeof getUserThemePalette>): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: '11px 13px',
    background: theme.surface,
    color: theme.textMain,
    fontSize: 15,
  }
}

function Field({
  label,
  theme,
  children,
}: {
  label: string
  theme: ReturnType<typeof getUserThemePalette>
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{
        display: 'block',
        marginBottom: 6,
        color: theme.primary,
        fontWeight: 800,
        fontSize: 14,
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function ChoiceSection({
  title,
  theme,
  children,
}: {
  title: string
  theme: ReturnType<typeof getUserThemePalette>
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: '0 0 10px', color: theme.primary, fontSize: 17 }}>
        {title}
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 10,
      }}>
        {children}
      </div>
    </div>
  )
}

function ChoiceCard({
  selected,
  title,
  description,
  theme,
  onClick,
}: {
  selected: boolean
  title: string
  description: string
  theme: ReturnType<typeof getUserThemePalette>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: selected ? `2px solid ${theme.primary}` : `1px solid ${theme.border}`,
        borderRadius: 16,
        padding: 14,
        background: selected ? theme.primarySoft : theme.surface,
        color: theme.textMain,
        cursor: 'pointer',
      }}
    >
      <p style={{ margin: '0 0 5px', color: theme.primary, fontWeight: 900 }}>
        {title}
      </p>

      <p style={{ margin: 0, color: theme.textMuted, lineHeight: 1.4, fontSize: 13 }}>
        {description}
      </p>
    </button>
  )
}

function ToggleGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 10,
      marginTop: 18,
    }}>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  theme,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  theme: ReturnType<typeof getUserThemePalette>
}) {
  return (
    <label style={{
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      border: `1px solid ${theme.border}`,
      borderRadius: 16,
      padding: 14,
      background: theme.surface,
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 3 }}
      />

      <span>
        <span style={{ display: 'block', color: theme.primary, fontWeight: 900 }}>
          {label}
        </span>

        <span style={{ display: 'block', color: theme.textMuted, fontSize: 13, lineHeight: 1.4 }}>
          {description}
        </span>
      </span>
    </label>
  )
}

function ColorDot({ color }: { color: string }) {
  return (
    <span style={{
      width: 24,
      height: 24,
      borderRadius: 999,
      background: color,
      border: '1px solid rgba(0,0,0,0.08)',
      display: 'inline-block',
    }} />
  )
}

function PreviewTile({
  label,
  color,
  theme,
}: {
  label: string
  color: string
  theme: ReturnType<typeof getUserThemePalette>
}) {
  return (
    <div style={{
      minHeight: 82,
      borderRadius: 18,
      padding: 14,
      background: color,
      border: `1px solid ${theme.border}`,
    }}>
      <p style={{ margin: 0, color: theme.primary, fontWeight: 900 }}>
        {label}
      </p>

      <p style={{ margin: '8px 0 0', color: theme.textMuted, fontSize: 13 }}>
        Tuile personnalisée
      </p>
    </div>
  )
}

function MessageBox({
  type,
  message,
  theme,
}: {
  type: 'success' | 'error'
  message: string
  theme: ReturnType<typeof getUserThemePalette>
}) {
  return (
    <div style={{
      border: `1px solid ${type === 'success' ? theme.success : theme.danger}`,
      background: type === 'success' ? '#F1FAF4' : '#FFF1F1',
      color: type === 'success' ? theme.success : theme.danger,
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
      fontWeight: 800,
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}