'use client'

import { ReactNode, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  getUserDensityOption,
  getUserThemePalette,
  type UserInterfaceDensity,
  type UserThemeKey,
} from '@/lib/theme/user-themes'

type UserInterfacePreferencesRow = {
  theme_key: string | null
  interface_density: string | null
  reduced_motion: boolean | null
  high_contrast: boolean | null
}

const DEFAULT_THEME_KEY: UserThemeKey = 'novae_bordeaux'
const DEFAULT_DENSITY: UserInterfaceDensity = 'comfort'
const CACHE_KEY = 'novae-interface-preferences'

function applyThemeVariables(params: {
  themeKey?: string | null
  density?: string | null
  reducedMotion?: boolean | null
  highContrast?: boolean | null
}) {
  if (typeof document === 'undefined') return

  const theme = getUserThemePalette(params.themeKey || DEFAULT_THEME_KEY)
  const density = getUserDensityOption(params.density || DEFAULT_DENSITY)
  const root = document.documentElement

  root.style.setProperty('--novae-background', theme.background)
  root.style.setProperty('--novae-surface', theme.surface)
  root.style.setProperty('--novae-surface-alt', theme.surfaceAlt)

  root.style.setProperty('--novae-primary', theme.primary)
  root.style.setProperty('--novae-primary-soft', theme.primarySoft)
  root.style.setProperty('--novae-secondary', theme.secondary)
  root.style.setProperty('--novae-accent', theme.accent)

  root.style.setProperty('--novae-text-main', theme.textMain)
  root.style.setProperty('--novae-text-muted', theme.textMuted)
  root.style.setProperty('--novae-border', theme.border)

  root.style.setProperty('--novae-success', theme.success)
  root.style.setProperty('--novae-warning', theme.warning)
  root.style.setProperty('--novae-danger', theme.danger)

  root.style.setProperty('--novae-tile-daily', theme.categories.daily)
  root.style.setProperty('--novae-tile-admin', theme.categories.admin)
  root.style.setProperty('--novae-tile-finance', theme.categories.finance)
  root.style.setProperty('--novae-tile-family', theme.categories.family)
  root.style.setProperty('--novae-tile-meals', theme.categories.meals)
  root.style.setProperty('--novae-tile-planner', theme.categories.planner)
  root.style.setProperty('--novae-tile-routines', theme.categories.routines)
  root.style.setProperty('--novae-tile-vault', theme.categories.vault)
  root.style.setProperty('--novae-tile-transformation', theme.categories.transformation)
  root.style.setProperty('--novae-tile-learning', theme.categories.learning)

  root.style.setProperty('--novae-card-padding', `${density.cardPadding}px`)
  root.style.setProperty('--novae-gap', `${density.gap}px`)
  root.style.setProperty('--novae-radius', `${density.radius}px`)

  root.style.setProperty('--novae-reduced-motion', params.reducedMotion ? '1' : '0')
  root.style.setProperty('--novae-high-contrast', params.highContrast ? '1' : '0')
}

function cacheThemePreferences(preferences: UserInterfacePreferencesRow) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      theme_key: preferences.theme_key || DEFAULT_THEME_KEY,
      interface_density: preferences.interface_density || DEFAULT_DENSITY,
      reduced_motion: Boolean(preferences.reduced_motion),
      high_contrast: Boolean(preferences.high_contrast),
    })
  )
}

function readCachedThemePreferences(): UserInterfacePreferencesRow | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    return JSON.parse(raw) as UserInterfacePreferencesRow
  } catch {
    return null
  }
}

function applyCachedThemePreferences() {
  const cached = readCachedThemePreferences()

  if (cached) {
    applyThemeVariables({
      themeKey: cached.theme_key,
      density: cached.interface_density,
      reducedMotion: cached.reduced_motion,
      highContrast: cached.high_contrast,
    })
    return
  }

  applyThemeVariables({
    themeKey: DEFAULT_THEME_KEY,
    density: DEFAULT_DENSITY,
    reducedMotion: false,
    highContrast: false,
  })
}

export default function UserThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyCachedThemePreferences()

    const loadThemePreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        const { data, error } = await supabase
          .from('user_interface_preferences')
          .select('theme_key, interface_density, reduced_motion, high_contrast')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error || !data) return

        const preferences = data as UserInterfacePreferencesRow

        applyThemeVariables({
          themeKey: preferences.theme_key,
          density: preferences.interface_density,
          reducedMotion: preferences.reduced_motion,
          highContrast: preferences.high_contrast,
        })

        cacheThemePreferences(preferences)
      } catch {
        // On garde le thème par défaut ou le thème en cache.
      }
    }

    loadThemePreferences()

    const handleThemeUpdate = () => {
      applyCachedThemePreferences()
    }

    window.addEventListener('novae-theme-updated', handleThemeUpdate)
    window.addEventListener('storage', handleThemeUpdate)

    return () => {
      window.removeEventListener('novae-theme-updated', handleThemeUpdate)
      window.removeEventListener('storage', handleThemeUpdate)
    }
  }, [])

  return <>{children}</>
}