// src/app/api/agent/route.ts
// Agent IA NOVAÉ ("Nova") — il PARLE et il AGIT (tool use).
// Réutilise le pattern auth + gating de /api/chat. System prompt côté serveur (verrouillé).
// Logique : tu parles → il propose → tu valides ("oui") → il exécute l'outil.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canAccess, incrementAiChatCount } from '@/lib/permissions'
import missionsData from '@/data/missions.json'
import { getNovaContextFromDeepJourneys, formatNovaContextAsPromptBlock } from '@/lib/deepJourneys'
import { rateLimit } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 30 // ← évite le timeout Vercel à 10s

// ── Modèle ───────────────────────────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5' // ← corrigé (ancien identifiant déprécié)
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
    name: 'lire_mes_taches',
    description:
      "Liste TOUTES les tâches en attente de la to-do (\"À faire\") de l'utilisatrice, avec leur titre, priorité et échéance éventuelle. À utiliser dès que l'utilisatrice demande quelles sont ses tâches, lesquelles sont en attente, ou veut qu'on les organise ensemble.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'lire_planning_jour',
    description:
      "Lit tous les événements déjà planifiés (Planner) pour un jour précis. À appeler AVANT de proposer un créneau horaire pour un jour donné, afin d'annoncer à l'utilisatrice ce qu'elle a déjà ce jour-là et de proposer une heure réellement libre. Ne jamais dire 'tu es libre' sans avoir lu le planning du jour visé.",
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Le jour à consulter, au format YYYY-MM-DD.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'valider_mission_du_jour',
    description:
      "Valide ENTIÈREMENT la mission du jour du programme 90j : coche toutes les tâches du jour, enregistre la réflexion, et fait avancer au jour suivant (uniquement si c'est le jour courant). À appeler UNIQUEMENT après confirmation explicite de l'utilisatrice.",
    input_schema: {
      type: 'object',
      properties: {
        jour: { type: 'integer', description: 'Numéro du jour à valider. Si omis, le jour courant du programme est utilisé.' },
        reflexion: { type: 'string', description: "Réflexion de l'utilisatrice sur sa mission (recommandée)." },
      },
      required: [],
    },
  },
  {
    name: 'lire_mes_notes',
    description:
      "Lit les notes de l'utilisatrice dans son carnet de notes (titre + contenu). À utiliser quand elle veut trier ses notes, faire le point sur ce qu'elle a noté, ou quand tu lui proposes de transformer certaines notes en tâches ou en défis (boucle de 'mental offloading').",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'lire_mes_defis',
    description:
      "Lit les défis de l'utilisatrice (module Défis) : titre, catégorie, statut (disponible / en cours / terminé), progression et points. À utiliser quand elle demande où elle en est sur ses défis, ou pour lui suggérer d'en lancer un.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'lire_ma_famille',
    description:
      "Lit les membres du foyer de l'utilisatrice (module Famille) : prénom, relation, allergies, notes de santé. À utiliser pour personnaliser une réponse qui concerne sa famille (ex : planifier un repas en tenant compte des allergies, se souvenir d'un anniversaire).",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'lire_mes_routines',
    description:
      "Lit les routines existantes de l'utilisatrice (module Routines) : titre, catégorie (matin/soir), fréquence, si elles sont faites aujourd'hui, et leur streak. À utiliser AVANT de proposer de créer une nouvelle routine (pour éviter les doublons) ou quand elle demande où elle en est sur ses habitudes.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'lire_mes_repas',
    description:
      "Lit le planning de repas de la semaine (module Repas) et la liste de courses de l'utilisatrice. À utiliser quand elle demande ce qu'elle a prévu de manger, ou pour vérifier ce qui est déjà planifié avant de proposer un nouveau repas.",
    input_schema: { type: 'object', properties: {}, required: [] },
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
        categorie: { type: 'string', enum: ['pro', 'self', 'family', 'social'], description: "Catégorie de la tâche (défaut 'self')." },
      },
      required: ['titre'],
    },
  },
  {
    name: 'ajouter_evenement_planner',
    description:
      "Ajoute un événement daté sur le calendrier/agenda (Planner) à une heure précise. C'est ce qu'on utilise pour 'récupérer les filles à 18h', 'créneau de travail', 'faire les courses', un RDV, etc. À appeler UNIQUEMENT après confirmation de l'utilisatrice. IMPORTANT : si l'outil renvoie conflit_bloquant=true, l'événement n'a PAS été créé. Ne dis jamais qu'il est créé : propose une autre heure/jour, et ne rappelle l'outil avec forcer=true que si l'utilisatrice dit explicitement de le créer malgré le conflit.",
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: "Titre de l'événement." },
        date: { type: 'string', description: 'Date YYYY-MM-DD (obligatoire).' },
        heure_debut: { type: 'string', description: 'Heure de début HH:MM (optionnel, défaut 09:00).' },
        heure_fin: { type: 'string', description: 'Heure de fin HH:MM (optionnel).' },
        journee_entiere: { type: 'boolean', description: 'true si toute la journée.' },
        categorie: {
          type: 'string',
          enum: ['pro', 'self', 'family', 'social'],
          description: "Catégorie/couleur : 'pro' (travail), 'self' (perso/moi), 'family' (famille/enfants), 'social' (amis/couple). Défaut 'self'.",
        },
        lieu: { type: 'string', description: 'Lieu (optionnel).' },
        description: { type: 'string', description: 'Description (optionnel).' },
        forcer: { type: 'boolean', description: "Mettre true UNIQUEMENT si l'utilisatrice a explicitement accepté de créer l'événement malgré un conflit d'horaire signalé. Par défaut false." },
      },
      required: ['titre', 'date'],
    },
  },
  {
    name: 'planifier_repas',
    description:
      "Planifie un repas dans le planning de la semaine (meal_plan). À appeler UNIQUEMENT après confirmation. Fournis le jour, le type de repas, et soit le titre d'une recette existante, soit un repas libre.",
    input_schema: {
      type: 'object',
      properties: {
        jour: {
          type: 'string',
          description: 'Jour de la semaine en français, 1re lettre majuscule : Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche.',
        },
        repas: {
          type: 'string',
          enum: ['petit_dej', 'dejeuner', 'diner', 'collation'],
          description: 'Type de repas.',
        },
        recette_titre: {
          type: 'string',
          description: "Titre d'une recette existante de l'utilisatrice (ex. 'Buddha Bowl végétarien'). Optionnel si repas_libre fourni.",
        },
        repas_libre: {
          type: 'string',
          description: "Texte libre si ce n'est pas une recette enregistrée (ex. 'Restes du frigo'). Optionnel.",
        },
      },
      required: ['jour', 'repas'],
    },
  },
  {
    name: 'creer_routine',
    description:
      "Crée une routine récurrente (table routines) avec rappel. À appeler UNIQUEMENT après confirmation. Pour créer plusieurs routines, appelle cet outil plusieurs fois.",
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: "Intitulé de la routine (ex. 'Dîner avant 20h')." },
        categorie: {
          type: 'string',
          enum: ['morning', 'evening'],
          description: "Moment : 'morning' (matin) ou 'evening' (soir). L'app n'a QUE ces deux moments — une routine de l'après-midi ou du midi va dans 'evening'.",
        },
        description: { type: 'string', description: 'Détail optionnel.' },
        heure_preferee: { type: 'string', description: 'Heure préférée HH:MM (optionnel).' },
        duree_minutes: { type: 'integer', description: 'Durée en minutes (optionnel).' },
        jours: {
          type: 'array',
          items: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
          description: "Jours actifs. Par défaut TOUS les jours de la semaine — ne restreins ces jours QUE si l'utilisatrice le demande explicitement.",
        },
        rappel_minutes_avant: { type: 'integer', description: 'Minutes de rappel avant (défaut 15).' },
      },
      required: ['titre', 'categorie'],
    },
  },
  {
    name: 'lire_historique_programme',
    description:
      "Lit l'historique des réflexions et missions du programme 90 jours sur plusieurs jours (ce qu'elle a écrit jour après jour). À utiliser DÈS qu'elle demande d'analyser sa progression, ses patterns, ou ses derniers jours.",
    input_schema: {
      type: 'object',
      properties: {
        depuis_jour: { type: 'integer', description: 'Numéro de jour de départ (optionnel).' },
        limite: { type: 'integer', description: 'Nombre de jours à récupérer (défaut 30).' },
      },
    },
  },
  {
    name: 'lire_parcours_profonds',
    description:
      "Lit ce qu'elle a écrit dans ses Parcours Profonds (ex : Reclaim Myself) — forces, valeurs, engagements, réponses. À utiliser pour relier ses réflexions profondes au quotidien.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'lire_mes_debriefs',
    description:
      "Lit ses débriefs hebdomadaires passés (les bilans du dimanche). À utiliser pour faire le point sur plusieurs semaines ou rappeler ce qui avait été observé.",
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'integer', description: 'Nombre de débriefs (défaut 4).' } },
    },
  },
  {
    name: 'lire_ma_progression',
    description:
      "Lit sa progression : streak (flamme) et badges obtenus. À utiliser pour commenter sa régularité et ses réussites.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'lire_ma_communaute',
    description:
      "Lit sa propre activité dans la communauté (ses publications). À utiliser si elle parle de la communauté ou de ce qu'elle a partagé.",
    input_schema: {
      type: 'object',
      properties: { limite: { type: 'integer', description: 'Nombre de publications (défaut 10).' } },
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
const _n = new Date()
const _p = new Date(_n.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
const _pad = (n: number) => String(n).padStart(2, '0')
const today = `${_p.getFullYear()}-${_pad(_p.getMonth() + 1)}-${_pad(_p.getDate())}`
        const { data: tasks } = await db
          .from('todo_list')
          .select('title, status, due_date, priority')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .limit(20)
        const { data: events } = await db
          .from('planner_events')
          .select('title, start_minutes, end_minutes, category, status')
          .eq('user_id', userId)
          .gte('start_date', `${today}T00:00:00`)
          .lte('start_date', `${today}T23:59:59`)
          .order('start_minutes', { ascending: true })
        return {
          ok: true,
          jour_programme: prog?.current_day ?? null,
          streak: prog?.streak_days ?? 0,
          missions_completees: prog?.completed_missions ?? 0,
          taches_a_faire: tasks ?? [],
          evenements_aujourdhui: events ?? [],
        }
      }

      case 'lire_mes_taches': {
        const { data: taches } = await db
          .from('todo_list')
          .select('title, status, due_date, priority, category')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(50)
        return {
          ok: true,
          nb_taches: (taches ?? []).length,
          taches: taches ?? [],
        }
      }

      case 'lire_planning_jour': {
        const jour = input?.date
        if (!jour) return { ok: false, message: 'Date manquante (format YYYY-MM-DD).' }
        const { data: evts } = await db
          .from('planner_events')
          .select('title, start_minutes, end_minutes, category')
          .eq('user_id', userId)
          .gte('start_date', `${jour}T00:00:00`)
          .lte('start_date', `${jour}T23:59:59`)
          .order('start_minutes', { ascending: true })
        const pad2 = (n: number) => String(n).padStart(2, '0')
        const hm = (mins: number | null) =>
          mins == null ? '--:--' : `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
        const evenements = (evts ?? []).map((e: any) => ({
          titre: e.title,
          debut: hm(e.start_minutes),
          fin: hm(e.end_minutes),
          categorie: e.category,
        }))
        return { ok: true, date: jour, nb: evenements.length, evenements }
      }

      case 'valider_mission_du_jour': {
        const { data: prog } = await db
          .from('program_progress')
          .select('current_day')
          .eq('user_id', userId)
          .maybeSingle()
        const currentDay = prog?.current_day ?? 1
        const jour = input?.jour ?? currentDay

        const mission = (missionsData as any[]).find((m: any) => m.day === jour)
        const tasks = Array.isArray(mission?.tasks) ? mission.tasks : []
        const completed_tasks = tasks.map((_: any, i: number) => i)

        const { data: existing } = await db
          .from('mission_responses')
          .select('reflection')
          .eq('user_id', userId)
          .eq('day_number', jour)
          .maybeSingle()
        const reflection =
          typeof input?.reflexion === 'string' && input.reflexion.trim()
            ? input.reflexion.trim()
            : existing?.reflection ?? null

        const { error: upErr } = await db.from('mission_responses').upsert(
          {
            user_id: userId,
            day_number: jour,
            reflection,
            completed_tasks,
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,day_number' }
        )
        if (upErr) return { ok: false, message: upErr.message }

        let jour_suivant: number | null = null
        if (jour === currentDay && jour < 90) {
          const { error: advErr } = await db
            .from('program_progress')
            .update({
              current_day: jour + 1,
              last_access_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
          if (!advErr) jour_suivant = jour + 1
        }

        return {
          ok: true,
          jour_valide: jour,
          taches_cochees: completed_tasks.length,
          reflexion_enregistree: !!reflection,
          jour_suivant,
        }
      }

      case 'lire_mes_defis': {
        const { data: defis } = await db
          .from('user_defis')
          .select('title, category, status, points, days')
          .eq('user_id', userId)
        return {
          ok: true,
          nb_defis: (defis ?? []).length,
          defis: (defis ?? []).map((d: any) => {
            const days = Array.isArray(d.days) ? d.days : []
            const total = days.length
            const faits = days.filter((x: any) => x === true || x?.done === true).length
            return {
              titre: d.title,
              categorie: d.category,
              statut: d.status,
              points: d.points ?? 0,
              progression: total > 0 ? `${faits}/${total}` : null,
            }
          }),
        }
      }

      case 'lire_ma_famille': {
        const { data: membres } = await db
          .from('family_data')
          .select('data, relation_to_user')
          .eq('user_id', userId)
          .eq('is_active', true)
        return {
          ok: true,
          nb_membres: (membres ?? []).length,
          membres: (membres ?? []).map((m: any) => {
            const d = m.data || {}
            return {
              prenom: d.firstName || d.name || '(sans nom)',
              relation: d.relation || m.relation_to_user || null,
              date_naissance: d.birthDate || d.birthday || null,
              allergies: Array.isArray(d.allergies) ? d.allergies.join(', ') : (d.allergies || d.healthNotes || null),
              notes_sante: d.healthNotes || null,
              notes: d.notes || null,
            }
          }),
        }
      }

      case 'lire_mes_routines': {
        const { data: routines } = await db
          .from('routines')
          .select('title, category, frequency, custom_days, completed, streak_count')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
        return {
          ok: true,
          nb_routines: (routines ?? []).length,
          routines: (routines ?? []).map((r: any) => ({
            titre: r.title,
            categorie: r.category, // 'morning' ou 'evening'
            frequence: r.frequency,
            jours_personnalises: r.custom_days || null,
            faite_aujourdhui: !!r.completed,
            streak: r.streak_count ?? 0,
          })),
        }
      }

      case 'lire_mes_repas': {
        const { data: slots } = await db
          .from('meal_plan')
          .select('day_of_week, meal_type, headcount, meal_scope, recipes(title)')
          .eq('user_id', userId)
        const { data: courses } = await db
          .from('shopping_list')
          .select('ingredient, quantity, checked, to_buy')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        return {
          ok: true,
          repas_planifies: (slots ?? []).map((s: any) => ({
            jour: s.day_of_week,
            repas: s.meal_type,
            recette: s.recipes?.title ?? null,
            nb_personnes: s.headcount ?? null,
            qui_mange: s.meal_scope ?? null,
          })),
          liste_de_courses: (courses ?? [])
            .filter((c: any) => c.to_buy !== false && !c.checked)
            .map((c: any) => ({ article: c.ingredient, quantite: c.quantity ?? null })),
        }
      }

      case 'lire_mes_notes': {
        const { data: notes } = await db
          .from('notes')
          .select('title, content, updated_at')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(30)
        return {
          ok: true,
          nb_notes: (notes ?? []).length,
          notes: (notes ?? []).map((n: any) => ({
            titre: n.title || '(sans titre)',
            contenu: n.content,
          })),
        }
      }

      case 'lire_historique_programme': {
        const limite = Math.min(Math.max(Number(input?.limite) || 30, 1), 90)
        let q = db
          .from('mission_responses')
          .select('day_number, reflection, completed_tasks, completed_at')
          .eq('user_id', userId)
        if (input?.depuis_jour != null) q = q.gte('day_number', Number(input.depuis_jour))
        const { data, error } = await q.order('day_number', { ascending: false }).limit(limite)
        if (error) return { ok: false, message: error.message }
        return { ok: true, jours: data || [], nombre: (data || []).length }
      }

      case 'lire_parcours_profonds': {
        const context = await getNovaContextFromDeepJourneys(userId)
        const bloc = formatNovaContextAsPromptBlock(context)
        return {
          ok: true,
          parcours_profonds: bloc || 'Aucune donnée de parcours profond pour le moment.',
        }
      }

      case 'lire_mes_debriefs': {
        const limite = Math.min(Math.max(Number(input?.limite) || 4, 1), 12)
        const { data, error } = await db
          .from('weekly_debriefs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limite)
        if (error) return { ok: false, message: error.message }
        return { ok: true, debriefs: data || [], nombre: (data || []).length }
      }

      case 'lire_ma_progression': {
        const [streakRes, badgesRes] = await Promise.all([
          db.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
          db
            .from('user_badges')
            .select('*')
            .eq('user_id', userId)
            .order('earned_at', { ascending: false }),
        ])
        return {
          ok: true,
          streak: streakRes.data || null,
          badges: badgesRes.data || [],
          nombre_badges: (badgesRes.data || []).length,
        }
      }

      case 'lire_ma_communaute': {
        const limite = Math.min(Math.max(Number(input?.limite) || 10, 1), 30)
        const { data, error } = await db
          .from('community_posts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limite)
        if (error) return { ok: false, message: error.message }
        return { ok: true, publications: data || [], nombre: (data || []).length }
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
        const prioriteMap: Record<string, string> = { basse: 'low', moyenne: 'medium', haute: 'high' }
        const priority = prioriteMap[input.priorite] ?? 'medium'
        const category = ['pro', 'self', 'family', 'social'].includes(input.categorie) ? input.categorie : 'self'
        const { data, error } = await db
          .from('todo_list')
          .insert({
            user_id: userId,
            title: input.titre,
            description: input.description ?? null,
            category,
            status: 'pending',
            due_date: input.date ?? null,
            priority,
          })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return { ok: true, tache_id: data.id }
      }

      case 'ajouter_evenement_planner': {
        if (!input?.titre || !input?.date) return { ok: false, message: 'Titre ou date manquant.' }
        const allDay = !!input.journee_entiere
        const parseHM = (s: string) => {
          const [h, m] = String(s).split(':').map((x) => parseInt(x, 10))
          return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m }
        }
        const startHM = parseHM(input.heure_debut ?? '09:00')
        let durationHours = 1
        if (allDay) {
          durationHours = 24
        } else if (input.heure_fin) {
          const endHM = parseHM(input.heure_fin)
          const diff = (endHM.h * 60 + endHM.m - (startHM.h * 60 + startHM.m)) / 60
          durationHours = diff > 0 ? Math.round(diff * 100) / 100 : 1
        }
        const categorie = ['pro', 'self', 'family', 'social'].includes(input?.categorie)
          ? input.categorie
          : 'self'

        // Conflits : on lit le vrai planner (planner_events) du même jour
        const startMinutes = allDay ? 0 : (startHM.h * 60 + startHM.m)
        const endMinutes = allDay
          ? (23 * 60 + 59)
          : Math.min(startMinutes + Math.round(durationHours * 60), 23 * 60 + 59)
        const pad2 = (n: number) => String(n).padStart(2, '0')
        const hm = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`
        const startDt = `${input.date}T${hm(startMinutes)}:00`
        const endDt = `${input.date}T${hm(endMinutes)}:00`

        const { data: sameDay } = await db
          .from('planner_events')
          .select('title, start_minutes, end_minutes')
          .eq('user_id', userId)
          .gte('start_date', `${input.date}T00:00:00`)
          .lte('start_date', `${input.date}T23:59:59`)
        const conflits = (sameDay ?? []).filter((t: any) => {
          const s = t.start_minutes ?? 540
          const e = t.end_minutes ?? (s + 60)
          return startMinutes < e && endMinutes > s
        })

        // S'il y a un conflit et que l'utilisatrice n'a PAS explicitement forcé,
        // on NE CRÉE RIEN. On renvoie le conflit pour que Nova propose une autre heure.
        if (conflits.length > 0 && !input.forcer) {
          return {
            ok: false,
            conflit_bloquant: true,
            evenement_non_cree: true,
            message:
              "Conflit d'horaire : l'événement n'a PAS été créé. Propose une autre heure/jour à l'utilisatrice, ou demande-lui si elle veut quand même le créer malgré le chevauchement (dans ce cas, rappelle l'outil avec forcer=true).",
            evenements_en_conflit: conflits.map((c: any) => c.title),
          }
        }

        const { data, error } = await db
          .from('planner_events')
          .insert({
            user_id: userId,
            title: input.titre,
            description: [input.description, input.lieu ? `Lieu : ${input.lieu}` : '']
              .filter(Boolean)
              .join(' · ') || null,
            start_date: startDt,
            end_date: endDt,
            start_minutes: startMinutes,
            end_minutes: endMinutes,
            category: categorie,
            recurrence_days: [],
            reminder_minutes_before: [15],
            reminder_sent: false,
          })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return {
          ok: true,
          evenement_id: data.id,
          jour: input.date,
          heure: hm(startMinutes),
          duree_h: durationHours,
          conflit:
            conflits.length > 0
              ? { message: 'Créé malgré un chevauchement (forcé par l\'utilisatrice)', evenements: conflits.map((c: any) => c.title) }
              : null,
        }
      }

      case 'planifier_repas': {
        const jourRaw = (input?.jour ?? '').trim()
        if (!jourRaw) return { ok: false, message: 'Jour manquant.' }
        const jour = jourRaw.charAt(0).toUpperCase() + jourRaw.slice(1).toLowerCase()
        const repas = (input?.repas ?? 'diner').toLowerCase()

        let recipe_id: string | null = null
        let custom_meal: string | null = input?.repas_libre ?? null

        if (input?.recette_titre) {
          const { data: recipe } = await db
            .from('recipes')
            .select('id, title')
            .or(`user_id.eq.${userId},is_public.eq.true`)
            .ilike('title', `%${input.recette_titre}%`)
            .limit(1)
            .maybeSingle()
          if (recipe) recipe_id = recipe.id
          else custom_meal = custom_meal ?? input.recette_titre
        }

        if (!recipe_id && !custom_meal) {
          return { ok: false, message: 'Donne soit une recette existante, soit un repas libre.' }
        }

        const { data, error } = await db
          .from('meal_plan')
          .insert({ user_id: userId, day_of_week: jour, meal_type: repas, recipe_id, custom_meal })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return {
          ok: true,
          meal_plan_id: data.id,
          jour,
          repas,
          recette: recipe_id ? input.recette_titre : custom_meal,
        }
      }

      case 'creer_routine': {
        if (!input?.titre) return { ok: false, message: 'Titre manquant.' }
        const categorie = ['morning', 'evening'].includes(input?.categorie)
          ? input.categorie
          : 'morning'
        const { data: dup } = await db
          .from('routines')
          .select('id')
          .eq('user_id', userId)
          .eq('title', input.titre)
          .limit(1)
          .maybeSingle()
        if (dup) {
          return { ok: true, routine_id: dup.id, titre: input.titre, categorie, deja_existante: true }
        }
        const jours =
          Array.isArray(input?.jours) && input.jours.length > 0
            ? input.jours
            : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        const { data, error } = await db
          .from('routines')
          .insert({
            user_id: userId,
            title: input.titre,
            description: input.description ?? '✨',
            frequency: 'daily',
            category: categorie,
            preferred_time: input.heure_preferee ?? null,
            duration_minutes: input.duree_minutes ?? null,
            completed: false,
            streak_count: 0,
            custom_days: jours,
            reminder_enabled: true,
            reminder_minutes_before: input.rappel_minutes_avant ?? 15,
          })
          .select('id')
          .single()
        if (error) return { ok: false, message: error.message }
        return { ok: true, routine_id: data.id, titre: input.titre, categorie }
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
Tu peux à la fois PARLER avec elle ET AGIR dans son espace grâce à des outils. Tu peux LIRE : sa journée, ses tâches, son planning, ses notes, ses défis, sa famille, ses routines, ses repas, l'historique de ses réflexions du programme 90 jours (lire_historique_programme), ses Parcours Profonds comme Reclaim Myself (lire_parcours_profonds), ses débriefs hebdomadaires passés (lire_mes_debriefs), sa progression — flamme et badges (lire_ma_progression), et son activité dans la communauté (lire_ma_communaute). Tu peux AGIR : valider sa mission du jour, créer une note, ajouter une tâche, ajouter un événement au planner, planifier un repas, créer une routine.

## Tu as accès à son historique
Tu n'es PAS aveugle sur son passé. Quand elle te demande d'analyser ses derniers jours, sa progression ou ses patterns, tu APPELLES d'abord lire_historique_programme (et au besoin lire_parcours_profonds, lire_mes_debriefs, lire_ma_progression) AVANT de répondre. Tu ne dis JAMAIS que tu n'as pas accès à ses réflexions passées ni que le système ne stocke pas son historique : tu vas chercher ses vraies données avec tes outils de lecture, puis tu réponds à partir d'elles.

## Ta voix
Chaleureuse, directe, honnête. Tu tutoies. Réponses concises (3-4 phrases). Une seule question à la fois.
Anti-perfectionniste : tu déculpabilises, tu ne survends pas, pas de faux enthousiasme. Pas de listes à 6+ points, pas de ## ni ###. **gras** uniquement pour les mots-clés. Tu ne commences pas une réponse par "Je".

## RÈGLE ABSOLUE — n'invente JAMAIS une action
- Tu ne dis JAMAIS qu'une chose est faite ("c'est validé", "j'ai créé", "ajouté ✅") tant que l'OUTIL n'a pas réellement été exécuté et t'a renvoyé un résultat positif (ok:true).
- Avant TOUTE action qui modifie ses données (valider une mission, créer une note, ajouter une tâche ou un événement) : tu PROPOSES d'abord en une phrase claire, et tu attends son "oui" explicite. Tu n'appelles l'outil d'écriture qu'APRÈS sa confirmation.
- Si tu n'es pas sûre de ce qu'elle veut, tu DEMANDES. Tu ne devines jamais une écriture.
- Pour planifier un événement : appelle d'abord 'lire_ma_journee' pour repérer un éventuel conflit d'horaire, et préviens-la si tu en vois un.
- Après exécution, tu confirmes UNIQUEMENT sur la base du vrai résultat de l'outil.
- CONFLIT D'HORAIRE : si l'outil d'ajout d'événement renvoie conflit_bloquant=true, c'est que l'événement N'A PAS été créé. Tu ne dis JAMAIS qu'il est créé. Tu annonces le conflit, tu proposes une autre heure ou un autre jour, et tu attends sa décision. Tu ne crées l'événement malgré le conflit (forcer=true) QUE si elle te le demande explicitement.
- AVANT de proposer un créneau pour un jour : appelle lire_planning_jour sur ce jour, puis annonce-lui ce qu'elle a déjà ("demain tu as Lidl de 7h à 17h"). Ne dis jamais "tu es libre" sans avoir lu le planning du jour visé. Propose une heure réellement disponible.
- TRI DE NOTES (mental offloading) : si l'utilisatrice veut trier ses notes, ou si elle arrive depuis une notification "notes à trier", appelle lire_mes_notes, puis pour chaque note propose UNE action concrète : la transformer en tâche (ajouter_tache), en événement (ajouter_evenement_planner), ou la laisser telle quelle. Une note à la fois, jamais en liste à puces, et tu n'agis qu'après son accord sur chaque note.
- Si tu n'as PAS d'outil pour une action demandée, dis-le honnêtement (« je ne peux pas encore faire ça directement dans l'app, mais voilà comment faire toi-même… »). Tu n'annonces JAMAIS un succès (« ajouté ✅ », « c'est fait ») pour une action que tu n'as pas réellement exécutée via un outil.
- Quand on te demande de créer PLUSIEURS éléments (routines, tâches, repas…) : tu crées CHAQUE élément exactement UNE fois, avec un seul titre clair. Dès qu'un outil te renvoie ok:true, l'élément EST créé — tu ne le recrées jamais et tu ne reformules pas son titre pour le recréer. Quand tout ce qui était demandé est créé, tu réponds en texte et tu n'appelles plus AUCUN outil.

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

    // ── Rate limiting par utilisatrice (protection coût API Claude) ──────────
const rl = await rateLimit(db, user.id, 'agent')
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'too_many_requests', message: 'Trop de messages en peu de temps. Attends une minute. ✦' },
        { status: 429 }
      )
    }
    // ────────────────────────────────────────────────────────────────────────

    const { message, history, clientContext } = await request.json()
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message manquant' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Clé API manquante côté serveur.' }, { status: 500 })
    }

    const system = await buildSystemPrompt(db, user.id)

    // ── Date du jour (heure de Paris) injectée pour que Nova calcule les dates relatives ──
    const _now = new Date()
    const _paris = new Date(_now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const _pad = (n: number) => String(n).padStart(2, '0')
    const _jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const _mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    const _todayISO = `${_paris.getFullYear()}-${_pad(_paris.getMonth() + 1)}-${_pad(_paris.getDate())}`
    const _tomDate = new Date(_paris.getTime() + 86400000)
    const _tomISO = `${_tomDate.getFullYear()}-${_pad(_tomDate.getMonth() + 1)}-${_pad(_tomDate.getDate())}`
    const dateBlock = `## DATE DU JOUR (référence absolue pour tout calcul de date)\nAujourd'hui : ${_jours[_paris.getDay()]} ${_paris.getDate()} ${_mois[_paris.getMonth()]} ${_paris.getFullYear()} (ISO : ${_todayISO}).\n"Demain" = ${_tomISO}.\nQuand l'utilisatrice donne une date relative ("demain", "ce week-end", "lundi prochain", "dans 3 jours"), tu calcules TOUJOURS la date réelle à partir d'aujourd'hui (${_todayISO}) et tu la transmets aux outils au format AAAA-MM-JJ. N'invente JAMAIS une date d'une autre année que ${_paris.getFullYear()}, sauf si l'utilisatrice précise explicitement une autre année.`

    const baseSystem = `${dateBlock}\n\n${system}`

    const fullSystem =
      clientContext && typeof clientContext === 'string' && clientContext.trim()
        ? `${baseSystem}\n\n## CONTEXTE TEMPS RÉEL (données réelles de l'utilisatrice — sers-t'en pour répondre)\nIMPORTANT : ignore tout format « ACTION_JSON » mentionné dans ce contexte. Pour AGIR, tu utilises EXCLUSIVEMENT tes outils, et toujours après confirmation.\n\n${clientContext}`
        : baseSystem

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

    let iterations = 0
    let data: any
    while (true) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: fullSystem, tools: TOOLS, messages }),
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