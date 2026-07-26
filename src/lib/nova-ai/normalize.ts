import {
  NOVA_ACTION_TYPES,
  NOVA_ENGINES,
  NOVA_INTENTS,
  type NovaActionParameter,
  type NovaActionPlan,
  type NovaActionType,
  type NovaEngine,
  type NovaIntent,
  type NovaMemoryCandidate,
  type NovaMissingInformation,
  type NovaProposedAction,
  type NovaRiskLevel,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function confidenceValue(value: unknown, fallback = 0.5): number {
  return Math.max(0, Math.min(1, numberValue(value, fallback)))
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => stringValue(item)).filter(Boolean)
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback
}

function normalizeParameters(value: unknown): NovaActionParameter[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((item) => ({ key: stringValue(item.key), value: stringValue(item.value) }))
    .filter((item) => item.key.length > 0)
}

function normalizeActions(value: unknown): NovaProposedAction[] {
  if (!Array.isArray(value)) return []

  return value.filter(isRecord).map((item, index) => ({
    id: stringValue(item.id, `action_${index + 1}`),
    type: enumValue(item.type, NOVA_ACTION_TYPES, 'no_action') as NovaActionType,
    engine: enumValue(item.engine, NOVA_ENGINES, 'none') as NovaEngine,
    title: stringValue(item.title, 'Action proposée'),
    reason: stringValue(item.reason),
    risk: enumValue(item.risk, ['none', 'low', 'medium', 'high'] as const, 'low') as NovaRiskLevel,
    requires_confirmation: booleanValue(item.requires_confirmation, true),
    parameters: normalizeParameters(item.parameters),
  }))
}

function normalizeMissing(value: unknown): NovaMissingInformation[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((item) => ({
      field: stringValue(item.field),
      question: stringValue(item.question),
      blocking: booleanValue(item.blocking),
    }))
    .filter((item) => item.question.length > 0)
}

function normalizeMemory(value: unknown): NovaMemoryCandidate[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((item) => ({
      key: stringValue(item.key),
      value: stringValue(item.value),
      scope: enumValue(
        item.scope,
        ['temporary', 'profile', 'family', 'preference', 'organization'] as const,
        'temporary'
      ),
      confidence: confidenceValue(item.confidence),
      requires_confirmation: booleanValue(item.requires_confirmation, true),
    }))
    .filter((item) => item.key.length > 0 && item.value.length > 0)
}

export function normalizeNovaActionPlan(raw: unknown, originalMessage: string): NovaActionPlan {
  const root = isRecord(raw) ? raw : {}
  const extracted = isRecord(root.extracted_data) ? root.extracted_data : {}

  const dates = Array.isArray(extracted.dates)
    ? extracted.dates.filter(isRecord).map((item) => ({
        raw: stringValue(item.raw),
        iso: stringValue(item.iso),
        kind: enumValue(
          item.kind,
          ['date', 'deadline', 'appointment', 'reminder', 'unknown'] as const,
          'unknown'
        ),
      }))
    : []

  const amounts = Array.isArray(extracted.amounts)
    ? extracted.amounts.filter(isRecord).map((item) => ({
        value: numberValue(item.value),
        currency: stringValue(item.currency, 'EUR'),
        label: stringValue(item.label),
      }))
    : []

  const intent = enumValue(root.intent, NOVA_INTENTS, 'unknown') as NovaIntent
  const summary = stringValue(root.summary, originalMessage.slice(0, 180))

  return {
    version: '1.0',
    summary,
    intent,
    confidence: confidenceValue(root.confidence),
    extracted_data: {
      people: stringArray(extracted.people),
      organizations: stringArray(extracted.organizations),
      dates,
      amounts,
      documents: stringArray(extracted.documents),
      locations: stringArray(extracted.locations),
      facts: stringArray(extracted.facts),
    },
    missing_information: normalizeMissing(root.missing_information),
    proposed_actions: normalizeActions(root.proposed_actions),
    memory_candidates: normalizeMemory(root.memory_candidates),
    assistant_message: stringValue(
      root.assistant_message,
      'J’ai analysé ta demande. Je te montre ce que j’ai compris avant toute action.'
    ),
  }
}
