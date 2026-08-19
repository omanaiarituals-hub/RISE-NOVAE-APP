import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccess } from '@/lib/permissions'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const preferredRegion = 'dub1'

function safetyIdentifier(userId: string): string {
  return createHash('sha256')
    .update(`novae-realtime-input:${userId}`)
    .digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const openAiApiKey = process.env.OPENAI_API_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAiApiKey) {
      return NextResponse.json(
        { error: 'realtime_input_not_configured' },
        { status: 503 },
      )
    }

    const authClient = createClient(
      supabaseUrl,
      anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'invalid_session' },
        { status: 401 },
      )
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const access = await canAccess(
      supabaseAdmin,
      'ai_coach',
      user.id,
    )

    if (!access.allowed) {
      return NextResponse.json(
        {
          error: access.reason || 'premium_required',
          message:
            access.reason === 'monthly_limit_reached'
              ? 'Tu as utilisé tes essais Nova du mois.'
              : 'Cette fonctionnalité nécessite un accès Premium.',
        },
        { status: 403 },
      )
    }

    const rl = await rateLimit(
      supabaseAdmin,
      user.id,
      'nova_realtime_input',
      {
        max: 30,
        windowMinutes: 60,
      },
    )

    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_realtime_input_sessions' },
        { status: 429 },
      )
    }

    const model =
      process.env.NOVA_REALTIME_MODEL ||
      'gpt-realtime-2.1'

    const response = await fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${openAiApiKey}`,
          'content-type': 'application/json',
          'OpenAI-Safety-Identifier': safetyIdentifier(user.id),
        },
        body: JSON.stringify({
          expires_after: {
            anchor: 'created_at',
            seconds: 120,
          },

          // IMPORTANT :
          // On utilise une session Realtime uniquement pour profiter
          // du VAD + de la transcription automatique des tours.
          // Le modèle Realtime NE répond jamais : create_response=false.
          // Le cerveau reste exclusivement /api/nova/plan.
          session: {
            type: 'realtime',
            model,
            output_modalities: ['audio'],
            instructions: [
              'Cette session ne doit jamais répondre automatiquement à la parole de l’utilisatrice.',
              'Elle sert à transcrire les tours audio et à vocaliser uniquement les textes explicitement fournis par NOVAÉ.',
              'Ne déclenche aucune réponse de ta propre initiative.',
            ].join(' '),

            audio: {
              input: {
                transcription: {
                  model: 'gpt-live-transcribe',
                  // RealTalk Step 2 : le français est la langue principale pour l'instant.
                  // On pourra rendre ce réglage FR/EN configurable plus tard.
                  language: 'fr',
                  prompt:
                    'Conversation naturelle en français. Conserver fidèlement les prénoms, les noms propres et les mots NOVAÉ / Nova. Ne pas traduire vers une autre langue.',
                },

                turn_detection: {
                  type: 'server_vad',
                  create_response: false,
                  interrupt_response: true,
                  // Un peu moins agressif que le lot précédent :
                  // garde davantage le début de phrase et tolère les petites pauses.
                  threshold: 0.5,
                  prefix_padding_ms: 500,
                  silence_duration_ms: 900,
                },
              },
              output: {
                voice: 'marin',
              },
            },
          },
        }),
      },
    )

    const payload = await response.json()

    if (!response.ok) {
      console.error(
        '[api/nova/realtime-token] OpenAI error',
        {
          status: response.status,
          code: payload?.error?.code ?? null,
          param: payload?.error?.param ?? null,
          message: payload?.error?.message ?? null,
        },
      )

      return NextResponse.json(
        { error: 'realtime_input_session_failed' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      value: payload.value,
      expires_at: payload.expires_at,
      model: payload.session?.model || model,
      session_type: 'realtime_input_only',
    })
  } catch (error) {
    console.error(
      '[api/nova/realtime-token]',
      error instanceof Error
        ? error.message
        : 'unknown_error',
    )

    return NextResponse.json(
      { error: 'realtime_input_session_failed' },
      { status: 500 },
    )
  }
}
