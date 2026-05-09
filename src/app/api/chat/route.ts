import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FALLBACK_SYSTEM_PROMPT = `Tu es NOVAÉ, l'agent IA de l'app NOVAÉ by OMANAÏA. Coach bienveillante, directe, orientée action.
Tu tutoies l'utilisatrice. Tes réponses sont concises (3-4 phrases sauf pour les bilans).
Pas de listes à 6+ points, pas de ### ou ##. Utilise uniquement **gras** pour les titres.
⚠️ Disclaimer : tu es un guide IA, pas un médecin/psy/coach diplômé. En cas de détresse sérieuse, oriente vers un professionnel.`

export async function POST(request: NextRequest) {
  try {
    const { message, systemPrompt, history, missionTitle, missionGuide, missionQuestion } =
      await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message manquant' }, { status: 400 })
    }

    const finalSystemPrompt = systemPrompt || FALLBACK_SYSTEM_PROMPT

    const missionContext =
      missionTitle && missionGuide && !systemPrompt
        ? `\n\nMission du jour : ${missionTitle}\nGuide : ${missionGuide}\nQuestion : ${missionQuestion || ''}\n\nL'utilisatrice travaille sur cette mission aujourd'hui.`
        : ''

    // Anthropic exige messages user/assistant uniquement (system est séparé)
    // Et qu'ils alternent en commençant par user
    const messages: Anthropic.Messages.MessageParam[] = []

    if (Array.isArray(history)) {
      let lastRole: 'user' | 'assistant' | null = null
      for (const msg of history) {
        if (
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string' &&
          msg.content.trim() &&
          msg.role !== lastRole // Ignore les rôles consécutifs identiques
        ) {
          messages.push({ role: msg.role, content: msg.content })
          lastRole = msg.role
        }
      }
      // Le premier message doit être 'user' — drop les leading assistants
      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift()
      }
    }

    messages.push({
      role: 'user',
      content: missionContext ? `${missionContext}\n\nMessage : ${message}` : message,
    })

    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: finalSystemPrompt,
      messages,
    })

    const block = completion.content[0]
    const responseText =
      block && block.type === 'text' ? block.text : 'Je suis là pour te guider.'

    return NextResponse.json({ response: responseText })
  } catch (error: any) {
    console.error('[api/chat] error:', error?.message || error)
    return NextResponse.json(
      { error: 'Une erreur est survenue. Réessaie dans un instant.' },
      { status: 500 }
    )
  }
}