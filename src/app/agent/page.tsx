'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OnboardingData {
  bilan: {
    sommeil: string
    alimentation: string
    sport: string
    travail: string
  }
  objectif: {
    description: string
    smart: {
      specifique: boolean
      mesurable: boolean
      atteignable: boolean
      relevant: boolean
      temporel: boolean
    }
  }
  axes: string[]
}

export default function AgentPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isComplete, setIsComplete] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    bilan: {
      sommeil: '',
      alimentation: '',
      sport: '',
      travail: ''
    },
    objectif: {
      description: '',
      smart: {
        specifique: false,
        mesurable: false,
        atteignable: false,
        relevant: false,
        temporel: false
      }
    },
    axes: []
  })

  const axesOptions = [
    'Santé & Bien-être',
    'Carrière & Profession',
    'Relations & Social',
    'Développement Personnel',
    'Finances & Abondance',
    'Spiritualité & Sens'
  ]

  useEffect(() => {
    // Charger les données existantes si elles existent
    const saved = localStorage.getItem('novae_onboarding')
    if (saved) {
      setOnboardingData(JSON.parse(saved))
    }
  }, [])

  const saveToLocalStorage = () => {
    // Structure enrichie pour compatibilité avec le module programme
    const enhancedData = {
      ...onboardingData,
      metadata: {
        completedAt: new Date().toISOString(),
        version: '1.0',
        status: 'completed'
      },
      // Ajout de champs analysés pour l'IA
      analyzed: {
        priorityAxes: onboardingData.axes.slice(0, 2), // Les 2 premiers axes comme priorités
        objectiveScore: Object.values(onboardingData.objectif.smart).filter(Boolean).length / 5,
        hasCompleteBilan: Object.values(onboardingData.bilan).every(val => val.trim().length > 0)
      }
    }
    
    localStorage.setItem('novae_onboarding', JSON.stringify(enhancedData))
    console.log('Diagnostic sauvegardé avec métadonnées:', enhancedData)
  }

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      saveToLocalStorage()
      setIsComplete(true)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleBilanChange = (field: keyof typeof onboardingData.bilan, value: string) => {
    setOnboardingData(prev => ({
      ...prev,
      bilan: {
        ...prev.bilan,
        [field]: value
      }
    }))
  }

  const handleObjectifChange = (value: string) => {
    setOnboardingData(prev => ({
      ...prev,
      objectif: {
        ...prev.objectif,
        description: value
      }
    }))
  }

  const toggleAxe = (axe: string) => {
    setOnboardingData(prev => ({
      ...prev,
      axes: prev.axes.includes(axe)
        ? prev.axes.filter(a => a !== axe)
        : [...prev.axes.slice(0, 2), axe] // Limiter à 3 axes
    }))
  }

  const checkSmartCriteria = (text: string) => {
    const smart = {
      specifique: text.length > 10,
      mesurable: /\d+/.test(text),
      atteignable: !/impossible|trop difficile|inaccessible/.test(text.toLowerCase()),
      relevant: text.length > 20,
      temporel: /\d+ (jour|mois|an|semaine)s?/.test(text.toLowerCase())
    }
    
    setOnboardingData(prev => ({
      ...prev,
      objectif: {
        ...prev.objectif,
        smart
      }
    }))
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">{"\ud83e\udd16"}</div>
          <h2 className="text-2xl font-serif text-novae-anthracite mb-4">
            Analyse en cours par l'Agent IA...
          </h2>
          <p className="text-novae-anthracite/70 mb-6">
            Votre diagnostic personnel a été sauvegardé avec succès.
            L'Agent IA analyse vos réponses pour créer votre programme personnalisé.
          </p>
          <div className="animate-pulse mb-6">
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-novae-gold rounded-full"></div>
              <div className="w-3 h-3 bg-novae-gold rounded-full"></div>
              <div className="w-3 h-3 bg-novae-gold rounded-full"></div>
            </div>
          </div>
          <Link
            href="/program"
            className="btn-primary w-full inline-block text-center"
          >
            Accéder au Programme 90 jours
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-novae-cream p-6">
      <div className="max-w-2xl mx-auto">
        {/* Navigation Header */}
        <div className="flex justify-between items-center mb-8">
          <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-novae-gold text-white rounded-lg hover:bg-novae-gold/80 transition-colors"
          >
            <span className="text-lg">×</span>
            Menu Principal
          </Link>
          <div className="text-novae-anthracite/60 text-sm">
            Étape {currentStep} sur 3
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif text-novae-anthracite mb-4">
            Diagnostic Personnel
          </h1>
          <p className="text-novae-anthracite/70">
            Commençons par mieux vous connaître pour un accompagnement sur mesure
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-novae-anthracite/60">Étape {currentStep} sur 3</span>
          </div>
          <div className="w-full bg-novae-beige/30 rounded-full h-2">
            <div
              className="bg-novae-gold h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="card">
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-serif text-novae-anthracite mb-6">
                Étape 1 : Bilan actuel
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-novae-anthracite font-medium mb-2">
                    Comment évaluez-vous votre sommeil actuel ?
                  </label>
                  <textarea
                    value={onboardingData.bilan.sommeil}
                    onChange={(e) => handleBilanChange('sommeil', e.target.value)}
                    className="w-full p-3 border border-novae-beige/50 rounded-lg focus:ring-2 focus:ring-novae-gold focus:border-transparent"
                    rows={3}
                    placeholder="Ex: Je dors 6h par nuit, qualité moyenne..."
                  />
                </div>

                <div>
                  <label className="block text-novae-anthracite font-medium mb-2">
                    Comment décririez-vous votre alimentation ?
                  </label>
                  <textarea
                    value={onboardingData.bilan.alimentation}
                    onChange={(e) => handleBilanChange('alimentation', e.target.value)}
                    className="w-full p-3 border border-novae-beige/50 rounded-lg focus:ring-2 focus:ring-novae-gold focus:border-transparent"
                    rows={3}
                    placeholder="Ex: Équilibrée mais trop de sucre, je saute souvent le petit-déjeuner..."
                  />
                </div>

                <div>
                  <label className="block text-novae-anthracite font-medium mb-2">
                    Quelle est votre activité physique ?
                  </label>
                  <textarea
                    value={onboardingData.bilan.sport}
                    onChange={(e) => handleBilanChange('sport', e.target.value)}
                    className="w-full p-3 border border-novae-beige/50 rounded-lg focus:ring-2 focus:ring-novae-gold focus:border-transparent"
                    rows={3}
                    placeholder="Ex: Marche 30min 3x/semaine, sédentaire le week-end..."
                  />
                </div>

                <div>
                  <label className="block text-novae-anthracite font-medium mb-2">
                    Comment se passe votre vie professionnelle ?
                  </label>
                  <textarea
                    value={onboardingData.bilan.travail}
                    onChange={(e) => handleBilanChange('travail', e.target.value)}
                    className="w-full p-3 border border-novae-beige/50 rounded-lg focus:ring-2 focus:ring-novae-gold focus:border-transparent"
                    rows={3}
                    placeholder="Ex: Stressant mais épanouissant, je cherche plus d'équilibre..."
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-serif text-novae-anthracite mb-6">
                Étape 2 : Votre objectif annuel
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-novae-anthracite font-medium mb-2">
                    Quel est votre principal objectif pour cette année ?
                  </label>
                  <textarea
                    value={onboardingData.objectif.description}
                    onChange={(e) => {
                      handleObjectifChange(e.target.value)
                      checkSmartCriteria(e.target.value)
                    }}
                    className="w-full p-3 border border-novae-beige/50 rounded-lg focus:ring-2 focus:ring-novae-gold focus:border-transparent"
                    rows={4}
                    placeholder="Ex: Perdre 10kg en 6 mois en adoptant une alimentation saine et en faisant du sport 3x par semaine..."
                  />
                </div>

                <div className="bg-novae-beige/20 rounded-lg p-4">
                  <h3 className="font-medium text-novae-anthracite mb-3">Analyse SMART</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Spécifique</span>
                      <span className={`text-sm ${onboardingData.objectif.smart.specifique ? 'text-green-600' : 'text-orange-600'}`}>
                        {onboardingData.objectif.smart.specifique ? '{"\u2713"}' : 'Attention'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Mesurable</span>
                      <span className={`text-sm ${onboardingData.objectif.smart.mesurable ? 'text-green-600' : 'text-orange-600'}`}>
                        {onboardingData.objectif.smart.mesurable ? '{"\u2713"}' : 'Ajoutez des chiffres'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Atteignable</span>
                      <span className={`text-sm ${onboardingData.objectif.smart.atteignable ? 'text-green-600' : 'text-orange-600'}`}>
                        {onboardingData.objectif.smart.atteignable ? '{"\u2713"}' : 'Vérifiez le réalisme'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Relevant</span>
                      <span className={`text-sm ${onboardingData.objectif.smart.relevant ? 'text-green-600' : 'text-orange-600'}`}>
                        {onboardingData.objectif.smart.relevant ? '{"\u2713"}' : 'Plus de contexte ?'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Temporel</span>
                      <span className={`text-sm ${onboardingData.objectif.smart.temporel ? 'text-green-600' : 'text-orange-600'}`}>
                        {onboardingData.objectif.smart.temporel ? '{"\u2713"}' : 'Ajoutez une date'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-serif text-novae-anthracite mb-6">
                Étape 3 : Vos 3 axes de transformation
              </h2>
              
              <div className="space-y-4">
                <p className="text-novae-anthracite/70 mb-4">
                  Sélectionnez les 3 domaines sur lesquels vous souhaitez concentrer vos efforts cette année.
                </p>
                
                {axesOptions.map((axe) => (
                  <div
                    key={axe}
                    onClick={() => toggleAxe(axe)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      onboardingData.axes.includes(axe)
                        ? 'border-novae-gold bg-novae-gold/10'
                        : 'border-novae-beige/50 hover:border-novae-beige'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-novae-anthracite">{axe}</span>
                      <div className={`w-6 h-6 rounded-full border-2 ${
                        onboardingData.axes.includes(axe)
                          ? 'border-novae-gold bg-novae-gold'
                          : 'border-novae-beige'
                      }`}>
                        {onboardingData.axes.includes(axe) && (
                          <div className="w-full h-full flex items-center justify-center text-white text-xs">
                            {"\u2713"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="text-sm text-novae-anthracite/60 mt-4">
                  {onboardingData.axes.length}/3 axes sélectionnés
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-lg ${
                currentStep === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-novae-beige text-novae-anthracite hover:bg-novae-beige/80'
              }`}
            >
              Précédent
            </button>
            
            <button
              onClick={handleNext}
              disabled={currentStep === 3 && onboardingData.axes.length !== 3}
              className={`px-6 py-2 rounded-lg ${
                currentStep === 3 && onboardingData.axes.length !== 3
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {currentStep === 3 ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
