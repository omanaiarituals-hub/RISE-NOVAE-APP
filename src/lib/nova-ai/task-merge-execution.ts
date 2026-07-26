import type { NovaActionPlan, NovaProposedAction } from './types'

export interface PreparedTaskMerge {
  actionId: string
  keepTaskId: string
  duplicateTaskId: string
  keepTitle: string
  duplicateTitle: string
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

export function prepareTaskMerge(
  action: NovaProposedAction,
  _plan: NovaActionPlan
): PreparedTaskMerge {
  if (action.type !== 'merge_tasks' || action.engine !== 'tasks') {
    throw new Error('Cette action n’est pas une fusion de tâches autorisée.')
  }
  if (!action.requires_confirmation) {
    throw new Error('La fusion n’a pas été marquée comme nécessitant une confirmation.')
  }
  if (action.risk === 'high') {
    throw new Error('Une fusion à risque élevé ne peut pas être exécutée automatiquement.')
  }

  const parameters = parametersMap(action)
  const keepTaskId = cleanUuid(
    firstParameter(parameters, ['keep_task_id', 'task_to_keep_id', 'id_tache_a_garder'])
  )
  const duplicateTaskId = cleanUuid(
    firstParameter(parameters, [
      'duplicate_task_id',
      'task_to_archive_id',
      'id_tache_doublon',
    ])
  )

  if (!keepTaskId || !duplicateTaskId) {
    throw new Error('Les deux tâches à fusionner ne sont pas identifiées avec précision.')
  }
  if (keepTaskId === duplicateTaskId) {
    throw new Error('Une tâche ne peut pas être fusionnée avec elle-même.')
  }

  const keepTitle = firstParameter(parameters, [
    'keep_title',
    'task_to_keep_title',
    'titre_a_garder',
  ])
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180)
  const duplicateTitle = firstParameter(parameters, [
    'duplicate_title',
    'task_to_archive_title',
    'titre_doublon',
  ])
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 180)

  return {
    actionId: action.id,
    keepTaskId,
    duplicateTaskId,
    keepTitle,
    duplicateTitle,
  }
}
