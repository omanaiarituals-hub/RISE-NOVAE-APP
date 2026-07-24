import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'

export const runtime = 'nodejs'
export const maxDuration = 30

type ProcessingStatus = 'todo' | 'in_progress' | 'done'

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
            // Safe to ignore in server context.
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

function isValidProcessingStatus(status: unknown): status is ProcessingStatus {
  return status === 'todo' || status === 'in_progress' || status === 'done'
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

    const body = await request.json().catch(() => null)
    const documentId = body?.documentId
    const processingStatus = body?.processingStatus

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Document manquant.' },
        { status: 400 }
      )
    }

    if (!isValidProcessingStatus(processingStatus)) {
      return NextResponse.json(
        { error: 'Statut invalide.' },
        { status: 400 }
      )
    }

    const { data, error: updateError } = await supabase
      .from('administrative_documents')
      .update({
        processing_status: processingStatus,
        processed_at: processingStatus === 'done' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', user.id)
      .select('id, processing_status, processed_at')
      .single()

    if (updateError || !data) {
      return NextResponse.json(
        { error: 'Impossible de mettre à jour ce document.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: data,
    })
  } catch (error) {
    console.error('[admin documents status] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant la mise à jour du statut.' },
      { status: 500 }
    )
  }
}