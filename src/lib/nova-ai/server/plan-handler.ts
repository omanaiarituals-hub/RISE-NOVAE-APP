import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNovaActionPlan } from '@/lib/nova-ai/router'
import {
  NOVA_PROVIDER_IDS,
  type NovaActionPlan,
  type NovaProviderPreference,
} from '@/lib/nova-ai/types'
import { rateLimit } from '@/lib/rateLimit'
import { canAccess, incrementAiChatCount } from '@/lib/permissions'
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
  start_minutes: number | null
  end_minutes: number | null
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

function plannerClockLabel(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function plannerDateLabel(value: string): string {
  if (!value) return ''
  return value.split('T')[0] || value
}

function plannerLocalDateTime(value: string, minutes: number | null | undefined): string {
  const clock = plannerClockLabel(minutes)
  const date = plannerDateLabel(value)
  if (date && clock) return `${date} ${clock}`
  return formatParisDateTime(value)
}

function plannerComparableMs(value: string, minutes: number | null | undefined): number {
  const date = plannerDateLabel(value)
  const clock = plannerClockLabel(minutes)
  if (date && clock) {
    // Explicit Paris offset for August/CEST is intentionally NOT hard-coded.
    // Date/time ordering within the Planner is based on the stored local wall-clock
    // components, which avoids the old +2h display regression.
    return new Date(`${date}T${clock}:00`).getTime()
  }
  return new Date(value).getTime()
}

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

function isClearShoppingListRequest(message: string): boolean {
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const mentionsShopping = /\b(liste de courses|courses)\b/.test(normalized)
  const mentionsFullClear = /\b(vide|vider|efface|effacer|supprime|supprimer|enleve|enlever)\b/.test(normalized)
    && /\b(tout|toute|completement|entierement|liste)\b/.test(normalized)

  return mentionsShopping && mentionsFullClear
}

function applyShoppingListClearGuard(plan: NovaActionPlan, message: string): NovaActionPlan {
  if (!isClearShoppingListRequest(message)) return plan

  const alreadyHasClear = plan.proposed_actions.some(
    (action) => action.type === 'clear_shopping_list' && action.engine === 'meals'
  )
  if (alreadyHasClear) {
    return {
      ...plan,
      proposed_actions: plan.proposed_actions.map((action) =>
        action.type === 'clear_shopping_list' && action.engine === 'meals'
          ? { ...action, risk: 'medium', requires_confirmation: true }
          : action
      ),
    }
  }

  return {
    ...plan,
    intent: 'meal',
    missing_information: plan.missing_information.filter((item) => !item.blocking),
    proposed_actions: [
      {
        id: `clear-shopping-${Date.now()}`,
        type: 'clear_shopping_list',
        engine: 'meals',
        title: 'Vider toute la liste de courses',
        reason: 'L’utilisatrice demande explicitement de vider sa liste de courses actuelle.',
        risk: 'medium',
        requires_confirmation: true,
        parameters: [],
      },
    ],
    assistant_message: 'Je vais vider toute ta liste de courses actuelle. Les recettes et ton planning repas ne seront pas supprimés. Tu confirmes ?',
  }
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

type DeterministicDateParts = { year: number; month: number; day: number }

function getLocalDateParts(timezone = 'Europe/Paris', now = new Date()): DeterministicDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
  return { year: value('year'), month: value('month'), day: value('day') }
}

function parseIsoBirthDate(value: unknown): DeterministicDateParts | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function calculateDeterministicAge(
  birthDate: unknown,
  timezone = 'Europe/Paris',
  now = new Date()
): number | null {
  const birth = parseIsoBirthDate(birthDate)
  if (!birth) return null

  const today = getLocalDateParts(timezone, now)
  let age = today.year - birth.year
  const birthdayPassed =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day)

  if (!birthdayPassed) age -= 1
  return age >= 0 ? age : null
}

function getNextBirthdayFacts(
  birthDate: unknown,
  timezone = 'Europe/Paris',
  now = new Date()
): { nextBirthdayIso: string; turningAge: number; daysUntil: number } | null {
  const birth = parseIsoBirthDate(birthDate)
  if (!birth) return null

  const today = getLocalDateParts(timezone, now)
  const thisYearBirthday = new Date(Date.UTC(today.year, birth.month - 1, birth.day))
  const todayUtc = new Date(Date.UTC(today.year, today.month - 1, today.day))
  const nextBirthday =
    thisYearBirthday.getTime() >= todayUtc.getTime()
      ? thisYearBirthday
      : new Date(Date.UTC(today.year + 1, birth.month - 1, birth.day))

  const nextYear = nextBirthday.getUTCFullYear()
  const daysUntil = Math.round((nextBirthday.getTime() - todayUtc.getTime()) / 86400000)

  return {
    nextBirthdayIso: `${nextYear}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}`,
    turningAge: nextYear - birth.year,
    daysUntil,
  }
}

function normalizeFactKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function findMemoryFact(
  rows: NovaMemoryRow[] | null,
  acceptedKeys: string[]
): string | null {
  if (!rows) return null
  const accepted = new Set(acceptedKeys.map(normalizeFactKey))
  const row = rows.find((item) => accepted.has(normalizeFactKey(item.key)) && item.value)
  return row?.value?.trim() || null
}

function buildDeterministicOwnProfileContext(
  memories: NovaMemoryRow[] | null,
  userEmail: string | null | undefined,
  timezone = 'Europe/Paris'
): string | undefined {
  const lines: string[] = []

  const birthDate = findMemoryFact(memories, [
    'date_naissance',
    'date_de_naissance',
    'birth_date',
    'birthdate',
    'birthday',
  ])
  const gender = findMemoryFact(memories, [
    'genre',
    'sexe',
    'gender',
  ])

  if (gender) lines.push(`Genre déclaré : ${gender}`)

  if (birthDate) {
    const age = calculateDeterministicAge(birthDate, timezone)
    const birthday = getNextBirthdayFacts(birthDate, timezone)
    lines.push(`Date de naissance déclarée : ${birthDate}`)
    if (age !== null) lines.push(`Âge actuel CALCULÉ PAR LE CODE : ${age} ans`)
    if (birthday) {
      lines.push(
        `Prochain anniversaire CALCULÉ PAR LE CODE : ${birthday.nextBirthdayIso} — aura ${birthday.turningAge} ans — dans ${birthday.daysUntil} jour${birthday.daysUntil > 1 ? 's' : ''}`
      )
    }
  }

  const creatorEmail = String(process.env.NOVAE_CREATOR_EMAIL || '').trim().toLocaleLowerCase('fr-FR')
  const isCreator =
    !!creatorEmail &&
    !!userEmail &&
    userEmail.trim().toLocaleLowerCase('fr-FR') === creatorEmail

  if (isCreator) {
    lines.push(
      'Rôle produit permanent : cette utilisatrice est la créatrice de NOVAÉ et pilote la conception et l’évolution de Nova.'
    )
    lines.push(
      'Interprétation : quand elle parle de « mon application », « mon app », « mon produit » ou de l’évolution de Nova, il s’agit de NOVAÉ sauf indication contraire.'
    )
    lines.push(
      'Consigne de ton : utilise ce fait uniquement pour comprendre le contexte. Ne lui dis pas spontanément « tu es ma créatrice » et ne le répète pas sans raison.'
    )
  }

  return lines.length > 0 ? lines.join('\n') : undefined
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
  updated_at?: string | null
  created_at?: string | null
  relation_to_user: string | null
  is_primary_contact: boolean | null
  notes: string | null
  data: Record<string, unknown> | null
}


function buildTemporalRealityContext(
  nowIso: string,
  timezone = 'Europe/Paris'
): string {
  const now = new Date(nowIso)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now)

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || ''

  const year = Number(value('year'))
  const month = Number(value('month'))
  const day = Number(value('day'))

  // Midi UTC évite les bascules de jour liées aux changements d'heure.
  const localDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const currentWeekday = localDate.getUTCDay()

  const frenchWeekdays = [
    'dimanche',
    'lundi',
    'mardi',
    'mercredi',
    'jeudi',
    'vendredi',
    'samedi',
  ]

  const frenchMonths = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ]

  const formatDate = (date: Date) =>
    `${frenchWeekdays[date.getUTCDay()]} ${date.getUTCDate()} ${
      frenchMonths[date.getUTCMonth()]
    } ${date.getUTCFullYear()}`

  const addDays = (offset: number) => {
    const date = new Date(localDate)
    date.setUTCDate(date.getUTCDate() + offset)
    return date
  }

  // Semaine civile lundi -> dimanche contenant aujourd'hui.
  const offsetFromMonday = currentWeekday === 0 ? 6 : currentWeekday - 1
  const monday = addDays(-offsetFromMonday)

  const weekLines = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setUTCDate(date.getUTCDate() + index)
    const relation =
      date.toISOString().slice(0, 10) === localDate.toISOString().slice(0, 10)
        ? ' ← AUJOURD’HUI'
        : ''
    return `- ${formatDate(date)}${relation}`
  })

  return [
    'ANCRAGE TEMPOREL DÉTERMINISTE — CALCULÉ PAR LE CODE :',
    `- Aujourd’hui : ${formatDate(localDate)}.`,
    `- Hier : ${formatDate(addDays(-1))}.`,
    `- Demain : ${formatDate(addDays(1))}.`,
    '',
    'SEMAINE CIVILE EN COURS :',
    ...weekLines,
    '',
    'RÈGLES DE COHÉRENCE TEMPORELLE :',
    '- Une règle récurrente comme « mercredi à 19h » ne signifie PAS automatiquement « le prochain mercredi ».',
    '- Pour décrire la situation actuelle, commence par repérer l’occurrence de cette semaine dans le calendrier ci-dessus.',
    '- Si cette occurrence est déjà passée aujourd’hui et qu’aucune exception explicite ne l’annule, traite-la comme déjà survenue.',
    '- N’utilise le prochain mercredi / prochain jour récurrent que pour une question explicitement tournée vers le futur.',
    '- Une note, checklist ou période de voyage décrit un projet. Elle ne prouve jamais que le voyage a déjà commencé.',
    '- Si la date de départ connue est postérieure à aujourd’hui, l’utilisatrice n’est pas encore partie.',
    '- Si deux sources se contredisent sur une date, privilégie la donnée actuelle la plus explicite et signale l’incertitude au lieu d’inventer.',
  ].join('\n')
}

function formatFamilyContext(rows: FamilyMemberRow[] | null, timezone = 'Europe/Paris'): string | undefined {
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
      if (d.gender === 'female') parts.push('genre : féminin')
      if (d.gender === 'male') parts.push('genre : masculin')
      if (typeof d.category === 'string' && d.category) parts.push(`cercle : ${d.category}`)
      if (d.isHouseholdMember === true) parts.push('membre du foyer')
      if (typeof d.birthDate === 'string' && d.birthDate) {
        parts.push(`né(e) le ${d.birthDate}`)
        const age = calculateDeterministicAge(d.birthDate, timezone)
        const birthday = getNextBirthdayFacts(d.birthDate, timezone)
        if (age !== null) parts.push(`âge actuel CALCULÉ PAR LE CODE : ${age} ans`)
        if (birthday) {
          parts.push(
            `prochain anniversaire CALCULÉ PAR LE CODE : ${birthday.nextBirthdayIso}, aura ${birthday.turningAge} ans, dans ${birthday.daysUntil} jour${birthday.daysUntil > 1 ? 's' : ''}`
          )
        }
      }
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

  const locationConfigRow = rows
    .filter((row) => row.data_type === 'location_config')
    .sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.created_at || 0).getTime()
      const rightTime = new Date(right.updated_at || right.created_at || 0).getTime()
      return rightTime - leftTime
    })[0]
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
        home: 'domicile',
        work: 'travail',
        school: 'école',
        daycare: 'crèche / garde',
        activity: 'activité',
        doctor: 'médecin',
        pharmacy: 'pharmacie',
        other: 'autre lieu',
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
        const baseKind = placeKindLabels[String(place?.kind || 'other')] || 'lieu'
        const customType =
          typeof place?.customType === 'string' && place.customType.trim()
            ? place.customType.trim()
            : ''
        const kind =
          String(place?.kind || 'other') === 'other' && customType
            ? customType
            : baseKind
        const icon =
          typeof place?.icon === 'string' && place.icon.trim()
            ? `${place.icon.trim()} `
            : ''
        const reference = index === referenceIndex ? ' — POINT DE DÉPART PRINCIPAL' : ''
        locationLines.push(`- ${icon}${label} [${kind}]${address}${approximate}${reference} — ${transportLabels[transport] || transport}, trajet ${travel} min, marge ${margin} min`)
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
    '- ORIGINE DYNAMIQUE : déterminer le point de départ dans cet ordre : 1) lieu explicitement indiqué dans le message, 2) lieu du dernier événement Planner qui se termine avant le rendez-vous concerné, 3) POINT DE DÉPART PRINCIPAL.',
    '- Les valeurs "trajet X min" enregistrées sur un lieu correspondent au trajet habituel depuis le POINT DE DÉPART PRINCIPAL vers ce lieu, sauf indication contraire explicite.',
    '- Si l’origine réelle est différente du POINT DE DÉPART PRINCIPAL, ne JAMAIS réutiliser automatiquement le temps domicile→destination. Si aucun temps fiable origine→destination n’est fourni par le message ou le contexte, demander une précision plutôt que d’inventer.',
    '- Exemple : Travail jusqu’à 17:00 puis École à 17:30 => considérer Travail comme origine pour aller à l’École.',
    '- Pour une heure de départ lorsque le temps origine→destination est fiable : heure d’arrivée moins trajet moins marge de sécurité.',
    '- Si aucun lieu précédent n’est renseigné dans le Planner et que l’utilisatrice ne précise pas son départ, utiliser le POINT DE DÉPART PRINCIPAL. S’il manque, demander le point de départ.',
    '- Exemple avec origine fiable : arrivée 06:00, trajet 30 min, marge 15 min => départ 05:15.',
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

function formatNotesContext(rows: NoteRow[] | null, message: string, conversationHistory = ''): string | undefined {
  if (!rows || rows.length === 0) return undefined

  const normalizedMessage = normalizeNoteText(message)
  const isAnaphoricNoteReference =
    /\b(cette liste|cette note|la liste|la note|la checklist|cette checklist|que tu viens de creer|que tu viens de créer|que tu as cree|que tu as créé|dans cette liste|dans cette note)\b/.test(normalizedMessage)

  const scored = rows
    .map((note, index) => {
      const directScore = note.title ? noteTitleScore(message, note.title) : 0
      const historyScore =
        isAnaphoricNoteReference && note.title
          ? noteTitleScore(conversationHistory, note.title)
          : 0

      // Petit bonus de récence uniquement lorsqu'elle fait clairement référence
      // à la note/liste dont elle vient de parler.
      const recencyBonus = isAnaphoricNoteReference ? Math.max(0, 0.12 - index * 0.01) : 0

      return {
        note,
        directScore,
        historyScore,
        score: Math.max(directScore, historyScore) + recencyBonus,
      }
    })
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  const second = scored[1]
  const strongDirectMatch = !!top && top.directScore >= 0.65
  const strongConversationMatch =
    !!top &&
    isAnaphoricNoteReference &&
    top.historyScore >= 0.65

  const canExposeTopContent =
    !!top &&
    (strongDirectMatch || strongConversationMatch) &&
    (!second || top.score - second.score >= 0.12)

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
  requires_confirmation?: boolean
}

function canonicalMemoryKey(value: string): string {
  const normalized = normalizeFactKey(value)
  const aliases: Record<string, string> = {
    date_de_naissance: 'date_naissance',
    birth_date: 'date_naissance',
    birthdate: 'date_naissance',
    birthday: 'date_naissance',
    sexe: 'genre',
    gender: 'genre',
    prenom: 'prenom',
    first_name: 'prenom',
    firstname: 'prenom',
    nom_affichage: 'prenom',
    food_preferences: 'preferences_alimentaires',
    preference_alimentaire: 'preferences_alimentaires',
    preferences_nourriture: 'preferences_alimentaires',
    work_schedule: 'rythme_travail',
    horaires_travail: 'rythme_travail',
    rythme_professionnel: 'rythme_travail',
  }
  return aliases[normalized] || normalized
}

function selectDurableMemories(candidates: MemoryCandidateLike[]): MemoryCandidateLike[] {
  const byKey = new Map<string, MemoryCandidateLike>()

  for (const raw of candidates) {
    const key = canonicalMemoryKey(String(raw.key || ''))
    const value = String(raw.value || '').trim()
    const confidence = Number(raw.confidence || 0)

    if (!key || !value) continue
    if (raw.scope === 'temporary') continue

    // Une information inférée ou explicitement marquée "à confirmer" ne doit
    // jamais devenir un fait persistant silencieusement.
    if (raw.requires_confirmation === true) continue

    // On ne persiste automatiquement que les faits suffisamment sûrs.
    if (!Number.isFinite(confidence) || confidence < 0.78) continue

    // Ne jamais mémoriser un âge fixe : la date de naissance est le fait source.
    if (key === 'age' || key.endsWith('_age') || key.includes('age_actuel')) continue

    const candidate: MemoryCandidateLike = {
      ...raw,
      key,
      value,
      confidence,
      requires_confirmation: false,
    }

    const existing = byKey.get(key)
    if (!existing || confidence > existing.confidence) byKey.set(key, candidate)
  }

  return Array.from(byKey.values())
}


function hasMemoryKey(rows: NovaMemoryRow[] | null, keys: string[]): boolean {
  if (!rows) return false
  const accepted = new Set(keys.map(canonicalMemoryKey))
  return rows.some((row) => {
    if (!row.key || !row.value) return false
    return accepted.has(canonicalMemoryKey(row.key))
  })
}

function messageTouches(message: string, words: string[]): boolean {
  const normalized = normalizeNoteText(message)
  return words.some((word) => normalized.includes(normalizeNoteText(word)))
}

function buildProfileLearningHints(
  profile: Record<string, unknown> | null,
  memories: NovaMemoryRow[] | null,
  familyRows: FamilyMemberRow[] | null,
  message: string
): string | undefined {
  const hints: string[] = []
  const familyMembers = (familyRows || []).filter((row) => !row.data_type || row.data_type === 'member')

  const displayNameKnown =
    !!(profile && typeof profile.display_name === 'string' && profile.display_name.trim()) ||
    hasMemoryKey(memories, ['prenom', 'first_name', 'firstname'])

  const householdKnown =
    !!(profile && typeof profile.household_type === 'string' && profile.household_type.trim())

  const workRhythmKnown =
    !!(profile && typeof profile.work_rhythm === 'string' && profile.work_rhythm.trim()) ||
    hasMemoryKey(memories, ['rythme_travail', 'horaires_travail', 'work_schedule'])

  const foodKnown = hasMemoryKey(memories, [
    'preferences_alimentaires',
    'regime_alimentaire',
    'allergies',
    'aliments_exclus',
  ])

  const birthDateKnown = hasMemoryKey(memories, [
    'date_naissance',
    'date_de_naissance',
    'birth_date',
    'birthdate',
    'birthday',
  ])

  if (!displayNameKnown && messageTouches(message, ['bonjour', 'salut', 'moi', 'je suis'])) {
    hints.push('Prénom inconnu : tu peux demander comment l’appeler si cela s’intègre naturellement à l’échange.')
  }

  if (!householdKnown && messageTouches(message, ['repas', 'courses', 'famille', 'maison', 'semaine'])) {
    hints.push('Composition/type de foyer incomplète : une question courte peut être utile si elle change réellement la réponse.')
  }

  if (familyMembers.length === 0 && messageTouches(message, ['enfant', 'fille', 'fils', 'famille', 'garde'])) {
    hints.push('Entourage familial non renseigné : demande uniquement l’information nécessaire au sujet actuel.')
  }

  if (!foodKnown && messageTouches(message, ['repas', 'recette', 'manger', 'courses', 'cuisine'])) {
    hints.push('Préférences/contraintes alimentaires encore inconnues : tu peux poser UNE question utile après avoir aidé sur la demande principale.')
  }

  if (!workRhythmKnown && messageTouches(message, ['travail', 'planning', 'semaine', 'organisation', 'routine'])) {
    hints.push('Rythme de travail encore inconnu : demande-le seulement si cela améliore concrètement la planification.')
  }

  if (!birthDateKnown && messageTouches(message, ['age', 'anniversaire', 'date de naissance', 'née', 'né'])) {
    hints.push('Date de naissance de l’utilisatrice inconnue : demande-la uniquement parce que le sujet actuel porte sur l’âge ou l’anniversaire.')
  }

  if (hints.length === 0) return undefined

  return [
    'Opportunités d’enrichissement du profil détectées par le code :',
    ...hints.slice(0, 2).map((hint) => `- ${hint}`),
    'Règle : au maximum UNE question d’enrichissement par réponse, jamais si elle détourne de la demande principale, jamais pour une information déjà connue.',
  ].join('\n')
}


type NovaWebSource = {
  url: string
  title: string
}

type NovaWebResearch = {
  kind: 'events' | 'rated_recipes' | 'fresh_info'
  text: string
  sources: NovaWebSource[]
}

type OpenAIWebAnnotation = {
  type?: string
  url?: string
  title?: string
}

type OpenAIWebContent = {
  type?: string
  text?: string
  annotations?: OpenAIWebAnnotation[]
}

type OpenAIWebOutputItem = {
  type?: string
  status?: string
  content?: OpenAIWebContent[]
  action?: {
    type?: string
    query?: string
    queries?: string[]
    sources?: Array<{ url?: string; title?: string }>
  }
}

type OpenAIWebResponse = {
  output?: OpenAIWebOutputItem[]
  error?: { message?: string }
}

function normalizeWebIntentText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectNovaWebSearchKind(message: string): NovaWebResearch['kind'] | null {
  const value = normalizeWebIntentText(message)

  const ratedRecipe =
    /\b(recette|recettes|plat|plats)\b/.test(value) &&
    (
      /\b(notee?s?|notation|etoiles?|avis)\b/.test(value) ||
      /\b4\s*(?:\/|sur)\s*5\b/.test(value) ||
      /\bplus de 4\b/.test(value)
    )

  if (ratedRecipe) return 'rated_recipes'

  const localEvent =
    /\b(evenement|evenements|meetup|meetups|networking|conference|conferences|salon|salons|concert|concerts|sortie|sorties|activite|activites|coworking|co-working|aperos?|afterwork)\b/.test(value) &&
    /\b(aujourd hui|demain|cette semaine|semaine prochaine|ce week end|week end|ce mois|prochain|prochaine|en ce moment|a venir|autour de|pres de|a lyon|a paris|a marseille|a lille|a bordeaux|a toulouse|a nice)\b/.test(value)

  if (localEvent) return 'events'

  const explicitSearch =
    /\b(cherche|chercher|recherche|rechercher|trouve|trouver|verifie|verifier|check|checker)\b/.test(value) &&
    /\b(internet|web|en ligne|actuel|actuelle|actuels|actuelles|aujourd hui|maintenant|horaires?|prix|disponibilite|disponible|derniere|dernieres|recent|recente|recents|recentes)\b/.test(value)

  if (explicitSearch) return 'fresh_info'

  return null
}

function buildNovaWebSearchPrompt(
  kind: NovaWebResearch['kind'],
  message: string,
  nowIso: string
): string {
  const common = [
    `Date/heure de référence : ${nowIso}.`,
    `Demande de l'utilisatrice : ${message}`,
    '',
    'Effectue réellement une recherche web maintenant.',
    'Ne promets aucun travail futur.',
    'Ne complète jamais une information manquante par supposition.',
    'Retourne une synthèse courte et factuelle en français.',
    'Pour chaque résultat retenu, donne son URL source exacte.',
  ]

  if (kind === 'events') {
    return [
      ...common,
      '',
      'OBJECTIF ÉVÉNEMENTS :',
      '- ne retiens que des événements dont la date correspond réellement à la période demandée ;',
      '- donne : nom, date, heure si disponible, lieu/ville, courte description et URL officielle ou source fiable ;',
      '- si une date ou un lieu n’est pas vérifiable, ne présente pas le résultat comme confirmé ;',
      '- privilégie les sites officiels des organisateurs, lieux, billetteries ou plateformes événementielles reconnues ;',
      '- limite-toi à 6 résultats maximum.',
    ].join('\n')
  }

  if (kind === 'rated_recipes') {
    return [
      ...common,
      '',
      'OBJECTIF RECETTES NOTÉES :',
      '- ne retiens QUE les recettes dont une note strictement supérieure à 4/5 est visible et vérifiable sur la source ;',
      '- 4,0/5 exactement ne passe PAS le filtre ;',
      '- si une note est sur une autre échelle, convertis-la sur 5 seulement si la conversion est mathématiquement non ambiguë ;',
      '- donne : nom de la recette, note exacte, nombre d’avis si visible, site/source, URL et résumé très court du plat ;',
      '- ne copie pas intégralement le texte ou les étapes d’une recette source ;',
      '- si aucune recette ne satisfait réellement le critère, dis-le clairement ;',
      '- limite-toi à 5 résultats maximum.',
    ].join('\n')
  }

  return [
    ...common,
    '',
    'OBJECTIF INFORMATION FRAÎCHE :',
    '- privilégie les sources récentes et directement pertinentes ;',
    '- distingue clairement ce qui est vérifié de ce qui ne l’est pas ;',
    '- limite-toi aux éléments nécessaires pour répondre à la demande.',
  ].join('\n')
}

function uniqueNovaWebSources(sources: NovaWebSource[]): NovaWebSource[] {
  const seen = new Set<string>()
  const output: NovaWebSource[] = []

  for (const source of sources) {
    const url = String(source.url || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    output.push({
      url,
      title: String(source.title || '').trim() || url,
    })
  }

  return output.slice(0, 12)
}

async function runNovaWebSearch(
  kind: NovaWebResearch['kind'],
  message: string,
  nowIso: string
): Promise<NovaWebResearch | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[api/nova/plan] Web Search demandé mais OPENAI_API_KEY absente')
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)


  try {
    const model = process.env.NOVA_WEB_SEARCH_MODEL || 'gpt-5-mini'
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search' }],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        input: buildNovaWebSearchPrompt(kind, message, nowIso),
      }),
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800)
      console.warn('[api/nova/plan] Web Search OpenAI refusé', response.status, detail)
      return null
    }

    const data = (await response.json()) as OpenAIWebResponse
    const textParts: string[] = []
    const sources: NovaWebSource[] = []

    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const content of item.content || []) {
          if (content.type === 'output_text' && content.text?.trim()) {
            textParts.push(content.text.trim())
          }

          for (const annotation of content.annotations || []) {
            if (annotation.type === 'url_citation' && annotation.url) {
              sources.push({
                url: annotation.url,
                title: annotation.title || annotation.url,
              })
            }
          }
        }
      }

      if (item.type === 'web_search_call') {
        for (const source of item.action?.sources || []) {
          if (source.url) {
            sources.push({
              url: source.url,
              title: source.title || source.url,
            })
          }
        }
      }
    }

    const text = textParts.join('\n\n').trim()
    if (!text) {
      console.warn('[api/nova/plan] Web Search terminé sans texte exploitable')
      return null
    }

    return {
      kind,
      text: text.slice(0, 12_000),
      sources: uniqueNovaWebSources(sources),
    }
  } catch (error) {
    console.warn(
      '[api/nova/plan] Web Search indisponible',
      error instanceof Error ? error.message : error
    )
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function formatNovaWebResearchForModel(research: NovaWebResearch): string {
  const sources = research.sources.length > 0
    ? research.sources
        .map((source, index) => `${index + 1}. ${source.title} — ${source.url}`)
        .join('\n')
    : 'Aucune URL structurée récupérée.'

  return [
    'RÉSULTAT DE RECHERCHE WEB RÉELLE — effectué maintenant par NOVAÉ :',
    `type=${research.kind}`,
    '',
    research.text,
    '',
    'SOURCES WEB AUTORISÉES À CITER :',
    sources,
    '',
    'RÈGLES :',
    '- utilise ces résultats maintenant, dans cette réponse ;',
    '- ne dis jamais « je vais chercher », « je vais checker » ou « je te donne ça dans quelques instants » ;',
    '- ne cite aucune URL qui ne figure pas dans cette section ;',
    '- si les résultats ne suffisent pas à vérifier une affirmation, dis-le ;',
    '- pour une recette annoncée comme >4/5, la note doit être explicitement vérifiable dans le résultat web.',
  ].join('\n')
}

function frenchLocal(iso: string | null | undefined): string {
  if (!iso) return 'heure inconnue'
  try {
    return formatParisDateTime(iso)
  } catch {
    return String(iso)
  }
}

function capContext(value: string | undefined, maxChars: number, keepEnd = false): string | undefined {
  if (!value) return value
  if (value.length <= maxChars) return value
  const marker = '\n[… contexte tronqué pour maîtriser le coût et la latence …]\n'
  if (keepEnd) return `${marker}${value.slice(-(maxChars - marker.length))}`
  return `${value.slice(0, maxChars - marker.length)}${marker}`
}

export async function handleNovaPlanRequest(
  request: NextRequest,
  options?: { onSafeAssistantMessage?: (message: string) => void | Promise<void> }
) {
  const requestStartedAt = Date.now()
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

    // Contrôle commercial côté serveur : trial/premium illimité, free limité au quota mensuel.
    const access = await canAccess(supabaseAdmin, 'ai_coach', user.id)
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason || 'premium_required',
          message: access.reason === 'monthly_limit_reached'
            ? 'Tu as utilisé tes essais Nova du mois. Passe à Premium pour continuer.'
            : 'Cette fonctionnalité nécessite un accès Premium.',
          quota_remaining: access.quota_remaining,
          quota_max: access.quota_max,
          reset_at: access.reset_at,
        },
        { status: 403 }
      )
    }

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

    // LOT 3 LATENCE : on lance en parallèle toutes les lectures indépendantes
    // (historique, contexte NOVAÉ et éventuelle recherche web) avant de les attendre.
    // Le contenu et les garde-fous restent identiques : seule l'ordonnancement change.
    const nowIso = new Date().toISOString()
    const webSearchKind = detectNovaWebSearchKind(message)

    const historyPromise = conversationId
      ? supabaseAdmin
          .from('nova_conversation_messages')
          .select('role,content,created_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [], error: null })

    const calendarWindowStart = new Date()
    calendarWindowStart.setDate(calendarWindowStart.getDate() - 30)

    const contextStartedAt = Date.now()
    const contextPromise = Promise.all([
      supabaseAdmin
        .from('todo_list')
        .select('id,title,description,category,due_date,due_time,status,created_at')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('planner_events')
        .select('id,title,start_date,end_date,start_minutes,end_minutes,location,attendees,status,reminder_minutes_before')
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

    const webResearchPromise: Promise<NovaWebResearch | null> = webSearchKind
      ? runNovaWebSearch(webSearchKind, message, nowIso)
      : Promise.resolve(null)

    let conversationHistory = ''
    const historyRes = await historyPromise
    if (historyRes.error) {
      console.warn('[api/nova/plan] historique conversation indisponible', historyRes.error.message)
    } else {
      const chronological = [...(historyRes.data || [])].reverse()
      // Le client sauvegarde le message utilisateur juste avant l'appel API.
      // On retire cette dernière copie identique pour ne pas le présenter deux fois au modèle.
      const last = chronological[chronological.length - 1]
      if (last?.role === 'user' && String(last.content || '').trim() === message) {
        chronological.pop()
      }
      conversationHistory = chronological
        .slice(-24)
        .map((row) => {
          const when = row.created_at ? frenchLocal(row.created_at) : 'date inconnue'
          const speaker = row.role === 'assistant' ? 'Nova' : row.role === 'user' ? 'Utilisateur' : 'Système'
          return `[message envoyé le ${when}] ${speaker} : ${String(row.content || '').trim()}`
        })
        .filter(Boolean)
        .join('\n')
      conversationHistory = capContext(conversationHistory, 10_000, true) || ''
    }

    const conversationalRequest = [
      conversationHistory ? `Historique récent de cette conversation :\n${conversationHistory}` : '',
      workflowContext ? `État du sujet actif :\n${workflowContext}` : '',
      `Nouveau message de l’utilisatrice : ${message}`,
      'Réponds uniquement au nouveau message. Utilise l’historique et les données connues silencieusement. IMPORTANT TEMPOREL : chaque ligne d’historique porte sa date réelle ; les mots relatifs contenus dans un ancien message (« demain », « samedi », « cette semaine », etc.) doivent être interprétés par rapport à la date de CE message, jamais par rapport à aujourd’hui. Le planning actuel fourni par la base est prioritaire pour affirmer qu’un rendez-vous futur existe. Le champ lieu des événements Planner est aussi un contexte de position : utilise-le pour déterminer d’où l’utilisatrice part probablement juste avant un déplacement, sans inventer si le lieu précédent n’est pas renseigné. N’affirme jamais qu’un ancien rendez-vous est encore à venir s’il est déjà passé ou s’il n’apparaît pas comme événement futur dans le contexte Planner. Ne récite jamais le programme complet sauf demande explicite, ne répète pas les informations déjà établies, ne ramène pas automatiquement un ancien sujet et ne pose qu’une question à la fois. Une réponse courante doit rester courte et naturelle. Ne prétends jamais avoir exécuté une action avant le résultat réel du moteur.',
    ].filter(Boolean).join('\n\n')

    const [
      tasksRes,
      eventsRes,
      remindersRes,
      profileRes,
      memoriesRes,
      familyRes,
      adminDocsRes,
      notesRes,
      mealsRes,
      shoppingRes,
      routinesRes,
      recipesRes,
    ] = await contextPromise
    const contextMs = Date.now() - contextStartedAt

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
    const nowMs = Date.now()
    const eventContext = activeEventRows
      .map((event) => {
        const startClock = plannerClockLabel(event.start_minutes)
        const endClock = plannerClockLabel(event.end_minutes)
        const startComparable = plannerComparableMs(event.start_date, event.start_minutes)
        const endComparable = plannerComparableMs(event.end_date, event.end_minutes)

        return [
          `id=${event.id}`,
          `titre=${String(event.title || '').replace(/\s+/g, ' ').trim()}`,
          `position_temporelle=${endComparable < nowMs ? 'PASSE' : startComparable > nowMs ? 'FUTUR' : 'EN_COURS'}`,
          `date_debut=${plannerDateLabel(event.start_date)}`,
          `heure_debut=${startClock || 'non renseignée'}`,
          `debut_local=${plannerLocalDateTime(event.start_date, event.start_minutes)}`,
          `date_fin=${plannerDateLabel(event.end_date)}`,
          `heure_fin=${endClock || 'non renseignée'}`,
          `fin_local=${plannerLocalDateTime(event.end_date, event.end_minutes)}`,
          `lieu=${event.location || 'aucun'}`,
          `participants=${(event.attendees || []).join(', ') || 'aucun'}`,
          `rappel_minutes=${(event.reminder_minutes_before || []).join(',') || 'aucun'}`,
          `statut=${event.status || 'pending'}`,
        ].join(' ; ')
      })
      .join('\n')

    const calendarMatches: RequestCalendarMatch[] = findBestCalendarMatches(
      message,
      activeEventRows,
      0.2
    ).slice(0, 5)
    const calendarMatchContext = calendarMatches
      .map(({ event, score, reasons }) => {
        const plannerEvent = event as ActiveCalendarContextRow
        return [
          `score=${score.toFixed(3)}`,
          `id=${plannerEvent.id}`,
          `titre=${String(plannerEvent.title || '').replace(/\s+/g, ' ').trim()}`,
          `date_debut=${plannerDateLabel(plannerEvent.start_date)}`,
          `heure_debut=${plannerClockLabel(plannerEvent.start_minutes) || 'non renseignée'}`,
          `debut_local=${plannerLocalDateTime(plannerEvent.start_date, plannerEvent.start_minutes)}`,
          `date_fin=${plannerDateLabel(plannerEvent.end_date)}`,
          `heure_fin=${plannerClockLabel(plannerEvent.end_minutes) || 'non renseignée'}`,
          `fin_local=${plannerLocalDateTime(plannerEvent.end_date, plannerEvent.end_minutes)}`,
          `raisons=${reasons.join(', ') || 'proximite semantique'}`,
        ].join(' ; ')
      })
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
      const profileRow = (profileRes.data || null) as Record<string, unknown> | null
      const profileText = buildUserContextFromProfile(profileRow)
      const memoryRows = memoriesRes.data as NovaMemoryRow[] | null
      const familyRows = familyRes.data as FamilyMemberRow[] | null
      const ownProfileText = buildDeterministicOwnProfileContext(memoryRows, user.email, 'Europe/Paris')
      const memoriesText = formatNovaMemories(memoryRows)
      const familyText = formatFamilyContext(familyRows, 'Europe/Paris')
      const learningHintsText = buildProfileLearningHints(profileRow, memoryRows, familyRows, message)
      const adminDocsText = formatAdminDocsContext(adminDocsRes.data as AdminDocRow[] | null)
      const notesText = formatNotesContext(notesRes.data as NoteRow[] | null, message, conversationHistory)
      const mealsText = formatMealsContext(mealsRes.data as MealRow[] | null)
      const shoppingText = formatShoppingContext(shoppingRes.data as ShoppingRow[] | null)
      const routinesText = formatRoutinesContext(routinesRes.data as RoutineRow[] | null)
      const recipesText = formatRecipesContext(recipesRes.data as RecipeContextRow[] | null)

      const parts: string[] = []
      if (profileText) parts.push(profileText)
      if (ownProfileText) parts.push(`Profil factuel déterministe de l’utilisatrice :\n${ownProfileText}`)
      if (memoriesText) parts.push(`Ce que Nova a appris au fil des échanges :\n${memoriesText}`)
      if (familyText) parts.push(`Entourage et organisation du foyer :\n${familyText}`)
      if (learningHintsText) parts.push(learningHintsText)
      if (adminDocsText) parts.push(`Documents administratifs en attente (métadonnées uniquement) :\n${adminDocsText}`)
      if (notesText) parts.push(`Notes récentes (identifiants internes ; le contenu d’une note peut être exposé lorsqu’elle est identifiée directement OU par une référence claire dans la conversation comme « cette liste » ; ne jamais afficher les identifiants) :\n${notesText}`)
      if (mealsText) parts.push(`Plan de repas de la semaine :\n${mealsText}`)
      if (shoppingText) parts.push(`Liste de courses à acheter :\n${shoppingText}`)
      if (routinesText) parts.push(`Routines actives :\n${routinesText}`)
      if (recipesText) parts.push(`Recettes déjà enregistrées (identifiants internes, ne jamais les afficher) :\n${recipesText}`)
      userContext = capContext(parts.length > 0 ? parts.join('\n\n') : undefined, 18_000)
    } catch (contextError) {
      console.warn('[api/nova/plan] contexte indisponible, poursuite sans', contextError)
    }

    const webResearch = await webResearchPromise

    const enrichedMessageWithContext = [
      messageWithContext,
      webResearch
        ? formatNovaWebResearchForModel(webResearch)
        : webSearchKind
          ? [
              'RECHERCHE WEB DEMANDÉE MAIS INDISPONIBLE POUR CE TOUR.',
              'Ne promets pas de recherche ultérieure. Dis immédiatement que la vérification en temps réel n’a pas abouti et réponds seulement avec ce que tu peux affirmer sans inventer.',
            ].join('\n')
          : '',
    ].filter(Boolean).join('\n\n')

    const temporalRealityContext = buildTemporalRealityContext(
      nowIso,
      'Europe/Paris'
    )

    const temporalGuard = [
      'RÈGLES DE FIABILITÉ PLANNER :',
      '- Pour toute question sur un horaire prévu, les événements Planner ACTUELS fournis dans le contexte sont la source de vérité prioritaire.',
      '- Pour l’heure d’un événement Planner, utilise en priorité heure_debut / heure_fin issues de start_minutes / end_minutes. Elles sont déterministes et ne doivent subir AUCUNE conversion de fuseau horaire.',
      '- Ne remplace jamais 17:00/17:30 par 19:00/19:30 si le Planner actuel indique 17:00/17:30.',
      '- Si l’historique conversationnel contredit le Planner actuel, utilise le Planner actuel.',
      '- Avant d’annoncer une heure de départ, vérifie arithmétiquement sa cohérence avec la fin de l’événement précédent.',
      '- Si le départ calculé tombe AVANT la fin du travail, annonce clairement un conflit de planning. Ne prétends jamais qu’il reste du temps après la fin du service.',
      '- Exemple : travail jusqu’à 17:00, école à 17:30, trajet 30 min + marge 5 min => départ 16:55 : il y a donc un conflit de 5 minutes avec le travail.',
    ].join('\n')

    const modelStartedAt = Date.now()
    const result = await createNovaActionPlan(
      {
        message: `${enrichedMessageWithContext}\n\n${temporalRealityContext}\n\n${temporalGuard}`,
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        nowIso,
        userContext,
      },
      provider,
      { onSafeAssistantMessage: options?.onSafeAssistantMessage }
    )
    const modelMs = Date.now() - modelStartedAt

    result.plan = applyTaskIdentityGuard(
      result.plan,
      message,
      duplicatePairs,
      requestMatches
    )

    // Garde déterministe : une demande explicite de vidage des courses doit
    // toujours produire une vraie action confirmable, jamais une simple promesse.
    result.plan = applyShoppingListClearGuard(result.plan, message)

    // LOT 3 LATENCE : les écritures secondaires n'altèrent pas la réponse métier.
    // Elles sont lancées en parallèle au lieu de s'attendre les unes les autres.
    const postStartedAt = Date.now()
    const telemetryPromise = (async () => {
      try {
        const { error } = await supabaseAdmin
          .from('ai_usage')
          .insert({
            user_id: user.id,
            route: 'nova_plan',
            provider: result.provider,
            model: result.model,
            input_tokens: result.usage?.inputTokens ?? null,
            output_tokens: result.usage?.outputTokens ?? null,
            duration_ms: result.durationMs ?? null,
            success: true,
          })

        if (error) {
          console.warn('[api/nova/plan] ai_usage non enregistré', error.message)
        }
      } catch (usageError) {
        console.warn('[api/nova/plan] ai_usage non enregistré', usageError)
      }
    })()

    const quotaPromise = incrementAiChatCount(supabaseAdmin, user.id).catch((quotaError) => {
      console.warn('[api/nova/plan] quota IA non incrémenté', quotaError)
    })

    const memoryPromise = (async () => {
      try {
        const durable = selectDurableMemories(
          result.plan.memory_candidates as MemoryCandidateLike[]
        )
        if (durable.length === 0) return

        const memoryNowIso = new Date().toISOString()
        await Promise.allSettled(
          durable.map(async (memory) => {
            const { data: existingMemory, error: existingMemoryError } = await supabaseAdmin
              .from('nova_memories')
              .select('confidence,value')
              .eq('user_id', user.id)
              .eq('key', memory.key)
              .maybeSingle()

            if (existingMemoryError) {
              console.warn('[api/nova/plan] lecture mémoire existante impossible', existingMemoryError.message)
              return
            }

            const existingConfidence = Number(existingMemory?.confidence || 0)
            if (
              existingMemory &&
              existingMemory.value &&
              existingMemory.value !== memory.value &&
              existingConfidence > memory.confidence
            ) {
              return
            }

            const { error: upsertError } = await supabaseAdmin
              .from('nova_memories')
              .upsert(
                {
                  user_id: user.id,
                  key: memory.key,
                  value: memory.value,
                  scope: memory.scope,
                  confidence: memory.confidence,
                  source: 'nova_auto',
                  updated_at: memoryNowIso,
                },
                { onConflict: 'user_id,key' }
              )

            if (upsertError) {
              console.warn('[api/nova/plan] mémoire non enregistrée', upsertError.message)
            }
          })
        )
      } catch (memoryError) {
        console.warn('[api/nova/plan] mémoire non enregistrée', memoryError)
      }
    })()

    await Promise.allSettled([telemetryPromise, quotaPromise, memoryPromise])
    const postMs = Date.now() - postStartedAt

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

    const totalMs = Date.now() - requestStartedAt
    console.info('[api/nova/plan][perf]', {
      total_ms: totalMs,
      context_ms: contextMs,
      model_ms: modelMs,
      post_ms: postMs,
    })

    return NextResponse.json(
      {
        ...result,
        executionToken,
        webSearch: webResearch
          ? {
              used: true,
              kind: webResearch.kind,
              sources: webResearch.sources,
            }
          : webSearchKind
            ? { used: false, kind: webSearchKind, sources: [] }
            : undefined,
      },
      {
        headers: {
          'Server-Timing': `nova_context;dur=${contextMs}, nova_model;dur=${modelMs}, nova_post;dur=${postMs}, nova_total;dur=${totalMs}`,
        },
      }
    )
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