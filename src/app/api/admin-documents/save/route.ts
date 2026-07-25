import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'
import { verifyVaultAccessToken } from '@/lib/vault/tokens'
import { createAdministrativeDocumentReminders } from '@/lib/admin-documents/reminders'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_FILE_SIZE = 5 * 1024 * 1024
const STORAGE_BUCKET = 'administrative-documents'

type ExtractionPayload = {
  title?: string | null
  document_type?: string | null
  sender?: string | null
  received_date?: string | null
  due_date?: string | null
  due_date_status?: string | null
  recommended_next_step?: string | null
  amount?: number | null
  currency?: string | null
  action_required?: string | null
  summary?: string | null
}

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
            // Safe to ignore in route handlers.
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

function isAcceptedFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

function sanitizeFilename(filename: string): string {
  const cleaned = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned || 'document'
}

function parseExtraction(value: FormDataEntryValue | null): ExtractionPayload {
  if (typeof value !== 'string') {
    throw new Error('Extraction manquante.')
  }

  try {
    const parsed = JSON.parse(value) as ExtractionPayload
    return parsed
  } catch {
    throw new Error('Extraction illisible.')
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numberOrNull(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isFinite(value)) return null
  return value
}

function normalizeDueDateStatus(value: unknown): string {
  if (
    value === 'none' ||
    value === 'upcoming' ||
    value === 'today' ||
    value === 'overdue' ||
    value === 'unknown'
  ) {
    return value
  }

  return 'unknown'
}

function normalizeSensitivityLevel(
  value: FormDataEntryValue | null,
  vaultProtected: boolean
): 'standard' | 'sensitive' | 'very_sensitive' {
  if (value === 'very_sensitive') return 'very_sensitive'
  if (value === 'sensitive') return 'sensitive'
  return vaultProtected ? 'sensitive' : 'standard'
}

export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null

  try {
    const bearerToken = getBearerToken(request)
    const supabase = bearerToken
      ? getSupabaseBearerClient(bearerToken)
      : await getSupabaseServerClient()

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
    const extraction = parseExtraction(formData.get('extraction'))

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Document manquant.' },
        { status: 400 }
      )
    }

    if (!isAcceptedFile(file)) {
      return NextResponse.json(
        { error: 'Format non accepté. Utilise une image ou un PDF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Document trop lourd. Taille maximale : 5 MB.' },
        { status: 400 }
      )
    }

    const vaultProtectedRaw = formData.get('vaultProtected')
    const sensitivityLevelRaw = formData.get('sensitivityLevel')

    const vaultProtected = vaultProtectedRaw === 'true'
    const sensitivityLevel = normalizeSensitivityLevel(sensitivityLevelRaw, vaultProtected)

    if (vaultProtected) {
      const vaultAccessToken = request.headers.get('x-vault-access-token')

      if (!verifyVaultAccessToken(vaultAccessToken, user.id)) {
        return NextResponse.json(
          {
            error: 'Code PIN coffre requis pour enregistrer ce document dans le coffre.',
            requiresVaultPin: true,
          },
          { status: 403 }
        )
      }
    }

    const linkedTodoIdRaw = formData.get('linkedTodoId')
    const linkedPlannerEventIdRaw = formData.get('linkedPlannerEventId')

    const linkedTodoId =
      typeof linkedTodoIdRaw === 'string' && linkedTodoIdRaw.trim()
        ? linkedTodoIdRaw.trim()
        : null

    const linkedPlannerEventId =
      typeof linkedPlannerEventIdRaw === 'string' && linkedPlannerEventIdRaw.trim()
        ? linkedPlannerEventIdRaw.trim()
        : null

    const documentId = crypto.randomUUID()
    const safeFilename = sanitizeFilename(file.name)
    const storagePath = `${user.id}/${documentId}/${Date.now()}-${safeFilename}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('[admin documents save] upload failed', uploadError)

      return NextResponse.json(
        { error: 'Impossible d’enregistrer le fichier du document.' },
        { status: 500 }
      )
    }

    uploadedStoragePath = storagePath

    const { data, error: insertError } = await supabase
      .from('administrative_documents')
      .insert({
        id: documentId,
        user_id: user.id,

        title: stringOrNull(extraction.title) || 'Document administratif',
        document_type: stringOrNull(extraction.document_type) || 'other',
        sender: stringOrNull(extraction.sender),
        received_date: stringOrNull(extraction.received_date),
        due_date: stringOrNull(extraction.due_date),
        due_date_status: normalizeDueDateStatus(extraction.due_date_status),
        recommended_next_step: stringOrNull(extraction.recommended_next_step),

        amount: numberOrNull(extraction.amount),
        currency: stringOrNull(extraction.currency) || 'EUR',
        action_required: stringOrNull(extraction.action_required),
        summary: stringOrNull(extraction.summary),

        extracted_json: extraction,
        user_corrections: null,

        status: 'validated',
        validation_status: 'confirmed',
        processing_status: 'todo',

        vault_protected: vaultProtected,
        sensitivity_level: sensitivityLevel,
        added_to_vault_at: vaultProtected ? new Date().toISOString() : null,

        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        original_filename: file.name,
        file_mime_type: file.type || null,
        file_size_bytes: file.size,

        linked_todo_id: linkedTodoId,
        linked_planner_event_id: linkedPlannerEventId,
      })
      .select('id, storage_path')
      .single()

    if (insertError || !data) {
      console.error('[admin documents save] insert failed', insertError)

      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath])

      uploadedStoragePath = null

      return NextResponse.json(
        { error: 'Impossible d’enregistrer la fiche du document.' },
        { status: 500 }
      )
    }

    try {
      await createAdministrativeDocumentReminders({
        supabase,
        userId: user.id,
        documentId: data.id,
        dueDate: stringOrNull(extraction.due_date),
        dueDateStatus: normalizeDueDateStatus(extraction.due_date_status),
      })
    } catch (reminderError) {
      console.error('[admin documents save] reminder creation failed', reminderError)
    }

    return NextResponse.json({
      success: true,
      documentId: data.id,
      storagePath: data.storage_path,
      message: vaultProtected
        ? 'Document enregistré dans le coffre sécurisé.'
        : 'Document enregistré dans ton espace sécurisé.',
    })
  } catch (error) {
    console.error('[admin documents save] unexpected error', error)

    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Erreur inattendue pendant l’enregistrement du document.',
      },
      { status: 500 }
    )
  }
}