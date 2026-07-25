export type UserThemeKey =
  | 'novae_bordeaux'
  | 'deep_emerald'
  | 'midnight_blue'
  | 'terracotta_sun'
  | 'soft_graphite'
  | 'calm_lavender'

export type UserFontStyle =
  | 'modern'
  | 'soft_elegant'
  | 'focus_pro'

export type UserInterfaceDensity =
  | 'comfort'
  | 'compact'
  | 'focus'

export type UserTileStyle =
  | 'soft_transparent'
  | 'solid_cards'
  | 'minimal_lines'

export type UserHomeLayout =
  | 'universe_cards'
  | 'focus_today'
  | 'dashboard'

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

  textMain: string
  textMuted: string
  border: string

  success: string
  warning: string
  danger: string

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

export const USER_THEME_PALETTES: Record<UserThemeKey, UserThemePalette> = {
  novae_bordeaux: {
  key: 'novae_bordeaux',
  name: 'NOVAÉ classique',
  description: 'Le thème d’origine de NOVAÉ : crème, rose poudré, lavande douce, cuivre et ambiance pastel premium.',

    background: '#FBF7F2',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF9F5',
    primary: '#7A2E2A',
    primarySoft: '#F3D8CF',
    secondary: '#B8895E',
    accent: '#D9A66F',

    textMain: '#2B2320',
    textMuted: '#6F625C',
    border: '#EADDD2',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#F8E7DF',
      admin: '#F3D8CF',
      finance: '#F4E2C8',
      family: '#F6DCE6',
      meals: '#F5E9D0',
      planner: '#EADDD2',
      routines: '#F1D9C8',
      vault: '#E8C6BA',
      transformation: '#EFD9E8',
      learning: '#F5EFE8',
    },
  },

  deep_emerald: {
    key: 'deep_emerald',
    name: 'Émeraude profond',
    description: 'Naturel, posé, élégant, avec des nuances vertes rassurantes.',

    background: '#F5F8F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F6EC',
    primary: '#0F5A45',
    primarySoft: '#D8EBDD',
    secondary: '#6F8F5F',
    accent: '#B7C98B',

    textMain: '#1F2B25',
    textMuted: '#5D6A60',
    border: '#DCE8D8',

    success: '#2F7A4F',
    warning: '#A66B12',
    danger: '#9F2525',

    categories: {
      daily: '#E6F2DF',
      admin: '#D8EBDD',
      finance: '#DDEAC8',
      family: '#EAF3DD',
      meals: '#EEF5D7',
      planner: '#D0E5D7',
      routines: '#E2EED4',
      vault: '#C6DDCF',
      transformation: '#E7F0E2',
      learning: '#F2F7EF',
    },
  },

  midnight_blue: {
    key: 'midnight_blue',
    name: 'Bleu nuit',
    description: 'Sobre, mixte, sérieux et très rassurant pour un usage quotidien.',

    background: '#F4F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F4FA',
    primary: '#1E3557',
    primarySoft: '#DCE7F5',
    secondary: '#657C9B',
    accent: '#A9B8D8',

    textMain: '#202733',
    textMuted: '#5F6978',
    border: '#DDE5F0',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#E8EFF8',
      admin: '#DCE7F5',
      finance: '#E3EDF5',
      family: '#E8E4F5',
      meals: '#EDF1F7',
      planner: '#D8E3F2',
      routines: '#E4ECF7',
      vault: '#CDD8EA',
      transformation: '#ECE7F6',
      learning: '#F3F6FA',
    },
  },

  terracotta_sun: {
    key: 'terracotta_sun',
    name: 'Terracotta solaire',
    description: 'Chaleureux, humain, lumineux, avec une énergie douce.',

    background: '#FBF6EF',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF4EA',
    primary: '#A34F35',
    primarySoft: '#F1D6C8',
    secondary: '#C98555',
    accent: '#E4B46F',

    textMain: '#30241F',
    textMuted: '#6F5F56',
    border: '#EBD9CC',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#F8E5D7',
      admin: '#F1D6C8',
      finance: '#F6E1C4',
      family: '#F7DDD3',
      meals: '#F8E8C8',
      planner: '#EED6C7',
      routines: '#F4DAC8',
      vault: '#E8C5B5',
      transformation: '#F4E0D7',
      learning: '#FAEFE5',
    },
  },

  soft_graphite: {
    key: 'soft_graphite',
    name: 'Graphite doux',
    description: 'Minimaliste, professionnel, mixte, plus discret et concentré.',

    background: '#F7F5F1',
    surface: '#FFFFFF',
    surfaceAlt: '#F1EFEB',
    primary: '#2E302D',
    primarySoft: '#E3E1DC',
    secondary: '#77736A',
    accent: '#A89575',

    textMain: '#232321',
    textMuted: '#67645E',
    border: '#E2DED7',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#EDEAE4',
      admin: '#E3E1DC',
      finance: '#ECE5D8',
      family: '#E8E4E2',
      meals: '#F0EADC',
      planner: '#DDDAD4',
      routines: '#E8E5DE',
      vault: '#D7D2C8',
      transformation: '#ECE8E4',
      learning: '#F4F2EE',
    },
  },

  calm_lavender: {
    key: 'calm_lavender',
    name: 'Lavande calme',
    description: 'Apaisant, mental load friendly, doux sans être trop rose.',

    background: '#F8F5FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F0FA',
    primary: '#6A4C93',
    primarySoft: '#E7DFF4',
    secondary: '#9B84B8',
    accent: '#CBB7E8',

    textMain: '#2C2433',
    textMuted: '#6B6072',
    border: '#E5DDEC',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#EFE7F8',
      admin: '#E7DFF4',
      finance: '#EEE8F5',
      family: '#F1E4F1',
      meals: '#F4EDF7',
      planner: '#E2D8EF',
      routines: '#ECE3F6',
      vault: '#D8CCE8',
      transformation: '#F0DFF1',
      learning: '#F8F3FB',
    },
  },
}

export const USER_FONT_OPTIONS: Record<UserFontStyle, UserFontOption> = {
  modern: {
    key: 'modern',
    name: 'Moderne & mixte',
    description: 'Clair, propre, lisible, adapté à tous les profils.',
    titleClassName: 'font-sans',
    bodyClassName: 'font-sans',
  },

  soft_elegant: {
    key: 'soft_elegant',
    name: 'Douce & élégante',
    description: 'Plus premium, plus chaleureuse, adaptée à une ambiance bien-être.',
    titleClassName: 'font-serif',
    bodyClassName: 'font-sans',
  },

  focus_pro: {
    key: 'focus_pro',
    name: 'Focus & pro',
    description: 'Sobre, efficace, moins décoratif, pensé pour la productivité.',
    titleClassName: 'font-sans',
    bodyClassName: 'font-sans',
  },
}

export const USER_DENSITY_OPTIONS: Record<UserInterfaceDensity, UserDensityOption> = {
  comfort: {
    key: 'comfort',
    name: 'Confort',
    description: 'Grandes cartes, respiration visuelle, idéal en charge mentale.',
    cardPadding: 20,
    gap: 14,
    radius: 20,
  },

  compact: {
    key: 'compact',
    name: 'Compact',
    description: 'Plus d’informations visibles à l’écran.',
    cardPadding: 14,
    gap: 10,
    radius: 16,
  },

  focus: {
    key: 'focus',
    name: 'Focus',
    description: 'Interface plus calme, moins d’éléments visibles à la fois.',
    cardPadding: 22,
    gap: 18,
    radius: 24,
  },
}

export function getUserThemePalette(themeKey: string | null | undefined): UserThemePalette {
  if (
    themeKey === 'novae_bordeaux' ||
    themeKey === 'deep_emerald' ||
    themeKey === 'midnight_blue' ||
    themeKey === 'terracotta_sun' ||
    themeKey === 'soft_graphite' ||
    themeKey === 'calm_lavender'
  ) {
    return USER_THEME_PALETTES[themeKey]
  }

  return USER_THEME_PALETTES.novae_bordeaux
}

export function getUserFontOption(fontStyle: string | null | undefined): UserFontOption {
  if (
    fontStyle === 'modern' ||
    fontStyle === 'soft_elegant' ||
    fontStyle === 'focus_pro'
  ) {
    return USER_FONT_OPTIONS[fontStyle]
  }

  return USER_FONT_OPTIONS.modern
}

export function getUserDensityOption(
  density: string | null | undefined
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
  'novae_bordeaux',
  'deep_emerald',
  'midnight_blue',
  'terracotta_sun',
  'soft_graphite',
  'calm_lavender',
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