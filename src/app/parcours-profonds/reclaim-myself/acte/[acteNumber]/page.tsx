// app/parcours-profonds/reclaim-myself/acte/[acteNumber]/page.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  getJourneyBySlug,
  getActByNumber,
  getActsForJourney,
  getResponsesForAct,
  saveResponse,
  saveCommitment,
  closeActAndScheduleRereads,
  getHighestCompletedAct,
  isActUnlocked,
  type DeepJourney,
  type DeepJourneyAct,
  type DeepJourneyResponse
} from '@/lib/deepJourneys'
import AnchorToolModal from '@/components/parcours-profonds/AnchorToolModal'
import PharmacyWidget from '@/components/parcours-profonds/PharmacyWidget'
import FillInBlankPrompt from '@/components/parcours-profonds/FillInBlankPrompt'
import ThreeColumnList from '@/components/parcours-profonds/ThreeColumnList'
import EnergyTable from '@/components/parcours-profonds/EnergyTable'
import HabitTracker from '@/components/parcours-profonds/HabitTracker'
import SynthesisCard from '@/components/parcours-profonds/SynthesisCard'

export default function ActeSessionPage() {
  const params = useParams()
  const router = useRouter()
  const acteNumber = Number(params.acteNumber)

  const [userId, setUserId] = useState<string | null>(null)
  const [journey, setJourney] = useState<DeepJourney | null>(null)
  const [act, setAct] = useState<DeepJourneyAct | null>(null)
  const [responses, setResponses] = useState<Record<string, DeepJourneyResponse>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAnchorTool, setShowAnchorTool] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showClosingFlow, setShowClosingFlow] = useState(false)
  const [commitmentText, setCommitmentText] = useState('')
  // Nouvel état : afficher la fiche de synthèse après clôture
  const [showSynthesis, setShowSynthesis] = useState(false)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acteNumber])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Connecte-toi pour accéder à ce parcours.')
        setLoading(false)
        return
      }
      setUserId(user.id)

      const journeyData = await getJourneyBySlug('reclaim-myself')
      if (!journeyData) {
        setError('Ce parcours n\'est pas disponible pour le moment.')
        setLoading(false)
        return
      }
      setJourney(journeyData)

      const actData = await getActByNumber(journeyData.id, acteNumber)
      if (!actData) {
        setError('Cet Acte n\'a pas été trouvé.')
        setLoading(false)
        return
      }

      const allActs = await getActsForJourney(journeyData.id)
      const highest = await getHighestCompletedAct(user.id, journeyData.id, allActs)
      if (!isActUnlocked(acteNumber, highest)) {
        router.push('/parcours-profonds/reclaim-myself')
        return
      }

      setAct(actData)

      const existingResponses = await getResponsesForAct(user.id, journeyData.id, acteNumber)
      setResponses(existingResponses)

      const initialAnswers: Record<string, string> = {}
      for (const [sectionId, resp] of Object.entries(existingResponses)) {
        if (resp.response) initialAnswers[sectionId] = resp.response
      }
      setAnswers(initialAnswers)
    } catch (err) {
      console.error(err)
      setError('Une erreur est survenue. Réessaie dans un instant.')
    } finally {
      setLoading(false)
    }
  }

  const debouncedSave = useCallback(
    (sectionId: string, value: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      setSaveStatus('saving')
      saveTimeoutRef.current = setTimeout(async () => {
        if (!userId || !journey) return
        const currentJourney = journey
        const ok = await saveResponse({
          userId,
          journeyId: currentJourney.id,
          actNumber: acteNumber,
          sectionId,
          response: value,
          isDraft: true
        })
        setSaveStatus(ok ? 'saved' : 'idle')
      }, 1200)
    },
    [userId, journey, acteNumber]
  )

  function handleAnswerChange(sectionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [sectionId]: value }))
    debouncedSave(sectionId, value)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-[#6B6B66] text-sm">Ouverture de ton espace d'écriture...</p>
      </div>
    )
  }

  if (error || !act || !journey) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B6B66] text-sm mb-4">{error || 'Acte introuvable.'}</p>
        <Link href="/parcours-profonds/reclaim-myself" className="text-[#5C7A66] text-sm underline">
          Retour au parcours
        </Link>
      </div>
    )
  }

  const sections = [...act.sections].sort((a, b) => a.order - b.order)
  const currentSection = sections[currentSectionIndex]
  const isLastSection = currentSectionIndex === sections.length - 1
  const isClosingSection = currentSection?.is_act_closing === true

  async function handleNext() {
    if (isClosingSection && !showClosingFlow) {
      setShowClosingFlow(true)
      return
    }

    if (isLastSection) {
      if (!userId || !journey) return
      const currentJourney = journey

      if (commitmentText.trim()) {
        await saveCommitment({
          userId,
          journeyId: currentJourney.id,
          actNumber: acteNumber,
          commitmentText: commitmentText.trim(),
          committedAt: new Date().toISOString().split('T')[0]
        })
      }

      await saveResponse({
        userId,
        journeyId: currentJourney.id,
        actNumber: acteNumber,
        sectionId: currentSection.id,
        response: answers[currentSection.id] || '',
        isDraft: false
      })

      await closeActAndScheduleRereads({
        userId,
        journeyId: currentJourney.id,
        actNumber: acteNumber,
        rereadOffsetsDays: currentJourney.reread_offsets_days
      })

      // Afficher la fiche de synthèse au lieu de rediriger immédiatement
      setShowSynthesis(true)
      return
    }

    setCurrentSectionIndex(i => i + 1)
    setShowClosingFlow(false)
  }

  function handlePrevious() {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(i => i - 1)
      setShowClosingFlow(false)
    }
  }

  // ─── Écran de révélation de la fiche après clôture ───────────────────────

  if (showSynthesis) {
    return (
      <div className="min-h-screen bg-cream pb-28">
        {/* En-tête de célébration */}
        <div
          className="px-6 pt-10 pb-8 rounded-b-[28px] text-center"
          style={{ background: 'linear-gradient(160deg, #BFD6BE 0%, #A9C7A6 100%)' }}
        >
          <div className="text-4xl mb-3">🌿</div>
          <h1
            className="text-[24px] font-medium text-[#2F4D38] mb-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Acte {acteNumber} complété
          </h1>
          <p className="text-sm text-[#355640]">
            Voici ce que cet Acte a révélé sur toi.
          </p>
        </div>

        {/* Fiche de synthèse avec highlight de cet Acte */}
        <div className="px-5 pt-6">
          <SynthesisCard
            journeySlug="reclaim-myself"
            justCompletedAct={acteNumber}
          />
        </div>

        {/* Bouton de retour au parcours */}
        <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-sm border-t border-[rgba(127,160,134,0.12)] px-5 py-4 z-30">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => router.push('/parcours-profonds/reclaim-myself')}
              className="w-full py-3.5 rounded-xl bg-[#8FAE8E] text-white text-[14.5px] font-medium"
            >
              Retour au parcours
            </button>
          </div>
        </div>

        <PharmacyWidget />
      </div>
    )
  }

  // ─── Écran de session normal ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream pb-28">
      {/* Header avec progression */}
      <div className="px-5 pt-6 pb-4 sticky top-0 bg-cream/95 backdrop-blur-sm z-30 border-b border-[rgba(127,160,134,0.12)]">
        <div className="flex items-center justify-between mb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] text-[#9A9A94]"
          >
            <span aria-hidden="true">←</span> Accueil
          </Link>
        </div>
        <div className="flex items-center justify-between mb-3">
          <Link
            href="/parcours-profonds/reclaim-myself"
            className="text-[13px] text-[#5C7A66]"
          >
            ← Acte {acteNumber}
          </Link>
          <span className="text-[12px] text-[#9A9A94]">
            {currentSectionIndex + 1} / {sections.length}
          </span>
        </div>
        <div className="h-1 bg-[#E3EAE1] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8FAE8E] rounded-full transition-all duration-300"
            style={{ width: `${((currentSectionIndex + 1) / sections.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Contenu de la section */}
      <div className="px-5 pt-6">
        <h2
          className="text-[21px] font-medium text-[#2F4D38] mb-1"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {currentSection.title}
        </h2>
        {currentSection.subtitle && (
          <p className="text-sm text-[#6B6B66] mb-3">{currentSection.subtitle}</p>
        )}
        {currentSection.intro_text && (
          <p className="text-sm text-[#6B6B66] leading-relaxed mb-5 italic">
            {currentSection.intro_text}
          </p>
        )}

        {!showClosingFlow && (
          <div className="space-y-6">
            {currentSection.type === 'open_text' && currentSection.prompts?.map(prompt => (
              <div key={prompt.id}>
                <label className="block text-[14.5px] text-[#3A3A36] mb-2 leading-relaxed">
                  {prompt.text || prompt.template}
                </label>
                <textarea
                  value={answers[prompt.id] || ''}
                  onChange={e => handleAnswerChange(prompt.id, e.target.value)}
                  placeholder="Écris ici, sans te relire..."
                  className="w-full min-h-[110px] rounded-2xl border border-[rgba(127,160,134,0.25)] bg-white/60 p-4 text-[14.5px] text-[#3A3A36] placeholder:text-[#B8B8B2] focus:outline-none focus:ring-2 focus:ring-[#8FAE8E]/40 resize-none"
                />
              </div>
            ))}

            {currentSection.type === 'fill_in_blank' && currentSection.prompts?.[0] && (
              <FillInBlankPrompt
                template={currentSection.prompts[0].template || ''}
                value={answers[currentSection.id] || ''}
                onChange={val => handleAnswerChange(currentSection.id, val)}
              />
            )}

            {currentSection.type === 'three_column_list' && (
              <ThreeColumnList
                columns={currentSection.columns || []}
                value={answers[currentSection.id] || ''}
                onChange={val => handleAnswerChange(currentSection.id, val)}
              />
            )}

            {currentSection.type === 'energy_table' && (
              <EnergyTable
                columns={currentSection.table_columns || []}
                rowsCount={currentSection.rows_count || 10}
                value={answers[currentSection.id] || ''}
                onChange={val => handleAnswerChange(currentSection.id, val)}
              />
            )}

            {currentSection.type === 'habit_tracker' && (
              <HabitTracker
                slots={currentSection.habit_slots || []}
                fields={currentSection.habit_fields || []}
                durationWeeks={currentSection.tracking_duration_weeks || 3}
                value={answers[currentSection.id] || ''}
                onChange={val => handleAnswerChange(currentSection.id, val)}
              />
            )}

            {currentSection.type === 'synthesis' && currentSection.prompts?.map(prompt => (
              <div key={prompt.id}>
                <label className="block text-[14.5px] text-[#3A3A36] mb-2 leading-relaxed">
                  {prompt.text || prompt.template}
                </label>
                <textarea
                  value={answers[prompt.id] || ''}
                  onChange={e => handleAnswerChange(prompt.id, e.target.value)}
                  placeholder="Écris ici, sans te relire..."
                  className="w-full min-h-[110px] rounded-2xl border border-[rgba(127,160,134,0.25)] bg-white/60 p-4 text-[14.5px] text-[#3A3A36] placeholder:text-[#B8B8B2] focus:outline-none focus:ring-2 focus:ring-[#8FAE8E]/40 resize-none"
                />
              </div>
            ))}
          </div>
        )}

        {/* Écran de clôture d'Acte */}
        {showClosingFlow && (
          <div className="space-y-6">
            {currentSection.commitment_prompt && (
              <div>
                <p className="text-[14.5px] text-[#3A3A36] mb-2 leading-relaxed font-medium">
                  {currentSection.commitment_prompt}
                </p>
                <textarea
                  value={commitmentText}
                  onChange={e => setCommitmentText(e.target.value)}
                  placeholder="Mon engagement..."
                  className="w-full min-h-[90px] rounded-2xl border border-[rgba(127,160,134,0.25)] bg-white/60 p-4 text-[14.5px] text-[#3A3A36] placeholder:text-[#B8B8B2] focus:outline-none focus:ring-2 focus:ring-[#8FAE8E]/40 resize-none"
                />
              </div>
            )}

            {currentSection.closing_quote && (
              <div
                className="rounded-2xl p-5"
                style={{ background: 'linear-gradient(135deg, #C7DCC5 0%, #B8D2B5 100%)' }}
              >
                <span className="block text-[32px] leading-none text-[#8E6F45] mb-1">"</span>
                <p className="text-[15px] italic text-[#2F4D38] leading-relaxed">
                  {currentSection.closing_quote}
                </p>
              </div>
            )}

            <p className="text-[12px] text-[#9A9A94] text-center">
              {journey && journey.reread_offsets_days.length > 0 && (
                <>Tu reviendras sur cette page dans {journey.reread_offsets_days[0]} jours, sans pression.</>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Barre d'actions fixe en bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-sm border-t border-[rgba(127,160,134,0.12)] px-5 py-4 z-30">
        <div className="flex items-center justify-between mb-2 max-w-md mx-auto">
          <button
            onClick={() => setShowAnchorTool(true)}
            disabled={!act.anchor_tool}
            className="text-[12px] text-[#7FA086] underline disabled:opacity-0"
          >
            Besoin d'une pause guidée ?
          </button>
          <span className="text-[11px] text-[#B8B8B2]">
            {saveStatus === 'saving' && 'Sauvegarde...'}
            {saveStatus === 'saved' && 'Sauvegardé'}
          </span>
        </div>

        <div className="flex gap-3 max-w-md mx-auto">
          {currentSectionIndex > 0 && !showClosingFlow && (
            <button
              onClick={handlePrevious}
              className="flex-1 py-3.5 rounded-xl border border-[#C3D6C2] text-[#4D7257] text-[14.5px] font-medium"
            >
              Précédent
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3.5 rounded-xl bg-[#8FAE8E] text-white text-[14.5px] font-medium"
          >
            {isLastSection && showClosingFlow
              ? 'Voir ma fiche de synthèse'
              : isClosingSection && !showClosingFlow
              ? 'Voir ma synthèse'
              : 'Continuer'}
          </button>
        </div>
      </div>

      {showAnchorTool && act.anchor_tool && (
        <AnchorToolModal tool={act.anchor_tool} onClose={() => setShowAnchorTool(false)} />
      )}

      <PharmacyWidget />
    </div>
  )
}