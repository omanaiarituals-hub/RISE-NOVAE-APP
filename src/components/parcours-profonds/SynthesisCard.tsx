'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Engagement {
  acte: number
  texte: string
  statut: 'pending' | 'done'
  date_engagement: string
}

interface SynthesisData {
  mes_forces: string[] | null
  mes_valeurs: string[] | null
  mes_besoins_prioritaires: string[] | null
  mes_limites: string[] | null
  mes_engagements: Engagement[]
  updated_at: string
}

// Sections nouvellement remplies par acte
const NEW_SECTIONS_BY_ACT: Record<number, string[]> = {
  1: ['mes_forces', 'mes_besoins_prioritaires', 'mes_engagements'],
  2: ['mes_limites', 'mes_engagements'],
  3: ['mes_valeurs', 'mes_besoins_prioritaires', 'mes_engagements'],
  4: ['mes_limites', 'mes_engagements'],
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Section({
  emoji,
  title,
  items,
  emptyLabel,
  color,
  isNew,
}: {
  emoji: string
  title: string
  items: string[] | null
  emptyLabel: string
  color: string
  isNew: boolean
}) {
  const filled = items && items.filter(Boolean).length > 0

  return (
    <div className={`rounded-2xl p-5 transition-all ${color} ${isNew ? 'ring-2 ring-[#8FAE8E]' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#3a5a40] flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h3>
        {isNew && (
          <span className="text-[10px] font-semibold text-white bg-[#8FAE8E] rounded-full px-2 py-0.5">
            Nouveau
          </span>
        )}
      </div>
      {filled ? (
        <ul className="space-y-2">
          {items!.filter(Boolean).map((item, i) => (
            <li key={i} className="text-sm text-[#1A1A1A] leading-relaxed flex gap-2">
              <span className="text-[#3a5a40] mt-0.5 shrink-0">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#8a9e8c] italic">{emptyLabel}</p>
      )}
    </div>
  )
}

function EngagementsSection({
  engagements,
  isNew,
}: {
  engagements: Engagement[]
  isNew: boolean
}) {
  const filled = engagements && engagements.length > 0

  return (
    <div className={`rounded-2xl p-5 bg-[#e8f0ea] transition-all ${isNew ? 'ring-2 ring-[#8FAE8E]' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#3a5a40] flex items-center gap-2">
          <span>🌱</span>
          Mes engagements
        </h3>
        {isNew && (
          <span className="text-[10px] font-semibold text-white bg-[#8FAE8E] rounded-full px-2 py-0.5">
            Nouveau
          </span>
        )}
      </div>
      {filled ? (
        <div className="space-y-3">
          {engagements.map((eng, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span
                className={`mt-0.5 text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                  eng.statut === 'done'
                    ? 'bg-[#3a5a40] text-white'
                    : 'bg-white text-[#3a5a40] border border-[#3a5a40]'
                }`}
              >
                Acte {eng.acte}
              </span>
              <p className="text-sm text-[#1A1A1A] leading-relaxed">{eng.texte}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#8a9e8c] italic">
          Tes engagements apparaîtront après la clôture de chaque Acte.
        </p>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SynthesisCard({
  journeySlug,
  justCompletedAct,
}: {
  journeySlug: string
  justCompletedAct?: number
}) {
  const [data, setData] = useState<SynthesisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const newSections = justCompletedAct ? (NEW_SECTIONS_BY_ACT[justCompletedAct] ?? []) : []

  useEffect(() => {
    fetchSynthesis()
  }, [journeySlug])

  async function fetchSynthesis() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: journey, error: journeyError } = await supabase
        .from('deep_journeys')
        .select('id')
        .eq('slug', journeySlug)
        .single()

      if (journeyError || !journey) throw new Error('Parcours introuvable')

      const { data: synthesis, error: synthError } = await supabase
        .from('deep_journey_synthesis_card')
        .select('mes_forces, mes_valeurs, mes_besoins_prioritaires, mes_limites, mes_engagements, updated_at')
        .eq('user_id', user.id)
        .eq('journey_id', journey.id)
        .single()

      if (synthError && synthError.code !== 'PGRST116') throw synthError

      setData(synthesis ?? null)
    } catch (err) {
      console.error('SynthesisCard fetch error:', err)
      setError('Impossible de charger ta fiche de synthèse.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 border border-[#d4e6d5] space-y-4 animate-pulse">
        <div className="h-5 bg-[#e8f0ea] rounded w-1/2" />
        <div className="h-24 bg-[#e8f0ea] rounded-2xl" />
        <div className="h-24 bg-[#e8f0ea] rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-6 border border-red-100 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-3xl bg-white p-6 border border-[#d4e6d5] text-center">
        <p className="text-sm text-[#8a9e8c] italic">
          Ta fiche de synthèse sera générée à la clôture de ton premier Acte.
        </p>
      </div>
    )
  }

  const lastSync = new Date(data.updated_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="rounded-3xl bg-white border border-[#d4e6d5] overflow-hidden">
      <div className="bg-gradient-to-r from-[#d4e6d5] to-[#e8f0ea] px-6 py-5">
        <h2 className="text-base font-semibold text-[#3a5a40]">
          ✨ Ma fiche de synthèse
        </h2>
        <p className="text-xs text-[#5a7a5c] mt-0.5">
          Mise à jour le {lastSync} · En tes propres mots
        </p>
        {justCompletedAct && (
          <p className="text-xs text-[#3a5a40] font-medium mt-1.5">
            Les sections encadrées en vert ont été enrichies par cet Acte.
          </p>
        )}
      </div>

      <div className="p-5 space-y-4">
        <Section
          emoji="💎"
          title="Mes forces"
          items={data.mes_forces}
          emptyLabel="Tes forces apparaîtront après avoir complété les sections correspondantes de l'Acte 1."
          color="bg-[#f0f7f0]"
          isNew={newSections.includes('mes_forces')}
        />
        <Section
          emoji="🧭"
          title="Mes valeurs"
          items={data.mes_valeurs}
          emptyLabel="Tes valeurs seront révélées dans l'Acte 3, Réappropriation."
          color="bg-[#f5f0e8]"
          isNew={newSections.includes('mes_valeurs')}
        />
        <Section
          emoji="🌊"
          title="Mes besoins prioritaires"
          items={data.mes_besoins_prioritaires}
          emptyLabel="Tes besoins se préciseront au fil des Actes."
          color="bg-[#e8f0f7]"
          isNew={newSections.includes('mes_besoins_prioritaires')}
        />
        <Section
          emoji="🛡️"
          title="Mes limites"
          items={data.mes_limites}
          emptyLabel="Tes limites seront identifiées dans les Actes 2 et 4."
          color="bg-[#f7f0f5]"
          isNew={newSections.includes('mes_limites')}
        />
        <EngagementsSection
          engagements={data.mes_engagements ?? []}
          isNew={newSections.includes('mes_engagements')}
        />
      </div>

      <div className="px-6 pb-5">
        <p className="text-xs text-[#8a9e8c] text-center italic">
          Cette fiche est uniquement visible par toi. Elle s'enrichit à chaque Acte complété.
        </p>
      </div>
    </div>
  )
}