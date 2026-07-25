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
    border: '#BFD4C2',

    success: '#22764D',
    warning: '#9B6815',
    danger: '#9F2525',

    categories: {
      daily: 'linear-gradient(135deg, #D9EDD3 0%, #BFDDB6 100%)',
      admin: 'linear-gradient(135deg, #D2E8D9 0%, #AFCFBD 100%)',
      finance: 'linear-gradient(135deg, #E2EBC0 0%, #C8D98D 100%)',
      family: 'linear-gradient(135deg, #D7ECDC 0%, #B6D5C5 100%)',
      meals: 'linear-gradient(135deg, #EEF2CF 0%, #D2DD9B 100%)',
      planner: 'linear-gradient(135deg, #CAE3D4 0%, #A5CBB6 100%)',
      routines: 'linear-gradient(135deg, #D9EAC6 0%, #BDD49B 100%)',
      vault: 'linear-gradient(135deg, #B7D3C5 0%, #8DB7A2 100%)',
      transformation: 'linear-gradient(135deg, #E3EBD5 0%, #C8D7AB 100%)',
      learning: 'linear-gradient(135deg, #EEF6E8 0%, #D2E6C9 100%)',
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
    border: '#BFD0E4',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: 'linear-gradient(135deg, #D9E7F7 0%, #BFD3EC 100%)',
      admin: 'linear-gradient(135deg, #CDDCF0 0%, #ACC3DF 100%)',
      finance: 'linear-gradient(135deg, #D8E5F2 0%, #B8CDE5 100%)',
      family: 'linear-gradient(135deg, #E1D9F2 0%, #C8B9E4 100%)',
      meals: 'linear-gradient(135deg, #E4EDF7 0%, #C7D9EC 100%)',
      planner: 'linear-gradient(135deg, #C5D8EE 0%, #A4BBD9 100%)',
      routines: 'linear-gradient(135deg, #D6E4F4 0%, #B8CDE7 100%)',
      vault: 'linear-gradient(135deg, #B8CBE3 0%, #92ABC9 100%)',
      transformation: 'linear-gradient(135deg, #E2DAF4 0%, #C7B7E5 100%)',
      learning: 'linear-gradient(135deg, #EDF4FB 0%, #D2DFEE 100%)',
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
    border: '#E3C1AB',

    success: '#2F7A4F',
    warning: '#9C5F11',
    danger: '#9F2525',

    categories: {
      daily: 'linear-gradient(135deg, #F8DDCB 0%, #EFBF9F 100%)',
      admin: 'linear-gradient(135deg, #F2CDBA 0%, #DFA487 100%)',
      finance: 'linear-gradient(135deg, #F5D7A6 0%, #E7B867 100%)',
      family: 'linear-gradient(135deg, #F7D6C8 0%, #EAB39B 100%)',
      meals: 'linear-gradient(135deg, #F9E1B7 0%, #EBC374 100%)',
      planner: 'linear-gradient(135deg, #EBC8B3 0%, #D49F82 100%)',
      routines: 'linear-gradient(135deg, #F4D3BF 0%, #E1AC8E 100%)',
      vault: 'linear-gradient(135deg, #E3B9A3 0%, #C78A6E 100%)',
      transformation: 'linear-gradient(135deg, #F3D8CD 0%, #E4B6A1 100%)',
      learning: 'linear-gradient(135deg, #FAE9DA 0%, #F0CCAA 100%)',
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
    border: '#C9C2B6',

    success: '#2F7A4F',
    warning: '#9A6417',
    danger: '#9F2525',

    categories: {
      daily: 'linear-gradient(135deg, #E4E0D7 0%, #CFC7B9 100%)',
      admin: 'linear-gradient(135deg, #D9D6CE 0%, #BEB8AC 100%)',
      finance: 'linear-gradient(135deg, #E6DDCB 0%, #CDBF9F 100%)',
      family: 'linear-gradient(135deg, #E0DCD8 0%, #C8C0B9 100%)',
      meals: 'linear-gradient(135deg, #EDE4D2 0%, #D2C39F 100%)',
      planner: 'linear-gradient(135deg, #D2CDC3 0%, #B3AB9C 100%)',
      routines: 'linear-gradient(135deg, #DEDAD2 0%, #C2BAAE 100%)',
      vault: 'linear-gradient(135deg, #C7C0B4 0%, #A69B8B 100%)',
      transformation: 'linear-gradient(135deg, #E3DFDA 0%, #C9C0B7 100%)',
      learning: 'linear-gradient(135deg, #F0EDE7 0%, #D8D0C4 100%)',
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
    border: '#D4C4E5',

    success: '#2F7A4F',
    warning: '#A65E12',
    danger: '#9F2525',

    categories: {
      daily: 'linear-gradient(135deg, #EBE1F6 0%, #D5C4EB 100%)',
      admin: 'linear-gradient(135deg, #E2D5F2 0%, #CBB6E6 100%)',
      finance: 'linear-gradient(135deg, #EDE4F4 0%, #D5C4E3 100%)',
      family: 'linear-gradient(135deg, #EDDCEE 0%, #D8BBDD 100%)',
      meals: 'linear-gradient(135deg, #F1E8F6 0%, #DCC9EA 100%)',
      planner: 'linear-gradient(135deg, #D8C9EA 0%, #BDA7D8 100%)',
      routines: 'linear-gradient(135deg, #E8DDF4 0%, #D1BDE7 100%)',
      vault: 'linear-gradient(135deg, #CDBDDF 0%, #A98FC8 100%)',
      transformation: 'linear-gradient(135deg, #EBD7EE 0%, #D5B4DC 100%)',
      learning: 'linear-gradient(135deg, #F5EFFA 0%, #E0D0F0 100%)',
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