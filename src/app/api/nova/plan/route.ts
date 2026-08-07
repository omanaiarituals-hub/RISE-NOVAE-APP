import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNovaActionPlan } from '@/lib/nova-ai/router'
import {
  NOVA_PROVIDER_IDS,
  type NovaActionPlan,
  type NovaProviderPreference,
} from '@/lib/nova-ai/types'
import { rateLimit } from '@/lib/rateLimit'
import { createNovaExecutionToken } from '@/lib/nova-ai/action-token'
import {
  findBestTaskMatches,
  findLikelyDuplicatePairs,
  type TaskIdentityComparison,
} from '@/lib/nova-ai/task-identity'
import {
  findBestCalendarMatches,
  type CalendarIdentityMatch,
} from '@/lib/nova-ai/calendar-identity'
import { formatParisDateTime } from '@/lib/nova-ai/timezone'

export const runtime = 'nodejs'
export const preferredRegion = 'dub1'
export const maxDuration = 30

type ActiveTaskContextRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  due_date: string | null
  due_time: string | null
  status: string
  created_at: string
}

type ActiveCalendarContextRow = {
  id: string
  title: string
  start_date: string
  end_date: string
  location: string | null
  attendees: string[] | null
  status: string | null
  reminder_minutes_before: number[] | null
}

type ActiveReminderContextRow = {
  id: string
  todo_id: string
  scheduled_for: string
  status: string
  message: string | null
}

type DuplicateTaskPair = {
  left: ActiveTaskContextRow
  right: ActiveTaskContextRow
  comparison: TaskIdentityComparison
}

type RequestTaskMatch = {
  task: ActiveTaskContextRow
  comparison: TaskIdentityComparison
}

type RequestCalendarMatch = CalendarIdentityMatch

function actionStartsTitle(title: string): boolean {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return /^(envoyer|contacter|appeler|payer|regler|acheter|reserver|prendre|verifier|transmettre|deposer)\b/.test(
    normalized
  )
}

function chooseTaskToKeep(left: ActiveTaskContextRow, right: ActiveTaskContextRow) {
  const leftScore =
    (actionStartsTitle(left.title) ? 3 : 0) +
    (left.due_date ? 2 : 0) +
    (left.description ? 1 : 0) +
    Math.min(2, left.title.trim().split(/\s+/).length / 4)
  const rightScore =
    (actionStartsTitle(right.title) ? 3 : 0) +
    (right.due_date ? 2 : 0) +
    (right.description ? 1 : 0) +
    Math.min(2, right.title.trim().split(/\s+/).length / 4)

  if (leftScore !== rightScore) return leftScore > rightScore ? left : right
  return new Date(left.created_at).getTime() <= new Date(right.created_at).getTime()
    ? left
    : right
}

function applyTaskIdentityGuard(
  plan: NovaActionPlan,
  message: string,
  duplicatePairs: DuplicateTaskPair[],
  requestMatches: RequestTaskMatch[]
): NovaActionPlan {
  // La garde anti-fusion ne concerne QUE les tâches. Si le plan ne contient
  // aucune action de tâche/rappel/fusion (par exemple uniquement des repas,
  // des courses ou des notes), on le laisse intact : sinon un plan repas
  // déclenchait à tort le message « je ne peux pas relier ces tâches ».
  const planHasTaskActions = plan.proposed_actions.some((action) =>
    ['create_task', 'create_reminder', 'merge_tasks', 'update_task', 'cancel_task'].includes(action.type)
  )
  if (!planHasTaskActions) {
    return plan
  }

  const planContainsMerge = plan.proposed_actions.some(
    (action) => action.type === 'merge_tasks'
  )

  // Le modèle de langage peut soupçonner un doublon, mais il ne doit jamais
  // produire une fusion exécutable sans validation déterministe côté NOVAÉ.
  if (duplicatePairs.length === 0) {
    if (!planContainsMerge) return plan
    return {
      ...plan,
      summary: 'Une proximité a été repérée, mais elle n’est pas encore assez fiable.',
      missing_information: [
        {
          field: 'task_duplicate_confirmation',
          question:
            'Ces tâches semblent proches, mais Nova ne peut pas encore confirmer qu’il s’agit de la même action. Souhaites-tu les conserver séparément ?',
          blocking: true,
        },
      ],
      proposed_actions: [],
      assistant_message:
        'J’ai repéré une ressemblance entre ces tâches, mais pas assez pour proposer une fusion sécurisée. Je les laisse séparées pour le moment.',
    }
  }

  const explicitMergeRequest = /\b(fusionne|fusionner|doublon|meme tache|même tâche|identique)\b/i.test(
    message
  )
  const matchThreshold = explicitMergeRequest ? 0.25 : 0.45
  const topMatchIds = new Set(
    requestMatches
      .filter(({ comparison }) => comparison.score >= matchThreshold)
      .slice(0, 5)
      .map(({ task }) => task.id)
  )
  const planTouchesTasks = plan.proposed_actions.some((action) =>
    ['create_task', 'create_reminder', 'merge_tasks'].includes(action.type)
  )

  const relevantPair =
    duplicatePairs.find(({ left, right }) => {
      const bothMatch = topMatchIds.has(left.id) && topMatchIds.has(right.id)
      const oneMatch = topMatchIds.has(left.id) || topMatchIds.has(right.id)
      return bothMatch || (explicitMergeRequest && oneMatch)
    }) ||
    (explicitMergeRequest && duplicatePairs.length === 1 ? duplicatePairs[0] : undefined)

  if (!relevantPair || (!explicitMergeRequest && !planTouchesTasks)) {
    if (!planContainsMerge) return plan
    return {
      ...plan,
      summary: 'Aucune paire de tâches suffisamment fiable n’a été identifiée.',
      missing_information: [],
      proposed_actions: [],
      assistant_message:
        'Je ne peux pas relier ces tâches avec assez de certitude pour proposer une fusion. Je les conserve séparément.',
    }
  }

  const { left, right, comparison } = relevantPair
  if (
    left.due_date &&
    right.due_date &&
    left.due_date !== right.due_date
  ) {
    return {
      ...plan,
      summary: `Deux tâches similaires ont été trouvées, mais leurs échéances sont différentes.`,
      missing_information: [
        {
          field: 'task_duplicate_dates',
          question: `Les tâches « ${left.title} » et « ${right.title} » semblent proches, mais leurs échéances diffèrent. S’agit-il vraiment de la même démarche ?`,
          blocking: true,
        },
      ],
      proposed_actions: [],
      assistant_message: `J’ai trouvé deux tâches très proches, mais elles n’ont pas la même échéance. Dis-moi si elles correspondent réellement à la même démarche avant que je propose une fusion.`,
    }
  }

  const keep = chooseTaskToKeep(left, right)
  const duplicate = keep.id === left.id ? right : left

  return {
    ...plan,
    summary: `Deux tâches semblent correspondre à la même action (${Math.round(
      comparison.score * 100
    )} % de similarité).`,
    missing_information: [],
    proposed_actions: [
      {
        id: 'merge_tasks_1',
        type: 'merge_tasks',
        engine: 'tasks',
        title: `Fusionner les deux tâches similaires`,
        reason: `Conserver « ${keep.title} » et archiver « ${duplicate.title} ». Les rappels actifs seront rattachés à la tâche conservée sans doublon.`,
        risk: 'medium',
        requires_confirmation: true,
        parameters: [
          { key: 'keep_task_id', value: keep.id },
          { key: 'duplicate_task_id', value: duplicate.id },
          { key: 'keep_title', value: keep.title },
          { key: 'duplicate_title', value: duplicate.title },
        ],
      },
    ],
    assistant_message: `J’ai repéré que « ${left.title} » et « ${right.title} » semblent correspondre à la même tâche. Je te propose de conserver « ${keep.title} » et d’archiver l’autre. Tu confirmes ?`,
  }
}

function buildUserContextFromProfile(profile: Record<string, unknown> | null): string | undefined {
  if (!profile) return undefined
  const lines: string[] = []
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).join(', ') : null

  const name = str(profile.display_name)
  if (name) lines.push(`Prénom : ${name}`)

  const usage = str(profile.usage_mode)
  if (usage) lines.push(`Mode d’usage : ${usage}`)

  const priorities = arr(profile.priorities)
  if (priorities) lines.push(`Priorités : ${priorities}`)

  const rhythm = str(profile.work_rhythm)
  if (rhythm) lines.push(`Rythme : ${rhythm}`)

  const household = str(profile.household_type)
  if (household) lines.push(`Type de foyer : ${household}`)

  const householdCtx = arr(profile.household_context)
  if (householdCtx) lines.push(`Contexte du foyer : ${householdCtx}`)

  if (profile.has_children === true) lines.push('A des enfants : oui')

  if (str(profile.custody_mode)) {
    lines.push('Situation de garde alternée : oui (tenir compte des périodes de présence des enfants)')
  }

  return lines.length > 0 ? lines.join('\n') : undefined
}

type NovaMemoryRow = { key: string | null; value: string | null; scope: string | null }

function formatNovaMemories(rows: NovaMemoryRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined
  const lines = rows
    .filter((r) => r.key && r.value)
    .map((r) => `- ${r.key} : ${r.value}`)
  return lines.length > 0 ? lines.join('\n') : undefined
}

type FamilyMemberRow = {
  data_type: string | null
  relation_to_user: string | null
  is_primary_contact: boolean | null
  notes: string | null
  data: Record<string, unknown> | null
}

function formatFamilyContext(rows: FamilyMemberRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined

  const memberLines = rows
    .filter((row) => !row.data_type || row.data_type === 'member')
    .slice(0, 30)
    .map((r) => {
      const d = r.data || {}
      const name =
        typeof d.firstName === 'string' && d.firstName
          ? d.firstName
          : typeof d.name === 'string'
            ? d.name
            : 'Proche'
      const parts: string[] = [name]
      if (r.relation_to_user) parts.push(r.relation_to_user)
      if (typeof d.category === 'string' && d.category) parts.push(`cercle : ${d.category}`)
      if (d.isHouseholdMember === true) parts.push('membre du foyer')
      if (typeof d.birthDate === 'string' && d.birthDate) parts.push(`né(e) le ${d.birthDate}`)
      const allergies = Array.isArray(d.allergies)
        ? d.allergies.filter((a) => typeof a === 'string' && a)
        : []
      if (allergies.length > 0) parts.push(`allergies : ${allergies.join(', ')}`)
      if (typeof d.healthNotes === 'string' && d.healthNotes.trim()) {
        parts.push(`santé : ${d.healthNotes.trim()}`)
      }
      if (typeof d.dietaryRegime === 'string' && d.dietaryRegime.trim()) {
        parts.push(`régime/habitudes alimentaires : ${d.dietaryRegime.trim()}`)
      }
      const foodPreferences = Array.isArray(d.foodPreferences)
        ? d.foodPreferences.filter((value) => typeof value === 'string' && value)
        : []
      if (foodPreferences.length > 0) parts.push(`aime : ${foodPreferences.join(', ')}`)
      const foodDislikes = Array.isArray(d.foodDislikes)
        ? d.foodDislikes.filter((value) => typeof value === 'string' && value)
        : []
      if (foodDislikes.length > 0) parts.push(`n’aime pas : ${foodDislikes.join(', ')}`)
      if (typeof d.phone === 'string' && d.phone.trim()) parts.push(`téléphone : ${d.phone.trim()}`)
      if (typeof d.email === 'string' && d.email.trim()) parts.push(`e-mail : ${d.email.trim()}`)
      if (r.is_primary_contact || d.isPrimaryContact === true) parts.push('contact principal')
      return `- ${parts.join(' — ')}`
    })

  const custodyConfigRow = rows.find((row) => row.data_type === 'custody_config')
  const custodyLines: string[] = []
  if (custodyConfigRow?.data) {
    const d = custodyConfigRow.data
    const modeLabels: Record<string, string> = {
      full_time: 'enfants avec l’utilisatrice à temps plein',
      alternate_weeks: 'une semaine sur deux',
      fixed_days: 'jours fixes chaque semaine',
      custom: 'organisation personnalisée',
    }
    const mode = typeof d.mode === 'string' ? d.mode : ''
    custodyLines.push(`- Rythme habituel : ${modeLabels[mode] || mode || 'non précisé'}`)
    if (typeof d.referenceDate === 'string' && d.referenceDate) {
      custodyLines.push(`- Date de référence d’une période avec les enfants : ${d.referenceDate}`)
    }
    if (Array.isArray(d.fixedDays) && d.fixedDays.length > 0) {
      custodyLines.push(`- Jours fixes (0=dimanche, 1=lundi...) : ${d.fixedDays.join(', ')}`)
    }
    if (typeof d.note === 'string' && d.note.trim()) {
      custodyLines.push(`- Précision sur la garde : ${d.note.trim()}`)
    }
  }

  const exceptionLines = rows
    .filter((row) => row.data_type === 'custody_exception')
    .slice(0, 20)
    .map((row) => {
      const d = row.data || {}
      const start = typeof d.startDate === 'string' ? d.startDate : '?'
      const startTime = typeof d.startTime === 'string' && d.startTime ? ` à ${d.startTime}` : ''
      const end = typeof d.endDate === 'string' && d.endDate ? d.endDate : start
      const endTime = typeof d.endTime === 'string' && d.endTime ? ` à ${d.endTime}` : ''
      const presence = d.withChildren === false ? 'sans les enfants' : 'avec les enfants'
      const note = typeof d.note === 'string' && d.note.trim() ? ` — ${d.note.trim()}` : ''
      return `- Exception ${start}${startTime}${end !== start || endTime ? ` au ${end}${endTime}` : ''} : ${presence}${note}`
    })

  const locationConfigRow = rows.find((row) => row.data_type === 'location_config')
  const locationLines: string[] = []
  if (locationConfigRow?.data) {
    const d = locationConfigRow.data
    const transportLabels: Record<string, string> = {
      car: 'voiture', walk: 'à pied', bike: 'vélo', public_transport: 'transports en commun', other: 'autre',
    }
    const defaultTransport = typeof d.defaultTransportMode === 'string' ? d.defaultTransportMode : 'car'
    const defaultMargin = Math.max(0, Number(d.defaultSafetyMarginMinutes) || 0)
    locationLines.push(`- Transport habituel : ${transportLabels[defaultTransport] || defaultTransport}`)
    locationLines.push(`- Marge de sécurité habituelle : ${defaultMargin} min`)
    if (Array.isArray(d.places)) {
      const placeKindLabels: Record<string, string> = {
        home: 'domicile', work: 'travail', school: 'école', daycare: 'crèche / garde', activity: 'activité', other: 'autre lieu',
      }
      const explicitReferenceIndex = d.places.findIndex((place: any) => place?.isReference === true)
      const fallbackHomeIndex = d.places.findIndex((place: any) => place?.kind === 'home')
      const referenceIndex = explicitReferenceIndex >= 0 ? explicitReferenceIndex : fallbackHomeIndex
      d.places.slice(0, 20).forEach((place: any, index: number) => {
        const label = typeof place?.label === 'string' && place.label.trim() ? place.label.trim() : 'Lieu récurrent'
        const address = typeof place?.address === 'string' && place.address.trim() ? ` — ${place.address.trim()}` : ''
        const approximate = place?.approximate === true ? ' (approximatif)' : ''
        const transport = typeof place?.transportMode === 'string' ? place.transportMode : defaultTransport
        const travel = Math.max(0, Number(place?.travelMinutes) || 0)
        const margin = Math.max(0, Number(place?.safetyMarginMinutes) || defaultMargin)
        const kind = placeKindLabels[String(place?.kind || 'other')] || 'lieu'
        const reference = index === referenceIndex ? ' — POINT DE DÉPART PRINCIPAL' : ''
        locationLines.push(`- ${label} [${kind}]${address}${approximate}${reference} — ${transportLabels[transport] || transport}, trajet ${travel} min, marge ${margin} min`)
      })
      if (referenceIndex < 0) locationLines.push('- Aucun domicile principal n’est défini : ne pas inventer de point de départ.')
    }
  }

  const sections: string[] = []
  if (memberLines.length > 0) sections.push(`Personnes connues :\n${memberLines.join('\n')}`)
  if (custodyLines.length > 0) sections.push(`Organisation de garde :\n${custodyLines.join('\n')}`)
  if (exceptionLines.length > 0) sections.push(`Exceptions de garde :\n${exceptionLines.join('\n')}`)
  if (locationLines.length > 0) sections.push([
    'Lieux et trajets habituels :',
    ...locationLines,
    'RÈGLES LIEUX ET TRAJETS :',
    '- Répondre avec le nom et l’adresse enregistrés quand l’utilisatrice demande où elle travaille ou quels lieux sont connus.',
    '- Pour une heure de départ, calculer : heure d’arrivée moins trajet moins marge de sécurité.',
    '- Utiliser le POINT DE DÉPART PRINCIPAL comme origine par défaut. S’il manque, demander le point de départ au lieu d’inventer.',
    '- Exemple : arrivée 06:00, trajet 30 min, marge 15 min => départ 05:15.',
  ].join('\n'))

  return sections.length > 0 ? sections.join('\n\n') : undefined
}

type AdminDocRow = {
  title: string | null
  sender: string | null
  due_date: string | null
  recommended_next_step: string | null
  amount: number | null
  processing_status: string | null
}

function formatAdminDocsContext(rows: AdminDocRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined
  const label = (s: string | null) => (s === 'in_progress' ? 'en cours' : 'à traiter')
  const lines = rows.slice(0, 20).map((r) => {
    const parts: string[] = [r.title || 'Document']
    if (r.sender) parts.push(`de ${r.sender}`)
    if (r.due_date) parts.push(`échéance ${r.due_date}`)
    if (typeof r.amount === 'number') parts.push(`${r.amount} €`)
    parts.push(label(r.processing_status))
    if (r.recommended_next_step) parts.push(`prochaine étape : ${r.recommended_next_step}`)
    return `- ${parts.join(' — ')}`
  })
  return lines.join('\n')
}

type NoteRow = {
  id: string
  title: string | null
  content: string | null
  pinned: boolean | null
  updated_at: string | null
}

function normalizeNoteText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function noteTitleScore(message: string, title: string): number {
  const normalizedMessage = normalizeNoteText(message)
  const normalizedTitle = normalizeNoteText(title)
  if (!normalizedTitle) return 0
  if (normalizedMessage.includes(normalizedTitle)) return 1

  const stopWords = new Set([
    'note', 'notes', 'ma', 'mon', 'mes', 'la', 'le', 'les', 'une', 'un', 'de', 'du', 'des',
    'sur', 'pour', 'dans', 'avec', 'et', 'a', 'au', 'aux', 'que', 'qui', 'je', 'tu',
    'retrouve', 'retrouver', 'modifie', 'modifier', 'supprime', 'supprimer', 'transforme', 'transformer',
  ])
  const titleTokens = normalizedTitle.split(/\s+/).filter((token) => token.length >= 3 && !stopWords.has(token))
  if (titleTokens.length === 0) return 0
  const matched = titleTokens.filter((token) => normalizedMessage.includes(token)).length
  return matched / titleTokens.length
}

function formatNotesContext(rows: NoteRow[] | null, message: string): string | undefined {
  if (!rows || rows.length === 0) return undefined

  const scored = rows
    .map((note) => ({
      note,
      score: note.title ? noteTitleScore(message, note.title) : 0,
    }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  const second = scored[1]
  const canExposeTopContent =
    !!top &&
    top.score >= 0.65 &&
    (!second || top.score - second.score >= 0.2)

  return rows.slice(0, 30).map((note) => {
    const parts = [
      `note_id=${note.id}`,
      `titre=${note.title || 'Note sans titre'}`,
      `epinglee=${note.pinned ? 'oui' : 'non'}`,
    ]
    if (canExposeTopContent && top.note.id === note.id) {
      parts.push(`contenu=${note.content || ''}`)
    }
    return `- ${parts.join(' ; ')}`
  }).join('\n')
}

type MealRow = {
  id: string
  recipe_id: string | null
  day_of_week: string | null
  meal_type: string | null
  custom_meal: string | null
  headcount: number | null
}

function formatMealsContext(rows: MealRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined
  return rows.slice(0, 30).map((r) => {
    const parts: string[] = [
      `meal_id=${r.id}`,
      `recipe_id=${r.recipe_id || ''}`,
      `jour=${r.day_of_week || 'non précisé'}`,
      `créneau=${r.meal_type || 'non précisé'}`,
      `repas=${r.custom_meal || 'recette enregistrée'}`,
    ]
    if (typeof r.headcount === 'number' && r.headcount > 0) parts.push(`personnes=${r.headcount}`)
    return `- ${parts.join(' ; ')}`
  }).join('\n')
}

type ShoppingRow = { ingredient: string | null; quantity: string | null; unit: string | null; priority: string | null }

function formatShoppingContext(rows: ShoppingRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined
  const lines = rows.slice(0, 30).map((r) => {
    const qty = [r.quantity, r.unit].filter(Boolean).join(' ')
    return `- ${r.ingredient || 'Article'}${qty ? ` (${qty})` : ''}${r.priority === 'high' ? ' — prioritaire' : ''}`
  })
  return lines.join('\n')
}

type RoutineRow = {
  id: string
  title: string | null
  category: string | null
  frequency: string | null
  custom_days: unknown
  preferred_time: string | null
  duration_minutes: number | null
  reminder_enabled: boolean | null
  reminder_minutes_before: number | null
  description: string | null
}

type RecipeContextRow = {
  id: string
  title: string | null
  description: string | null
  prep_time: string | null
  cook_time: string | null
  servings: number | null
  ingredients: unknown
  steps: unknown
}

function formatRecipesContext(rows: RecipeContextRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined
  return rows.slice(0, 40).map((r) => {
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients.length : 0
    const steps = Array.isArray(r.steps) ? r.steps.length : 0
    const complete = ingredients >= 3 && steps >= 2
    return `- id=${r.id} ; titre=${r.title || 'Recette'} ; portions=${r.servings || '?'} ; préparation=${r.prep_time || '0'} min ; cuisson=${r.cook_time || '0'} min ; ingrédients=${ingredients} ; étapes=${steps} ; état=${complete ? 'complète' : 'incomplète'}`
  }).join('\n')
}

function formatRoutinesContext(rows: RoutineRow[] | null): string | undefined {
  if (!rows || rows.length === 0) return undefined

  const formatDays = (value: unknown): string => {
    if (Array.isArray(value)) return value.map(String).join(',')
    if (typeof value === 'string') return value.replace(/[{}]/g, '').trim()
    return ''
  }

  return rows.slice(0, 30).map((r) => {
    const days = formatDays(r.custom_days)
    return [
      `id=${r.id}`,
      `titre=${r.title || 'Routine'}`,
      `categorie=${r.category || 'non précisée'}`,
      `frequence=${r.frequency || 'non précisée'}`,
      `jours=${days || (r.frequency === 'daily' ? 'mon,tue,wed,thu,fri,sat,sun' : 'non précisés')}`,
      `heure=${r.preferred_time ? String(r.preferred_time).slice(0, 5) : 'non précisée'}`,
      `duree_minutes=${r.duration_minutes ?? 'non précisée'}`,
      `rappel_active=${r.reminder_enabled === null ? 'non précisé' : String(r.reminder_enabled)}`,
      `rappel_minutes_avant=${r.reminder_minutes_before ?? 'non précisé'}`,
      `emoji=${r.description || ''}`,
    ].join(' ; ')
  }).join('\n')
}

type MemoryCandidateLike = {
  key: string
  value: string
  scope: string
  confidence: number
}

function selectDurableMemories(candidates: MemoryCandidateLike[]): MemoryCandidateLike[] {
  const byKey = new Map<string, MemoryCandidateLike>()
  for (const c of candidates) {
    if (!c.key || !c.value) continue
    // On se fie au scope : tout ce qui n'est pas "temporary" est durable.
    // La confiance est conservée mais ne sert plus de filtre (elle était trop
    // stricte face aux valeurs basses que le modèle produit par défaut).
    if (c.scope === 'temporary') continue
    const existing = byKey.get(c.key)
    if (!existing || (c.confidence ?? 0) > (existing.confidence ?? 0)) byKey.set(c.key, c)
  }
  return Array.from(byKey.values())
}

function frenchLocal(iso: string | null | undefined): string {
  if (!iso) return 'heure inconnue'
  try {
    return formatParisDateTime(iso)
  } catch {
    return String(iso)
  }
}

export async function POST(request: NextRequest) {
try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration Supabase incomplète.' }, { status: 500 })
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const rl = await rateLimit(supabaseAdmin, user.id, 'nova_v2', { max: 30, windowMinutes: 60 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop de tests en peu de temps. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const body = (await request.json()) as {
      message?: unknown
      provider?: unknown
      conversationId?: unknown
      workflowContext?: unknown
    }
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const conversationId =
      typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
    const workflowContext =
      typeof body.workflowContext === 'string' ? body.workflowContext.trim().slice(0, 4_000) : ''

    if (!message) {
      return NextResponse.json({ error: 'Le message est obligatoire.' }, { status: 400 })
    }
    if (message.length > 5_000) {
      return NextResponse.json({ error: 'Le message est trop long pour ce laboratoire.' }, { status: 400 })
    }

    const providerIsKnown =
      typeof body.provider === 'string' &&
      (body.provider === 'auto' || (NOVA_PROVIDER_IDS as readonly string[]).includes(body.provider))
    const provider: NovaProviderPreference = providerIsKnown
      ? (body.provider as NovaProviderPreference)
      : 'auto'

    let conversationHistory = ''
    if (conversationId) {
      const { data: ownedConversation } = await supabaseAdmin
        .from('nova_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (ownedConversation) {
        const { data: storedMessages, error: historyError } = await supabaseAdmin
          .from('nova_conversation_messages')
          .select('role,content,created_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(17)

        if (historyError) {
          console.warn('[api/nova/plan] historique conversation indisponible', historyError.message)
        } else {
          const chronological = [...(storedMessages || [])].reverse()
          // Le client sauvegarde le message utilisateur juste avant l'appel API.
          // On retire cette dernière copie identique pour ne pas le présenter deux fois au modèle.
          const last = chronological[chronological.length - 1]
          if (last?.role === 'user' && String(last.content || '').trim() === message) {
            chronological.pop()
          }
          conversationHistory = chronological
            .slice(-16)
            .map((row) => `${row.role === 'assistant' ? 'Nova' : row.role === 'user' ? 'Utilisateur' : 'Système'} : ${String(row.content || '').trim()}`)
            .filter(Boolean)
            .join('\n')
        }
      }
    }

    const conversationalRequest = [
      conversationHistory ? `Historique récent de cette conversation :\n${conversationHistory}` : '',
      workflowContext ? `État du sujet actif :\n${workflowContext}` : '',
      `Nouveau message de l’utilisatrice : ${message}`,
      'Réponds uniquement au nouveau message. Utilise l’historique et les données connues silencieusement. Ne récite jamais le programme complet sauf demande explicite, ne répète pas les informations déjà établies, ne ramène pas automatiquement un ancien sujet et ne pose qu’une question à la fois. Une réponse courante doit rester courte et naturelle. Ne prétends jamais avoir exécuté une action avant le résultat réel du moteur.',
    ].filter(Boolean).join('\n\n')

    const calendarWindowStart = new Date()
    calendarWindowStart.setDate(calendarWindowStart.getDate() - 30)

    // Les trois lectures de contexte sont indépendantes : on les lance en parallèle.
    const [tasksRes, eventsRes, remindersRes] = await Promise.all([
      supabaseAdmin
        .from('todo_list')
        .select('id,title,description,category,due_date,due_time,status,created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('planner_events')
        .select('id,title,start_date,end_date,location,attendees,status,reminder_minutes_before')
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .gte('end_date', calendarWindowStart.toISOString())
        .order('start_date', { ascending: true })
        .limit(200),
      supabaseAdmin
        .from('task_reminders')
        .select('id,todo_id,scheduled_for,status,message')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true })
        .limit(40),
    ])

    const { data: activeTasks, error: activeTasksError } = tasksRes
    const { data: activeEvents, error: activeEventsError } = eventsRes
    const { data: activeReminders, error: activeRemindersError } = remindersRes

    if (activeTasksError) {
      console.warn('[api/nova/plan] task context unavailable', activeTasksError.message)
    }
    if (activeEventsError) {
      console.warn('[api/nova/plan] calendar context unavailable', activeEventsError.message)
    }
    if (activeRemindersError) {
      console.warn('[api/nova/plan] reminder context unavailable', activeRemindersError.message)
    }

    const activeTaskRows = (activeTasks || []) as ActiveTaskContextRow[]
    const taskContext = activeTaskRows
      .map((task: ActiveTaskContextRow) =>
        [
          `id=${task.id}`,
          `titre=${String(task.title || '').replace(/\s+/g, ' ').trim()}`,
          `description=${String(task.description || '').replace(/\s+/g, ' ').trim() || 'aucune'}`,
          `categorie=${task.category || 'aucune'}`,
          `echeance=${task.due_date || 'aucune'}`,
          `heure=${task.due_time || 'aucune'}`,
          `statut=${task.status}`,
        ].join(' ; ')
      )
      .join('\n')

    const activeEventRows = ((activeEvents || []) as ActiveCalendarContextRow[])
    const eventContext = activeEventRows
      .map((event) => [
        `id=${event.id}`,
        `titre=${String(event.title || '').replace(/\s+/g, ' ').trim()}`,
        `debut=${event.start_date}`,
        `debut_local=${frenchLocal(event.start_date)}`,
        `fin=${event.end_date}`,
        `fin_local=${frenchLocal(event.end_date)}`,
        `lieu=${event.location || 'aucun'}`,
        `participants=${(event.attendees || []).join(', ') || 'aucun'}`,
        `rappel_minutes=${(event.reminder_minutes_before || []).join(',') || 'aucun'}`,
        `statut=${event.status || 'pending'}`,
      ].join(' ; '))
      .join('\n')

    const calendarMatches: RequestCalendarMatch[] = findBestCalendarMatches(
      message,
      activeEventRows,
      0.2
    ).slice(0, 5)
    const calendarMatchContext = calendarMatches
      .map(({ event, score, reasons }) =>
        [
          `score=${score.toFixed(3)}`,
          `id=${event.id}`,
          `titre=${String(event.title || '').replace(/\s+/g, ' ').trim()}`,
          `debut=${event.start_date}`,
          `debut_local=${frenchLocal(event.start_date)}`,
          `fin=${event.end_date}`,
          `raisons=${reasons.join(', ') || 'proximite semantique'}`,
        ].join(' ; ')
      )
      .join('\n')

    const reminderContext = ((activeReminders || []) as ActiveReminderContextRow[])
      .map((reminder) => [
        `id=${reminder.id}`,
        `task_id=${reminder.todo_id}`,
        `date=${reminder.scheduled_for}`,
        `message=${String(reminder.message || '').replace(/\s+/g, ' ').trim() || 'aucun'}`,
        `statut=${reminder.status}`,
      ].join(' ; '))
      .join('\n')

    const duplicatePairs = findLikelyDuplicatePairs(activeTaskRows, 0.76).slice(0, 8)
    const duplicateContext = duplicatePairs
      .map(({ left, right, comparison }) =>
        [
          `score=${comparison.score}`,
          `tache_a=${left.id}|${String(left.title || '').replace(/\s+/g, ' ').trim()}`,
          `tache_b=${right.id}|${String(right.title || '').replace(/\s+/g, ' ').trim()}`,
          `raisons=${comparison.reasons.join(', ') || 'similarite lexicale'}`,
        ].join(' ; ')
      )
      .join('\n')

    const requestMatches = findBestTaskMatches(message, activeTaskRows, 0.25).slice(0, 5)
    const requestMatchContext = requestMatches
      .map(({ task, comparison }) =>
        `score=${comparison.score} ; id=${task.id} ; titre=${String(task.title || '')
          .replace(/\s+/g, ' ')
          .trim()}`
      )
      .join('\n')

    const messageWithContext = [
      conversationalRequest,
      '',
      'CONTEXTE INTERNE NOVAÉ - ne jamais réciter les identifiants techniques à l’utilisatrice :',
      'Tâches actives connues :',
      taskContext || 'aucune tâche active',
      '',
      'Correspondances probables entre la demande et les tâches actives :',
      requestMatchContext || 'aucune correspondance suffisamment proche',
      '',
      'Groupes de tâches déjà existantes qui semblent être des doublons :',
      duplicateContext || 'aucun doublon probable détecté',
      '',
      'Rendez-vous actifs connus :',
      eventContext || 'aucun rendez-vous actif',
      '',
      'Correspondances prioritaires entre la demande et les rendez-vous actifs :',
      calendarMatchContext || 'aucune correspondance suffisamment proche',
      '',
      'RÈGLE DE RÉSOLUTION DES RENDEZ-VOUS :',
      calendarMatches.length > 0 && (calendarMatches.length === 1 || calendarMatches[0].score - calendarMatches[1].score >= 0.12)
        ? `Le rendez-vous prioritaire est id=${calendarMatches[0].event.id}, titre=${calendarMatches[0].event.title}, debut=${frenchLocal(calendarMatches[0].event.start_date)} (ISO ${calendarMatches[0].event.start_date}), fin=${frenchLocal(calendarMatches[0].event.end_date)}. Considère-le comme identifié. Ne dis jamais qu'il est absent et ne redemande pas son identité. Pour une modification ou annulation, utilise obligatoirement cet id dans event_id. Demande seulement les informations réellement manquantes sur le nouvel horaire.`
        : 'Plusieurs rendez-vous restent plausibles : demande lequel utiliser sans prétendre qu’aucun rendez-vous n’existe.',
      '',
      'Quand tu parles d’un événement à l’utilisatrice, utilise TOUJOURS l’heure locale (champ debut_local / heure de Paris), jamais l’heure ISO/UTC brute.',
      '',
      'Rappels de tâches encore en attente :',
      reminderContext || 'aucun rappel en attente',
      '',
      'Utilise ce contexte uniquement pour comprendre les références, éviter les doublons, retrouver précisément une tâche, un rappel ou un rendez-vous et préparer une création, modification ou annulation après validation.',
    ].join('\n')

    let userContext: string | undefined
    try {
      const [profileRes, memoriesRes, familyRes, adminDocsRes, notesRes, mealsRes, shoppingRes, routinesRes, recipesRes] = await Promise.all([
        supabaseAdmin
          .from('onboarding_v2_profiles')
          .select(
            'display_name, usage_mode, priorities, work_rhythm, household_type, household_context, has_children, custody_mode, custody_pattern'
          )
          .eq('user_id', user.id)
          .maybeSingle(),
        supabaseAdmin
          .from('nova_memories')
          .select('key, value, scope')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('family_data')
          .select('data_type, relation_to_user, is_primary_contact, notes, data')
          .eq('user_id', user.id)
          .in('data_type', ['member', 'custody_config', 'custody_exception', 'location_config'])
          .eq('is_active', true)
          .limit(20),
        supabaseAdmin
          .from('administrative_documents')
          .select('title, sender, due_date, recommended_next_step, amount, processing_status')
          .eq('user_id', user.id)
          .eq('vault_protected', false)
          .in('processing_status', ['todo', 'in_progress'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(20),
        supabaseAdmin
          .from('notes')
          .select('id, title, content, pinned, updated_at')
          .eq('user_id', user.id)
          .order('pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(30),
        supabaseAdmin
          .from('meal_plan')
          .select('id, recipe_id, day_of_week, meal_type, custom_meal, headcount')
          .eq('user_id', user.id)
          .limit(30),
        supabaseAdmin
          .from('shopping_list')
          .select('ingredient, quantity, unit, priority')
          .eq('user_id', user.id)
          .eq('to_buy', true)
          .limit(30),
        supabaseAdmin
          .from('routines')
          .select('id,title,category,frequency,custom_days,preferred_time,duration_minutes,reminder_enabled,reminder_minutes_before,description')
          .eq('user_id', user.id)
          .limit(30),
        supabaseAdmin
          .from('recipes')
          .select('id,title,description,prep_time,cook_time,servings,ingredients,steps')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(40),
      ])

      const profileText = buildUserContextFromProfile(profileRes.data)
      const memoriesText = formatNovaMemories(memoriesRes.data as NovaMemoryRow[] | null)
      const familyText = formatFamilyContext(familyRes.data as FamilyMemberRow[] | null)
      const adminDocsText = formatAdminDocsContext(adminDocsRes.data as AdminDocRow[] | null)
      const notesText = formatNotesContext(notesRes.data as NoteRow[] | null, message)
      const mealsText = formatMealsContext(mealsRes.data as MealRow[] | null)
      const shoppingText = formatShoppingContext(shoppingRes.data as ShoppingRow[] | null)
      const routinesText = formatRoutinesContext(routinesRes.data as RoutineRow[] | null)
      const recipesText = formatRecipesContext(recipesRes.data as RecipeContextRow[] | null)

      const parts: string[] = []
      if (profileText) parts.push(profileText)
      if (memoriesText) parts.push(`Ce que Nova a appris au fil des échanges :\n${memoriesText}`)
      if (familyText) parts.push(`Entourage et organisation du foyer :\n${familyText}`)
      if (adminDocsText) parts.push(`Documents administratifs en attente (métadonnées uniquement) :\n${adminDocsText}`)
      if (notesText) parts.push(`Notes récentes (identifiants internes, contenu exposé uniquement pour une correspondance déterministe ; ne jamais afficher les identifiants) :\n${notesText}`)
      if (mealsText) parts.push(`Plan de repas de la semaine :\n${mealsText}`)
      if (shoppingText) parts.push(`Liste de courses à acheter :\n${shoppingText}`)
      if (routinesText) parts.push(`Routines actives :\n${routinesText}`)
      if (recipesText) parts.push(`Recettes déjà enregistrées (identifiants internes, ne jamais les afficher) :\n${recipesText}`)
      userContext = parts.length > 0 ? parts.join('\n\n') : undefined
    } catch (contextError) {
      console.warn('[api/nova/plan] contexte indisponible, poursuite sans', contextError)
    }

    const result = await createNovaActionPlan(
      {
        message: messageWithContext,
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        nowIso: new Date().toISOString(),
        userContext,
      },
      provider
    )

    result.plan = applyTaskIdentityGuard(
      result.plan,
      message,
      duplicatePairs,
      requestMatches
    )

    // Mémoire épisodique : Nova enregistre automatiquement les faits durables.
    // Non bloquant : un échec ici ne doit jamais empêcher la réponse à l'utilisatrice.
    try {
      const durable = selectDurableMemories(
        result.plan.memory_candidates as MemoryCandidateLike[]
      )
      if (durable.length > 0) {
        const nowIso = new Date().toISOString()
        const rows = durable.map((m) => ({
          user_id: user.id,
          key: m.key,
          value: m.value,
          scope: m.scope,
          confidence: m.confidence,
          source: 'nova_auto',
          updated_at: nowIso,
        }))
        await supabaseAdmin
          .from('nova_memories')
          .upsert(rows, { onConflict: 'user_id,key' })
      }
    } catch (memoryError) {
      console.warn('[api/nova/plan] mémoire non enregistrée', memoryError)
    }

    const hasConfirmableAction = result.plan.proposed_actions.some(
      (action) => action.requires_confirmation
    )
    const hasBlockingMissingInformation = result.plan.missing_information.some(
      (item) => item.blocking
    )

    let executionToken: string | undefined
    if (hasConfirmableAction && !hasBlockingMissingInformation) {
      try {
        executionToken = createNovaExecutionToken(user.id, result.plan)
      } catch (tokenError) {
        console.warn('[api/nova/plan] execution token unavailable', tokenError)
      }
    }

    return NextResponse.json({ ...result, executionToken })
  } catch (error) {
    console.error('[api/nova/plan] error', error)
    return NextResponse.json(
      {
        error: 'nova_plan_failed',
        message: error instanceof Error ? error.message : 'Impossible d’analyser la demande.',
      },
      { status: 502 }
    )
  }
}