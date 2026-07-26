import type { NovaActionPlan, NovaProposedAction } from './types'
import { normalizeTaskTitle } from './task-execution'

export interface PreparedReminderInsert {
  actionId: string
  taskId: string | null
  taskTitle: string
  scheduledFor: string
  message: string | null
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

function cleanUuid(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    normalized
  )
    ? normalized
    : null
}

function cleanScheduledFor(value: string): string | null {
  const normalized = value.trim()
  if (!normalized || !/T\d{2}:\d{2}/.test(normalized)) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getTime() < Date.now() + 30_000) return null
  if (parsed.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) return null

  // Les rappels sont gérés à la minute. On neutralise les secondes et
  // millisecondes pour que « dans 5 minutes » et « à 15 h 13 » ciblent
  // exactement le même créneau et ne puissent pas créer deux lignes.
  parsed.setUTCSeconds(0, 0)
  return parsed.toISOString()
}

function fallbackReminderDate(plan: NovaActionPlan): string | null {
  const candidate = plan.extracted_data.dates.find(
    (date) => date.kind === 'reminder' && cleanScheduledFor(date.iso)
  )
  return candidate ? cleanScheduledFor(candidate.iso) : null
}

export function prepareReminderInsert(
  action: NovaProposedAction,
  plan: NovaActionPlan
): PreparedReminderInsert {
  if (action.type !== 'create_reminder' || action.engine !== 'notifications') {
    throw new Error('Cette action n’est pas une création de rappel autorisée.')
  }
  if (!action.requires_confirmation) {
    throw new Error('Le rappel n’a pas été marqué comme nécessitant une confirmation.')
  }
  if (action.risk === 'high') {
    throw new Error('Un rappel à risque élevé ne peut pas être programmé automatiquement.')
  }

  const parameters = parametersMap(action)
  const taskId = cleanUuid(
    firstParameter(parameters, ['task_id', 'todo_id', 'tache_id', 'id_tache'])
  )
  const taskTitle = firstParameter(parameters, [
    'task_title',
    'todo_title',
    'titre_tache',
    'title',
    'titre',
  ])
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180)

  if (!taskId && taskTitle.length < 2) {
    throw new Error('Nova n’a pas identifié avec assez de précision la tâche à rappeler.')
  }

  const scheduledFor =
    cleanScheduledFor(
      firstParameter(parameters, [
        'scheduled_for',
        'reminder_at',
        'date_heure_rappel',
        'datetime',
      ])
    ) || fallbackReminderDate(plan)

  if (!scheduledFor) {
    throw new Error('La date et l’heure exactes du rappel sont manquantes ou invalides.')
  }

  const messageValue = firstParameter(parameters, [
    'message',
    'notification_message',
    'texte',
    'body',
  ])
  const message = (messageValue || action.reason).trim().slice(0, 500) || null

  return {
    actionId: action.id,
    taskId,
    taskTitle: normalizeTaskTitle(taskTitle),
    scheduledFor,
    message,
  }
}
