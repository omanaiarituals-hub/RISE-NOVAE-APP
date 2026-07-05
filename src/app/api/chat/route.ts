// src/app/api/chat/route.ts
// CORRECTIFS (audit 04/07/2026, seconde passe) :
//  1. SYSTEM PROMPT VERROUILLE : l'ancienne version acceptait n'importe quel
//     systemPrompt envoye par le client. Toute utilisatrice authentifiee
//     pouvait transformer cette route en proxy Claude generaliste paye par
//     NOVAE (rediger n'importe quoi, contourner la personnalite de Nova).
//     Desormais, seuls deux prompts serveur sont acceptes, correspondant aux
//     deux usages reels (onboarding et regeneration du profil). Les chaines
//     exactes envoyees par les pages actuelles sont reconnues, donc AUCUNE
//     modification cote client n'est necessaire : zero regression.
//  2. RATE LIMITING : meme protection que /api/agent (le quota 5/mois ne
//     protegeait que les comptes free, une Premium pouvait marteler la route).
// Le reste (auth Bearer, quota canAccess, historique, increment) est inchange.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccess, incrementAiChatCount } from '@/lib/permissions'
import { rateLimit } from '@/lib/rateLimit'

type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

const FALLBACK_SYSTEM_PROMPT = `Tu es NOVAÉ, l'agent IA de l'app NOVAÉ by OMANAÏA. Coach bienveillante, directe, orientée action.
Tu tutoies l'utilisatrice. Tes réponses sont concises (3-4 phrases sauf pour les bilans).
Pas de listes à 6+ points, pas de ### ou ##. Utilise uniquement **gras** pour les titres.
⚠️ Disclaimer : tu es un guide IA, pas un médecin/psy/coach diplômé. En cas de détresse sérieuse, oriente vers un professionnel.`

// Prompts systeme autorises, cote serveur uniquement.
// Les cles "legacy" sont les chaines exactes que les pages onboarding et
// profil envoient aujourd'hui : on les reconnait pour ne rien casser.
const PROMPT_ONBOARDING =
  'Tu es une experte en psychologie positive, neurosciences et coaching de vie. Tu génères des analyses personnalisées précises, chaleureuses et scientifiquement fondées. Réponds toujours en français, en tutoyant.'
const PROMPT_PROFIL =
  'Tu es une experte en psychologie positive, neurosciences et coaching de vie. Réponds en français, en tutoyant.'

const ALLOWED_SYSTEM_PROMPTS = new Set([PROMPT_ONBOARDING, PROMPT_PROFIL])

export async function POST(request: NextRequest) {
  try {
    // ─── 1) Auth : vérifier l'identité avec le token ───
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // Client service-role : lecture du tier + gestion du quota de façon fiable
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ─── 2) Accès Agent IA : 5/mois en free, illimité en Premium/trial ───
    const access = await canAccess(supabaseAdmin, 'ai_coach', user.id)
    if (!access.allowed) {
      const limitReached = access.reason === 'monthly_limit_reached'
      return NextResponse.json({
        error: access.reason || 'premium_required',
        message: limitReached
          ? `Tu as utilisé tes ${access.quota_max ?? 5} échanges gratuits avec NOVAÉ ce mois-ci. Passe Premium pour échanger sans limite. ✦`
          : "L'Agent IA NOVAÉ est réservé aux membres Premium.",
        quota_remaining: 0,
        quota_max: access.quota_max,
        reset_at: access.reset_at,
        upgrade_url: '/subscribe',
      }, { status: 403 })
    }

    const isQuotaUser = access.quota_remaining !== undefined

    // ─── 2bis) Rate limiting par utilisatrice (protection coût API) ───
    // Même modèle que /api/agent : 20 appels / heure, fail-open si la table
    // api_rate_limits est absente (jamais bloquant pour l'utilisatrice).
    const rl = await rateLimit(supabaseAdmin, user.id, 'chat')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop de messages en peu de temps. Attends une minute. ✦' },
        { status: 429 }
      )
    }

    // ─── 3) Logique existante ───
    const { message, systemPrompt, history, missionTitle, missionGuide, missionQuestion } =
      await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message manquant' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[api/chat] ANTHROPIC_API_KEY manquante')
      return NextResponse.json({ error: 'Clé API manquante côté serveur.' }, { status: 500 })
    }

    // CORRECTIF 1 : le systemPrompt du client n'est utilisé QUE s'il figure
    // dans la liste blanche serveur. Tout autre contenu est ignoré et
    // remplacé par le prompt Nova par défaut.
    const clientPromptIsAllowed =
      typeof systemPrompt === 'string' && ALLOWED_SYSTEM_PROMPTS.has(systemPrompt)
    const finalSystemPrompt = clientPromptIsAllowed ? systemPrompt : FALLBACK_SYSTEM_PROMPT

    if (systemPrompt && !clientPromptIsAllowed) {
      console.warn('[api/chat] systemPrompt non autorisé ignoré. user:', user.id)
    }

    // Contexte mission : uniquement quand aucun prompt liste blanche n'est
    // utilisé (même sémantique qu'avant : missionContext si pas de systemPrompt).
    const missionContext =
      missionTitle && missionGuide && !clientPromptIsAllowed
        ? `\n\nMission du jour : ${missionTitle}\nGuide : ${missionGuide}\nQuestion : ${missionQuestion || ''}\n\nL'utilisatrice travaille sur cette mission aujourd'hui.`
        : ''

    const messages: AnthropicMessage[] = []

    if (Array.isArray(history)) {
      let lastRole: 'user' | 'assistant' | null = null
      for (const msg of history) {
        if (
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string' &&
          msg.content.trim() &&
          msg.role !== lastRole
        ) {
          messages.push({ role: msg.role, content: msg.content })
          lastRole = msg.role
        }
      }
      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift()
      }
    }

    messages.push({
      role: 'user',
      content: missionContext ? `${missionContext}\n\nMessage : ${message}` : message,
    })

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: finalSystemPrompt,
        messages,
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      console.error('[api/chat] Anthropic error:', apiResponse.status, errText)
      return NextResponse.json(
        { error: 'NOVAÉ est temporairement indisponible. Réessaie.' },
        { status: 502 }
      )
    }

    const data = await apiResponse.json()
    const block = data?.content?.[0]
    const responseText = block?.type === 'text' ? block.text : 'Je suis là pour te guider.'

    // ─── 4) Incrément du quota : free uniquement, après succès (non-bloquant) ───
    if (isQuotaUser) {
      try {
        await incrementAiChatCount(supabaseAdmin, user.id)
      } catch (e) {
        console.error('[api/chat] increment quota (non-blocking):', e)
      }
    }

    return NextResponse.json({
      response: responseText,
      ...(isQuotaUser
        ? {
            quota_remaining: Math.max(0, (access.quota_remaining ?? 0) - 1),
            quota_max: access.quota_max,
          }
        : {}),
    })
  } catch (error: any) {
    console.error('[api/chat] error:', error?.message || error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessaie dans un instant.' },
      { status: 500 }
    )
  }
}