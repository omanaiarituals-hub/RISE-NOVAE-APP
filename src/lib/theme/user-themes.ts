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
    description: 'Premium, posé, mixte et rassurant, avec un vert plus assumé et une meilleure lisibilité.',

    background: '#F1F7EF',
    surface: '#FBFEF9',
    surfaceAlt: '#E4F0DC',
    primary: '#065F46',
    primarySoft: '#CFE7D9',
    secondary: '#3E7454',
    accent: '#A7BE6B',

    textMain: '#14251D',
    textMuted: '#435649',
    border: '#C9DCC6',

    success: '#22764D',
    warning: '#9B6815',
    danger: '#9F2525',

    categories: {
      daily: '#DDEDD5',
      admin: '#CFE7D9',
      finance: '#E2ECC0',
      family: '#D7EACD',
      meals: '#EEF3C9',
      planner: '#C3DECC',
      routines: '#D7E8C6',
      vault: '#B8D3C5',
      transformation: '#E4EBD4',
      learning: '#EEF5E8',
    },
  },

  midnight_blue: {
    key: 'midnight_blue',
    name: 'Bleu nuit',
    description: 'Sobre, mixte, sérieux et très rassurant pour un assistant de vie quotidien.',

    background: '#F1F5FB',
    surface: '#FBFDFF',
    surfaceAlt: '#DFE8F5',
    primary: '#17365D',
    primarySoft: '#D3E0F0',
    secondary: '#4B6688',
    accent: '#8BA2C8',

    textMain: '#172235',
    textMuted: '#435066',
    border: '#CAD7E8',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#DFEAF7',
      admin: '#D3E0F0',
      finance: '#DDE8F2',
      family: '#E4DFF1',
      meals: '#E7EEF7',
      planner: '#CAD9EC',
      routines: '#DCE7F5',
      vault: '#BCCCE2',
      transformation: '#E5DEF4',
      learning: '#EEF3FA',
    },
  },

  terracotta_sun: {
    key: 'terracotta_sun',
    name: 'Terracotta solaire',
    description: 'Chaleureux, humain, lumineux, avec une énergie douce mais plus structurée.',

    background: '#FFF4E7',
    surface: '#FFFDF9',
    surfaceAlt: '#F7DFCB',
    primary: '#A2462D',
    primarySoft: '#F2CDBA',
    secondary: '#B8663E',
    accent: '#DD9B4A',

    textMain: '#2F2018',
    textMuted: '#5F4B3F',
    border: '#E9CDB9',

    success: '#2F7A4F',
    warning: '#9C5F11',
    danger: '#9F2525',

    categories: {
      daily: '#F8DDCB',
      admin: '#F2CDBA',
      finance: '#F5D7A6',
      family: '#F7D6C8',
      meals: '#F9E1B7',
      planner: '#EBC8B3',
      routines: '#F4D3BF',
      vault: '#E3B9A3',
      transformation: '#F3D8CD',
      learning: '#FAE9DA',
    },
  },

  soft_graphite: {
    key: 'soft_graphite',
    name: 'Graphite doux',
    description: 'Minimaliste, professionnel, mixte, plus concentré, avec davantage de contraste.',

    background: '#F3F1EC',
    surface: '#FCFBF7',
    surfaceAlt: '#E8E4DC',
    primary: '#2F332D',
    primarySoft: '#D9D6CE',
    secondary: '#5F5B52',
    accent: '#9C835B',

    textMain: '#1E1F1C',
    textMuted: '#505049',
    border: '#D3CEC4',

    success: '#2F7A4F',
    warning: '#9A6417',
    danger: '#9F2525',

    categories: {
      daily: '#E5E1D8',
      admin: '#D9D6CE',
      finance: '#E6DDCB',
      family: '#E1DDDA',
      meals: '#EDE4D2',
      planner: '#D2CDC3',
      routines: '#DEDAD2',
      vault: '#C5BFB2',
      transformation: '#E4DFDA',
      learning: '#F0EDE7',
    },
  },

  calm_lavender: {
    key: 'calm_lavender',
    name: 'Lavande calme',
    description: 'Apaisant, mental load friendly, doux, lisible et moins rose.',

    background: '#F7F2FB',
    surface: '#FFFDFE',
    surfaceAlt: '#ECE2F5',
    primary: '#6B4A99',
    primarySoft: '#E2D5F2',
    secondary: '#8167A4',
    accent: '#BFA6E2',

    textMain: '#282131',
    textMuted: '#574D63',
    border: '#DCCFE9',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: '#EBE1F6',
      admin: '#E2D5F2',
      finance: '#EDE4F4',
      family: '#EDDCEE',
      meals: '#F1E8F6',
      planner: '#D8C9EA',
      routines: '#E8DDF4',
      vault: '#CDBDDF',
      transformation: '#EBD7EE',
      learning: '#F5EFFA',
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