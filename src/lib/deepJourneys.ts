// lib/deepJourneys.ts
//
// Fonctions centralisees pour le module Parcours Profonds.
// Toute la logique d'acces a Supabase pour ce module passe par ici,
// pour que les pages restent simples et que le mode test soit gere
// a un seul endroit.

import { supabase } from '@/lib/supabase/client'

// ============================================================
// MODE TEST
// ============================================================
// Passe a false : le verrouillage sequentiel des Actes est actif.
// Un Acte N+1 n'est accessible en ECRITURE que si la derniere section
// de l'Acte N (is_act_closing=true) a une reponse non-draft enregistree.
// Les Actes deja valides restent TOUJOURS consultables en lecture/relecture,
// le verrouillage ne bloque que la PROGRESSION vers un nouvel Acte, jamais
// le retour en arriere.
export const TEST_MODE = false

// ============================================================
// TYPES
// ============================================================

export interface DeepJourney {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  acts_count: number
  diagnostic_fields: string[]
  reread_offsets_days: number[]
  free_acts_limit: number
  active: boolean
}

export interface DeepJourneyPrompt {
  id: string
  text?: string
  template?: string
  type?: string
  with_scale?: boolean
  scale_label?: string
  follow_up?: string[]
}

export interface DeepJourneySection {
  id: string
  order: number
  title: string
  subtitle?: string
  type: 'open_text' | 'synthesis' | 'fill_in_blank' | 'three_column_list' | 'energy_table' | 'habit_tracker'
  intro_text?: string
  prompts?: DeepJourneyPrompt[]
  is_act_closing?: boolean
  commitment_prompt?: string
  closing_quote?: string
  columns?: string[]
  table_columns?: string[]
  rows_count?: number
  habit_slots?: string[]
  habit_fields?: string[]
  tracking_duration_weeks?: number
}

export interface DeepJourneyAnchorTool {
  id: string
  title: string
  context_note?: string
  steps: string[]
}

export interface DeepJourneyAct {
  id: string
  journey_id: string
  act_number: number
  title: string
  intention: string | null
  sections: DeepJourneySection[]
  anchor_tool: DeepJourneyAnchorTool | null
  neuroscience_note: { title: string; text: string } | null
  intro_text_full: string | null
}

export interface DeepJourneyResponse {
  id: string
  section_id: string
  response: string | null
  is_draft: boolean
  updated_at: string
}

// ============================================================
// LECTURE
// ============================================================

export async function getJourneyBySlug(slug: string): Promise<DeepJourney | null> {
  const { data, error } = await supabase
    .from('deep_journeys')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error) {
    console.error('Erreur getJourneyBySlug:', error.message)
    return null
  }
  return data
}

export async function getActsForJourney(journeyId: string): Promise<DeepJourneyAct[]> {
  const { data, error } = await supabase
    .from('deep_journey_acts')
    .select('*')
    .eq('journey_id', journeyId)
    .order('act_number', { ascending: true })

  if (error) {
    console.error('Erreur getActsForJourney:', error.message)
    return []
  }
  return data || []
}

export async function getActByNumber(
  journeyId: string,
  actNumber: number
): Promise<DeepJourneyAct | null> {
  const { data, error } = await supabase
    .from('deep_journey_acts')
    .select('*')
    .eq('journey_id', journeyId)
    .eq('act_number', actNumber)
    .single()

  if (error) {
    console.error('Erreur getActByNumber:', error.message)
    return null
  }
  return data
}

export async function getUserProgress(userId: string, journeyId: string) {
  const { data, error } = await supabase
    .from('user_deep_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .maybeSingle()

  if (error) {
    console.error('Erreur getUserProgress:', error.message)
    return null
  }
  return data
}

export async function getResponsesForAct(
  userId: string,
  journeyId: string,
  actNumber: number
): Promise<Record<string, DeepJourneyResponse>> {
  const { data, error } = await supabase
    .from('deep_journey_responses')
    .select('*')
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .eq('act_number', actNumber)

  if (error) {
    console.error('Erreur getResponsesForAct:', error.message)
    return {}
  }

  const map: Record<string, DeepJourneyResponse> = {}
  for (const r of data || []) {
    map[r.section_id] = r
  }
  return map
}

// ============================================================
// ECRITURE
// ============================================================

export async function saveResponse(params: {
  userId: string
  journeyId: string
  actNumber: number
  sectionId: string
  response: string
  isDraft?: boolean
}): Promise<boolean> {
  const { userId, journeyId, actNumber, sectionId, response, isDraft = true } = params

  const { error } = await supabase
    .from('deep_journey_responses')
    .upsert(
      {
        user_id: userId,
        journey_id: journeyId,
        act_number: actNumber,
        section_id: sectionId,
        response,
        is_draft: isDraft,
        is_test_data: TEST_MODE,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,journey_id,section_id' }
    )

  if (error) {
    console.error('Erreur saveResponse:', error.message)
    return false
  }
  return true
}

export async function ensureUserJourneyStarted(
  userId: string,
  journeyId: string
): Promise<void> {
  const existing = await getUserProgress(userId, journeyId)
  if (existing) return

  const { error } = await supabase.from('user_deep_journeys').insert({
    user_id: userId,
    journey_id: journeyId,
    current_act: 1
  })

  if (error) {
    console.error('Erreur ensureUserJourneyStarted:', error.message)
  }
}

export async function saveCommitment(params: {
  userId: string
  journeyId: string
  actNumber: number
  commitmentText: string
  committedAt: string // format YYYY-MM-DD
}): Promise<boolean> {
  const { userId, journeyId, actNumber, commitmentText, committedAt } = params

  const { error } = await supabase.from('deep_journey_commitments').insert({
    user_id: userId,
    journey_id: journeyId,
    act_number: actNumber,
    commitment_text: commitmentText,
    committed_at: committedAt,
    status: 'pending'
  })

  if (error) {
    console.error('Erreur saveCommitment:', error.message)
    return false
  }
  return true
}

export async function closeActAndScheduleRereads(params: {
  userId: string
  journeyId: string
  actNumber: number
  rereadOffsetsDays: number[]
}): Promise<boolean> {
  const { userId, journeyId, actNumber, rereadOffsetsDays } = params

  // Avance current_act sur user_deep_journeys
  const { error: progressError } = await supabase
    .from('user_deep_journeys')
    .update({ current_act: actNumber + 1 })
    .eq('user_id', userId)
    .eq('journey_id', journeyId)

  if (progressError) {
    console.error('Erreur progression Acte:', progressError.message)
  }

  // Planifie les relectures (en mode test, on les cree mais on ne les envoie jamais
  // automatiquement, voir le worker cron qui doit ignorer is_test_data)
  const rows = rereadOffsetsDays.map(offset => {
    const scheduledFor = new Date()
    scheduledFor.setDate(scheduledFor.getDate() + offset)
    return {
      user_id: userId,
      journey_id: journeyId,
      reread_offset_days: offset,
      scheduled_for: scheduledFor.toISOString().split('T')[0]
    }
  })

  const { error: rereadError } = await supabase
    .from('deep_journey_reread_schedule')
    .insert(rows)

  if (rereadError) {
    console.error('Erreur planification relectures:', rereadError.message)
    return false
  }

  // Appel a la fonction Supabase qui regenere la fiche de synthese
  // et synchronise le profil NOVA (voir bloc-5-fiche-synthese-et-fonction.sql).
  // C'est ce qui alimente ai_personality_profile.deep_journey_insights,
  // lu plus bas par getNovaContextFromDeepJourneys().
  const { error: rpcError } = await supabase.rpc('refresh_deep_journey_synthesis', {
    p_user_id: userId,
    p_journey_id: journeyId
  })

  if (rpcError) {
    console.error('Erreur refresh_deep_journey_synthesis:', rpcError.message)
  }

  return true
}

export async function saveDiagnostic(params: {
  userId: string
  journeyId: string
  checkpointLabel: string // 'entree' | 'j7' | 'j30' | 'j90' | 'j180'
  scores: Record<string, number>
  priorityDomains?: string[]
  personalIntention?: string
}): Promise<boolean> {
  const { userId, journeyId, checkpointLabel, scores, priorityDomains, personalIntention } = params

  const { error } = await supabase.from('deep_journey_diagnostics').insert({
    user_id: userId,
    journey_id: journeyId,
    checkpoint_label: checkpointLabel,
    scores,
    priority_domains: priorityDomains || [],
    personal_intention: personalIntention || null
  })

  if (error) {
    console.error('Erreur saveDiagnostic:', error.message)
    return false
  }
  return true
}

// ============================================================
// VERROUILLAGE SEQUENTIEL DES ACTES
// ============================================================
//
// Regle : un Acte N+1 ne s'ouvre que si l'Acte N a ete valide
// (sa section is_act_closing=true a une reponse enregistree en non-draft).
// On garde TOUJOURS acces en relecture a tous les Actes deja valides,
// ainsi qu'a l'Acte courant.
//
// En TEST_MODE=true : tout est deverrouille, peu importe la progression,
// pour permettre de tout tester sans avoir a valider chaque Acte dans l'ordre.

export function isActUnlocked(actNumber: number, highestCompletedAct: number): boolean {
  if (TEST_MODE) return true
  if (actNumber === 1) return true
  return actNumber <= highestCompletedAct + 1
}

// Calcule le plus haut numero d'Acte valide pour un parcours donne,
// en verifiant qu'une reponse non-draft existe sur la section is_act_closing
// de chaque Acte. A utiliser sur la page liste des Actes ET en re-verification
// cote page de session (ne jamais faire confiance uniquement a l'UI).
export async function getHighestCompletedAct(
  userId: string,
  journeyId: string,
  acts: DeepJourneyAct[]
): Promise<number> {
  let highest = 0

  for (const act of acts) {
    const closingSection = act.sections.find(s => s.is_act_closing)
    if (!closingSection) continue

    const { data, error } = await supabase
      .from('deep_journey_responses')
      .select('is_draft')
      .eq('user_id', userId)
      .eq('journey_id', journeyId)
      .eq('section_id', closingSection.id)
      .eq('is_draft', false)
      .limit(1)

    if (!error && data && data.length > 0) {
      highest = Math.max(highest, act.act_number)
    }
  }

  return highest
}

// ============================================================
// CONTEXTE POUR NOVA (coach conversationnel + débrief hebdomadaire)
// ============================================================
//
// Ces fonctions lisent ce que refresh_deep_journey_synthesis() a deja
// prepare dans ai_personality_profile.deep_journey_insights
// (voir bloc-5-fiche-synthese-et-fonction.sql). Aucune interpretation ici :
// on restitue uniquement ce que l'utilisatrice a elle-meme ecrit, deja
// agrege par theme (forces, valeurs, besoins, limites, engagements).

export interface DeepJourneyNovaContext {
  hasInsights: boolean
  journeySlug?: string
  forces?: string[]
  valeurs?: string[]
  besoinsPrioritaires?: string[]
  limites?: string[]
  engagements?: Array<{ acte: number; texte: string; date_engagement: string; statut: string }>
  lastSyncAt?: string
}

export async function getNovaContextFromDeepJourneys(
  userId: string
): Promise<DeepJourneyNovaContext> {
  const { data, error } = await supabase
    .from('ai_personality_profile')
    .select('deep_journey_insights, last_deep_journey_sync')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data || !data.deep_journey_insights) {
    return { hasInsights: false }
  }

  // Un seul parcours existe pour l'instant (reclaim-myself). Si plusieurs
  // parcours profonds existent un jour, on pourra agreger plusieurs slugs ici.
  const insightsByJourney = data.deep_journey_insights as Record<string, any>
  const slugs = Object.keys(insightsByJourney)
  if (slugs.length === 0) {
    return { hasInsights: false }
  }

  const slug = slugs[0]
  const insights = insightsByJourney[slug]

  return {
    hasInsights: true,
    journeySlug: slug,
    forces: insights.forces || [],
    valeurs: insights.valeurs || [],
    besoinsPrioritaires: insights.besoins_prioritaires || [],
    limites: insights.limites || [],
    engagements: insights.engagements || [],
    lastSyncAt: data.last_deep_journey_sync
  }
}

// Formate ce contexte en un bloc de texte pret a inserer dans le prompt
// systeme de NOVA (coach conversationnel, route app/api/coach) ou dans la
// generation du debrief hebdomadaire (route app/api/cron/weekly-debrief).
// Redige a la 3e personne factuelle, sans evaluation ni terme clinique.
export function formatNovaContextAsPromptBlock(context: DeepJourneyNovaContext): string {
  if (!context.hasInsights) return ''

  const lines: string[] = []
  lines.push(
    "Cette personne a aussi travaillé sur le parcours profond Reclaim Myself. Voici ce qu'elle a elle-même identifié, dans ses propres mots :"
  )

  if (context.forces?.length) {
    lines.push(`Forces qu'elle a nommées : ${context.forces.join(' / ')}`)
  }
  if (context.valeurs?.length) {
    lines.push(`Valeurs qu'elle a identifiées : ${context.valeurs.join(' / ')}`)
  }
  if (context.besoinsPrioritaires?.length) {
    lines.push(`Besoins prioritaires qu'elle a exprimés : ${context.besoinsPrioritaires.join(' / ')}`)
  }
  if (context.limites?.length) {
    lines.push(`Limites qu'elle a posées : ${context.limites.join(' / ')}`)
  }
  if (context.engagements?.length) {
    const engagementsTexte = context.engagements
      .map(e => `"${e.texte}" (${e.statut})`)
      .join(' ; ')
    lines.push(`Engagements pris : ${engagementsTexte}`)
  }

  lines.push(
    "Utilise ce contexte pour personnaliser tes réponses avec chaleur et continuité, en reprenant ses propres mots quand c'est pertinent. Ne transforme jamais ces informations en évaluation, diagnostic ou catégorisation psychologique. Réfère-t'y naturellement, comme une personne qui se souvient de ce qu'elle t'a confié, jamais comme une analyse clinique."
  )

  return lines.join('\n')
}

// ============================================================
// ETAT ACTUEL DU GATING ET DU CONTEXTE NOVA (a jour)
// ============================================================
//
// TEST_MODE = false : le verrouillage sequentiel est actif.
// - isActUnlocked() + getHighestCompletedAct() gerent le deverrouillage,
//   utilises a la fois dans la page liste des Actes ET dans la page de
//   session (double verification, jamais confiance uniquement en l'UI)
// - Un Acte deja valide reste TOUJOURS consultable en lecture/relecture
// - getNovaContextFromDeepJourneys() + formatNovaContextAsPromptBlock()
//   sont prets a etre branches dans app/api/coach/route.ts et
//   app/api/cron/weekly-debrief/route.ts (voir section CONTEXTE POUR NOVA
//   plus haut dans ce fichier)
//
// Reste a activer separement, pas encore fait dans ce fichier :
// 1. Le gating Free/Premium (free_acts_limit du journey) sur les Actes 2 a 4
// 2. L'envoi reel des notifications de relecture dans le cron
//    (les lignes sont creees dans deep_journey_reread_schedule mais
//    aucun envoi n'est encore branche)
// 3. Si tu veux pouvoir rouvrir un mode test ponctuel sans toucher au code,
//    remplacer la constante TEST_MODE par une vraie lecture d'un champ
//    is_internal_tester sur le profil utilisateur