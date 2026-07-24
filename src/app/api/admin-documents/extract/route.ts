import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  ADMINISTRATIVE_DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  type AdministrativeDocumentExtractedData,
} from '@/lib/admin-documents/types'

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

function safeParseExtraction(rawText: string): AdministrativeDocumentExtractedData {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  return {
    title: typeof parsed.title === 'string' ? parsed.title : null,
    document_type: parsed.document_type || 'other',
    sender: typeof parsed.sender === 'string' ? parsed.sender : null,
    received_date: typeof parsed.received_date === 'string' ? parsed.received_date : null,
    due_date: typeof parsed.due_date === 'string' ? parsed.due_date : null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    currency: 'EUR',
    action_required: typeof parsed.action_required === 'string' ? parsed.action_required : null,
    summary: typeof parsed.summary === 'string'
      ? parsed.summary
      : 'Document administratif analyse. Verification utilisateur requise.',
    urgency: parsed.urgency || 'medium',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    suggested_task_title: typeof parsed.suggested_task_title === 'string'
      ? parsed.suggested_task_title
      : null,
    suggested_task_description: typeof parsed.suggested_task_description === 'string'
      ? parsed.suggested_task_description
      : null,
    suggested_event_title: typeof parsed.suggested_event_title === 'string'
      ? parsed.suggested_event_title
      : null,
    suggested_event_date: typeof parsed.suggested_event_date === 'string'
      ? parsed.suggested_event_date
      : null,
    missing_information: Array.isArray(parsed.missing_information)
      ? parsed.missing_information.filter((item: unknown) => typeof item === 'string')
      : [],
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((item: unknown) => typeof item === 'string')
      : ['Extraction automatique a verifier avant toute action.'],
  }
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
        { error: 'Session expiree. Reconnecte-toi puis reessaie.' },
        { status: 401 }
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

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Le fichier doit etre une image pour cette premiere version.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Document trop lourd. Choisis une image de moins de 5 MB.' },
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

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
                text: `
Analyse ce document administratif.

Retourne uniquement un JSON valide avec exactement ces champs :
{
  "title": string | null,
  "document_type": "tax" | "caf" | "health_insurance" | "insurance" | "school" | "fine" | "invoice" | "bank" | "employment" | "housing" | "other",
  "sender": string | null,
  "received_date": "YYYY-MM-DD" | null,
  "due_date": "YYYY-MM-DD" | null,
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

Rappel :
- N'invente jamais une date, un montant ou un expediteur.
- Si ce n'est pas clairement lisible, mets null.
- Toute action doit etre une proposition a valider.
`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[admin documents extract] anthropic failed', {
        status: response.status,
        errorText,
      })

      return NextResponse.json(
        { error: "L'analyse IA a echoue. Reessaie avec une photo plus nette." },
        { status: 502 }
      )
    }

    const data = await response.json()
    const rawText = data?.content?.[0]?.text

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json(
        { error: "L'IA n'a pas retourne de resultat lisible." },
        { status: 502 }
      )
    }

    const extraction = safeParseExtraction(rawText)

    return NextResponse.json({
      success: true,
      extraction,
      notice: 'Extraction automatique a verifier avant validation.',
    })
  } catch (error) {
    console.error('[admin documents extract] unexpected error', error)

    return NextResponse.json(
      { error: 'Erreur inattendue pendant l’analyse du document.' },
      { status: 500 }
    )
  }
}