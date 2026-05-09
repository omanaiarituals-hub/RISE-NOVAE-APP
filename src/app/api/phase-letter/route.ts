import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const PHASE_NAMES: Record<number, { name: string; days: string }> = {
  1: { name: 'Reprogrammation', days: 'J1 — J30' },
  2: { name: 'Action & Discipline', days: 'J31 — J60' },
  3: { name: 'Expansion & Pérennité', days: 'J61 — J90' },
}

export async function POST(request: NextRequest) {
  try {
    const { phase } = await request.json()
    if (![1, 2, 3].includes(phase)) {
      return NextResponse.json({ error: 'phase invalide' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante côté serveur.' }, { status: 500 })
    }

    // Auth via SSR client (lit les cookies)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'non authentifié' }, { status: 401 })
    }

    // Service client pour les écritures (bypass RLS pour insert)
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Lettre déjà existante ?
    const { data: existing } = await adminClient
      .from('phase_letters')
      .select('letter_text, generated_at')
      .eq('user_id', user.id)
      .eq('phase', phase)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        letter: existing.letter_text,
        generatedAt: existing.generated_at,
        cached: true,
      })
    }

    // Vérifier que l'utilisatrice a atteint le palier
    const { data: progress } = await adminClient
      .from('program_progress')
      .select('current_day')
      .eq('user_id', user.id)
      .maybeSingle()

    const currentDay = progress?.current_day || 0
    const requiredDay = phase * 30
    if (currentDay < requiredDay) {
      return NextResponse.json(
        { error: `Tu n'as pas encore atteint le J${requiredDay}` },
        { status: 403 }
      )
    }

    // Charger profil + réflexions de la phase + débriefs
    const phaseStartDay = (phase - 1) * 30 + 1
    const phaseEndDay = phase * 30

    const [profileRes, reflectionsRes, debriefsRes] = await Promise.all([
      adminClient.from('ai_personality_profile').select('*').eq('user_id', user.id).maybeSingle(),
      adminClient
        .from('mission_responses')
        .select('day_number, reflection, completed_at')
        .eq('user_id', user.id)
        .gte('day_number', phaseStartDay)
        .lte('day_number', phaseEndDay)
        .order('day_number'),
      adminClient
        .from('weekly_debriefs')
        .select('week_number, debrief_text, week_start')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const profile = profileRes.data
    const reflections = reflectionsRes.data || []
    const debriefs = debriefsRes.data || []

    const phaseInfo = PHASE_NAMES[phase]
    const nextPhase = phase < 3 ? PHASE_NAMES[phase + 1] : null

    const reflectionsText = reflections.length > 0
      ? reflections
        .filter(r => r.reflection && r.reflection.trim())
        .map(r => `J${r.day_number} : ${(r.reflection || '').substring(0, 350)}`)
        .join('\n\n')
      : 'Pas de réflexions enregistrées pour cette phase.'

    const debriefsText = debriefs.length > 0
      ? debriefs
        .map(d => `Semaine ${d.week_number || '?'} : ${(d.debrief_text || '').substring(0, 250)}`)
        .join('\n\n')
      : ''

    const profileText = profile ? `
- Pseudo : ${profile.pseudo || 'non renseigné'}
- Objectif : ${profile.objectif || 'non renseigné'}
- Bloqueurs : ${profile.bloqueurs || 'non renseignés'}
- État émotionnel de départ : ${profile.etat_emotionnel || 'non renseigné'}
- Motivation profonde : ${profile.motivation || 'non renseignée'}
- Réaction à l'échec : ${profile.reaction_echec || 'non renseignée'}
- Domaine prioritaire : ${profile.domaine_prioritaire || 'non renseigné'}
- Vision succès 90j : ${profile.signal_succes || 'non renseignée'}
- Ton souhaité : ${profile.ton_souhaite || 'bienveillant'}
` : 'Profil non disponible.'

    const isFinal = phase === 3
    const systemPrompt = `Tu es NOVAÉ, l'agent IA bienveillante. Tu écris une LETTRE PERSONNELLE à une utilisatrice qui vient de terminer la Phase ${phase} (${phaseInfo.name}, ${phaseInfo.days}) du programme 90 jours de transformation.

Cette lettre est un moment important pour elle. Elle doit :
- T'adresser à elle directement (tutoie-la, utilise son pseudo si disponible)
- Reconnaître concrètement son chemin parcouru en t'appuyant sur ses VRAIES réflexions ci-dessous (cite des thèmes ou idées qui reviennent, pas les mots exacts)
- Saluer ses prises de conscience ET ses difficultés (sans complaisance ni dureté)
- Lui montrer comment elle a changé — concret, pas en généralités
- ${isFinal
      ? "Marquer la fin du programme et lui projeter son avenir : qui elle est devenue, ce qu'elle emporte, sa promesse à venir"
      : `Faire le pont vers la Phase ${phase + 1} (${nextPhase!.name}, ${nextPhase!.days}) en lui disant ce qui l'attend et pourquoi elle est prête`}
- Adapter le ton à son profil (ton souhaité)
- Être sincère, puissante, bienveillante — surtout pas généraliste ni gnangnan
- 400 à 550 mots
- FORMAT PROSE CONTINUE — pas de listes, pas de titres, pas de gras, pas de markdown
- Commence par "Chère ${profile?.pseudo || 'toi'}," ou similaire
- Termine par une signature séparée : "— NOVAÉ"

PROFIL DE L'UTILISATRICE :
${profileText}

SES RÉFLEXIONS DE LA PHASE ${phase} (J${phaseStartDay} à J${phaseEndDay}) :
${reflectionsText}

${debriefsText ? `SES DERNIERS DÉBRIEFS HEBDOMADAIRES :\n${debriefsText}\n` : ''}

Écris maintenant la lettre. Pas de préambule, pas d'explication — directement la lettre.`

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Écris ma lettre de fin de Phase ${phase}.` },
        ],
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      console.error('[phase-letter] Anthropic error:', apiResponse.status, errText)
      return NextResponse.json(
        { error: 'Génération impossible. Réessaie plus tard.' },
        { status: 502 }
      )
    }

    const data = await apiResponse.json()
    const block = data?.content?.[0]
    const letterText = block?.type === 'text' ? block.text.trim() : ''

    if (!letterText) {
      return NextResponse.json({ error: 'Lettre vide' }, { status: 500 })
    }

    // Sauvegarde
    const { data: inserted, error: insertError } = await adminClient
      .from('phase_letters')
      .insert({
        user_id: user.id,
        phase,
        letter_text: letterText,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[phase-letter] insert error:', insertError)
    }

    return NextResponse.json({
      letter: letterText,
      generatedAt: inserted?.generated_at || new Date().toISOString(),
      cached: false,
    })
  } catch (error: any) {
    console.error('[phase-letter] error:', error?.message || error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}