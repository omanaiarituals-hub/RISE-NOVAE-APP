import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { message, systemPrompt, history, missionTitle, missionGuide, missionQuestion } = await request.json()

    const finalSystemPrompt = systemPrompt || `Tu es Novae, une coach de vie et de performance au sommet de son art.
Expertise : Psychologie positive, neurosciences, productivité, développement personnel.
Style : Élégant, concis, orienté vers l'action. Tu inspires confiance et motivation.
Réponds toujours en maximum 3-4 phrases pour rester percutante.
Tu es un coach premium qui transforme les vies avec élégance et efficacité.`

    const missionContext = missionTitle && missionGuide && !systemPrompt
      ? `\n\nMission du jour : ${missionTitle}\nGuide : ${missionGuide}\nQuestion : ${missionQuestion || ''}\n\nL'utilisateur travaille sur cette mission aujourd'hui.`
      : ''

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: finalSystemPrompt }
    ]

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content })
        }
      }
    }

    messages.push({
      role: 'user',
      content: missionContext ? `${missionContext}\n\nMessage : ${message}` : message
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 600,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "Je suis là pour te guider."
    return NextResponse.json({ response })

  } catch (error) {
    console.error('ERREUR API CHAT:', error)
    return NextResponse.json(
      { error: "Une erreur est survenue. Réessaie dans un instant." },
      { status: 500 }
    )
  }
}