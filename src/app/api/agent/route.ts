// src/app/api/agent/route.ts
// Agent IA NOVAÉ ("Nova") — il PARLE et il AGIT (tool use).
// Réutilise le pattern auth + gating de /api/chat. System prompt côté serveur (verrouillé).
// Logique : tu parles → il propose → tu valides ("oui") → il exécute l'outil.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canAccess, incrementAiChatCount } from '@/lib/permissions'

export const runtime = 'nodejs'

// ── Modèle ───────────────────────────────────────────────────────────────────
// Haiku pour le coût (ton modèle actuel). Si l'agent choisit mal ses outils ou
// hallucine des arguments, bascule sur un modèle Sonnet plus costaud
// (vérifie l'identifiant courant dans la doc Anthropic).
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_ITERATIONS = 6

type Block = any
type Msg = { role: 'user' | 'assistant'; content: string | Block[] }

function todayISODate() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

// ── Définition des outils envoyés à Claude ────────────────────────────────────
const TOOLS = [
  {
    name: 'lire_ma_journee',
    description:
      "Lit la journée de l'utilisatrice : jour du programme, streak, missions complétées, ses tâches à faire (to-do) et ses événements planifiés aujourd'hui. À utiliser AVANT de proposer de planifier un événement, pour repérer un conflit d'horaire.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'valider_mission_du_jour',
    description:
      "Marque la mission du jour du programme 90 jours comme complétée. À appeler UNIQUEMENT après confirmation explicite de l'utilisatrice.",
    input_schema: {
      type: 'object',
      properties: {
        jour: { type: 'integer', description: 'Numéro du jour à valider. Si omis, le jour courant du programme est utilisé.' },
        reflexion: { type: 'string', description: "Réflexion / note optionnelle de l'utilisatrice." },
      },
      required: [],
    },
  },
  {
    name: 'creer_note',
    description: "Crée une note dans le module Notes. À appeler UNIQUEMENT après confirmation de l'utilisatrice.",
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: 'Titre court (optionnel).' },
        contenu: { type: 'string', description: 'Contenu de la note (obligatoire).' },
      },
      required: ['contenu'],
    },
  },
  {
    name: 'ajouter_tache',
    description: 'Ajoute une tâche dans la to-do ("À faire"). À appeler UNIQUEMENT après confirmation de l\'utilisatrice.',
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: 'Intitulé de la tâche.' },
        description: { type: 'string', description: 'Détail (optionnel).' },
        date: { type: 'string', description: 'Date YYYY-MM-DD (optionnel).' },
        priorite: { type: 'string', description: "Priorité : 'basse' | 'moyenne' | 'haute' (optionnel)." },
        categorie: { type: 'string', description: "Catégorie (optionnel, défaut 'perso')." },
      },
      required: ['titre'],
    },
  },
  {
    name: 'ajouter_evenement_planner',
    description:
      "Ajoute un événement dans le planner/agenda. À appeler UNIQUEMENT après confirmation de l'utilisatrice.",
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: "Titre de l'événement." },
        date: { type: 'string', description: 'Date YYYY-MM-DD (obligatoire).' },
        heure_debut: { type: 'string', description: 'Heure de début HH:MM (optionnel).' },
        heure_fin: { type: 'string', description: 'Heure de fin HH:MM (optionnel).' },
        journee_entiere: { type: 'boolean', description: 'true si toute la journée.' },
        lieu: { type: 'string', description: 'Lieu (optionnel).' },
        description: { type: 'string', description: 'Description (optionnel).' },
      },
      required: ['titre', 'date'],
    },
  },
]

// ── Exécuteurs (service-role) ─────────────────────────────────────────────────
async function executeTool(name: string, input: any, userId: string, db: SupabaseClient) {
  try {
    switch (name) {
      case 'lire_ma_journee': {
        const { data: prog } = await db
          .from('program_progress')
          .select('current_day, streak_days, completed_missions')
          .eq('user_id', userId)
          .maybeSingle()
        const today = todayISODate()
        const { data: tasks } = await db
          .from('tasks')
          .select('title, status, date, priority')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .limit(20)
        const { data: events } = await db
          .from('planner_events')
          .select('title, start_date, end_date, location')
          .eq('user_id', userId)
          .gte('start_date', `${today}T00:00:00`)
          .lte('start_date', `${today}T23:59:59`)
          .order('start_date', { ascending: true })
        return {
          ok: true,
          jour_programme: prog?.current_day ?? null,
          streak: prog?.streak_days ?? 0,
          missions_completees: prog?.completed_missions ?? 0,
          taches_a_faire: tasks ?? [],
          evenements_aujourdhui: events ?? [],
        }
      }

      case 'valider_mission_du_jour': {
        let jour = input?.jour
        if (!jour) {
          const { data: prog } = await db
            .from('program_progress')
            .select('current_day')
            .eq('user_id', userId)
            .maybeSingle()
          jour = prog?.current_day ?? 1
        }
        const { data: existing } = await db
          .from('mission_responses')
          .select('id')
          .eq('user_id', userId)
          .eq('day_number', jour)
          .maybeSingle()
        const payload: any = {
          user_id: userId,
          day_number: jour,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        if (input?.reflexion) payload.reflection = input.reflexion
        if (existing) {
          const { error } = await db.from('mission_responses').update(payload).eq('id', existing.id)
          if (error) return { ok: false, message: error.message }
        } else {
          const { error } = await db.from('mission_responses').insert(payload)
          if (error) return { ok: false, message: error.message }
        }
        return { ok: true, jour_valide: jour }
      }

      case 'creer_note': {
        if (!input?.contenu) return { ok: false, message: 'Contenu manquant.' }
        const { data, error } = await db
          .from('notes')
          .insert({ user_id: userId, title: input.titre ?? null, content: input.contenu })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return { ok: true, note_id: data.id }
      }

      case 'ajouter_tache': {
        if (!input?.titre) return { ok: false, message: 'Titre manquant.' }
        const { data, error } = await db
          .from('tasks')
          .insert({
            user_id: userId,
            title: input.titre,
            description: input.description ?? null,
            category: input.categorie ?? 'perso',
            status: 'pending',
            date: input.date ?? null,
            priority: input.priorite ?? null,
          })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return { ok: true, tache_id: data.id }
      }

      case 'ajouter_evenement_planner': {
        if (!input?.titre || !input?.date) return { ok: false, message: 'Titre ou date manquant.' }
        const allDay = !!input.journee_entiere
        const start = allDay ? `${input.date}T00:00:00` : `${input.date}T${input.heure_debut ?? '09:00'}:00`
        let end: string
        if (allDay) {
          end = `${input.date}T23:59:00`
        } else if (input.heure_fin) {
          end = `${input.date}T${input.heure_fin}:00`
        } else {
          const [h, m] = (input.heure_debut ?? '09:00').split(':').map(Number)
          const eh = String((h + 1) % 24).padStart(2, '0')
          end = `${input.date}T${eh}:${String(m ?? 0).padStart(2, '0')}:00`
        }
        // Détection de conflit (chevauchement) le même jour
        const { data: clash } = await db
          .from('planner_events')
          .select('title, start_date, end_date')
          .eq('user_id', userId)
          .lt('start_date', end)
          .gt('end_date', start)
        const { data, error } = await db
          .from('planner_events')
          .insert({
            user_id: userId,
            title: input.titre,
            description: input.description ?? null,
            location: input.lieu ?? null,
            start_date: start,
            end_date: end,
            is_all_day: allDay,
          })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return {
          ok: true,
          evenement_id: data.id,
          conflit: clash && clash.length > 0 ? { message: "Chevauchement d'horaire détecté", evenements: clash } : null,
        }
      }

      default:
        return { ok: false, message: `Outil inconnu: ${name}` }
    }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Erreur outil' }
  }
}

// ── System prompt personnalisé (serveur, verrouillé) ──────────────────────────
async function buildSystemPrompt(db: SupabaseClient, userId: string) {
  const { data: profile } = await db
    .from('ai_personality_profile')
    .select('pseudo, objectif, bloqueurs, etat_emotionnel, motivation, ton_souhaite, domaine_prioritaire')
    .eq('user_id', userId)
    .maybeSingle()
  const { data: prog } = await db
    .from('program_progress')
    .select('current_day, streak_days')
    .eq('user_id', userId)
    .maybeSingle()

  const pseudo = profile?.pseudo || 'toi'
  const ctx = [
    profile?.objectif && `Objectif : ${profile.objectif}`,
    profile?.bloqueurs && `Bloqueurs : ${profile.bloqueurs}`,
    profile?.etat_emotionnel && `État émotionnel : ${profile.etat_emotionnel}`,
    profile?.motivation && `Motivation : ${profile.motivation}`,
    profile?.ton_souhaite && `Ton souhaité : ${profile.ton_souhaite}`,
    profile?.domaine_prioritaire && `Domaine prioritaire : ${profile.domaine_prioritaire}`,
    prog?.current_day != null && `Jour du programme : ${prog.current_day}/90`,
    prog?.streak_days != null && `Streak : ${prog.streak_days} jours`,
  ]
    .filter(Boolean)
    .join('\n')

  return `Tu es NOVAÉ, l'assistante de transformation de ${pseudo} dans l'app NOVAÉ by OMANAÏA. On t'appelle "Nova".
Tu peux à la fois PARLER avec elle ET AGIR dans son espace grâce à des outils (lire sa journée, valider sa mission, créer une note, ajouter une tâche, ajouter un événement au planner).

## Ta voix
Chaleureuse, directe, honnête. Tu tutoies. Réponses concises (3-4 phrases). Une seule question à la fois.
Anti-perfectionniste : tu déculpabilises, tu ne survends pas, pas de faux enthousiasme. Pas de listes à 6+ points, pas de ## ni ###. **gras** uniquement pour les mots-clés. Tu ne commences pas une réponse par "Je".

## RÈGLE ABSOLUE — n'invente JAMAIS une action
- Tu ne dis JAMAIS qu'une chose est faite ("c'est validé", "j'ai créé", "ajouté ✅") tant que l'OUTIL n'a pas réellement été exécuté et t'a renvoyé un résultat positif (ok:true).
- Avant TOUTE action qui modifie ses données (valider une mission, créer une note, ajouter une tâche ou un événement) : tu PROPOSES d'abord en une phrase claire, et tu attends son "oui" explicite. Tu n'appelles l'outil d'écriture qu'APRÈS sa confirmation.
- Si tu n'es pas sûre de ce qu'elle veut, tu DEMANDES. Tu ne devines jamais une écriture.
- Pour planifier un événement : appelle d'abord 'lire_ma_journee' pour repérer un éventuel conflit d'horaire, et préviens-la si tu en vois un.
- Après exécution, tu confirmes UNIQUEMENT sur la base du vrai résultat de l'outil.

## Ce que tu sais d'elle
${ctx || 'Profil non encore renseigné.'}

## Disclaimer
Tu es un guide IA, pas un médecin/psy/coach diplômé. En cas de détresse sérieuse, oriente avec douceur vers un professionnel.`
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Gating identique au coach : 5/mois en free, illimité en Premium/trial
    const access = await canAccess(db, 'ai_coach', user.id)
    if (!access.allowed) {
      const limitReached = access.reason === 'monthly_limit_reached'
      return NextResponse.json(
        {
          error: access.reason || 'premium_required',
          message: limitReached
            ? `Tu as utilisé tes ${access.quota_max ?? 5} échanges gratuits avec Nova ce mois-ci. Passe Premium pour échanger sans limite. ✦`
            : 'Nova, ton assistante, est réservée aux membres Premium.',
          quota_remaining: 0,
          quota_max: access.quota_max,
          reset_at: access.reset_at,
          upgrade_url: '/subscribe',
        },
        { status: 403 }
      )
    }
    const isQuotaUser = access.quota_remaining !== undefined

    const { message, history, clientContext } = await request.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message manquant' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante côté serveur.' }, { status: 500 })
    }

    const system = await buildSystemPrompt(db, user.id)

    // On greffe le contexte riche envoyé par le front (repas, recettes, allergies,
    // mission du jour, mode traversée difficile, profil…) comme DONNÉES de référence.
    // Les règles de comportement + les outils restent ceux du serveur (prioritaires).
    const fullSystem =
      clientContext && typeof clientContext === 'string' && clientContext.trim()
        ? `${system}\n\n## CONTEXTE TEMPS RÉEL (données réelles de l'utilisatrice — sers-t'en pour répondre)\nIMPORTANT : ignore tout format « ACTION_JSON » mentionné dans ce contexte. Pour AGIR, tu utilises EXCLUSIVEMENT tes outils, et toujours après confirmation.\n\n${clientContext}`
        : system

    // Historique nettoyé (alternance, strings)
    const messages: Msg[] = []
    if (Array.isArray(history)) {
      let last: string | null = null
      for (const m of history) {
        if (
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim() &&
          m.role !== last
        ) {
          messages.push({ role: m.role, content: m.content })
          last = m.role
        }
      }
      while (messages.length && messages[0].role !== 'user') messages.shift()
    }
    messages.push({ role: 'user', content: message })

    // Boucle tool use
    let iterations = 0
    let data: any
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: fullSystem, tools: TOOLS, messages }),
      })
      if (!res.ok) {
        const t = await res.text()
        console.error('[api/agent] Anthropic error', res.status, t)
        return NextResponse.json({ error: 'Nova est temporairement indisponible. Réessaie.' }, { status: 502 })
      }
      data = await res.json()

      if (data.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
        iterations++
        messages.push({ role: 'assistant', content: data.content })
        const toolResults: Block[] = []
        for (const block of data.content) {
          if (block.type !== 'tool_use') continue
          const result = await executeTool(block.name, block.input, user.id, db)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }
        messages.push({ role: 'user', content: toolResults })
        continue
      }
      break
    }

    const responseText =
      (data.content || [])
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim() || 'Je suis là pour toi. ✦'

    // Incrément quota : free uniquement, après succès (non-bloquant)
    if (isQuotaUser) {
      try {
        await incrementAiChatCount(db, user.id)
      } catch (e) {
        console.error('[api/agent] increment quota (non-blocking):', e)
      }
    }

    return NextResponse.json({
      response: responseText,
      ...(isQuotaUser
        ? { quota_remaining: Math.max(0, (access.quota_remaining ?? 0) - 1), quota_max: access.quota_max }
        : {}),
    })
  } catch (e: any) {
    console.error('[api/agent] error', e?.message || e)
    return NextResponse.json({ error: 'Une erreur est survenue. Réessaie.' }, { status: 500 })
  }
}