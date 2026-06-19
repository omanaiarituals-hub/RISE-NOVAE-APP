// app/parcours-profonds/reclaim-myself/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  getJourneyBySlug,
  getActsForJourney,
  ensureUserJourneyStarted,
  getHighestCompletedAct,
  isActUnlocked,
  TEST_MODE,
  type DeepJourney,
  type DeepJourneyAct
} from '@/lib/deepJourneys'
import PharmacyWidget from '@/components/parcours-profonds/PharmacyWidget'
import SynthesisCard from '@/components/parcours-profonds/SynthesisCard'

export default function ReclaimMyselfHomePage() {
  const [journey, setJourney] = useState<DeepJourney | null>(null)
  const [acts, setActs] = useState<DeepJourneyAct[]>([])
  const [highestCompletedAct, setHighestCompletedAct] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Connecte-toi pour accéder à ce parcours.')
        setLoading(false)
        return
      }

      const journeyData = await getJourneyBySlug('reclaim-myself')
      if (!journeyData) {
        setError('Ce parcours n\'est pas disponible pour le moment.')
        setLoading(false)
        return
      }
      setJourney(journeyData)

      const actsData = await getActsForJourney(journeyData.id)
      setActs(actsData)

      await ensureUserJourneyStarted(user.id, journeyData.id)

      const highest = await getHighestCompletedAct(user.id, journeyData.id, actsData)
      setHighestCompletedAct(highest)
    } catch (err) {
      console.error(err)
      setError('Une erreur est survenue. Réessaie dans un instant.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-[#6B6B66] text-sm">Préparation de ton espace...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B6B66] text-sm mb-4">{error}</p>
        <Link href="/" className="text-[#5C7A66] text-sm underline">
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  function isOpen(actNumber: number): boolean {
    return isActUnlocked(actNumber, highestCompletedAct)
  }

  return (
    <div className="min-h-screen bg-cream pb-24">
      <div
        className="px-6 pt-9 pb-8 rounded-b-[28px]"
        style={{ background: 'linear-gradient(160deg, #BFD6BE 0%, #A9C7A6 100%)' }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#355640] mb-4"
        >
          <span aria-hidden="true">←</span> Accueil
        </Link>

        <p className="text-[11px] uppercase tracking-widest text-[#4D7257] font-semibold mb-2">
          Parcours profond
        </p>
        <h1 className="text-[28px] leading-tight font-medium text-[#2F4D38] mb-3" style={{ fontFamily: 'Georgia, serif' }}>
          {journey?.title}
        </h1>
        <p className="text-sm text-[#355640]">{journey?.subtitle}</p>

        {TEST_MODE && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/40 rounded-full px-3 py-1.5 text-[11px] text-[#355640]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9B98C]" />
            Mode test interne — tous les Actes sont déverrouillés
          </div>
        )}
      </div>

      <div className="px-5 pt-6 space-y-3">
        {acts.map(act => {
          const open = isOpen(act.act_number)
          const validated = act.act_number <= highestCompletedAct
          return (
            <Link
              key={act.id}
              href={open ? `/parcours-profonds/reclaim-myself/acte/${act.act_number}` : '#'}
              className={`block rounded-2xl border p-5 transition ${
                open
                  ? 'bg-[#F6F3EC] border-[rgba(127,160,134,0.18)] active:scale-[0.99]'
                  : 'bg-[#F6F3EC]/50 border-[rgba(127,160,134,0.1)] pointer-events-none'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                    validated
                      ? 'bg-[#B8D2B5] text-[#2F4D38]'
                      : open
                      ? 'bg-[#EAF1E8] text-[#2F4D38]'
                      : 'bg-[#EFEFEA] text-[#A8A8A2]'
                  }`}
                >
                  {validated ? '✓' : act.act_number}
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-[#3A3A36] mb-0.5">
                    Acte {act.act_number} · {act.title}
                  </p>
                  {act.intention && (
                    <p className="text-[13px] text-[#6B6B66] leading-relaxed">{act.intention}</p>
                  )}
                  {validated && (
                    <p className="text-[11px] text-[#5C7A66] mt-2">
                      Validé · tu peux le relire à tout moment
                    </p>
                  )}
                  {!open && (
                    <p className="text-[11px] text-[#A8A8A2] mt-2">
                      Termine l'Acte précédent pour débloquer
                    </p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Fiche de synthèse — visible dès qu'un Acte est complété */}
      {highestCompletedAct > 0 && (
        <div className="px-5 mt-8">
          <p className="text-[11px] uppercase tracking-widest text-[#7FA086] font-semibold mb-3 px-1">
            Ma fiche personnelle
          </p>
          <SynthesisCard journeySlug="reclaim-myself" />
        </div>
      )}

      <div className="px-5 mt-6">
        <p className="text-[12px] text-[#9A9A94] text-center leading-relaxed">
          Ce parcours n'a pas de deadline. Avance à ton rythme, dans l'ordre que tu veux.
        </p>
      </div>

      <PharmacyWidget />
    </div>
  )
}