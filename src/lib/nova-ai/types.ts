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
  'merge_tasks',
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
  executionToken?: string
}

export interface NovaTaskExecutionItem {
  kind: 'task'
  actionId: string
  status: 'created' | 'already_exists' | 'failed'
  task: {
    id: string
    title: string
    description: string | null
    category: string | null
    priority: string | null
    due_date: string | null
    due_time: string | null
    status: string
    created_at: string
  } | null
  message: string
}

export interface NovaReminderExecutionItem {
  kind: 'reminder'
  actionId: string
  status: 'scheduled' | 'already_exists' | 'failed'
  reminder: {
    id: string
    todo_id: string
    scheduled_for: string
    status: string
    message: string | null
    created_at: string
  } | null
  task: {
    id: string
    title: string
    due_date: string | null
    due_time: string | null
    status: string
  } | null
  message: string
}


export interface NovaCalendarExecutionItem {
  kind: 'calendar_event'
  actionId: string
  status: 'created' | 'already_exists' | 'conflict' | 'failed'
  event: {
    id: string
    title: string
    start_date: string
    end_date: string
    location: string | null
    source_todo_id: string | null
    status: string | null
  } | null
  conflicts: Array<{ id: string; title: string; start_date: string; end_date: string }>
  message: string
}

export interface NovaTaskMergeExecutionItem {
  kind: 'task_merge'
  actionId: string
  status: 'merged' | 'already_merged' | 'failed'
  keptTask: {
    id: string
    title: string
    due_date: string | null
    due_time: string | null
    status: string
  } | null
  archivedTask: {
    id: string
    title: string
    status: string
    merged_into_todo_id: string | null
    merged_at: string | null
  } | null
  remindersMoved: number
  reminderDuplicatesCancelled: number
  message: string
}

export type NovaExecutionItem =
  | NovaTaskExecutionItem
  | NovaReminderExecutionItem
  | NovaTaskMergeExecutionItem
  | NovaCalendarExecutionItem

export interface NovaExecutionResult {
  ok: boolean
  message: string
  results: NovaExecutionItem[]
  counts: {
    tasksCreated: number
    remindersScheduled: number
    tasksMerged: number
    calendarEventsCreated: number
    alreadyExists: number
    failed: number
    unsupported: number
  }
}
