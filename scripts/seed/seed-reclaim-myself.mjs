/**
 * scripts/seed/seed-reclaim-myself.mjs
 *
 * Importe le parcours "Reclaim Myself" dans Supabase :
 * - 1 ligne dans deep_journeys (catalogue)
 * - 4 lignes dans deep_journey_acts (un par Acte, avec sections + anchor_tool en jsonb)
 *
 * Usage :
 *   node scripts/seed/seed-reclaim-myself.mjs
 *
 * Prerequis :
 * - Avoir cree les tables deep_journeys et deep_journey_acts au prealable
 *   (migrations de la spec initiale, pas dans ce script)
 * - Variables d'environnement presentes dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (jamais le anon key ici, on a besoin de bypasser RLS pour le seed)
 *
 * Ce script est idempotent : relancer plusieurs fois ne cree pas de doublons,
 * il met a jour si le slug / journey_id + act_number existent deja (upsert).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'

// Charge .env.local depuis la racine du projet
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Variables manquantes : verifie NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

function loadJson(filename) {
  const filePath = path.resolve(__dirname, filename)
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

async function seedCatalogue() {
  console.log('-- Insertion catalogue deep_journeys --')
  const data = loadJson('01-catalogue-deep-journeys.json')
  const journey = data.deep_journeys[0]

  const { data: inserted, error } = await supabase
    .from('deep_journeys')
    .upsert({
      slug: journey.slug,
      title: journey.title,
      subtitle: journey.subtitle,
      description: journey.description,
      acts_count: journey.acts_count,
      diagnostic_fields: journey.diagnostic_fields,
      reread_offsets_days: journey.reread_offsets_days,
      free_acts_limit: journey.free_acts_limit,
      active: journey.active,
      sort_order: journey.sort_order
    }, { onConflict: 'slug' })
    .select()
    .single()

  if (error) {
    console.error('Erreur insertion catalogue :', error.message)
    process.exit(1)
  }

  console.log(`OK : journey "${inserted.slug}" -> id ${inserted.id}`)
  return inserted.id
}

async function seedAct(journeyId, filename) {
  const data = loadJson(filename)
  console.log(`-- Insertion Acte ${data.act_number} : ${data.title} --`)

  const payload = {
    journey_id: journeyId,
    act_number: data.act_number,
    title: data.title,
    intention: data.intention,
    sections: data.sections,
    synthesis_prompts: data.sections.filter(s => s.is_act_closing === true),
    engagements_count: 3
  }

  // anchor_tool et autres metadonnees riches sont stockes dans sections en jsonb,
  // on les rattache aussi a la racine si la colonne existe (sinon ignore silencieusement)
  if (data.anchor_tool) {
    payload.anchor_tool = data.anchor_tool
  }
  if (data.neuroscience_note) {
    payload.neuroscience_note = data.neuroscience_note
  }
  if (data.intro_text_full) {
    payload.intro_text_full = data.intro_text_full
  }

  const { data: inserted, error } = await supabase
    .from('deep_journey_acts')
    .upsert(payload, { onConflict: 'journey_id,act_number' })
    .select()
    .single()

  if (error) {
    console.error(`Erreur insertion Acte ${data.act_number} :`, error.message)
    console.error('Astuce : si l\'erreur mentionne une colonne inconnue (anchor_tool, neuroscience_note, intro_text_full),')
    console.error('ajoute-la a la table avec : ALTER TABLE deep_journey_acts ADD COLUMN IF NOT EXISTS anchor_tool jsonb;')
    console.error('(idem pour neuroscience_note jsonb et intro_text_full text)')
    process.exit(1)
  }

  console.log(`OK : Acte ${inserted.act_number} "${inserted.title}" -> id ${inserted.id}`)
}

async function main() {
  console.log('=== Seed Reclaim Myself ===\n')

  const journeyId = await seedCatalogue()

  await seedAct(journeyId, '02-acte-1-le-degel.json')
  await seedAct(journeyId, '03-acte-2-desencombrement.json')
  await seedAct(journeyId, '04-acte-3-reappropriation.json')
  await seedAct(journeyId, '05-acte-4-realignement.json')

  console.log('\n=== Termine. 1 journey + 4 actes inseres/mis a jour. ===')
  console.log('Le fichier 06-protocole-global-et-config-modes.json n\'est pas insere automatiquement :')
  console.log('c\'est un document de reference pour le code (protocole transversal + regles test/prod),')
  console.log('pas une ligne de table. Garde-le dans scripts/seed/ pour t\'y referer.')
}

main().catch(err => {
  console.error('Erreur inattendue :', err)
  process.exit(1)
})