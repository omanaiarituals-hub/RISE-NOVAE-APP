'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  getUserDensityOption,
  getUserInterfacePreset,
  getUserThemePalette,
  normalizeUserThemeKey,
  type UserThemeKey,
} from '@/lib/theme/user-themes'

const CACHE_KEY = 'novae-interface-preferences'

type CachedPreferences = {
  theme_key: UserThemeKey
}

function readCache(): CachedPreferences {
  if (typeof window === 'undefined') {
    return { theme_key: 'deep_emerald' }
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null

    return {
      theme_key: normalizeUserThemeKey(parsed?.theme_key),
    }
  } catch {
    return { theme_key: 'deep_emerald' }
  }
}

function writeCache(themeKey: UserThemeKey) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ theme_key: themeKey }),
    )
  } catch {
    // Le thème reste appliqué même si le stockage local est indisponible.
  }
}

function setVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value)
}

function applyTheme(themeKey: string | null | undefined) {
  const normalized = normalizeUserThemeKey(themeKey)
  const palette = getUserThemePalette(normalized)
  const preset = getUserInterfacePreset(normalized)
  const density = getUserDensityOption(preset.interfaceDensity)
  const root = document.documentElement

  const titleFont =
    preset.id === 'choice_4'
      ? "'Libre Baskerville', Georgia, serif"
      : "'Cormorant Garamond', Georgia, serif"

  const bodyFont =
    preset.id === 'choice_4'
      ? "'Manrope', 'Inter', system-ui, sans-serif"
      : "'Manrope', 'Inter', system-ui, sans-serif"

  setVar('--novae-background', palette.background)
  setVar('--novae-surface', palette.surface)
  setVar('--novae-surface-alt', palette.surfaceAlt)
  setVar('--novae-primary', palette.primary)
  setVar('--novae-primary-soft', palette.primarySoft)
  setVar('--novae-secondary', palette.secondary)
  setVar('--novae-accent', palette.accent)
  setVar('--novae-metal', palette.metal)
  setVar('--novae-hero-start', palette.heroStart)
  setVar('--novae-hero-end', palette.heroEnd)
  setVar('--novae-hero-text', palette.heroText)
  setVar('--novae-text-main', palette.textMain)
  setVar('--novae-text-muted', palette.textMuted)
  setVar('--novae-border', palette.border)
  setVar('--novae-success', palette.success)
  setVar('--novae-warning', palette.warning)
  setVar('--novae-danger', palette.danger)
  setVar('--novae-shadow', palette.shadow)

  setVar('--novae-tile-daily', palette.categories.daily)
  setVar('--novae-tile-admin', palette.categories.admin)
  setVar('--novae-tile-finance', palette.categories.finance)
  setVar('--novae-tile-family', palette.categories.family)
  setVar('--novae-tile-meals', palette.categories.meals)
  setVar('--novae-tile-planner', palette.categories.planner)
  setVar('--novae-tile-routines', palette.categories.routines)
  setVar('--novae-tile-vault', palette.categories.vault)
  setVar('--novae-tile-transformation', palette.categories.transformation)
  setVar('--novae-tile-learning', palette.categories.learning)

  setVar('--novae-font-body', bodyFont)
  setVar('--novae-font-title', titleFont)
  setVar('--novae-title-weight', preset.id === 'choice_4' ? '400' : '500')
  setVar('--novae-title-letter-spacing', preset.id === 'choice_4' ? '-0.015em' : '0')

  setVar('--novae-card-padding', `${density.cardPadding}px`)
  setVar('--novae-gap', `${density.gap}px`)
  setVar('--novae-radius-card', `${density.radius}px`)
  setVar('--novae-radius-small', `${Math.max(12, density.radius - 7)}px`)

  root.dataset.novaeTheme = normalized
  root.dataset.novaePreset = preset.id
  root.dataset.pointMode = preset.pointMode
  root.dataset.dark = String(palette.isDark)

  document.body.style.background = palette.background
  document.body.style.color = palette.textMain
  document.body.style.fontFamily = bodyFont

  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', palette.background)

  writeCache(normalized)
}

export default function UserThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    let cancelled = false

    applyTheme(readCache().theme_key)

    const load = async (userId?: string) => {
      if (!userId) return

      const { data, error } = await supabase
        .from('user_interface_preferences')
        .select('theme_key')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled || error || !data) return
      applyTheme(data.theme_key)
    }

    void supabase.auth.getUser().then(({ data }) => {
      void load(data.user?.id)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void load(session?.user?.id)
      },
    )

    const handleThemeUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme_key?: string }>
      applyTheme(customEvent.detail?.theme_key || readCache().theme_key)
    }

    const handleStorage = () => {
      applyTheme(readCache().theme_key)
    }

    window.addEventListener('novae-theme-updated', handleThemeUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      window.removeEventListener('novae-theme-updated', handleThemeUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return <>{children}</>
}
