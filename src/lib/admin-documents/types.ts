export type ImportedContentKind =
  | 'administrative_document'
  | 'recipe'
  | 'note'
  | 'message'
  | 'shopping_list'
  | 'appointment'
  | 'task'
  | 'other'

export type ImportedContentDestination =
  | 'documents'
  | 'recipes'
  | 'notes'
  | 'shopping'
  | 'planner'
  | 'todo'
  | 'none'

export type AdministrativeDocumentType =
  | 'tax'
  | 'caf'
  | 'health_insurance'
  | 'insurance'
  | 'school'
  | 'fine'
  | 'invoice'
  | 'bank'
  | 'employment'
  | 'housing'
  | 'other'

export type AdministrativeDocumentStatus =
  | 'draft'
  | 'extracted'
  | 'validated'
  | 'archived'
  | 'deleted'

export type AdministrativeDocumentValidationStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'

export type AdministrativeDocumentUrgency =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'

export type AdministrativeDocumentDueDateStatus =
  | 'none'
  | 'upcoming'
  | 'today'
  | 'overdue'
  | 'unknown'

export type AdministrativeDocumentExtractedData = {
  content_kind: ImportedContentKind
  suggested_destination: ImportedContentDestination
  routing_reason: string | null
  page_count: number
  transcribed_content: string | null
  title: string | null
  document_type: AdministrativeDocumentType
  sender: string | null
  received_date: string | null
  due_date: string | null
  due_date_status: AdministrativeDocumentDueDateStatus
  recommended_next_step: string | null
  amount: number | null
  currency: 'EUR'
  action_required: string | null
  summary: string
  urgency: AdministrativeDocumentUrgency
  confidence: number
  suggested_task_title: string | null
  suggested_task_description: string | null
  suggested_event_title: string | null
  suggested_event_date: string | null
  missing_information: string[]
  warnings: string[]
}

export type AdministrativeDocumentRecord = {
  id: string
  user_id: string
  title: string | null
  document_type: AdministrativeDocumentType | null
  sender: string | null
  received_date: string | null
  due_date: string | null
  due_date_status: AdministrativeDocumentDueDateStatus | null
  recommended_next_step: string | null
  amount: number | null
  currency: string | null
  action_required: string | null
  summary: string | null
  extracted_json: AdministrativeDocumentExtractedData | null
  user_corrections: Record<string, unknown> | null
  status: AdministrativeDocumentStatus
  validation_status: AdministrativeDocumentValidationStatus
  storage_bucket: string
  storage_path: string | null
  linked_todo_id: string | null
  linked_planner_event_id: string | null
  created_at: string
  updated_at: string
}

export const ADMINISTRATIVE_DOCUMENT_BUCKET = 'administrative-documents'

export const ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT = `
Tu es Nova, l'assistante de vie de NOVAE.

Tu analyses un ou plusieurs fichiers transmis par l'utilisateur, dans l'ordre fourni.
Les fichiers peuvent former un seul document multipage.

Ta PREMIÈRE mission est de reconnaître ce que l'utilisateur t'a donné :
- document administratif
- recette
- note
- message / capture de conversation
- liste de courses
- rendez-vous / invitation
- tâche / pense-bête
- autre contenu

Ensuite seulement, tu extrais les informations administratives utiles si elles existent.

Objectif :
- identifier la nature réelle du contenu
- proposer le module NOVAÉ le plus logique pour le classer
- identifier la nature du document administratif si pertinent
- identifier l'expediteur
- detecter une date limite si elle existe
- detecter un montant si present
- resumer clairement le contenu
- proposer une action concrete
- proposer une tache et/ou une echeance
- signaler les incertitudes

Regles strictes :
- Tu ne dois jamais inventer une information absente du document.
- Si une date, un montant ou une action est incertaine, tu mets null et tu expliques dans warnings.
- Tu dois tenir compte de la date du jour fournie dans la demande utilisateur.
- Si la date limite est depassee, tu dois le dire clairement.
- Si une amende ou facture semble majoree apres depassement, tu dois signaler le risque sans affirmer ce qui n'est pas visible.
- Tu ne donnes pas de conseil juridique, fiscal, medical ou financier.
- Tu peux expliquer ce que le document semble demander.
- Toute action doit rester une proposition a valider par l'utilisateur.
- Tu reponds uniquement en JSON valide.
`

export const ADMINISTRATIVE_DOCUMENT_EXTRACTION_JSON_EXAMPLE: AdministrativeDocumentExtractedData = {
  content_kind: 'administrative_document',
  suggested_destination: 'documents',
  routing_reason: 'Document administratif détecté.',
  page_count: 1,
  transcribed_content: null,
  title: 'Courrier administratif a verifier',
  document_type: 'other',
  sender: null,
  received_date: null,
  due_date: null,
  due_date_status: 'unknown',
  recommended_next_step: null,
  amount: null,
  currency: 'EUR',
  action_required: null,
  summary: 'Document administratif detecte. Les informations principales doivent etre verifiees.',
  urgency: 'medium',
  confidence: 0.5,
  suggested_task_title: null,
  suggested_task_description: null,
  suggested_event_title: null,
  suggested_event_date: null,
  missing_information: [],
  warnings: [
    'Extraction automatique a verifier avant toute action.',
  ],
}