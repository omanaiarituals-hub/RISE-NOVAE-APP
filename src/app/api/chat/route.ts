import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  console.log('=== API CHAT APPELÉE ===')
  console.log('Méthode:', request.method)
  console.log('URL:', request.url)
  
  try {
    // Diagnostic de la clé API
    console.log('=== DIAGNOSTIC API CHAT ===')
    console.log('process.env.OPENAI_API_KEY existe:', !!process.env.OPENAI_API_KEY)
    console.log('process.env.OPENAI_API_KEY (3 premiers chars):', process.env.OPENAI_API_KEY?.substring(0, 3))
    console.log('Longueur de la clé:', process.env.OPENAI_API_KEY?.length)

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    console.log('Client OpenAI créé avec succès')

    const { message, missionTitle, missionGuide, missionQuestion } = await request.json()

    // System prompt définissant Novae comme coach haut de gamme
    const systemPrompt = `Tu es Novae, une coach de vie et de performance au sommet de son art. 

Expertise : Psychologie positive, neurosciences, productivité, développement personnel.

Style : Élégant, concis, orienté vers l'action. Tu inspires confiance et motivation.

Approche : 
- Écoute active et empathie
- Questions puissantes pour faire émerger les réponses
- Conseils pratiques et immédiatement applicables
- Focus sur les solutions plutôt que les problèmes
- Optimisme réaliste basé sur les preuves scientifiques

Principes :
- Chaque personne a un potentiel illimité
- Les petits pas réguliers créent des transformations radicales
- La clarté précède l'action
- L'alignement entre valeurs et actions est la clé du bonheur

Réponds toujours avec :
1. Une phrase d'accueil chaleureuse
2. Une compréhension profonde de la situation
3. Une question ou un conseil concret
4. Maximum 3-4 phrases pour rester percutante

Tu es un coach premium qui transforme les vies avec élégance et efficacité.`

    // Contexte de la mission du jour
    const missionContext = missionTitle && missionGuide 
      ? `\n\nMission du jour : ${missionTitle}\nGuide : ${missionGuide}\nQuestion : ${missionQuestion || ''}\n\nL'utilisateur travaille sur cette mission aujourd'hui.`
      : ''

    const fullPrompt = `${systemPrompt}${missionContext}\n\nMessage de l'utilisateur : ${message}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${missionContext}\n\nMessage de l'utilisateur : ${message}`
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || "Je suis là pour vous guider."

    return NextResponse.json({ response })
  } catch (error) {
    console.error('ERREUR OPENAI DETECTEE:', error)
    if (error instanceof Error) {
      console.error('Type d\'erreur:', error.constructor.name)
      console.error('Message d\'erreur:', error.message)
      console.error('Stack trace:', error.stack)
    } else {
      console.error('Erreur inconnue:', String(error))
    }
    return NextResponse.json(
      { error: "Une erreur est survenue. Réessayez dans un instant." },
      { status: 500 }
    )
  }
}
