import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { canAccess, incrementAiChatCount } from '@/lib/permissions'

type AnthropicMessage = { role: 'user' | 'assistant'; content: string }

const FALLBACK_SYSTEM_PROMPT = `Tu es NOVAÉ, l'agent IA de l'app NOVAÉ by OMANAÏA. Coach bienveillante, directe, orientée action.
Tu tutoies l'utilisatrice. Tes réponses sont concises (3-4 phrases sauf pour les bilans).
Pas de listes à 6+ points, pas de ### ou ##. Utilise uniquement **gras** pour les titres.
⚠️ Disclaimer : tu es un guide IA, pas un médecin/psy/coach diplômé. En cas de détresse sérieuse, oriente vers un professionnel.`

export async function POST(request: NextRequest) {
  try {
    // ─── 1) Auth ───
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // ─── 2) Accès Agent IA : 5/mois en free, illimité en Premium/trial ───
    const access = await canAccess(supabase, 'ai_coach', user.id)
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

    // quota_remaining n'est défini QUE pour les free → permet de savoir s'il faut incrémenter
    const isQuotaUser = access.quota_remaining !== undefined

    // ─── 3) Logique existante (inchangée) ───
    const { message, systemPrompt, history, missionTitle, missionGuide, missionQuestion } =
      await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message manquant' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[api/chat] ANTHROPIC_API_KEY manquante')
      return NextResponse.json({ error: 'Clé API manquante côté serveur.' }, { status: 500 })
    }

    const finalSystemPrompt = systemPrompt || FALLBACK_SYSTEM_PROMPT

    const missionContext =
      missionTitle && missionGuide && !systemPrompt
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
        await incrementAiChatCount(supabase, user.id)
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