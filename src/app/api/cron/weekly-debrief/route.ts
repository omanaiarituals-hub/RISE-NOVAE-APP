// app/api/cron/weekly-debrief/route.ts
//
// CORRECTION : la requête de progression lisait la table `user_progress`
// qui n'est quasiment pas utilisée dans l'app. Toute l'app utilise
// `program_progress` (champs : current_day, streak, phase). Le débrief
// était donc généré sans aucune donnée de progression → contenu vide/générique.
// On lit désormais `program_progress`.
//
// CORRECTION 2 : modèle Anthropic mis à jour vers claude-sonnet-4-6.

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
    // --- Donnees de la semaine sur le programme 90j ---
    const { data: weekMissions } = await supabase
      .from('mission_responses')
      .select('*')
      .eq('user_id', user.id)
      .order('day_number', { ascending: false })
      .limit(7)

    // CORRIGÉ : program_progress (et non user_progress)
    const { data: progress } = await supabase
      .from('program_progress')
      .select('current_day, streak, phase')
      .eq('user_id', user.id)
      .maybeSingle()

    // --- AJOUT PARCOURS PROFONDS : debut ---
    const deepJourneyContext = await getNovaContextFromDeepJourneys(user.id)
    const deepJourneyPromptBlock = formatNovaContextAsPromptBlock(deepJourneyContext)
    // --- AJOUT PARCOURS PROFONDS : fin ---

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `Tu es NOVA, et tu rédiges le débrief hebdomadaire d'une utilisatrice de NOVAÉ.
Ce débrief doit être chaleureux, honnête, jamais culpabilisant, et toujours orienté vers ce qui avance.

Données de la semaine sur le programme 90 jours :
${JSON.stringify({ weekMissions, progress })}
${deepJourneyPromptBlock ? '\n' + deepJourneyPromptBlock + '\n' : ''}

Si cette personne a aussi travaillé sur Reclaim Myself cette semaine ou récemment, tu peux relier les deux dans ton débrief de façon naturelle (par exemple si une de ses limites posées dans Reclaim Myself se reflète dans une mission qu'elle a tenue ou pas tenue cette semaine). Ne force jamais ce lien s'il n'est pas pertinent.

Tu rédiges en français, à la deuxième personne, avec un ton intime et direct. Tu ne poses jamais de diagnostic, même informel, et tu ne formules jamais d'évaluation psychologique : tu observes et tu encourages, à partir de ses propres mots et de ses propres actions.`,
      messages: [
        {
          role: 'user',
          content: 'Rédige mon débrief de la semaine.'
        }
      ]
    })

    const debriefText = response.content[0].type === 'text' ? response.content[0].text : ''

    await supabase.from('weekly_debriefs').insert({
      user_id: user.id,
      content: debriefText,
      generated_at: new Date().toISOString()
    })

    return NextResponse.json({ debrief: debriefText })
  } catch (error) {
    console.error('Erreur route weekly-debrief:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}