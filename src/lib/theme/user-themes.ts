export type UserThemeKey =
  | 'novae_bordeaux'
  | 'deep_emerald'
  | 'midnight_blue'
  | 'terracotta_sun'
  | 'soft_graphite'
  | 'calm_lavender'

export type UserFontStyle = 'modern' | 'soft_elegant' | 'focus_pro'
export type UserInterfaceDensity = 'comfort' | 'compact' | 'focus'
export type UserTileStyle =
  | 'soft_transparent'
  | 'solid_cards'
  | 'minimal_lines'
export type UserHomeLayout =
  | 'universe_cards'
  | 'focus_today'
  | 'dashboard'

export type UserPointMode = 'cards' | 'timeline' | 'metrics'

export type UserThemePalette = {
  key: UserThemeKey
  name: string
  description: string
  background: string
  surface: string
  surfaceAlt: string
  primary: string
  primarySoft: string
  secondary: string
  accent: string
  metal: string
  heroStart: string
  heroEnd: string
  heroText: string
  textMain: string
  textMuted: string
  border: string
  success: string
  warning: string
  danger: string
  shadow: string
  isDark: boolean
  categories: {
    daily: string
    admin: string
    finance: string
    family: string
    meals: string
    planner: string
    routines: string
    vault: string
    transformation: string
    learning: string
  }
}

export type UserFontOption = {
  key: UserFontStyle
  name: string
  description: string
  titleClassName: string
  bodyClassName: string
}

export type UserDensityOption = {
  key: UserInterfaceDensity
  name: string
  description: string
  cardPadding: number
  gap: number
  radius: number
}

export type UserInterfacePreset = {
  id: 'choice_1' | 'choice_2' | 'choice_3' | 'choice_4'
  number: 1 | 2 | 3 | 4
  label: string
  description: string
  themeKey: UserThemeKey
  fontStyle: UserFontStyle
  interfaceDensity: UserInterfaceDensity
  tileStyle: UserTileStyle
  homeLayout: UserHomeLayout
  pointMode: UserPointMode
  reducedMotion: boolean
  highContrast: boolean
}

const VEGETAL_CATEGORIES = {
  daily: '#F2E8D8',
  admin: '#E4EADD',
  finance: '#EFE4CA',
  family: '#E7E1D9',
  meals: '#E9E4D4',
  planner: '#DDE5DD',
  routines: '#E7E0D0',
  vault: '#D7DFD5',
  transformation: '#ECE5DE',
  learning: '#F2EEE7',
}

const CELESTIAL_CATEGORIES = {
  daily: '#E8EDF4',
  admin: '#E2E9F2',
  finance: '#F0E6CF',
  family: '#ECE4EE',
  meals: '#F2E8D8',
  planner: '#DCE5F0',
  routines: '#E5EAF1',
  vault: '#D7DFEA',
  transformation: '#E8E0EF',
  learning: '#F2F4F7',
}

const EDITORIAL_CATEGORIES = {
  daily: '#F2E8EF',
  admin: '#EFE4EC',
  finance: '#F3E8D7',
  family: '#EDE2EA',
  meals: '#F2E8E1',
  planner: '#E8E1EC',
  routines: '#ECE2E7',
  vault: '#E2D9E6',
  transformation: '#EFDDEB',
  learning: '#F5EEF3',
}

const MASCULINE_CATEGORIES = {
  daily: '#1A2025',
  admin: '#171D22',
  finance: '#211D17',
  family: '#1D1D21',
  meals: '#201E19',
  planner: '#17212A',
  routines: '#1C2023',
  vault: '#11171C',
  transformation: '#211A20',
  learning: '#171A1D',
}

export const USER_THEME_PALETTES: Record<UserThemeKey, UserThemePalette> = {
  deep_emerald: {
    key: 'deep_emerald',
    name: 'Épure végétale',
    description:
      'Ivoire, vert profond et or doux. Élégant, calme et organique.',
    background: '#FBF8F2',
    surface: '#FFFDF9',
    surfaceAlt: '#F5F0E8',
    primary: '#173D32',
    primarySoft: '#E1E8DF',
    secondary: '#6D5A3E',
    accent: '#B88A4B',
    metal: '#C69A5B',
    heroStart: '#193D33',
    heroEnd: '#0D2B25',
    heroText: '#FFFDF8',
    textMain: '#1C2924',
    textMuted: '#6D6A61',
    border: '#E4D8C9',
    success: '#2F7A4F',
    warning: '#A66D1D',
    danger: '#9F2525',
    shadow: 'rgba(39, 52, 45, 0.14)',
    isDark: false,
    categories: VEGETAL_CATEGORIES,
  },

  midnight_blue: {
    key: 'midnight_blue',
    name: 'Nuit céleste',
    description:
      'Bleu nuit, ivoire et or lumineux. Structuré, premium et spectaculaire.',
    background: '#FBF9F5',
    surface: '#FFFDF9',
    surfaceAlt: '#F5F3EF',
    primary: '#071D38',
    primarySoft: '#E5EAF1',
    secondary: '#17365D',
    accent: '#B98232',
    metal: '#D1A458',
    heroStart: '#061A33',
    heroEnd: '#020D1D',
    heroText: '#FFFDF9',
    textMain: '#0E2744',
    textMuted: '#657184',
    border: '#DED9D1',
    success: '#2F7A4F',
    warning: '#A66D1D',
    danger: '#9F2525',
    shadow: 'rgba(7, 29, 56, 0.16)',
    isDark: false,
    categories: CELESTIAL_CATEGORIES,
  },

  calm_lavender: {
    key: 'calm_lavender',
    name: 'Douceur éditoriale',
    description:
      'Crème, prune et or rosé. Raffiné, chaleureux et très éditorial.',
    background: '#FBF7F6',
    surface: '#FFFDFC',
    surfaceAlt: '#F3ECEF',
    primary: '#5A294F',
    primarySoft: '#EADFE7',
    secondary: '#7A536E',
    accent: '#B07B63',
    metal: '#C89A72',
    heroStart: '#5A294F',
    heroEnd: '#33182F',
    heroText: '#FFF9FC',
    textMain: '#3B2035',
    textMuted: '#7A6874',
    border: '#E5D8DE',
    success: '#2F7A4F',
    warning: '#A66D1D',
    danger: '#9F2525',
    shadow: 'rgba(78, 36, 68, 0.14)',
    isDark: false,
    categories: EDITORIAL_CATEGORIES,
  },

  soft_graphite: {
    key: 'soft_graphite',
    name: 'Signature masculine',
    description:
      'Noir graphite, bleu profond et or chaud. Sobre, puissant et premium.',
    background: '#0B0F12',
    surface: '#12171B',
    surfaceAlt: '#181E22',
    primary: '#D09A57',
    primarySoft: '#2A241D',
    secondary: '#9E784B',
    accent: '#E0AE6B',
    metal: '#D7A25C',
    heroStart: '#07131F',
    heroEnd: '#03080D',
    heroText: '#F7F2E9',
    textMain: '#F4F0E9',
    textMuted: '#AAA9A5',
    border: '#5E4A32',
    success: '#5AA779',
    warning: '#D09A57',
    danger: '#D46D6D',
    shadow: 'rgba(0, 0, 0, 0.42)',
    isDark: true,
    categories: MASCULINE_CATEGORIES,
  },

  // Anciennes valeurs conservées uniquement pour ne pas casser
  // les comptes qui les ont encore en base.
  novae_bordeaux: {
    key: 'novae_bordeaux',
    name: 'Épure végétale',
    description: 'Ancienne valeur redirigée vers le choix 1.',
    background: '#FBF8F2',
    surface: '#FFFDF9',
    surfaceAlt: '#F5F0E8',
    primary: '#173D32',
    primarySoft: '#E1E8DF',
    secondary: '#6D5A3E',
    accent: '#B88A4B',
    metal: '#C69A5B',
    heroStart: '#193D33',
    heroEnd: '#0D2B25',
    heroText: '#FFFDF8',
    textMain: '#1C2924',
    textMuted: '#6D6A61',
    border: '#E4D8C9',
    success: '#2F7A4F',
    warning: '#A66D1D',
    danger: '#9F2525',
    shadow: 'rgba(39, 52, 45, 0.14)',
    isDark: false,
    categories: VEGETAL_CATEGORIES,
  },

  terracotta_sun: {
    key: 'terracotta_sun',
    name: 'Douceur éditoriale',
    description: 'Ancienne valeur redirigée vers le choix 3.',
    background: '#FBF7F6',
    surface: '#FFFDFC',
    surfaceAlt: '#F3ECEF',
    primary: '#5A294F',
    primarySoft: '#EADFE7',
    secondary: '#7A536E',
    accent: '#B07B63',
    metal: '#C89A72',
    heroStart: '#5A294F',
    heroEnd: '#33182F',
    heroText: '#FFF9FC',
    textMain: '#3B2035',
    textMuted: '#7A6874',
    border: '#E5D8DE',
    success: '#2F7A4F',
    warning: '#A66D1D',
    danger: '#9F2525',
    shadow: 'rgba(78, 36, 68, 0.14)',
    isDark: false,
    categories: EDITORIAL_CATEGORIES,
  },
}

export const USER_INTERFACE_PRESETS: UserInterfacePreset[] = [
  {
    id: 'choice_1',
    number: 1,
    label: 'Choix 1',
    description: 'Épure végétale',
    themeKey: 'deep_emerald',
    fontStyle: 'soft_elegant',
    interfaceDensity: 'comfort',
    tileStyle: 'solid_cards',
    homeLayout: 'focus_today',
    pointMode: 'cards',
    reducedMotion: false,
    highContrast: false,
  },
  {
    id: 'choice_2',
    number: 2,
    label: 'Choix 2',
    description: 'Nuit céleste',
    themeKey: 'midnight_blue',
    fontStyle: 'soft_elegant',
    interfaceDensity: 'comfort',
    tileStyle: 'solid_cards',
    homeLayout: 'dashboard',
    pointMode: 'timeline',
    reducedMotion: false,
    highContrast: false,
  },
  {
    id: 'choice_3',
    number: 3,
    label: 'Choix 3',
    description: 'Douceur éditoriale',
    themeKey: 'calm_lavender',
    fontStyle: 'soft_elegant',
    interfaceDensity: 'comfort',
    tileStyle: 'soft_transparent',
    homeLayout: 'focus_today',
    pointMode: 'metrics',
    reducedMotion: false,
    highContrast: false,
  },
  {
    id: 'choice_4',
    number: 4,
    label: 'Choix 4',
    description: 'Signature masculine',
    themeKey: 'soft_graphite',
    fontStyle: 'focus_pro',
    interfaceDensity: 'compact',
    tileStyle: 'solid_cards',
    homeLayout: 'focus_today',
    pointMode: 'cards',
    reducedMotion: false,
    highContrast: true,
  },
]

export const USER_INTERFACE_PRESET_ORDER = USER_INTERFACE_PRESETS.map(
  (preset) => preset.id,
)

export const USER_FONT_OPTIONS: Record<UserFontStyle, UserFontOption> = {
  modern: {
    key: 'modern',
    name: 'Contemporaine',
    description: 'Claire et très lisible.',
    titleClassName: 'font-sans',
    bodyClassName: 'font-sans',
  },
  soft_elegant: {
    key: 'soft_elegant',
    name: 'Éditoriale',
    description: 'Élégante et chaleureuse.',
    titleClassName: 'font-serif',
    bodyClassName: 'font-sans',
  },
  focus_pro: {
    key: 'focus_pro',
    name: 'Signature',
    description: 'Structurée et professionnelle.',
    titleClassName: 'font-serif',
    bodyClassName: 'font-sans',
  },
}

export const USER_DENSITY_OPTIONS: Record<
  UserInterfaceDensity,
  UserDensityOption
> = {
  comfort: {
    key: 'comfort',
    name: 'Confort',
    description: 'Respiration premium.',
    cardPadding: 20,
    gap: 14,
    radius: 22,
  },
  compact: {
    key: 'compact',
    name: 'Compact',
    description: 'Plus structuré.',
    cardPadding: 17,
    gap: 12,
    radius: 20,
  },
  focus: {
    key: 'focus',
    name: 'Focus',
    description: 'Plus calme.',
    cardPadding: 22,
    gap: 18,
    radius: 24,
  },
}

export function normalizeUserThemeKey(
  value: string | null | undefined,
): UserThemeKey {
  if (value === 'deep_emerald') return 'deep_emerald'
  if (value === 'midnight_blue') return 'midnight_blue'
  if (value === 'calm_lavender') return 'calm_lavender'
  if (value === 'soft_graphite') return 'soft_graphite'
  if (value === 'terracotta_sun') return 'calm_lavender'
  return 'deep_emerald'
}

export function getUserThemePalette(
  themeKey: string | null | undefined,
): UserThemePalette {
  return USER_THEME_PALETTES[normalizeUserThemeKey(themeKey)]
}

export function getUserInterfacePreset(
  themeKey: string | null | undefined,
): UserInterfacePreset {
  const normalized = normalizeUserThemeKey(themeKey)

  return (
    USER_INTERFACE_PRESETS.find(
      (preset) => preset.themeKey === normalized,
    ) || USER_INTERFACE_PRESETS[0]
  )
}

export function getUserFontOption(
  fontStyle: string | null | undefined,
): UserFontOption {
  if (
    fontStyle === 'modern' ||
    fontStyle === 'soft_elegant' ||
    fontStyle === 'focus_pro'
  ) {
    return USER_FONT_OPTIONS[fontStyle]
  }

  return USER_FONT_OPTIONS.soft_elegant
}

export function getUserDensityOption(
  density: string | null | undefined,
): UserDensityOption {
  if (
    density === 'comfort' ||
    density === 'compact' ||
    density === 'focus'
  ) {
    return USER_DENSITY_OPTIONS[density]
  }

  return USER_DENSITY_OPTIONS.comfort
}

export const USER_THEME_ORDER: UserThemeKey[] = [
  'deep_emerald',
  'midnight_blue',
  'calm_lavender',
  'soft_graphite',
]

export const USER_FONT_ORDER: UserFontStyle[] = [
  'modern',
  'soft_elegant',
  'focus_pro',
]

export const USER_DENSITY_ORDER: UserInterfaceDensity[] = [
  'comfort',
  'compact',
  'focus',
]
