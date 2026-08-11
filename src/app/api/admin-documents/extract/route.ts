import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  type AdministrativeDocumentExtractedData,
} from '@/lib/admin-documents/types'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_SIZE = 5 * 1024 * 1024
const DOCUMENT_ANALYSIS_MAX_PER_HOUR = 10
const ANTHROPIC_TIMEOUT_MS = 22_000

async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component context: safe to ignore.
          }
        },
      },
    }
  )
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [type, token] = header.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null

  return token
}

function getSupabaseBearerClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}


const MAX_FILES = 10

function getTodayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArrayOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number') return 0.5
  return Math.max(0, Math.min(1, value))
}

function normalizeContentKind(value: unknown): AdministrativeDocumentExtractedData['content_kind'] {
  const allowed = [
    'administrative_document', 'recipe', 'note', 'message',
    'shopping_list', 'appointment', 'task', 'other',
  ]
  return typeof value === 'string' && allowed.includes(value)
    ? value as AdministrativeDocumentExtractedData['content_kind']
    : 'other'
}

function normalizeDestination(value: unknown): AdministrativeDocumentExtractedData['suggested_destination'] {
  const allowed = ['documents', 'recipes', 'notes', 'shopping', 'planner', 'todo', 'none']
  return typeof value === 'string' && allowed.includes(value)
    ? value as AdministrativeDocumentExtractedData['suggested_destination']
    : 'none'
}

function normalizeDocumentType(value: unknown): AdministrativeDocumentExtractedData['document_type'] {
  const allowed = [
    'tax', 'caf', 'health_insurance', 'insurance', 'school',
    'fine', 'invoice', 'bank', 'employment', 'housing', 'other',
  ]
  return typeof value === 'string' && allowed.includes(value)
    ? value as AdministrativeDocumentExtractedData['document_type']
    : 'other'
}

function computeDueDateStatus(
  dueDate: string | null,
  todayISO: string
): AdministrativeDocumentExtractedData['due_date_status'] {
  if (!dueDate) return 'none'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'unknown'
  if (dueDate < todayISO) return 'overdue'
  if (dueDate === todayISO) return 'today'
  return 'upcoming'
}

function normalizeUrgency(
  urgency: unknown,
  dueDateStatus: AdministrativeDocumentExtractedData['due_date_status']
): AdministrativeDocumentExtractedData['urgency'] {
  const allowed = ['none', 'low', 'medium', 'high', 'critical']
  const value = typeof urgency === 'string' && allowed.includes(urgency)
    ? urgency as AdministrativeDocumentExtractedData['urgency']
    : 'medium'

  if (dueDateStatus === 'overdue' && (value === 'none' || value === 'low' || value === 'medium')) {
    return 'high'
  }
  return value
}

function safeParseExtraction(rawText: string, pageCount: number): AdministrativeDocumentExtractedData {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  const todayISO = getTodayISODate()
  const dueDate = stringOrNull(parsed.due_date)
  const dueDateStatus = computeDueDateStatus(dueDate, todayISO)

  return {
    content_kind: normalizeContentKind(parsed.content_kind),
    suggested_destination: normalizeDestination(parsed.suggested_destination),
    routing_reason: stringOrNull(parsed.routing_reason),
    page_count: pageCount,
    transcribed_content: stringOrNull(parsed.transcribed_content),
    title: stringOrNull(parsed.title),
    document_type: normalizeDocumentType(parsed.document_type),
    sender: stringOrNull(parsed.sender),
    received_date: stringOrNull(parsed.received_date),
    due_date: dueDate,
    due_date_status: dueDateStatus,
    recommended_next_step: stringOrNull(parsed.recommended_next_step),
    amount: numberOrNull(parsed.amount),
    currency: 'EUR',
    action_required: stringOrNull(parsed.action_required),
    summary: stringOrNull(parsed.summary) || 'Contenu analysé. Vérification utilisateur requise.',
    urgency: normalizeUrgency(parsed.urgency, dueDateStatus),
    confidence: normalizeConfidence(parsed.confidence),
    suggested_task_title: stringOrNull(parsed.suggested_task_title),
    suggested_task_description: stringOrNull(parsed.suggested_task_description),
    suggested_event_title: stringOrNull(parsed.suggested_event_title),
    suggested_event_date: stringOrNull(parsed.suggested_event_date),
    missing_information: stringArrayOrEmpty(parsed.missing_information),
    warnings: stringArrayOrEmpty(parsed.warnings),
  }
}

function buildExtractionPrompt(todayISO: string, pageCount: number): string {
  return `
Analyse l'ensemble des ${pageCount} fichier(s)/page(s) fourni(s), dans cet ordre.
Ils doivent être considérés comme UN SEUL contenu logique tant que rien ne prouve le contraire.

La date du jour est ${todayISO}.

Retourne UNIQUEMENT un JSON valide avec exactement ces champs :
{
  "content_kind": "administrative_document" | "recipe" | "note" | "message" | "shopping_list" | "appointment" | "task" | "other",
  "suggested_destination": "documents" | "recipes" | "notes" | "shopping" | "planner" | "todo" | "none",
  "routing_reason": string | null,
  "transcribed_content": string | null,
  "title": string | null,
  "document_type": "tax" | "caf" | "health_insurance" | "insurance" | "school" | "fine" | "invoice" | "bank" | "employment" | "housing" | "other",
  "sender": string | null,
  "received_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
  "due_date_status": "none" | "upcoming" | "today" | "overdue" | "unknown",
  "recommended_next_step": string | null,
  "amount": number | null,
  "currency": "EUR",
  "action_required": string | null,
  "summary": string,
  "urgency": "none" | "low" | "medium" | "high" | "critical",
  "confidence": number,
  "suggested_task_title": string | null,
  "suggested_task_description": string | null,
  "suggested_event_title": string | null,
  "suggested_event_date": "YYYY-MM-DD" | null,
  "missing_information": string[],
  "warnings": string[]
}

Routage attendu :
- administratif/facture/courrier officiel -> documents
- recette -> recipes
- note manuscrite/texte libre -> notes
- liste de courses -> shopping
- rendez-vous/invitation avec date -> planner
- tâche/pense-bête -> todo
- message/capture de conversation -> détecte ce que le message implique ; choisis notes, todo ou planner si c'est suffisamment clair, sinon none
- autre/ambigu -> none

Règles :
- N'invente jamais une information absente.
- transcribed_content doit contenir une transcription fidèle et exploitable de tout le contenu utile à une future création dans le module cible.
- Pour une recette : conserve titre, portions si visibles, ingrédients avec quantités et préparation.
- Pour une liste de courses : conserve tous les articles et quantités visibles.
- Pour une note ou un message : conserve le texte utile sans le réécrire de façon créative.
- Pour un rendez-vous : conserve date, heure, lieu et personnes uniquement si visibles.
- Pour une tâche : conserve l'action demandée et l'échéance uniquement si visibles.
- Analyse toutes les pages avant de conclure.
- Ne démarre aucune action : tu proposes seulement un classement.
- Si le contenu n'est PAS administratif, garde les champs administratifs inutiles à null / "other" / "none" selon leur type.
- Toute création dans un module cible devra être confirmée ensuite par l'utilisateur.
`
}

async function buildAnthropicContent(files: File[]) {
  const content: any[] = []

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    content.push({
      type: 'text',
      text: `PAGE/FICHIER ${index + 1} SUR ${files.length} — ${file.name}`,
    })

    if (isPdfFile(file)) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      })
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.type || 'image/jpeg',
          data: base64,
        },
      })
    }
  }

  content.push({
    type: 'text',
    text: buildExtractionPrompt(getTodayISODate(), files.length),
  })

  return content
}

export async function POST(request: NextRequest) {
  try {
    const bearerToken = getBearerToken(request)
    const supabase = bearerToken
      ? getSupabaseBearerClient(bearerToken)
      : await getSupabaseServerClient()

    const { data: { user }, error: authError } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Session expirée. Reconnecte-toi puis réessaie.' }, { status: 401 })
    }

    if (!canAccessAdminDocuments(user.email)) {
      return NextResponse.json({ error: 'Module administratif réservé à la phase de test.' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration serveur incomplète.' }, { status: 500 })
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const rl = await rateLimit(adminClient, user.id, 'admin_documents_extract', {
      max: DOCUMENT_ANALYSIS_MAX_PER_HOUR,
      windowMinutes: 60,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Trop d’analyses en peu de temps. Réessaie plus tard.' },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('documents').filter((item): item is File => item instanceof File)

    if (files.length === 0) {
      const legacy = formData.get('document')
      if (legacy instanceof File) files.push(legacy)
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 })
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} pages/fichiers par analyse.` }, { status: 400 })
    }

    for (const file of files) {
      if (!isImageFile(file) && !isPdfFile(file)) {
        return NextResponse.json({ error: `Format non accepté : ${file.name}` }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `${file.name} dépasse 5 MB après préparation.` }, { status: 413 })
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Configuration IA manquante.' }, { status: 500 })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS)
    const startedAt = Date.now()
    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2200,
          temperature: 0,
          system: ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: await buildAnthropicContent(files),
          }],
        }),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: "L'analyse a pris trop de temps. Réessaie avec moins de pages." },
          { status: 504 }
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      console.error('[documents extract] anthropic failed', { status: response.status })
      await adminClient.from('ai_usage').insert({
        user_id: user.id,
        route: 'admin_documents_extract',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        duration_ms: Date.now() - startedAt,
        success: false,
      })
      return NextResponse.json(
        { error: "Nova n'arrive pas à analyser cet ensemble. Vérifie la netteté des pages puis réessaie." },
        { status: 502 }
      )
    }

    const data = await response.json()
    await adminClient.from('ai_usage').insert({
      user_id: user.id,
      route: 'admin_documents_extract',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      input_tokens: Number.isFinite(Number(data?.usage?.input_tokens)) ? Number(data.usage.input_tokens) : null,
      output_tokens: Number.isFinite(Number(data?.usage?.output_tokens)) ? Number(data.usage.output_tokens) : null,
      duration_ms: Date.now() - startedAt,
      success: true,
    })
    const rawText = data?.content?.find((item: any) => item?.type === 'text')?.text

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: "L'IA n'a pas retourné de résultat lisible." }, { status: 502 })
    }

    let extraction: AdministrativeDocumentExtractedData
    try {
      extraction = safeParseExtraction(rawText, files.length)
    } catch (parseError) {
      console.error('[documents extract] JSON parse failed', {
        message: parseError instanceof Error ? parseError.message : 'invalid_json',
        responseLength: rawText.length,
      })
      return NextResponse.json(
        { error: "Nova a lu le contenu mais la classification n'est pas exploitable. Réessaie." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      extraction,
      notice: files.length > 1
        ? `${files.length} pages analysées ensemble. Vérifie le classement proposé avant validation.`
        : 'Contenu analysé. Vérifie le classement proposé avant validation.',
    })
  } catch (error) {
    console.error('[documents extract] unexpected error', error)
    return NextResponse.json({ error: "Erreur inattendue pendant l'analyse." }, { status: 500 })
  }
}
