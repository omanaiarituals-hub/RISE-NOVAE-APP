export type BadgeCategory = 'presence' | 'engagement' | 'programme';

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  /** Phrase courte à afficher dans la modale de déblocage et dans le partage communauté */
  meaning: string;
  /** Critère exprimé en langage naturel (pour la page badges) */
  criterion: string;
  /** Symbole décoratif unicode (peut être remplacé par SVG plus tard) */
  glyph: string;
};

export const BADGES: BadgeDefinition[] = [
  // --- Présence (streak) ---
  {
    id: 'first_spark',
    name: 'Première étincelle',
    description: 'Tu as allumé ta flamme.',
    meaning: 'Tout commence par un geste.',
    criterion: 'Allumer la flamme pour la première fois',
    category: 'presence',
    glyph: '✦',
  },
  {
    id: 'glow',
    name: 'Lueur',
    description: 'Trois jours de présence.',
    meaning: 'Une lueur s\'installe.',
    criterion: 'Streak de 3 jours',
    category: 'presence',
    glyph: '✧',
  },
  {
    id: 'perseverance',
    name: 'Persévérance',
    description: 'Sept jours de présence consécutifs.',
    meaning: 'Tu reviens, encore.',
    criterion: 'Streak de 7 jours',
    category: 'presence',
    glyph: '❋',
  },
  {
    id: 'constance',
    name: 'Constance',
    description: 'Quatorze jours de fidélité à toi-même.',
    meaning: 'La constance prend racine.',
    criterion: 'Streak de 14 jours',
    category: 'presence',
    glyph: '✺',
  },
  {
    id: 'anchor',
    name: 'Ancrage',
    description: 'Trente jours — fin de la phase Reprogrammation.',
    meaning: 'Ta flamme est ancrée.',
    criterion: 'Streak de 30 jours',
    category: 'programme',
    glyph: '⚭',
  },
  {
    id: 'depth',
    name: 'Profondeur',
    description: 'Soixante jours — fin de la phase Action et discipline.',
    meaning: 'Tu touches le profond.',
    criterion: 'Streak de 60 jours',
    category: 'programme',
    glyph: '✤',
  },
  {
    id: 'rebirth',
    name: 'Renaissance',
    description: 'Quatre-vingt-dix jours — phase Expansion accomplie.',
    meaning: 'Renaissance.',
    criterion: 'Streak de 90 jours',
    category: 'programme',
    glyph: '✿',
  },

  // --- Engagement communauté ---
  {
    id: 'first_word',
    name: 'Première parole',
    description: 'Ton premier message dans la communauté.',
    meaning: 'Une voix de plus dans le cercle.',
    criterion: 'Publier son premier post',
    category: 'engagement',
    glyph: '☙',
  },
  {
    id: 'presence_to_others',
    name: 'Présence',
    description: 'Cinq commentaires posés à d\'autres femmes.',
    meaning: 'Tu prends le temps d\'être là.',
    criterion: 'Laisser 5 commentaires',
    category: 'engagement',
    glyph: '◈',
  },
  {
    id: 'support',
    name: 'Soutien',
    description: 'Dix encouragements donnés.',
    meaning: 'Ta bienveillance se voit.',
    criterion: 'Laisser 10 likes',
    category: 'engagement',
    glyph: '♡',
  },
];

export const BADGES_BY_ID: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGES.map((b) => [b.id, b])
);

/** Renvoie la liste des badges_id qu'une utilisatrice doit débloquer
 * vu un streak donné. Renvoie ceux liés au streak/programme uniquement.
 * Les badges d'engagement sont déclenchés ailleurs (via triggerCommunityBadge).
 */
export function badgesUnlockedByStreak(currentStreak: number): string[] {
  const out: string[] = [];
  if (currentStreak >= 1) out.push('first_spark');
  if (currentStreak >= 3) out.push('glow');
  if (currentStreak >= 7) out.push('perseverance');
  if (currentStreak >= 14) out.push('constance');
  if (currentStreak >= 30) out.push('anchor');
  if (currentStreak >= 60) out.push('depth');
  if (currentStreak >= 90) out.push('rebirth');
  return out;
}