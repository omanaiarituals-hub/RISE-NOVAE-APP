export type TaskIdentityRecord = {
  id?: string
  title: string
  description?: string | null
  due_date?: string | null
  due_time?: string | null
  category?: string | null
}

export type TaskIdentityComparison = {
  score: number
  level: 'none' | 'possible' | 'probable' | 'strong'
  reasons: string[]
  normalizedLeft: string
  normalizedRight: string
}

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'ce',
  'cette',
  'ces',
  'de',
  'des',
  'du',
  'en',
  'et',
  'faire',
  'la',
  'le',
  'les',
  'ma',
  'mes',
  'mon',
  'pour',
  'sa',
  'ses',
  'son',
  'sur',
  'un',
  'une',
  'vers',
  'dans',
  'chez',
  'avant',
  'apres',
  'plus',
  'tache',
  'todo',
])

const TOKEN_ALIASES: Record<string, string> = {
  appeler: 'contacter',
  appel: 'contacter',
  contacte: 'contacter',
  contacter: 'contacter',
  telephone: 'contacter',
  telephoner: 'contacter',

  envoyer: 'envoyer',
  envoi: 'envoyer',
  expedier: 'envoyer',
  transmettre: 'envoyer',
  transmission: 'envoyer',
  remettre: 'envoyer',
  deposer: 'envoyer',

  payer: 'payer',
  paiement: 'payer',
  regler: 'payer',
  reglement: 'payer',

  acheter: 'acheter',
  achat: 'acheter',
  commander: 'acheter',
  commande: 'acheter',

  reserver: 'reserver',
  reservation: 'reserver',
  prendre: 'prendre',
  fixer: 'prendre',
  planifier: 'planifier',
  programmer: 'planifier',

  verifier: 'verifier',
  controle: 'verifier',
  controler: 'verifier',

  dossier: 'dossier',
  dossiers: 'dossier',
  document: 'document',
  documents: 'document',
  papier: 'document',
  papiers: 'document',
  justificatif: 'justificatif',
  justificatifs: 'justificatif',

  secu: 'cpam',
  securite: 'cpam',
  sociale: 'cpam',
  cpam: 'cpam',
  caf: 'caf',
  impots: 'impots',
  impot: 'impots',
  ameli: 'cpam',
}

const ACTION_TOKENS = new Set([
  'acheter',
  'contacter',
  'envoyer',
  'payer',
  'planifier',
  'prendre',
  'reserver',
  'verifier',
])

const ORGANIZATION_TOKENS = new Set([
  'caf',
  'cpam',
  'impots',
  'urssaf',
  'banque',
  'assurance',
  'ecole',
  'college',
  'lycee',
])

function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function singularize(token: string): string {
  if (token.length > 5 && token.endsWith('es')) return token.slice(0, -2)
  if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1)
  return token
}

export function normalizeTaskSemanticText(value: string): string {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/['’ʼ]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function taskSemanticTokens(value: string): string[] {
  const rawTokens = normalizeTaskSemanticText(value).split(' ').filter(Boolean)
  const result: string[] = []

  for (const rawToken of rawTokens) {
    const singular = singularize(rawToken)
    const canonical = TOKEN_ALIASES[rawToken] || TOKEN_ALIASES[singular] || singular
    if (!canonical || STOP_WORDS.has(canonical) || canonical.length < 2) continue
    if (!result.includes(canonical)) result.push(canonical)
  }

  return result
}

function setIntersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0

  left.forEach((value) => {
    if (right.has(value)) count += 1
  })

  return count
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  if (leftSet.size === 0 && rightSet.size === 0) return 1
  const intersection = setIntersectionSize(leftSet, rightSet)
  const unionSet = new Set<string>()

  leftSet.forEach((value) => {
    unionSet.add(value)
  })

  rightSet.forEach((value) => {
    unionSet.add(value)
  })

  const union = unionSet.size
  return union === 0 ? 0 : intersection / union
}

function bigrams(value: string): Set<string> {
  const compact = normalizeTaskSemanticText(value).replace(/\s+/g, '')
  const result = new Set<string>()
  if (compact.length < 2) {
    if (compact) result.add(compact)
    return result
  }
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.add(compact.slice(index, index + 2))
  }
  return result
}

function diceCoefficient(left: string, right: string): number {
  const leftBigrams = bigrams(left)
  const rightBigrams = bigrams(right)
  if (leftBigrams.size === 0 && rightBigrams.size === 0) return 1
  const intersection = setIntersectionSize(leftBigrams, rightBigrams)
  return (2 * intersection) / Math.max(1, leftBigrams.size + rightBigrams.size)
}

function firstTokenFromSet(tokens: string[], candidates: Set<string>): string | null {
  return tokens.find((token) => candidates.has(token)) || null
}

function datesCompatible(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return true
  return left === right
}

function timesCompatible(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return true
  return left.slice(0, 5) === right.slice(0, 5)
}

export function compareTaskIdentity(
  left: TaskIdentityRecord,
  right: TaskIdentityRecord
): TaskIdentityComparison {
  // L'identité d'une tâche est portée d'abord par son titre.
  // Une description longue ou formulée différemment ne doit pas faire chuter
  // artificiellement la similarité de deux intitulés équivalents.
  const leftTitleTokens = taskSemanticTokens(left.title)
  const rightTitleTokens = taskSemanticTokens(right.title)
  const leftAllTokens = taskSemanticTokens(`${left.title} ${left.description || ''}`)
  const rightAllTokens = taskSemanticTokens(`${right.title} ${right.description || ''}`)
  const leftSet = new Set(leftTitleTokens)
  const rightSet = new Set(rightTitleTokens)
  const reasons: string[] = []

  const tokenScore = jaccard(leftTitleTokens, rightTitleTokens)
  const characterScore = diceCoefficient(left.title, right.title)
  let score = tokenScore * 0.58 + characterScore * 0.2

  const leftAction =
    firstTokenFromSet(leftTitleTokens, ACTION_TOKENS) ||
    firstTokenFromSet(leftAllTokens, ACTION_TOKENS)
  const rightAction =
    firstTokenFromSet(rightTitleTokens, ACTION_TOKENS) ||
    firstTokenFromSet(rightAllTokens, ACTION_TOKENS)
  if (leftAction && rightAction) {
    if (leftAction === rightAction) {
      score += 0.15
      reasons.push(`même action (${leftAction})`)
    } else {
      score -= 0.25
      reasons.push('actions différentes')
    }
  }

  const leftOrganizations = leftAllTokens.filter((token) =>
    ORGANIZATION_TOKENS.has(token)
  )
  const rightOrganizations = rightAllTokens.filter((token) =>
    ORGANIZATION_TOKENS.has(token)
  )
  const organizationOverlap = setIntersectionSize(
    new Set(leftOrganizations),
    new Set(rightOrganizations)
  )
  if (organizationOverlap > 0) {
    score += 0.12
    reasons.push('même organisme ou contexte')
  } else if (leftOrganizations.length > 0 && rightOrganizations.length > 0) {
    score -= 0.12
    reasons.push('organismes différents')
  }

  const sharedImportantTokens: string[] = []

  leftSet.forEach((token) => {
    if (rightSet.has(token) && !ACTION_TOKENS.has(token)) {
      sharedImportantTokens.push(token)
    }
  })
  if (sharedImportantTokens.length >= 2) {
    score += 0.08
    reasons.push('mêmes éléments principaux')
  } else if (sharedImportantTokens.length === 1) {
    score += 0.03
  }

  if (left.description && right.description) {
    const descriptionScore = jaccard(
      taskSemanticTokens(left.description),
      taskSemanticTokens(right.description)
    )
    if (descriptionScore >= 0.6) {
      score += 0.04
      reasons.push('descriptions compatibles')
    }
  }

  const normalizedLeft = normalizeTaskSemanticText(left.title)
  const normalizedRight = normalizeTaskSemanticText(right.title)
  if (
    normalizedLeft &&
    normalizedRight &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  ) {
    score += 0.08
    reasons.push('un intitulé contient l’autre')
  }

  if (datesCompatible(left.due_date, right.due_date)) {
    if (left.due_date && right.due_date) {
      score += 0.05
      reasons.push('même échéance')
    }
  } else {
    score -= 0.18
    reasons.push('échéances différentes')
  }

  if (!timesCompatible(left.due_time, right.due_time)) {
    score -= 0.08
    reasons.push('heures différentes')
  }

  if (left.category && right.category && left.category !== right.category) {
    score -= 0.05
  }

  score = Math.max(0, Math.min(1, score))
  const roundedScore = Math.round(score * 1000) / 1000

  return {
    score: roundedScore,
    level:
      roundedScore >= 0.9
        ? 'strong'
        : roundedScore >= 0.76
          ? 'probable'
          : roundedScore >= 0.58
            ? 'possible'
            : 'none',
    reasons,
    normalizedLeft,
    normalizedRight,
  }
}

export function findLikelyDuplicatePairs<T extends TaskIdentityRecord>(
  tasks: T[],
  minimumScore = 0.76
): Array<{ left: T; right: T; comparison: TaskIdentityComparison }> {
  const pairs: Array<{ left: T; right: T; comparison: TaskIdentityComparison }> = []

  for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const left = tasks[leftIndex]
      const right = tasks[rightIndex]
      const comparison = compareTaskIdentity(left, right)
      if (comparison.score >= minimumScore) {
        pairs.push({ left, right, comparison })
      }
    }
  }

  return pairs.sort((a, b) => b.comparison.score - a.comparison.score)
}

export function findBestTaskMatches<T extends TaskIdentityRecord>(
  query: string,
  tasks: T[],
  minimumScore = 0.45
): Array<{ task: T; comparison: TaskIdentityComparison }> {
  const queryTask: TaskIdentityRecord = { title: query }
  return tasks
    .map((task) => ({ task, comparison: compareTaskIdentity(queryTask, task) }))
    .filter((candidate) => candidate.comparison.score >= minimumScore)
    .sort((a, b) => b.comparison.score - a.comparison.score)
}




