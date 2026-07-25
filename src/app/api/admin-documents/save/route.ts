import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { AdministrativeDocumentExtractedData } from '@/lib/admin-documents/types'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'

export const runtime = 'nodejs'
export const maxDuration = 30

const ADMINISTRATIVE_DOCUMENT_BUCKET = 'administrative-documents'
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

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'document'
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeExtraction(value: unknown): AdministrativeDocumentExtractedData {
  if (!value || typeof value !== 'object') {
    throw new Error('Données extraites invalides.')
  }

  const extraction = value as Partial<AdministrativeDocumentExtractedData>

  return {
    title: stringOrNull(extraction.title),
    document_type: extraction.document_type || 'other',
    sender: stringOrNull(extraction.sender),
    received_date: stringOrNull(extraction.received_date),
    due_date: stringOrNull(extraction.due_date),
    due_date_status: extraction.due_date_status || 'unknown',
    recommended_next_step: stringOrNull(extraction.recommended_next_step),
    amount: numberOrNull(extraction.amount),
    currency: 'EUR',
    action_required: stringOrNull(extraction.action_required),
    summary: stringOrNull(extraction.summary) || 'Document administratif enregistré.',
    urgency: extraction.urgency || 'medium',
    confidence: typeof extraction.confidence === 'number' ? extraction.confidence : 0.5,
    suggested_task_title: stringOrNull(extraction.suggested_task_title),
    suggested_task_description: stringOrNull(extraction.suggested_task_description),
    suggested_event_title: stringOrNull(extraction.suggested_event_title),
    suggested_event_date: stringOrNull(extraction.suggested_event_date),
    missing_information: Array.isArray(extraction.missing_information)
      ? extraction.missing_information.filter((item): item is string => typeof item === 'string')
      : [],
    warnings: Array.isArray(extraction.warnings)
      ? extraction.warnings.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function toDateOrNull(value: string | null): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null
  let supabaseForCleanup: ReturnType<typeof createClient> | null = null

  try {
    const bearerToken = getBearerToken(request)
    const supabase = bearerToken
      ? getSupabaseBearerClient(bearerToken)
      : await getSupabaseServerClient()

    supabaseForCleanup = supabase as ReturnType<typeof createClient>

    const { data: { user }, error: authError } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (authError || !user) {
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
    const extractionRaw = formData.get('extraction')
    const linkedTodoId = formData.get('linkedTodoId')
    const linkedPlannerEventId = formData.get('linkedPlannerEventId')
    const vaultProtectedRaw = formData.get('vaultProtected')
const sensitivityLevelRaw = formData.get('sensitivityLevel')

const vaultProtected = vaultProtectedRaw === 'true'
const sensitivityLevel =
  sensitivityLevelRaw === 'sensitive' || sensitivityLevelRaw === 'very_sensitive'
    ? sensitivityLevelRaw
    : vaultProtected
      ? 'sensitive'
      : 'standard'

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
        { error: 'Document trop lourd. Choisis une image ou un PDF de moins de 5 MB.' },
        { status: 413 }
      )
    }

    if (typeof extractionRaw !== 'string') {
      return NextResponse.json(
        { error: 'Données d’analyse manquantes.' },
        { status: 400 }
      )
    }

    let extraction: AdministrativeDocumentExtractedData

    try {
      extraction = normalizeExtraction(JSON.parse(extractionRaw))
    } catch {
      return NextResponse.json(
        { error: 'Données d’analyse invalides.' },
        { status: 400 }
      )
    }

    const documentId = crypto.randomUUID()
    const safeName = sanitizeFileName(file.name)
    const storagePath = `${user.id}/${documentId}/${Date.now()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('[admin documents save] upload failed', uploadError)

      return NextResponse.json(
        { error: "Impossible d'enregistrer le fichier dans l'espace sécurisé." },
        { status: 500 }
      )
    }

    uploadedPath = storagePath

    const { data: insertedDocument, error: insertError } = await supabase
      .from('administrative_documents')
      .insert({
        id: documentId,
        user_id: user.id,

        title: extraction.title,
        document_type: extraction.document_type,
        sender: extraction.sender,
        received_date: toDateOrNull(extraction.received_date),
        due_date: toDateOrNull(extraction.due_date),
        due_date_status: extraction.due_date_status,
        recommended_next_step: extraction.recommended_next_step,

        amount: extraction.amount,
        currency: extraction.currency,

        action_required: extraction.action_required,
        summary: extraction.summary,

        extracted_json: extraction,
        user_corrections: null,

        status: 'validated',
        validation_status: 'confirmed',

        storage_bucket: ADMINISTRATIVE_DOCUMENT_BUCKET,
        storage_path: storagePath,

        original_filename: file.name,
        file_mime_type: file.type || null,
        file_size_bytes: file.size,

        linked_todo_id: typeof linkedTodoId === 'string' && linkedTodoId.length > 0
          ? linkedTodoId
          : null,
        linked_planner_event_id: typeof linkedPlannerEventId === 'string' && linkedPlannerEventId.length > 0
          ? linkedPlannerEventId
          : null,
          vault_protected: vaultProtected,
sensitivity_level: sensitivityLevel,
added_to_vault_at: vaultProtected ? new Date().toISOString() : null,
      })
      .select('id, storage_path')
      .single()

    if (insertError) {
      console.error('[admin documents save] insert failed', insertError)

      if (uploadedPath) {
        await supabase.storage
          .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
          .remove([uploadedPath])
      }

      return NextResponse.json(
        { error: "Le fichier a été envoyé, mais l'enregistrement en base a échoué." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documentId: insertedDocument.id,
      storagePath: insertedDocument.storage_path,
      message: 'Document enregistré dans ton espace sécurisé.',
    })
  } catch (error) {
    console.error('[admin documents save] unexpected error', error)

    if (uploadedPath && supabaseForCleanup) {
      await supabaseForCleanup.storage
        .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
        .remove([uploadedPath])
    }

    return NextResponse.json(
      { error: "Erreur inattendue pendant l'enregistrement sécurisé." },
      { status: 500 }
    )
  }
}