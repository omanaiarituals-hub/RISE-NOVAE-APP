import type { NovaActionPlan, NovaProposedAction } from './types'

export const TASK_CATEGORIES = [
  'self',
  'family',
  'pro',
  'social',
  'health',
  'home',
  'other',
] as const
export type TaskCategory = (typeof TASK_CATEGORIES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface PreparedTaskInsert {
  actionId: string
  title: string
  description: string | null
  category: TaskCategory
  priority: TaskPriority
  dueDate: string | null
  dueTime: string | null
}

function normalizedKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parametersMap(action: NovaProposedAction): Map<string, string> {
  const map = new Map<string, string>()
  for (const parameter of action.parameters) {
    const key = normalizedKey(parameter.key)
    const value = parameter.value.trim()
    if (key && value) map.set(key, value)
  }
  return map
}

function firstParameter(map: Map<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = map.get(normalizedKey(key))
    if (value) return value
  }
  return ''
}

function cleanDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  if (!match) return null
  const parsed = new Date(`${match[1]}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return match[1]
}

function cleanTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

function cleanCategory(value: string): TaskCategory {
  const normalized = normalizedKey(value)
  const aliases: Record<string, TaskCategory> = {
    personnel: 'self',
    perso: 'self',
    self: 'self',
    famille: 'family',
    family: 'family',
    professionnel: 'pro',
    travail: 'pro',
    pro: 'pro',
    social: 'social',
    sante: 'health',
    health: 'health',
    maison: 'home',
    domicile: 'home',
    home: 'home',
    autre: 'other',
    other: 'other',
  }
  return aliases[normalized] || 'self'
}

function cleanPriority(value: string): TaskPriority {
  const normalized = normalizedKey(value)
  const aliases: Record<string, TaskPriority> = {
    basse: 'low',
    faible: 'low',
    low: 'low',
    moyenne: 'medium',
    normal: 'medium',
    medium: 'medium',
    haute: 'high',
    elevee: 'high',
    high: 'high',
    urgente: 'urgent',
    urgent: 'urgent',
  }
  return aliases[normalized] || 'medium'
}

function fallbackDueDate(plan: NovaActionPlan): string | null {
  const preferred = plan.extracted_data.dates.find(
    (date) => date.kind === 'deadline' && cleanDate(date.iso)
  )
  if (preferred) return cleanDate(preferred.iso)

  const anyDate = plan.extracted_data.dates.find((date) => cleanDate(date.iso))
  return anyDate ? cleanDate(anyDate.iso) : null
}

export function normalizeTaskTitle(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr-FR')
}

export function prepareTaskInsert(
  action: NovaProposedAction,
  plan: NovaActionPlan
): PreparedTaskInsert {
  if (action.type !== 'create_task' || action.engine !== 'tasks') {
    throw new Error('Cette action n’est pas une création de tâche autorisée.')
  }
  if (!action.requires_confirmation) {
    throw new Error('La tâche n’a pas été marquée comme nécessitant une confirmation.')
  }
  if (action.risk === 'high') {
    throw new Error('Une action à risque élevé ne peut pas être exécutée automatiquement.')
  }

  const parameters = parametersMap(action)
  const title = (
    firstParameter(parameters, ['title', 'titre', 'task_title', 'nom']) || action.title
  )
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180)

  if (title.length < 2) {
    throw new Error('Le titre de la tâche est manquant.')
  }

  const descriptionValue = firstParameter(parameters, [
    'description',
    'details',
    'detail',
    'notes',
  ])
  const description = (descriptionValue || action.reason).trim().slice(0, 1_500) || null

  const dueDateValue = firstParameter(parameters, [
    'due_date',
    'date',
    'deadline',
    'echeance',
  ])
  const dueTimeValue = firstParameter(parameters, ['due_time', 'time', 'heure'])

  return {
    actionId: action.id,
    title,
    description,
    category: cleanCategory(firstParameter(parameters, ['category', 'categorie'])),
    priority: cleanPriority(firstParameter(parameters, ['priority', 'priorite'])),
    dueDate: cleanDate(dueDateValue) || fallbackDueDate(plan),
    dueTime: cleanTime(dueTimeValue),
  }
}
