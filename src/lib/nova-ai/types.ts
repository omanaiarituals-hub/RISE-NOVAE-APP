export const NOVA_PROVIDER_IDS = ['anthropic', 'openai'] as const
export type NovaProviderId = (typeof NOVA_PROVIDER_IDS)[number]
export type NovaProviderPreference = NovaProviderId | 'auto'

export const NOVA_INTENTS = [
  'task',
  'calendar',
  'document',
  'administrative',
  'finance',
  'family',
  'meal',
  'note',
  'question',
  'unknown',
] as const
export type NovaIntent = (typeof NOVA_INTENTS)[number]

export const NOVA_ENGINES = [
  'tasks',
  'calendar',
  'documents',
  'administrative',
  'finance',
  'family',
  'meals',
  'notes',
  'memory',
  'notifications',
  'none',
] as const
export type NovaEngine = (typeof NOVA_ENGINES)[number]

export const NOVA_ACTION_TYPES = [
  'create_task',
  'create_reminder',
  'create_calendar_event',
  'classify_document',
  'create_admin_case',
  'prepare_email',
  'save_note',
  'ask_question',
  'no_action',
] as const
export type NovaActionType = (typeof NOVA_ACTION_TYPES)[number]

export type NovaRiskLevel = 'none' | 'low' | 'medium' | 'high'
export type NovaMemoryScope = 'temporary' | 'profile' | 'family' | 'preference' | 'organization'

export interface NovaPlanInput {
  message: string
  locale: string
  timezone: string
  nowIso: string
}

export interface NovaExtractedDate {
  raw: string
  iso: string
  kind: 'date' | 'deadline' | 'appointment' | 'reminder' | 'unknown'
}

export interface NovaExtractedAmount {
  value: number
  currency: string
  label: string
}

export interface NovaExtractedData {
  people: string[]
  organizations: string[]
  dates: NovaExtractedDate[]
  amounts: NovaExtractedAmount[]
  documents: string[]
  locations: string[]
  facts: string[]
}

export interface NovaMissingInformation {
  field: string
  question: string
  blocking: boolean
}

export interface NovaActionParameter {
  key: string
  value: string
}

export interface NovaProposedAction {
  id: string
  type: NovaActionType
  engine: NovaEngine
  title: string
  reason: string
  risk: NovaRiskLevel
  requires_confirmation: boolean
  parameters: NovaActionParameter[]
}

export interface NovaMemoryCandidate {
  key: string
  value: string
  scope: NovaMemoryScope
  confidence: number
  requires_confirmation: boolean
}

export interface NovaActionPlan {
  version: '1.0'
  summary: string
  intent: NovaIntent
  confidence: number
  extracted_data: NovaExtractedData
  missing_information: NovaMissingInformation[]
  proposed_actions: NovaProposedAction[]
  memory_candidates: NovaMemoryCandidate[]
  assistant_message: string
}

export interface NovaProviderUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface NovaProviderResult {
  provider: NovaProviderId
  model: string
  plan: NovaActionPlan
  usage?: NovaProviderUsage
}

export interface NovaPlanResult extends NovaProviderResult {
  attemptedProviders: NovaProviderId[]
  durationMs: number
  dryRun: true
}
