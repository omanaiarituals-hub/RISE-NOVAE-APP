'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Types pour les données centralisées
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
  metadata?: {
    completedAt: string
    version: string
    status: string
  }
  analyzed?: {
    priorityAxes: string[]
    objectiveScore: number
    hasCompleteBilan: boolean
  }
}

interface Recipe {
  id: string
  title: string
  prepTime: string
  category: 'express' | 'healthy' | 'family'
  mealType: 'entree' | 'plat' | 'dessert'
  ingredients: string[]
  steps: string[]
  isFavorite: boolean
}

interface MealPlan {
  day: string
  lunch: Recipe | null
  dinner: Recipe | null
}

interface ShoppingItem {
  id: string
  ingredient: string
  checked: boolean
  inStock: boolean
  toBuy: boolean
}

interface Routine {
  id: string
  title: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly'
  category: string
  completed: boolean
  createdAt: string
}

interface DailyMission {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'sante' | 'alimentation' | 'sport' | 'travail' | 'personnel'
  estimatedTime: string
  completed: boolean
  createdAt: string
  type?: 'audit' | 'reflection' | 'action'
  categories?: string[]
}

interface NovaeContextType {
  // Données du diagnostic
  onboardingData: OnboardingData | null
  setOnboardingData: (data: OnboardingData | null) => void
  
  // Données du planning de repas
  mealPlan: MealPlan[]
  setMealPlan: (plan: MealPlan[]) => void
  
  // Données des courses
  shoppingList: ShoppingItem[]
  setShoppingList: (list: ShoppingItem[]) => void
  
  // Données des routines
  routines: Routine[]
  setRoutines: (routines: Routine[]) => void
  
  // Mission quotidienne
  dailyMission: DailyMission | null
  setDailyMission: (mission: DailyMission | null) => void
  
  // Intelligence Engine
  generateDailyMission: (dayIndex?: number) => DailyMission
  
  // Sync automatique
  syncFromLocalStorage: () => void
  saveToLocalStorage: () => void
  
  // Mémoire de l'IA
  userMissionResponses: any[]
  setUserMissionResponses: (responses: any[]) => void
  addUserMissionResponse: (response: any) => void
}

export const NovaeContext = createContext<NovaeContextType | undefined>(undefined)

export const useNovae = () => {
  const context = useContext(NovaeContext)
  if (!context) {
    throw new Error('useNovae must be used within a NovaeProvider')
  }
  return context
}

interface NovaeProviderProps {
  children: ReactNode
}

export const NovaeProvider: React.FC<NovaeProviderProps> = ({ children }) => {
  // États centralisés
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>({
    bilan: {
      sommeil: "Bon",
      alimentation: "Équilibrée",
      sport: "Régulier",
      travail: "Équilibré"
    },
    objectif: {
      description: "Améliorer ma santé et mon bien-être quotidien",
      smart: {
        specifique: true,
        mesurable: true,
        atteignable: true,
        relevant: true,
        temporel: true
      }
    },
    axes: ["Santé", "Développement Personnel"],
    metadata: {
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Hier
      version: "1.0.0",
      status: "completed"
    },
    analyzed: {
      priorityAxes: ["Santé"],
      objectiveScore: 8,
      hasCompleteBilan: true
    }
  })
  const [mealPlan, setMealPlan] = useState<MealPlan[]>([
    { day: 'Lundi', lunch: null, dinner: null },
    { day: 'Mardi', lunch: null, dinner: null },
    { day: 'Mercredi', lunch: null, dinner: null },
    { day: 'Jeudi', lunch: null, dinner: null },
    { day: 'Vendredi', lunch: null, dinner: null },
    { day: 'Samedi', lunch: null, dinner: null },
    { day: 'Dimanche', lunch: null, dinner: null }
  ])
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [dailyMission, setDailyMission] = useState<DailyMission | null>(null)
  const [userMissionResponses, setUserMissionResponses] = useState<any[]>([])
  
  // Ajouter une réponse de mission
  const addUserMissionResponse = (response: any) => {
    setUserMissionResponses(prev => [...prev, response])
  }

  // Synchronisation depuis localStorage (DÉSACTIVÉ pour stabiliser)
  const syncFromLocalStorage = () => {
    try {
      // DÉSACTIVÉ - Plus de lecture localStorage pour onboardingData
      // const savedOnboarding = localStorage.getItem('novae_onboarding')
      // if (savedOnboarding) {
      //   setOnboardingData(JSON.parse(savedOnboarding))
      // }

      // Charger le plan de repas
      const savedMealPlan = localStorage.getItem('mealPlan')
      if (savedMealPlan) {
        setMealPlan(JSON.parse(savedMealPlan))
      }

      // Charger la liste de courses
      const savedShoppingList = localStorage.getItem('shoppingList')
      if (savedShoppingList) {
        setShoppingList(JSON.parse(savedShoppingList))
      }

      // Charger les routines
      const savedRoutines = localStorage.getItem('routines')
      if (savedRoutines) {
        setRoutines(JSON.parse(savedRoutines))
      }

      // Charger la mission quotidienne
      const savedDailyMission = localStorage.getItem('dailyMission')
      if (savedDailyMission) {
        setDailyMission(JSON.parse(savedDailyMission))
      }

      // Charger les réponses utilisateur
      const savedResponses = localStorage.getItem('userMissionResponses')
      if (savedResponses) {
        setUserMissionResponses(JSON.parse(savedResponses))
      }
    } catch (error) {
      console.error('Erreur lors du sync depuis localStorage:', error)
    }
  }

  // Sauvegarde automatique vers localStorage
  const saveToLocalStorage = () => {
    try {
      if (onboardingData) {
        localStorage.setItem('novae_onboarding', JSON.stringify(onboardingData))
      }
      localStorage.setItem('mealPlan', JSON.stringify(mealPlan))
      localStorage.setItem('shoppingList', JSON.stringify(shoppingList))
      localStorage.setItem('routines', JSON.stringify(routines))
      if (dailyMission) {
        localStorage.setItem('dailyMission', JSON.stringify(dailyMission))
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde vers localStorage:', error)
    }
  }

  // Dictionnaire de missions types pour chaque phase et axe
  const missionsDatabase = {
    phase1: { // Jours 1-9: Observation
      sante: [
        { title: "Observer votre sommeil", description: "Notez vos heures de coucher et de réveil pendant 3 jours", estimatedTime: "10 min", priority: "medium" as const },
        { title: "Analyser votre alimentation", description: "Listez tout ce que vous mangez aujourd'hui sans jugement", estimatedTime: "15 min", priority: "medium" as const },
        { title: "Évaluer votre niveau d'énergie", description: "Notez votre niveau d'énergie à 3 moments de la journée", estimatedTime: "5 min", priority: "low" as const },
        { title: "Observer votre posture", description: "Prenez conscience de votre posture pendant la journée", estimatedTime: "5 min", priority: "low" as const },
        { title: "Mesurer votre activité physique", description: "Comptez vos pas ou votre temps d'activité aujourd'hui", estimatedTime: "5 min", priority: "medium" as const }
      ],
      alimentation: [
        { title: "Journal alimentaire d'une journée", description: "Notez chaque repas et collation avec horaires", estimatedTime: "20 min", priority: "medium" as const },
        { title: "Identifier les habitudes alimentaires", description: "Repérez vos habitudes positives et négatives", estimatedTime: "15 min", priority: "medium" as const },
        { title: "Observer les fringues", description: "Notez quand et pourquoi vous grignotez", estimatedTime: "10 min", priority: "medium" as const }
      ],
      sport: [
        { title: "Tester votre niveau de forme", description: "Faites un test simple (pompe, squat, gainage)", estimatedTime: "15 min", priority: "medium" as const },
        { title: "Observer vos habitudes de mouvement", description: "Notez chaque activité physique dans la journée", estimatedTime: "10 min", priority: "low" as const }
      ],
      travail: [
        { title: "Analyser votre productivité", description: "Identifiez vos heures les plus productives", estimatedTime: "15 min", priority: "medium" as const },
        { title: "Observer vos sources de stress", description: "Listez les situations qui vous stressent aujourd'hui", estimatedTime: "10 min", priority: "medium" as const }
      ],
      personnel: [
        { title: "Faire le bilan émotionnel", description: "Notez vos émotions principales de la journée", estimatedTime: "10 min", priority: "medium" as const },
        { title: "Observer votre temps libre", description: "Comment utilisez-vous vos moments de repos ?", estimatedTime: "15 min", priority: "low" as const }
      ]
    },
    phase2: { // Jours 10-20: Identité
      sante: [
        { title: "Définir votre vision de la santé", description: "Écrivez ce que signifie être en bonne santé pour vous", estimatedTime: "30 min", priority: "high" as const },
        { title: "Identifier vos valeurs santé", description: "Quelles sont vos 3 valeurs fondamentales en matière de santé ?", estimatedTime: "20 min", priority: "high" as const },
        { title: "Créer votre identité sportive", description: "Quel type de sportif voulez-vous devenir ?", estimatedTime: "25 min", priority: "medium" as const }
      ],
      alimentation: [
        { title: "Définir votre philosophie alimentaire", description: "Quels sont vos principes pour bien manger ?", estimatedTime: "30 min", priority: "high" as const },
        { title: "Visualiser votre corps idéal", description: "Créez une image claire de votre objectif santé", estimatedTime: "20 min", priority: "medium" as const }
      ],
      travail: [
        { title: "Définir votre mission professionnelle", description: "Quelle est votre contribution unique au monde ?", estimatedTime: "45 min", priority: "high" as const },
        { title: "Clarifier vos valeurs au travail", description: "Qu'est-ce qui est non-négociable pour vous ?", estimatedTime: "30 min", priority: "high" as const }
      ],
      personnel: [
        { title: "Écrire votre lettre de mission", description: "Rédigez votre mission personnelle pour l'année", estimatedTime: "60 min", priority: "high" as const },
        { title: "Définir vos non-négociables", description: "Quelles sont vos limites personnelles ?", estimatedTime: "30 min", priority: "high" as const }
      ]
    },
    phase3: { // Jours 21-90: Action
      sante: [
        { title: "Routine matinale énergisante", description: "Créez et suivez une routine de 15 minutes", estimatedTime: "15 min", priority: "high" as const },
        { title: "Défi hydratation", description: "Buvez 2L d'eau aujourd'hui", estimatedTime: "5 min", priority: "medium" as const },
        { title: "Session de méditation guidée", description: "10 minutes de pleine conscience", estimatedTime: "10 min", priority: "medium" as const },
        { title: "Étirements du matin", description: "5 minutes d'étirements au réveil", estimatedTime: "5 min", priority: "low" as const },
        { title: "Douche froide de 30 secondes", description: "Testez les bienfaits de l'eau froide", estimatedTime: "2 min", priority: "low" as const },
        { title: "Testez une nouvelle recette saine", description: "Cuisinez un plat nutritif que vous n'avez jamais essayé", estimatedTime: "45 min", priority: "medium" as const }
      ],
      alimentation: [
        { title: "Préparer vos repas pour 3 jours", description: "Meal prep pour simplifier votre semaine", estimatedTime: "90 min", priority: "high" as const },
        { title: "Défi sans sucre 24h", description: "Évitez tous les sucres ajoutés aujourd'hui", estimatedTime: "30 min", priority: "medium" as const },
        { title: "Créer un menu hebdomadaire", description: "Planifiez tous vos repas pour la semaine", estimatedTime: "60 min", priority: "medium" as const },
        { title: "Faire les courses avec liste", description: "Achetez uniquement ce qui est sur votre liste", estimatedTime: "45 min", priority: "medium" as const },
        { title: "Essayer 1 légume nouveau", description: "Découvrez un nouveau légume et une recette", estimatedTime: "30 min", priority: "low" as const }
      ],
      sport: [
        { title: "30 minutes de cardio", description: "Course, vélo ou corde à sauter", estimatedTime: "30 min", priority: "high" as const },
        { title: "Session de musculation complète", description: "3x10 exercices pour tout le corps", estimatedTime: "45 min", priority: "high" as const },
        { title: "Sortir marcher 45 minutes", description: "Marche rapide en extérieur", estimatedTime: "45 min", priority: "medium" as const },
        { title: "Yoga ou étirements profonds", description: "20 minutes de flexibilité", estimatedTime: "20 min", priority: "medium" as const },
        { title: "Défi 100 pompes/squats", description: "Répartissez dans la journée", estimatedTime: "15 min", priority: "medium" as const }
      ],
      travail: [
        { title: "Technique Pomodoro 25min", description: "Travaillez par blocs de 25 minutes concentrées", estimatedTime: "25 min", priority: "high" as const },
        { title: "Nettoyer votre espace de travail", description: "Organisez votre bureau pour plus de clarté", estimatedTime: "30 min", priority: "medium" as const },
        { title: "Planifier votre semaine de travail", description: "Définissez vos priorités et objectifs", estimatedTime: "45 min", priority: "high" as const },
        { title: "Apprendre une nouvelle compétence", description: "30 minutes de formation ou pratique", estimatedTime: "30 min", priority: "medium" as const }
      ],
      personnel: [
        { title: "Écrire dans un journal", description: "10 minutes d'écriture libre", estimatedTime: "10 min", priority: "medium" as const },
        { title: "Appeler un ami ou proche", description: "Prenez des nouvelles sans raison particulière", estimatedTime: "20 min", priority: "medium" as const },
        { title: "Faire une bonne action", description: "Aidez quelqu'un sans rien attendre en retour", estimatedTime: "15 min", priority: "low" as const },
        { title: "Lire 20 minutes", description: "Un livre qui vous fait grandir", estimatedTime: "20 min", priority: "medium" as const },
        { title: "Déconnexion numérique 2h", description: "Coupez tous les écrans pendant 2 heures", estimatedTime: "120 min", priority: "high" as const }
      ]
    }
  }

  // Intelligence Engine - Génération de mission quotidienne améliorée
  const generateDailyMission = (dayIndex: number = 1): DailyMission => {
    if (!onboardingData) {
      return {
        id: Date.now().toString(),
        title: 'Commencer votre diagnostic',
        description: 'Faites le diagnostic personnel pour recevoir des missions personnalisées',
        priority: 'high',
        category: 'personnel',
        estimatedTime: '15 min',
        completed: false,
        createdAt: new Date().toISOString()
      }
    }

    const { bilan, axes, analyzed } = onboardingData
    let phase: 'phase1' | 'phase2' | 'phase3'
    let category: 'sante' | 'alimentation' | 'sport' | 'travail' | 'personnel'

    // Déterminer la phase selon le jour
    if (dayIndex <= 9) {
      phase = 'phase1' // Observation
    } else if (dayIndex <= 20) {
      phase = 'phase2' // Identité
    } else {
      phase = 'phase3' // Action
    }

    // Intelligence contextuelle - adapter selon le bilan
    if (phase === 'phase1' || phase === 'phase2') {
      // Prioriser les domaines problématiques dans les premières phases
      if (bilan.sommeil.toLowerCase().includes('irrégulier') || 
          bilan.sommeil.toLowerCase().includes('difficile') ||
          bilan.sommeil.toLowerCase().includes('insuffisant')) {
        category = 'sante'
      }
      else if (bilan.alimentation.toLowerCase().includes('saccad') || 
               bilan.alimentation.toLowerCase().includes('irrégulier') ||
               bilan.alimentation.toLowerCase().includes('saut')) {
        category = 'alimentation'
      }
      else if (bilan.sport.toLowerCase().includes('sédentaire') || 
               bilan.sport.toLowerCase().includes('peu') ||
               bilan.sport.toLowerCase().includes('rare')) {
        category = 'sport'
      }
      else if (bilan.travail.toLowerCase().includes('stress') || 
               bilan.travail.toLowerCase().includes('surcharge')) {
        category = 'travail'
      }
      else {
        category = 'personnel'
      }
    } else {
      // Phase 3 : alterner selon les axes prioritaires
      if (axes && axes.length > 0) {
        const axeIndex = (dayIndex - 1) % axes.length
        const selectedAxe = axes[axeIndex]
        
        switch (selectedAxe) {
          case 'Santé & Bien-être':
            category = 'sante'
            break
          case 'Carrière & Profession':
            category = 'travail'
            break
          case 'Relations & Social':
            category = 'personnel'
            break
          case 'Développement Personnel':
            category = 'personnel'
            break
          case 'Finances & Abondance':
            category = 'personnel'
            break
          case 'Spiritualité & Sens':
            category = 'personnel'
            break
          default:
            category = 'personnel'
        }
      } else {
        category = 'personnel'
      }
    }

    // Sélectionner une mission dans la base de données
    const phaseData = missionsDatabase[phase]
    const missionsForCategory = phaseData[category as keyof typeof phaseData] || phaseData.personnel
    const missionIndex = (dayIndex - 1) % missionsForCategory.length
    const selectedMission = missionsForCategory[missionIndex]

    return {
      id: `${dayIndex}-${Date.now()}`,
      title: selectedMission.title,
      description: selectedMission.description,
      priority: selectedMission.priority,
      category: category,
      estimatedTime: selectedMission.estimatedTime,
      completed: false,
      createdAt: new Date().toISOString()
    }
  }

  // Effet de montage pour charger les données (DÉSACTIVÉ pour stabiliser)
  // useEffect(() => {
  //   syncFromLocalStorage()
  // }, [])

  // Effet pour sauvegarder automatiquement quand les données changent
  // useEffect(() => {
  //   saveToLocalStorage()
  // }, [onboardingData, mealPlan, shoppingList, routines])

  // Effet pour générer une mission quotidienne si aucune n'existe (DÉSACTIVÉ pour stabiliser)
  // useEffect(() => {
  //   if (!dailyMission && onboardingData) {
  //     const newMission = generateDailyMission()
  //     setDailyMission(newMission)
  //   }
  // }, [dailyMission, onboardingData, generateDailyMission])

  const value: NovaeContextType = {
    onboardingData,
    setOnboardingData,
    mealPlan,
    setMealPlan,
    shoppingList,
    setShoppingList,
    routines,
    setRoutines,
    dailyMission,
    setDailyMission,
    generateDailyMission,
    syncFromLocalStorage,
    saveToLocalStorage,
    userMissionResponses,
    setUserMissionResponses,
    addUserMissionResponse
  }

  return (
    <NovaeContext.Provider value={value}>
      {children}
    </NovaeContext.Provider>
  )
}
