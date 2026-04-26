'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface OnboardingAnswers {
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
}

const QUESTIONS = [
  {
    id: 'objectif',
    numero: 1,
    emoji: '🎯',
    question: 'Quel est ton objectif principal en rejoignant NOVAÉ ?',
    sous_titre: 'Sois précise — plus c\'est concret, plus NOVAÉ peut t\'aider.',
    type: 'textarea',
    placeholder: 'Ex: Reprendre le contrôle de mon quotidien, lancer mon projet, retrouver de l\'énergie...',
    insight: 'Psychologie des objectifs',
  },
  {
    id: 'bloqueurs',
    numero: 2,
    emoji: '🧱',
    question: 'Qu\'est-ce qui t\'a bloquée jusqu\'ici dans tes transformations ?',
    sous_titre: 'Identifier les freins, c\'est déjà 50% du chemin.',
    type: 'choix_multiple',
    options: [
      'Le manque de temps',
      'La procrastination',
      'Le manque de motivation',
      'La peur d\'échouer',
      'L\'isolement / manque de soutien',
      'Trop de choses à gérer en même temps',
      'Je ne sais pas par où commencer',
      'Les imprévus de la vie de famille',
    ],
    insight: 'Neuroscience des habitudes',
  },
  {
    id: 'etat_emotionnel',
    numero: 3,
    emoji: '💭',
    question: 'Comment tu te sens émotionnellement en ce moment ?',
    sous_titre: 'Honnêteté totale — NOVAÉ adapte son accompagnement à ton état réel.',
    type: 'choix_unique',
    options: [
      '🔥 Motivée et prête à tout',
      '😌 Stable, je cherche juste à m\'améliorer',
      '😔 Fatiguée, j\'ai besoin de douceur',
      '🌀 Perdue, j\'ai besoin de clarté',
      '💪 Après une période difficile, je me relève',
      '⚡ Sous pression, beaucoup de stress',
    ],
    insight: 'Intelligence émotionnelle',
  },
  {
    id: 'temps_disponible',
    numero: 4,
    emoji: '⏰',
    question: 'Combien de temps peux-tu consacrer à toi chaque jour ?',
    sous_titre: 'Sois réaliste. NOVAÉ s\'adapte à ta vie, pas l\'inverse.',
    type: 'choix_unique',
    options: [
      '⚡ 5 à 15 minutes (mode ultra-rapide)',
      '🌱 15 à 30 minutes (mode équilibré)',
      '✨ 30 à 60 minutes (mode transformation)',
      '🚀 Plus d\'1 heure (mode immersion)',
    ],
    insight: 'Optimisation cognitive',
  },
  {
    id: 'motivation',
    numero: 5,
    emoji: '✨',
    question: 'Qu\'est-ce qui te motive le plus profondément ?',
    sous_titre: 'Ta motivation intrinsèque est le moteur de ta transformation.',
    type: 'choix_unique',
    options: [
      '👨‍👩‍👧 Être un modèle pour ma famille',
      '💼 Réussir professionnellement',
      '💚 Prendre soin de ma santé',
      '🌟 Devenir la meilleure version de moi-même',
      '🕊️ Trouver la paix intérieure',
      '💰 Atteindre la liberté financière',
      '🎨 Exprimer ma créativité',
    ],
    insight: 'Théorie de l\'autodétermination',
  },
  {
    id: 'reaction_echec',
    numero: 6,
    emoji: '🔄',
    question: 'Comment tu réagis face à l\'échec ou un mauvais jour ?',
    sous_titre: 'Ta résilience détermine ton style d\'accompagnement optimal.',
    type: 'choix_unique',
    options: [
      '🌊 Je me décourage facilement, j\'ai besoin de soutien',
      '⚖️ Je prends du recul et je réajuste',
      '🔥 Ça me motive encore plus',
      '🤷 J\'accepte et je passe à autre chose',
      '📊 J\'analyse ce qui n\'a pas marché',
    ],
    insight: 'Psychologie de la résilience',
  },
  {
    id: 'environnement_social',
    numero: 7,
    emoji: '👥',
    question: 'Ton entourage soutient-il tes projets de transformation ?',
    sous_titre: 'L\'environnement social influence directement nos comportements.',
    type: 'choix_unique',
    options: [
      '💚 Oui, j\'ai un cercle très soutenant',
      '🟡 Mitigé — certains oui, d\'autres moins',
      '🔴 Non, je dois avancer seule',
      '🌱 Je préfère garder ma transformation pour moi',
    ],
    insight: 'Neuroscience sociale',
  },
  {
    id: 'domaine_prioritaire',
    numero: 8,
    emoji: '🗺️',
    question: 'Quel domaine de vie est ta priorité numéro 1 ?',
    sous_titre: 'NOVAÉ concentre son énergie là où c\'est le plus important pour toi.',
    type: 'choix_unique',
    options: [
      '💚 Santé & Bien-être physique',
      '🧘 Équilibre mental & émotionnel',
      '💼 Carrière & Projet professionnel',
      '💰 Finances & Abondance',
      '👨‍👩‍👧 Famille & Relations',
      '🎯 Développement personnel',
      '🌍 Impact & Sens de vie',
    ],
    insight: 'Roue de la vie',
  },
  {
    id: 'signal_succes',
    numero: 9,
    emoji: '🏆',
    question: 'Dans 90 jours, quel signe concret te dirait que tu as réussi ?',
    sous_titre: 'Visualiser le succès active les mêmes circuits neuronaux que le vivre.',
    type: 'textarea',
    placeholder: 'Ex: Je me lève sans alarme, j\'ai lancé mon projet, je dors bien, je me sens légère...',
    insight: 'Visualisation & neurosciences',
  },
  {
    id: 'ton_souhaite',
    numero: 10,
    emoji: '💬',
    question: 'Quel ton tu veux que NOVAÉ adopte avec toi ?',
    sous_titre: 'Ton agent IA parle ta langue pour t\'accompagner au mieux.',
    type: 'choix_unique',
    options: [
      '🤝 Bienveillant et doux — j\'ai besoin de douceur',
      '🎯 Direct et efficace — va droit au but',
      '🔥 Challenger — pousse-moi à mes limites',
      '🧘 Coach holistique — corps, esprit, âme',
      '👩‍🔬 Basé sur la science — explique-moi le pourquoi',
    ],
    insight: 'Personnalisation de l\'accompagnement',
  },
]

export default function OnboardingPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const router = useRouter()
  const [step, setStep] = useState(0) // 0 = intro, 1-10 = questions, 11 = analyse, 12 = debrief
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({})
  const [currentAnswer, setCurrentAnswer] = useState<string | string[]>('')
  const [isLoading, setIsLoading] = useState(false)
  const [debrief, setDebrief] = useState('')
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    if (user) checkIfAlreadyDone()
  }, [user])

  const checkIfAlreadyDone = async () => {
    if (!user) return
    const { data } = await supabase
      .from('ai_personality_profile')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (data) setAlreadyDone(true)
  }

  const currentQ = QUESTIONS[step - 1]
  const progress = step === 0 ? 0 : (step / 10) * 100

  const handleAnswer = (value: string) => {
    if (currentQ?.type === 'choix_multiple') {
      const current = Array.isArray(currentAnswer) ? currentAnswer : []
      if (current.includes(value)) {
        setCurrentAnswer(current.filter(v => v !== value))
      } else if (current.length < 3) {
        setCurrentAnswer([...current, value])
      }
    } else {
      setCurrentAnswer(value)
    }
  }

  const handleNext = () => {
    if (!currentAnswer || (Array.isArray(currentAnswer) && currentAnswer.length === 0)) return

    const newAnswers = {
      ...answers,
      [currentQ.id]: Array.isArray(currentAnswer) ? currentAnswer.join(', ') : currentAnswer
    }
    setAnswers(newAnswers)
    setCurrentAnswer('')

    if (step === 10) {
      generateDebrief(newAnswers as OnboardingAnswers)
    } else {
      setStep(step + 1)
    }
  }

  const generateDebrief = async (finalAnswers: OnboardingAnswers) => {
    setStep(11) // analyse en cours
    setIsLoading(true)

    try {
      // Sauvegarder en Supabase
     await supabase.from('ai_personality_profile').upsert({
  user_id: user?.id,
  ...finalAnswers,
  updated_at: new Date().toISOString()
})

      // Générer le debrief avec l'IA
      const prompt = `Tu es une experte en psychologie positive et neurosciences. Analyse ce profil et génère un debrief personnalisé, chaleureux et inspirant en français.

PROFIL DE L'UTILISATRICE :
- Objectif principal : ${finalAnswers.objectif}
- Bloqueurs identifiés : ${finalAnswers.bloqueurs}
- État émotionnel actuel : ${finalAnswers.etat_emotionnel}
- Temps disponible : ${finalAnswers.temps_disponible}
- Motivation profonde : ${finalAnswers.motivation}
- Réaction face à l'échec : ${finalAnswers.reaction_echec}
- Environnement social : ${finalAnswers.environnement_social}
- Domaine prioritaire : ${finalAnswers.domaine_prioritaire}
- Vision du succès dans 90j : ${finalAnswers.signal_succes}
- Ton souhaité : ${finalAnswers.ton_souhaite}

Génère un debrief en 4 parties :

1. **TON PROFIL** (2-3 phrases) : Décris son profil psychologique de manière positive et précise. Montre que tu l'as vraiment "vue".

2. **TES FORCES CACHÉES** (2-3 phrases) : Identifie 2-3 forces réelles basées sur ses réponses, avec une explication neuroscientifique courte et accessible.

3. **TON DÉFI PRINCIPAL** (2 phrases) : Nomme le défi central avec bienveillance, sans jugement. Propose une stratégie concrète.

4. **TON PROGRAMME PERSONNALISÉ** (3-4 phrases) : Explique comment NOVAÉ va adapter son accompagnement spécifiquement à elle sur 90 jours. Termine par une phrase d'invitation puissante à commencer.

Ton : ${finalAnswers.ton_souhaite}. Tutoie-la. Sois inspirante, précise, basée sur la psychologie réelle. Maximum 300 mots.`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          systemPrompt: 'Tu es une experte en psychologie positive, neurosciences et coaching de vie. Tu génères des analyses personnalisées précises, chaleureuses et scientifiquement fondées. Réponds toujours en français, en tutoyant.'
        })
      })

     const data = await response.json()
const debriefText = data.response || ''

await supabase.from('ai_personality_profile').upsert({
  user_id: user?.id,
  ...finalAnswers,
  debrief: debriefText,
  updated_at: new Date().toISOString()
})

setDebrief(debriefText)
setStep(12)

    } catch (error) {
      console.error('Erreur debrief:', error)
      setDebrief('Ton profil a été sauvegardé. NOVAÉ est prête à t\'accompagner dans ta transformation.')
      setStep(12)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDebrief = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
  }

  if (authLoading) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center">
      <div className="text-novae-anthracite/40 text-sm">Chargement...</div>
    </div>
  )

  // Déjà fait
  if (alreadyDone) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-novae-beige/30">
        <div className="text-4xl mb-4">✨</div>
        <h2 className="font-serif text-2xl text-novae-anthracite mb-3">Tu as déjà complété ton profil</h2>
        <p className="text-novae-anthracite/60 text-sm mb-6">Ton agent NOVAÉ te connaît déjà. Retourne à l'accueil pour commencer ta journée.</p>
        <button onClick={() => router.push('/')} className="btn-primary w-full text-center py-3 rounded-xl bg-novae-gold text-white font-medium">
          Retour à l'accueil →
        </button>
      </div>
    </div>
  )

  // INTRO
  if (step === 0) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-3xl font-serif mx-auto mb-6 shadow-lg">N</div>
          <h1 className="font-serif text-4xl text-novae-anthracite mb-4">Bienvenue dans NOVAÉ</h1>
          <p className="text-novae-anthracite/60 text-base leading-relaxed mb-2">
            Avant de commencer, prends 3 minutes pour répondre à <strong>10 questions</strong>.
          </p>
          <p className="text-novae-anthracite/60 text-sm leading-relaxed">
            Ces réponses permettent à ton agent IA de créer un accompagnement <strong>vraiment personnalisé</strong>, basé sur la psychologie positive et les neurosciences.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-6 border border-novae-beige/20 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="font-medium text-novae-anthracite text-sm">Pourquoi ces questions ?</div>
              <div className="text-novae-anthracite/50 text-xs">Basé sur la psychologie et les neurosciences</div>
            </div>
          </div>
          <div className="space-y-2">
            {['Identifier tes freins réels (pas les symptômes)', 'Adapter le programme à ton énergie actuelle', 'Personnaliser le ton de ton coach IA', 'Générer un debrief psychologique personnalisé'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-novae-anthracite/70">
                <div className="w-4 h-4 rounded-full bg-novae-gold/20 flex items-center justify-center text-novae-gold text-xs">✓</div>
                {item}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStep(1)}
          className="w-full py-4 bg-novae-anthracite text-white rounded-2xl font-medium text-sm tracking-wide hover:bg-novae-gold transition-colors shadow-sm"
        >
          Commencer mon profil → 
        </button>
        <p className="text-center text-xs text-novae-anthracite/30 mt-3">3 minutes · Confidentiel · Modifiable à tout moment</p>
      </div>
    </div>
  )

  // ANALYSE EN COURS
  if (step === 11) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-3xl font-serif mx-auto mb-6 shadow-lg animate-pulse">N</div>
        <h2 className="font-serif text-3xl text-novae-anthracite mb-4">Analyse en cours...</h2>
        <p className="text-novae-anthracite/50 text-sm mb-2">NOVAÉ analyse ton profil psychologique</p>
        <p className="text-novae-anthracite/40 text-xs">Identification des patterns · Neurosciences · Personnalisation</p>
        <div className="flex justify-center gap-2 mt-8">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-novae-gold rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }}></div>
          ))}
        </div>
      </div>
    </div>
  )

  // DEBRIEF
  if (step === 12) return (
    <div className="min-h-screen bg-novae-cream p-6 pb-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-2xl font-serif mx-auto mb-4">N</div>
          <h1 className="font-serif text-3xl text-novae-anthracite mb-2">Ton profil NOVAÉ</h1>
          <p className="text-novae-anthracite/50 text-sm">Analyse personnalisée · Psychologie & Neurosciences</p>
        </div>

        <div className="bg-white rounded-2xl p-8 mb-6 border border-novae-beige/20 shadow-sm">
          <div
            className="text-novae-anthracite/80 text-sm leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: '<p>' + formatDebrief(debrief) + '</p>' }}
          />
        </div>

        <div className="bg-novae-gold/10 border border-novae-gold/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">🎯</span>
            <div className="font-medium text-novae-anthracite text-sm">Ton programme commence maintenant</div>
          </div>
          <p className="text-novae-anthracite/60 text-xs leading-relaxed">
            Ton profil est sauvegardé. Ton agent NOVAÉ l'utilisera à chaque conversation pour t'accompagner de manière personnalisée.
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full py-4 bg-novae-anthracite text-white rounded-2xl font-medium text-sm tracking-wide hover:bg-novae-gold transition-colors shadow-sm"
        >
          Commencer ma transformation →
        </button>
      </div>
    </div>
  )

  // QUESTIONS
  const isAnswered = Array.isArray(currentAnswer) ? currentAnswer.length > 0 : currentAnswer.length > 0

  return (
    <div className="min-h-screen bg-novae-cream flex flex-col">
      {/* Header progress */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-novae-anthracite/40 font-medium">{step} / 10</span>
          <span className="text-xs text-novae-gold font-medium">{currentQ?.insight}</span>
        </div>
        <div className="w-full bg-novae-beige/40 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-novae-gold to-novae-rose h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-6 py-4 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          <div className="text-4xl mb-4">{currentQ?.emoji}</div>
          <h2 className="font-serif text-2xl text-novae-anthracite mb-2 leading-tight">{currentQ?.question}</h2>
          <p className="text-novae-anthracite/50 text-sm mb-8 leading-relaxed">{currentQ?.sous_titre}</p>

          {/* Textarea */}
          {currentQ?.type === 'textarea' && (
            <textarea
              value={currentAnswer as string}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder={currentQ.placeholder}
              className="w-full p-4 bg-white border border-novae-beige/40 rounded-2xl text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-2 focus:ring-novae-gold/30 resize-none leading-relaxed"
              rows={5}
              autoFocus
            />
          )}

          {/* Choix unique */}
          {currentQ?.type === 'choix_unique' && (
            <div className="space-y-3">
              {currentQ.options?.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all text-sm ${
                    currentAnswer === option
                      ? 'border-novae-gold bg-novae-gold/10 text-novae-anthracite font-medium'
                      : 'border-novae-beige/40 bg-white text-novae-anthracite/70 hover:border-novae-gold/40 hover:bg-novae-gold/5'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Choix multiple */}
          {currentQ?.type === 'choix_multiple' && (
            <div className="space-y-3">
              <p className="text-xs text-novae-anthracite/40 mb-4">Sélectionne jusqu'à 3 réponses</p>
              {currentQ.options?.map((option, i) => {
                const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option)
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(option)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all text-sm ${
                      selected
                        ? 'border-novae-gold bg-novae-gold/10 text-novae-anthracite font-medium'
                        : 'border-novae-beige/40 bg-white text-novae-anthracite/70 hover:border-novae-gold/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-novae-gold bg-novae-gold' : 'border-novae-beige'}`}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                      {option}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 pt-4 bg-novae-cream">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 1 && (
            <button
              onClick={() => { setStep(step - 1); setCurrentAnswer('') }}
              className="px-6 py-4 rounded-2xl border border-novae-beige/40 text-novae-anthracite/60 text-sm hover:bg-white transition-colors"
            >
              ←
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!isAnswered}
            className={`flex-1 py-4 rounded-2xl font-medium text-sm tracking-wide transition-all ${
              isAnswered
                ? 'bg-novae-anthracite text-white hover:bg-novae-gold shadow-sm'
                : 'bg-novae-beige/30 text-novae-anthracite/30 cursor-not-allowed'
            }`}
          >
            {step === 10 ? '✨ Générer mon profil' : 'Continuer →'}
          </button>
        </div>
      </div>
    </div>
  )
}