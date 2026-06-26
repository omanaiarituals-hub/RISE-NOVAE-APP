'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import Link from 'next/link'
import { DemoBanner } from '@/components/DemoBanner'

interface Profile {
  objectif: string
  bloqueurs: string
  etat_emotionnel: string
  temps_disponible: string
  motivation: string
  reaction_echec: string
  environnement_social: string
  domaine_prioritaire: string
  signal_succes: string
  ton_souhaite: string
  debrief: string
  completed_at: string
}

interface WeeklyDebrief {
  id: string
  week_number: number
  week_start: string
  debrief_text: string
  stats: any
  created_at: string
}

export default function ProfilPage() {
  const { user, loading } = useSupabaseAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'profil' | 'bilans'>('profil')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [debriefs, setDebriefs] = useState<WeeklyDebrief[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth')
    if (user) loadData()
  }, [user, loading])

  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'bilans' || t === 'profil') setTab(t as any)
    } catch {}
  }, [])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [profileRes, debriefsRes] = await Promise.all([
        supabase.from('ai_personality_profile').select('*').eq('user_id', user.id).single(),
        supabase.from('weekly_debriefs').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ])
      setProfile(profileRes.data)
      setDebriefs(debriefsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const regenerateDebrief = async () => {
    if (!profile || !user) return
    setRegenerating(true)
    try {
      const prompt = `Tu es une experte en psychologie positive et neurosciences. Analyse ce profil et génère un debrief personnalisé, chaleureux et inspirant en français.

PROFIL :
- Objectif : ${profile.objectif}
- Bloqueurs : ${profile.bloqueurs}
- État émotionnel : ${profile.etat_emotionnel}
- Temps disponible : ${profile.temps_disponible}
- Motivation : ${profile.motivation}
- Réaction échec : ${profile.reaction_echec}
- Environnement social : ${profile.environnement_social}
- Domaine prioritaire : ${profile.domaine_prioritaire}
- Vision succès 90j : ${profile.signal_succes}
- Ton souhaité : ${profile.ton_souhaite}

Génère un debrief en 4 parties :
1. **TON PROFIL** (2-3 phrases) : profil psychologique positif et précis
2. **TES FORCES CACHÉES** (2-3 phrases) : forces réelles avec explication neuroscientifique
3. **TON DÉFI PRINCIPAL** (2 phrases) : défi central avec stratégie concrète
4. **TON PROGRAMME PERSONNALISÉ** (3-4 phrases) : comment NOVAÉ adapte l'accompagnement sur 90j

Ton : ${profile.ton_souhaite}. Tutoie. Maximum 300 mots.`

      const { data: { session: chatSession } } = await supabase.auth.getSession()
      if (!chatSession?.access_token) {
        alert('Session expirée. Reconnecte-toi.')
        return
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${chatSession.access_token}`,
        },
        body: JSON.stringify({
          message: prompt,
          systemPrompt: 'Tu es une experte en psychologie positive, neurosciences et coaching de vie. Réponds en français, en tutoyant.'
        })
      })

      if (response.status === 403) {
        alert("La régénération de ton profil est réservée aux membres Premium.")
        return
      }

      const data = await response.json()
      const newDebrief = data.response || ''

      await supabase.from('ai_personality_profile')
        .update({ debrief: newDebrief, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      setProfile(prev => prev ? { ...prev, debrief: newDebrief } : prev)
    } catch (e) {
      console.error(e)
    } finally {
      setRegenerating(false)
    }
  }

  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
  }

  const QUESTIONS_LABELS: Record<string, string> = {
    objectif: '🎯 Objectif principal',
    bloqueurs: '🧱 Freins identifiés',
    etat_emotionnel: '💭 État émotionnel',
    temps_disponible: '⏰ Temps disponible',
    motivation: '✨ Motivation profonde',
    reaction_echec: '🔄 Face à l\'échec',
    environnement_social: '👥 Environnement social',
    domaine_prioritaire: '🗺️ Domaine prioritaire',
    signal_succes: '🏆 Vision du succès à 90j',
    ton_souhaite: '💬 Ton souhaité',
  }

  if (loading || isLoading) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center">
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 bg-novae-gold rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
        ))}
      </div>
    </div>
  )

  return (
    <>
      <DemoBanner />
      <div className="min-h-screen bg-novae-cream">

        {/* Header */}
        <div className="bg-white border-b border-novae-beige/30 px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-novae-anthracite/50 hover:text-novae-anthracite transition-colors text-sm flex items-center gap-1">
            ← Accueil
          </Link>
          <h1 className="font-serif text-xl text-novae-anthracite">Mon Profil NOVAÉ</h1>
        </div>

        {/* Tabs — 2 onglets seulement (Programmes supprimé) */}
        <div className="bg-white border-b border-novae-beige/20 px-6">
          <div className="flex gap-0 max-w-2xl">
            {[
              { id: 'profil', label: '✨ Mon Profil' },
              { id: 'bilans', label: `📊 Bilans (${debriefs.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-novae-gold text-novae-gold'
                    : 'border-transparent text-novae-anthracite/50 hover:text-novae-anthracite'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8">

          {/* ONGLET PROFIL */}
          {tab === 'profil' && (
            <div className="space-y-6">
              {/* Debrief IA */}
              <div className="bg-white rounded-2xl border border-novae-beige/20 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-novae-beige/20 flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-lg text-novae-anthracite">Ton analyse personnalisée</h2>
                    <p className="text-xs text-novae-anthracite/40 mt-0.5">Psychologie & Neurosciences · NOVAÉ IA</p>
                  </div>
                  <button
                    onClick={regenerateDebrief}
                    disabled={regenerating}
                    className="px-3 py-1.5 text-xs bg-novae-gold/10 border border-novae-gold/20 text-novae-gold rounded-lg hover:bg-novae-gold/20 transition-colors disabled:opacity-50"
                  >
                    {regenerating ? '...' : '🔄 Régénérer'}
                  </button>
                </div>
                <div className="px-6 py-5">
                  {profile?.debrief ? (
                    <div
                      className="text-sm text-novae-anthracite/80 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: '<p>' + formatText(profile.debrief) + '</p>' }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-novae-anthracite/40 text-sm mb-4">Aucun debrief généré</p>
                      <button
                        onClick={regenerateDebrief}
                        disabled={regenerating}
                        className="px-4 py-2 bg-novae-anthracite text-white rounded-xl text-sm hover:bg-novae-gold transition-colors"
                      >
                        {regenerating ? 'Génération...' : '✨ Générer mon analyse'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Réponses onboarding */}
              <div className="bg-white rounded-2xl border border-novae-beige/20 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-novae-beige/20 flex items-center justify-between">
                  <h2 className="font-serif text-lg text-novae-anthracite">Mes réponses</h2>
                  <Link href="/onboarding" className="text-xs text-novae-anthracite/40 hover:text-novae-gold transition-colors">
                    Modifier →
                  </Link>
                </div>
                <div className="divide-y divide-novae-beige/20">
                  {profile && Object.entries(QUESTIONS_LABELS).map(([key, label]) => (
                    <div key={key} className="px-6 py-4">
                      <p className="text-xs font-medium text-novae-anthracite/40 mb-1">{label}</p>
                      <p className="text-sm text-novae-anthracite leading-relaxed">
                        {profile[key as keyof Profile] || <span className="text-novae-anthracite/30 italic">Non renseigné</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ONGLET BILANS */}
          {tab === 'bilans' && (
            <div className="space-y-4">
              {debriefs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-novae-beige/20 p-12 text-center shadow-sm">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="font-serif text-xl text-novae-anthracite mb-2">Aucun bilan encore</h3>
                  <p className="text-sm text-novae-anthracite/50 max-w-sm mx-auto leading-relaxed">
                    Chaque dimanche, ton agent NOVAÉ génère automatiquement un bilan de ta semaine. Il apparaîtra ici.
                  </p>
                  <Link href="/agent" className="inline-block mt-6 px-4 py-2 bg-novae-anthracite text-white rounded-xl text-sm hover:bg-novae-gold transition-colors">
                    Demander un bilan maintenant →
                  </Link>
                </div>
              ) : (
                debriefs.map(debrief => (
                  <div key={debrief.id} className="bg-white rounded-2xl border border-novae-beige/20 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-novae-beige/20 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-novae-anthracite text-sm">
                          Semaine {debrief.week_number}
                        </h3>
                        <p className="text-xs text-novae-anthracite/40 mt-0.5">
                          {new Date(debrief.week_start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      {debrief.stats && (
                        <div className="flex gap-3">
                          {debrief.stats.routines_done !== undefined && (
                            <div className="text-center">
                              <div className="text-lg font-serif text-novae-gold">{debrief.stats.routines_done}</div>
                              <div className="text-xs text-novae-anthracite/40">routines</div>
                            </div>
                          )}
                          {debrief.stats.tasks_done !== undefined && (
                            <div className="text-center">
                              <div className="text-lg font-serif text-novae-gold">{debrief.stats.tasks_done}</div>
                              <div className="text-xs text-novae-anthracite/40">tâches</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="px-6 py-5">
                      <div
                        className="text-sm text-novae-anthracite/80 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: '<p>' + formatText(debrief.debrief_text) + '</p>' }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}