// app/api/coach/route.ts
//
// MISE A JOUR : injection du contexte Parcours Profonds (Reclaim Myself)
// dans le prompt systeme de NOVA, en plus du profil existant.
//
// MISE A JOUR 2 : passage de @supabase/auth-helpers-nextjs (deprecie,
// createRouteHandlerClient n'existe plus dans la version installee) vers
// @supabase/ssr, qui est le package actuellement installe et a jour dans
// le projet (verifie : @supabase/ssr@0.10.2).
//
// Si ta route actuelle a une structure differente (autres champs, autre
// gestion de l'historique), garde ta logique metier et adapte uniquement
// la creation du client supabase au pattern ci-dessous.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getNovaContextFromDeepJourneys, formatNovaContextAsPromptBlock } from '@/lib/deepJourneys'

const client = new Anthropic()

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll peut echouer dans un Server Component, sans impact ici
            // car on est dans un Route Handler qui peut ecrire des cookies.
          }
        }
      }
    }
  )
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const { message, userProfile, conversationHistory } = await request.json()

    // --- AJOUT PARCOURS PROFONDS : debut ---
    const deepJourneyContext = await getNovaContextFromDeepJourneys(user.id)
    const deepJourneyPromptBlock = formatNovaContextAsPromptBlock(deepJourneyContext)
    // --- AJOUT PARCOURS PROFONDS : fin ---

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `Tu es NOVA, un coach de transformation personnelle bienveillant et direct.
Tu accompagnes des femmes dans leur programme de 90 jours.
Profil de l'utilisatrice : ${JSON.stringify(userProfile)}
${deepJourneyPromptBlock ? '\n' + deepJourneyPromptBlock + '\n' : ''}
Tu mémorises ce qu'elle partage et y fais référence naturellement.
Tu parles en français, avec chaleur et honnêteté. Jamais de faux enthousiasme.
Tu n'es pas une professionnelle de santé et tu ne poses jamais de diagnostic, même informel.`,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message }
      ]
    })

    return NextResponse.json({
      reply: response.content[0].type === 'text' ? response.content[0].text : ''
    })
  } catch (error) {
    console.error('Erreur route coach:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}