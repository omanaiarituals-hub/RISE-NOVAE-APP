import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  type AdministrativeDocumentExtractedData,
} from '@/lib/admin-documents/types'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_SIZE = 5 * 1024 * 1024

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

function getTodayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeDueDateStatus(
  dueDate: string | null,
  todayISO: string
): AdministrativeDocumentExtractedData['due_date_status'] {
  if (!dueDate) return 'none'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return 'unknown'
  }

  if (dueDate < todayISO) return 'overdue'
  if (dueDate === todayISO) return 'today'
  return 'upcoming'
}

function normalizeUrgency(
  urgency: unknown,
  dueDateStatus: AdministrativeDocumentExtractedData['due_date_status']
): AdministrativeDocumentExtractedData['urgency'] {
  if (
    urgency === 'none' ||
    urgency === 'low' ||
    urgency === 'medium' ||
    urgency === 'high' ||
    urgency === 'critical'
  ) {
    if (
      dueDateStatus === 'overdue' &&
      (urgency === 'none' || urgency === 'low' || urgency === 'medium')
    ) {
      return 'high'
    }

    return urgency
  }

  return dueDateStatus === 'overdue' ? 'high' : 'medium'
}

function normalizeDocumentType(value: unknown): AdministrativeDocumentExtractedData['document_type'] {
  if (
    value === 'tax' ||
    value === 'caf' ||
    value === 'health_insurance' ||
    value === 'insurance' ||
    value === 'school' ||
    value === 'fine' ||
    value === 'invoice' ||
    value === 'bank' ||
    value === 'employment' ||
    value === 'housing' ||
    value === 'other'
  ) {
    return value
  }

  return 'other'
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number') return 0.5
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArrayOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function safeParseExtraction(rawText: string): AdministrativeDocumentExtractedData {
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
  const urgency = normalizeUrgency(parsed.urgency, dueDateStatus)

  const fallbackOverdueNextStep =
    'Cette échéance semble dépassée. Vérifie rapidement la situation officielle du dossier et les conséquences possibles, notamment une majoration ou une procédure déjà engagée.'

  const warnings = stringArrayOrEmpty(parsed.warnings)

  return {
    title: stringOrNull(parsed.title),
    document_type: normalizeDocumentType(parsed.document_type),
    sender: stringOrNull(parsed.sender),
    received_date: stringOrNull(parsed.received_date),
    due_date: dueDate,
    due_date_status: dueDateStatus,
    recommended_next_step:
      stringOrNull(parsed.recommended_next_step) ||
      (dueDateStatus === 'overdue' ? fallbackOverdueNextStep : null),
    amount: numberOrNull(parsed.amount),
    currency: 'EUR',
    action_required: stringOrNull(parsed.action_required),
    summary:
      stringOrNull(parsed.summary) ||
      'Document administratif analysé. Vérification utilisateur requise.',
    urgency,
    confidence: normalizeConfidence(parsed.confidence),
    suggested_task_title: stringOrNull(parsed.suggested_task_title),
    suggested_task_description: stringOrNull(parsed.suggested_task_description),
    suggested_event_title: stringOrNull(parsed.suggested_event_title),
    suggested_event_date: stringOrNull(parsed.suggested_event_date),
    missing_information: stringArrayOrEmpty(parsed.missing_information),
    warnings:
      warnings.length > 0
        ? warnings
        : ['Extraction automatique à vérifier avant toute action.'],
  }
}

function buildExtractionPrompt(todayISO: string): string {
  return `
Analyse ce document administratif.

La date du jour est ${todayISO}.

Retourne uniquement un JSON valide avec exactement ces champs :
{
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

Règles de raisonnement sur les dates :
- Si la date limite est avant la date du jour, indique due_date_status = "overdue".
- Si la date limite est égale à la date du jour, indique due_date_status = "today".
- Si la date limite est après la date du jour, indique due_date_status = "upcoming".
- Si aucune date limite n'est visible, indique due_date_status = "none".
- Si la date est illisible ou ambiguë, indique due_date_status = "unknown".
- Si l'échéance est dépassée, explique clairement que le délai semble dépassé et propose une action urgente de vérification.
- Si une amende, facture ou pénalité semble pouvoir être majorée après dépassement, signale le risque sans affirmer une conséquence qui n'est pas visible.

Rappel :
- N'invente jamais une date, un montant ou un expéditeur.
- Si ce n'est pas clairement lisible, mets null.
- Toute action doit être une proposition à valider.
- Ne donne pas de conseil juridique, fiscal, médical ou financier.
`
}

async function callAnthropicForImage({
  apiKey,
  file,
  base64,
  todayISO,
}: {
  apiKey: string
  file: File
  base64: string
  todayISO: string
}) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      temperature: 0,
      system: ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type,
                data: base64,
              },
            },
            {
              type: 'text',
              text: buildExtractionPrompt(todayISO),
            },
          ],
        },
      ],
    }),
  })
}

async function callAnthropicForPdfDocument({
  apiKey,
  base64,
  todayISO,
}: {
  apiKey: string
  base64: string
  todayISO: string
}) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      temperature: 0,
      system: ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: buildExtractionPrompt(todayISO),
            },
          ],
        },
      ],
    }),
  })
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
      console.error('[admin documents extract] auth failed', {
        hasBearerToken: Boolean(bearerToken),
        authError: authError?.message,
      })

      return NextResponse.json(
        { error: 'Session expirée. Reconnecte-toi puis réessaie.' },
        { status: 401 }
      )
    }

    if (!canAccessAdminDocuments(user.email)) {
      return NextResponse.json(
        { error: 'Module administratif réservé à la phase de test.' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('document')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Aucun document fourni.' },
        { status: 400 }
      )
    }

    if (!isImageFile(file) && !isPdfFile(file)) {
      return NextResponse.json(
        { error: 'Le fichier doit être une image ou un PDF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            'Document trop lourd. Pour cette version, choisis une image ou un PDF de moins de 5 MB, ou prends une photo/capture du document.',
        },
        { status: 413 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[admin documents extract] missing ANTHROPIC_API_KEY')

      return NextResponse.json(
        { error: 'Configuration IA manquante.' },
        { status: 500 }
      )
    }

    const todayISO = getTodayISODate()
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const response = isPdfFile(file)
      ? await callAnthropicForPdfDocument({
          apiKey,
          base64,
          todayISO,
        })
      : await callAnthropicForImage({
          apiKey,
          file,
          base64,
          todayISO,
        })

    if (!response.ok) {
      const errorText = await response.text()

      console.error('[admin documents extract] anthropic failed', {
        status: response.status,
        errorText,
        fileType: file.type,
        fileName: file.name,
        isPdf: isPdfFile(file),
      })

      return NextResponse.json(
        {
          error: isPdfFile(file)
            ? "Nova n'arrive pas encore à analyser ce PDF. Pour cette version, prends une photo ou une capture lisible du document, puis relance l'analyse."
            : "L'analyse IA a échoué. Réessaie avec une image plus lisible.",
        },
        { status: 502 }
      )
    }

    const data = await response.json()
    const rawText = data?.content?.[0]?.text

    if (!rawText || typeof rawText !== 'string') {
      console.error('[admin documents extract] no readable AI content', {
        fileType: file.type,
        fileName: file.name,
        isPdf: isPdfFile(file),
      })

      return NextResponse.json(
        { error: "L'IA n'a pas retourné de résultat lisible." },
        { status: 502 }
      )
    }

    let extraction: AdministrativeDocumentExtractedData

    try {
      extraction = safeParseExtraction(rawText)
    } catch (parseError) {
      console.error('[admin documents extract] JSON parse failed', {
        parseError,
        rawText,
      })

      return NextResponse.json(
        { error: "Nova a lu le document, mais n'a pas retourné un format exploitable. Réessaie avec une photo plus nette." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      extraction,
      notice: 'Extraction automatique à vérifier avant validation.',
    })
  } catch (error) {
    console.error('[admin documents extract] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant l’analyse du document.' },
      { status: 500 }
    )
  }
}