// app/api/cron/weekly-debrief/route.ts
// CORRECTION MAJEURE : ce cron tourne maintenant pour TOUTES les utilisatrices
// actives (service_role key + boucle), pas seulement pour celle connectée.
// Corrections : user_progress → program_progress, modèle à jour, CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getNovaContextFromDeepJourneys, formatNovaContextAsPromptBlock } from '@/lib/deepJourneys'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic()

async function generateDebrief(userId: string, pseudo: string): Promise<string> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [missionsRes, progressRes] = await Promise.all([
    supabaseAdmin.from('mission_responses').select('*')
      .eq('user_id', userId)
      .gte('created_at', oneWeekAgo)
      .order('day_number', { ascending: false })
      .limit(7),
    supabaseAdmin.from('program_progress')
      .select('current_day, streak, phase')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const deepJourneyContext = await getNovaContextFromDeepJourneys(userId)
  const deepJourneyPromptBlock = formatNovaContextAsPromptBlock(deepJourneyContext)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Tu es NOVA, et tu rédiges le débrief hebdomadaire de ${pseudo}, une utilisatrice de NOVAÉ.
Ce débrief doit être chaleureux, honnête, jamais culpabilisant, et toujours orienté vers ce qui avance.

Données de la semaine :
${JSON.stringify({ missions: missionsRes.data, progress: progressRes.data })}
${deepJourneyPromptBlock ? '\n' + deepJourneyPromptBlock + '\n' : ''}

Si elle a travaillé sur Reclaim Myself récemment, relie les deux de façon naturelle si pertinent.
Tu rédiges en français, à la deuxième personne, ton intime et direct.
Tu ne poses jamais de diagnostic ni d'évaluation psychologique.
Tu observes et tu encourages à partir de ses propres mots et actions.`,
    messages: [{ role: 'user', content: 'Rédige mon débrief de la semaine.' }]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function POST(request: NextRequest) {
  // Sécurité : vérification du secret cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    // Récupère toutes les utilisatrices actives (connectées au moins une fois dans les 30 derniers jours)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: activeUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, pseudo, email')
      .gte('updated_at', thirtyDaysAgo)

    if (usersError || !activeUsers) {
      console.error('[weekly-debrief] Erreur récupération users:', usersError)
      return NextResponse.json({ error: 'Erreur récupération utilisatrices' }, { status: 500 })
    }

    console.log(`[weekly-debrief] Génération pour ${activeUsers.length} utilisatrices actives`)

    const results = []

    for (const user of activeUsers) {
      try {
        // Vérifie qu'on n'a pas déjà généré un débrief cette semaine
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const { data: existing } = await supabaseAdmin
          .from('weekly_debriefs')
          .select('id')
          .eq('user_id', user.id)
          .gte('generated_at', weekStart.toISOString())
          .maybeSingle()

        if (existing) {
          console.log(`[weekly-debrief] Déjà généré pour ${user.email}, skip`)
          results.push({ userId: user.id, status: 'skipped' })
          continue
        }

        const pseudo = user.pseudo || user.email?.split('@')[0] || 'toi'
        const debriefText = await generateDebrief(user.id, pseudo)

        await supabaseAdmin.from('weekly_debriefs').insert({
          user_id: user.id,
          content: debriefText,
          generated_at: new Date().toISOString()
        })

        results.push({ userId: user.id, status: 'generated' })
        console.log(`[weekly-debrief] Débrief généré pour ${user.email}`)

        // Pause 500ms entre chaque pour éviter de saturer l'API Anthropic
        await new Promise(r => setTimeout(r, 500))

      } catch (err) {
        console.error(`[weekly-debrief] Erreur pour ${user.email}:`, err)
        results.push({ userId: user.id, status: 'error' })
      }
    }

    const generated = results.filter(r => r.status === 'generated').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      success: true,
      total: activeUsers.length,
      generated,
      skipped,
      errors
    })

  } catch (error) {
    console.error('[weekly-debrief] Erreur globale:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}