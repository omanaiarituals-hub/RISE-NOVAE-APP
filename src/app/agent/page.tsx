'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import missionsData from '@/data/missions.json'
import { detectStruggleMode, type StruggleState } from '@/lib/struggle/detect'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: Action[]
}

interface Action {
  type: 'add_task' | 'complete_routine' | 'add_shopping' | 'update_plan'
  label: string
  data: any
}

interface AppContext {
  tasks: any[]
  routines: any[]
  recipes: any[]
  mealPlans: any[]
  shoppingList: any[]
  familyMembers: any[]
  programProgress: any
  currentMission: any | null
  struggle: StruggleState
  todayDate: string
  dayOfWeek: string
  profile: any
}

const QUICK_PROMPTS = [
  { icon: '🎯', label: "Mission du jour", prompt: "Aide-moi sur ma mission du jour. Rappelle-moi son objectif, propose-moi un plan d'action concret pour la réussir aujourd'hui, et donne-moi une inspiration adaptée à mon profil." },
  { icon: '📋', label: "Prévu aujourd'hui ?", prompt: "Qu'est-ce que j'ai prévu aujourd'hui dans mon planner ? Liste toutes mes tâches du jour avec leurs horaires." },
  { icon: '🔄', label: "Mes routines", prompt: "Liste toutes mes routines. Lesquelles sont faites et lesquelles sont en attente cette semaine ?" },
  { icon: '🍳', label: "Batch cooking", prompt: "Regarde mes recettes planifiées cette semaine et propose un plan batch cooking avec les ingrédients en commun." },
  { icon: '📊', label: "Bilan semaine", prompt: "Fais-moi un bilan complet de ma semaine : programme 90j avancement, routines complétées, tâches accomplies, et donne-moi 3 axes d'amélioration. Ensuite, incite-moi à consacrer 1 heure à préparer ma semaine prochaine : propose-moi de planifier mes menus, mes RDV, mes activités et mes routines pour éviter d'être submergée en semaine." },
  { icon: '👨‍👩‍👧', label: "Alertes famille", prompt: "Y a-t-il des anniversaires familiaux dans les 7 prochains jours ? Vérifie aussi les allergies potentielles dans mes recettes planifiées." },
  { icon: '⚡', label: "Conflits planning", prompt: "Analyse mon planning cette semaine et détecte tous les conflits entre mes routines, événements planner et recettes planifiées. Propose des ajustements." },
]

export default function AgentPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [appContext, setAppContext] = useState<AppContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [showHome, setShowHome] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user && !authLoading) {
      loadAppContext()
      loadConversationHistory()
    }
  }, [user, authLoading])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Mémoire conversationnelle ────────────────────────────────────────────
  const loadConversationHistory = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[agent] history load error:', error)
        return
      }

      const sorted = (data || []).reverse()
      if (sorted.length > 0) {
        const loadedMessages: Message[] = sorted.map((row: any) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          timestamp: new Date(row.created_at),
        }))
        setMessages(loadedMessages)
        setShowHome(false)
      }
    } catch (err) {
      console.error('[agent] history fetch error:', err)
    } finally {
      setHistoryLoaded(true)
    }
  }

  const persistMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!user) return
    try {
      await supabase.from('agent_conversations').insert({
        user_id: user.id,
        role,
        content,
      })
    } catch (err) {
      console.error('[agent] persist error:', err)
    }
  }

  const clearHistory = async () => {
    if (!user) return
    if (!confirm('Effacer tout ton historique de conversation avec NOVAÉ ? Cette action est irréversible.')) return
    try {
      await supabase.from('agent_conversations').delete().eq('user_id', user.id)
      setMessages([])
      setShowHome(true)
    } catch (err) {
      console.error('[agent] clear history error:', err)
    }
  }

  // ── Contexte app ─────────────────────────────────────────────────────────
  const loadAppContext = async () => {
    if (!user) return
    setContextLoading(true)
    try {
      const [profileRes, tasksRes, routinesRes, recipesRes, mealPlansRes, shoppingRes, familyRes, progressRes] = await Promise.all([
        supabase.from('ai_personality_profile').select('*').eq('user_id', user.id).single(),
        supabase.from('tasks').select('*').eq('user_id', user.id).order('date', { ascending: true }),
        supabase.from('routines').select('*').eq('user_id', user.id),
        supabase.from('recipes').select('*').or(`user_id.eq.${user.id},is_public.eq.true`).limit(20),
        supabase.from('meal_plan').select('*, recipes(id, title, ingredients, category, meal_type)').eq('user_id', user.id),
        supabase.from('shopping_list').select('*').eq('user_id', user.id),
        supabase.from('family_data').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('program_progress').select('*').eq('user_id', user.id).single()
      ])

      const now = new Date()
      const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

     // Mission du jour basée sur current_day du programme
      const currentDay = progressRes.data?.current_day || 0
      const currentMission = currentDay > 0
        ? (missionsData as any[]).find((m: any) => m.day === currentDay) || null
        : null

      // Détection mode traversée difficile
      const struggle = await detectStruggleMode(supabase, user.id)
      setAppContext({
        tasks: tasksRes.data || [],
        routines: routinesRes.data || [],
        recipes: recipesRes.data || [],
        mealPlans: mealPlansRes.data || [],
        shoppingList: shoppingRes.data || [],
        familyMembers: familyRes.data || [],
        programProgress: progressRes.data || null,
        currentMission,
        struggle,
        profile: profileRes.data || null,
        todayDate: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        dayOfWeek: days[now.getDay()]
      })
    } catch (error) {
      console.error('Erreur chargement contexte:', error)
    } finally {
      setContextLoading(false)
    }
  }

  const buildSystemPrompt = (ctx: AppContext) => {
    const today = new Date()
    const isSunday = today.getDay() === 0
    const todayStr = today.toISOString().split('T')[0]

    const todayTasks = ctx.tasks.filter(t => t.date && t.date.startsWith(todayStr))
    const futureTasks = ctx.tasks.filter(t => t.date && t.date >= todayStr)
    const pendingRoutines = ctx.routines.filter(r => !r.completed)
    const doneRoutines = ctx.routines.filter(r => r.completed)

    const currentDayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][today.getDay()]
    const relevantMealPlans = ctx.mealPlans

    const allergies = ctx.familyMembers
      .filter(m => m.data?.allergies && m.data.allergies.length > 0)
      .map(m => {
        const name = m.data?.firstName || m.data?.name || m.relation_to_user || 'Membre de la famille'
        const a = m.data.allergies
        const allergiesList = Array.isArray(a) ? a : [a]
        return { name, allergies: allergiesList }
      })
    const allergiesText = allergies.length > 0
      ? allergies.map(a => `${a.name} : ${a.allergies.join(', ')}`).join('\n')
      : 'Aucune allergie déclarée'

    const allergyConflicts: string[] = []
    allergies.forEach(({ name, allergies: allergyList }) => {
      relevantMealPlans.forEach((m: any) => {
        const recipe = m.recipes
        if (!recipe) return
        const ingredients = Array.isArray(recipe.ingredients)
          ? recipe.ingredients.map((i: any) => (typeof i === 'string' ? i : i.name || '').toLowerCase())
          : []
        allergyList.forEach(allergen => {
          const allergenLower = allergen.toLowerCase().trim()
          const hasConflict = ingredients.some((ing: string) => ing.includes(allergenLower))
          if (hasConflict) {
            allergyConflicts.push(`⚠️ CONFLIT ALLERGIE : ${name} est allergique à "${allergen}" — présent dans "${recipe.title}" planifié le ${m.day_of_week} (${m.meal_type})`)
          }
        })
      })
    })
    const allergyConflictsText = allergyConflicts.length > 0
      ? '\n\n🚨 ALERTES ALLERGIE DÉTECTÉES :\n' + allergyConflicts.join('\n')
      : ''

    const mealPlansText = relevantMealPlans.length > 0
      ? relevantMealPlans.map((m: any) => {
        const recipe = m.recipes
        if (!recipe) return `${m.day_of_week} ${m.meal_type} : ${m.custom_meal || 'Repas sans détail'}`
        const ingredientList = Array.isArray(recipe.ingredients)
          ? recipe.ingredients.map((i: any) => typeof i === 'string' ? i : i.name || '').filter(Boolean).join(', ')
          : ''
        return `${m.day_of_week} ${m.meal_type} : ${recipe.title} (ingrédients : ${ingredientList || 'non renseignés'})`
      }).join('\n')
      : 'Aucun repas planifié pour le reste de la semaine'

    // ── Section MISSION DU JOUR ─────────────────────────────────────────
    let missionSection = ''
    if (ctx.currentMission) {
      const m = ctx.currentMission
      const phase = m.phase || (m.day <= 30 ? 'Reprogrammation' : m.day <= 60 ? 'Action & Discipline' : 'Expansion')
      const reflectionQuestion = m.question || m.reflection?.question || ''
      const tasksText = Array.isArray(m.tasks)
        ? m.tasks
          .map((t: any) => typeof t === 'string' ? t : t.label || '')
          .filter(Boolean)
          .map((s: string) => `  - ${s}`)
          .join('\n')
        : ''

      missionSection = `

=== 🎯 MISSION DU JOUR (J${m.day}/90 — Phase ${phase}) ===
Titre : ${m.title}
Guide : ${m.guide || m.description || ''}
${tasksText ? `Tâches du jour :\n${tasksText}\n` : ''}${reflectionQuestion ? `Question de réflexion : ${reflectionQuestion}` : ''}

Quand l'utilisatrice te parle de "ma mission", "aujourd'hui", "ce que je dois faire", "le programme", c'est de cette mission qu'il s'agit. Tu peux la guider pour la réussir, expliquer le sens profond de la mission, l'aider à formuler sa réflexion, ou la motiver si elle traîne. Si elle a déjà fait sa réflexion (champ "completed_at" dans les données), félicite-la sans en rajouter.`
    } else if (ctx.programProgress?.current_day === 0 || !ctx.programProgress) {
      missionSection = `

=== 🎯 PROGRAMME 90 JOURS ===
L'utilisatrice n'a pas encore démarré son programme 90 jours. Si elle te parle de "mission" ou "programme", encourage-la doucement à le démarrer depuis l'onglet Programme.`
    }

// Section mode traversée difficile (s'ajoute au prompt si actif)
    const struggleSection = ctx.struggle?.active ? `

=== 🌙 MODE TRAVERSÉE DIFFICILE ACTIVÉ ===
L'utilisatrice n'a pas validé de mission depuis ${ctx.struggle.daysSinceLastResponse} jours (dernière mission : J${ctx.struggle.lastResponseDay}).
Elle traverse peut-être une période compliquée. ADAPTE TA POSTURE :
- Sois plus douce, plus patiente, moins dans la performance
- N'empile JAMAIS de tâches ni d'objectifs supplémentaires
- Reconnais que c'est OK de ralentir, que la transformation n'est pas linéaire
- Propose UNE SEULE micro-action accessible (pas une liste)
- Demande-lui comment elle va, sans la presser de répondre
- Si elle veut juste parler, écoute. Si elle veut juste être validée, valide.
- BANNIS les phrases du type "tu peux le faire", "courage", "remets-toi en selle" — c'est l'inverse de ce dont elle a besoin
- Le plus important : elle compte, indépendamment de sa productivité
- Tu peux lui rappeler que reprendre où elle s'est arrêtée est toujours possible — pas besoin de tout recommencer` : ''

    return `Tu es NOVAÉ, l'agent IA personnel de l'application RISE NOVAÉ.⚠️ DISCLAIMER OBLIGATOIRE : Tu es un guide IA, pas un professionnel de santé, de coaching, de nutrition ou de psychologie. Si l'utilisatrice mentionne une détresse émotionnelle sérieuse, une maladie ou un problème médical, oriente-la vers un professionnel qualifié.
Tu as accès en temps réel à TOUTES les données de l'utilisatrice ci-dessous. Tu DOIS les utiliser pour répondre — ne dis JAMAIS que tu n'y as pas accès.
Tu as aussi accès à ton historique de conversations passées avec elle — utilise-le pour assurer une continuité (rappels de discussions précédentes, suivi des engagements pris).
Aujourd'hui : ${ctx.dayOfWeek} ${ctx.todayDate}.${isSunday ? ' C\'est dimanche — propose un bilan hebdomadaire complet en fin de réponse.' : ''}
${struggleSection}
${missionSection}

=== DONNÉES RÉELLES DE L'UTILISATRICE ===

TÂCHES AUJOURD'HUI (${todayTasks.length}) :
${todayTasks.length > 0 ? JSON.stringify(todayTasks, null, 2) : 'Aucune tâche prévue aujourd\'hui'}

TÂCHES À VENIR — présent et futur uniquement (${futureTasks.length} total) :
${JSON.stringify(futureTasks.slice(0, 15), null, 2)}

ROUTINES — FAITES (${doneRoutines.length}) :
${JSON.stringify(doneRoutines, null, 2)}

ROUTINES — EN ATTENTE (${pendingRoutines.length}) :
${JSON.stringify(pendingRoutines, null, 2)}

RECETTES DISPONIBLES (${ctx.recipes.length}) :
${ctx.recipes.slice(0, 10).map((r: any) => {
      const ingredientList = Array.isArray(r.ingredients)
        ? r.ingredients.map((i: any) => typeof i === 'string' ? i : i.name || '').filter(Boolean).join(', ')
        : ''
      return `- ${r.title} (${r.course || 'plat'}) : ${ingredientList}`
    }).join('\n')}

REPAS PLANIFIÉS CETTE SEMAINE — aujourd'hui c'est ${currentDayName} (${ctx.mealPlans.length} repas au total) :
${mealPlansText}

LISTE DE COURSES (${ctx.shoppingList.length} articles) :
${ctx.shoppingList.slice(0, 20).map((s: any) => `- ${s.ingredient}${s.quantity ? ' : ' + s.quantity : ''}`).join('\n') || 'Liste vide'}

MEMBRES DE LA FAMILLE (${ctx.familyMembers.length}) :
${JSON.stringify(ctx.familyMembers, null, 2)}

⚠️ ALLERGIES FAMILLE (CRITIQUE — VÉRIFIER POUR CHAQUE RECETTE MENTIONNÉE) :
${allergiesText}
${allergyConflictsText}

PROGRAMME 90 JOURS — Avancement :
${ctx.programProgress ? JSON.stringify(ctx.programProgress, null, 2) : 'Aucun programme démarré'}

${ctx.profile ? `
=== PROFIL PSYCHOLOGIQUE DE L'UTILISATRICE ===
- Objectif : ${ctx.profile.objectif}
- Bloqueurs : ${ctx.profile.bloqueurs}
- État émotionnel de départ : ${ctx.profile.etat_emotionnel}
- Motivation profonde : ${ctx.profile.motivation}
- Réaction à l'échec : ${ctx.profile.reaction_echec}
- Domaine prioritaire : ${ctx.profile.domaine_prioritaire}
- Vision succès 90j : ${ctx.profile.signal_succes}
- Ton souhaité : ${ctx.profile.ton_souhaite}
ADAPTE TON TON ET TES CONSEILS à ce profil à chaque réponse.
` : ''}

=== TES RÈGLES ===
1. Tu UTILISES toujours les données ci-dessus pour répondre. Tu ne demandes JAMAIS à l'utilisatrice d'aller vérifier elle-même.
2. MISSION DU JOUR : Si elle te demande quelque chose en lien avec son programme/mission/aujourd'hui, réfère-toi à la section "MISSION DU JOUR" ci-dessus.
3. ARBITRE DU TEMPS : Détecte automatiquement les conflits entre routines, planner et recettes.
4. BATCH COOKING : Si des recettes planifiées ont des ingrédients communs, propose un plan batch cooking.
5. ALLERGIES — RÈGLE ABSOLUE : Pour chaque recette mentionnée ou analysée, vérifie IMMÉDIATEMENT si ses ingrédients contiennent un allergène de la section "ALLERGIES FAMILLE". Si oui, affiche : "⚠️ ALLERGIE : [prénom] est allergique à [ingrédient] présent dans [recette]."
6. FAMILLE : Alerte sur les anniversaires dans les 7 prochains jours (champ birthday dans data JSONB).
7. BILAN HEBDO : Chaque dimanche, analyse tous les modules automatiquement.
8. CONTINUITÉ : Référence-toi aux messages précédents quand pertinent — "tu m'avais dit que…", "comme on en parlait la dernière fois…".
9. MODIFICATIONS : Quand tu proposes d'ajouter une tâche ou cocher une routine, ajoute en fin de message : ACTION_JSON:{"type":"add_task","data":{"title":"...","date":"...","category":"self"}}
10. Tu tutoies toujours l'utilisatrice. Réponses concises sauf pour les bilans.
11. Tu réponds UNIQUEMENT sur les sujets liés à l'app (planning, routines, recettes, famille, programme, bien-être). Pour tout autre sujet, redirige poliment.
- Maximum 4-5 phrases sauf pour les bilans. Pas de listes à 6+ points — maximum 4 points par liste.
- N'utilise JAMAIS ### ou ## dans tes réponses. Utilise uniquement le gras **texte** pour les titres.`
  }

  const executeAction = async (action: Action) => {
    if (!user) return
    try {
      if (action.type === 'add_task') {
        const { data } = await supabase.from('tasks').insert({
          user_id: user.id,
          status: 'pending',
          duration_hours: 1,
          color: '#E8B4A0',
          ...action.data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).select().single()
        if (data) {
          setAppContext(prev => prev ? { ...prev, tasks: [...prev.tasks, data] } : prev)
          addSystemMessage(`✅ Tâche "${action.data.title}" ajoutée au planner !`)
        }
      } else if (action.type === 'complete_routine') {
        await supabase.from('routines').update({
          completed: true,
          last_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', action.data.id).eq('user_id', user.id)
        setAppContext(prev => prev ? {
          ...prev,
          routines: prev.routines.map(r => r.id === action.data.id ? { ...r, completed: true } : r)
        } : prev)
        addSystemMessage(`✅ Routine marquée comme complétée !`)
      } else if (action.type === 'add_shopping') {
        const { data } = await supabase.from('shopping_lists').insert({
          user_id: user.id,
          checked: false,
          in_stock: false,
          to_buy: true,
          ...action.data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).select().single()
        if (data) {
          setAppContext(prev => prev ? { ...prev, shoppingList: [...prev.shoppingList, data] } : prev)
          addSystemMessage(`✅ Article ajouté à la liste de courses !`)
        }
      }
    } catch (error) {
      console.error('Erreur action:', error)
    }
  }

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: text,
      timestamp: new Date()
    }])
  }

  const parseActions = (content: string): { cleanContent: string, actions: Action[] } => {
    const actions: Action[] = []
    let cleanContent = content

    const regex = /ACTION_JSON:(\{.*?\}(?:\})*)/g
    let match
    while ((match = regex.exec(content)) !== null) {
      try {
        let jsonStr = ''
        let depth = 0
        let started = false
        for (let i = match.index + 12; i < content.length; i++) {
          if (content[i] === '{') { depth++; started = true }
          if (started) jsonStr += content[i]
          if (content[i] === '}') { depth-- }
          if (started && depth === 0) break
        }
        const action = JSON.parse(jsonStr)
        const labels: Record<string, string> = {
          add_task: '➕ Ajouter au planner',
          complete_routine: '✅ Marquer comme fait',
          add_shopping: '🛒 Ajouter aux courses',
          update_plan: '📅 Mettre à jour'
        }
        actions.push({ ...action, label: labels[action.type] || 'Confirmer' })
        cleanContent = cleanContent.replace('ACTION_JSON:' + jsonStr, '').trim()
      } catch (e) {
        console.error('Parse action error:', e)
      }
    }
    return { cleanContent, actions }
  }

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    setInput('')
    setShowHome(false)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    persistMessage('user', text)

    try {
      const ctx = appContext
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          systemPrompt: ctx ? buildSystemPrompt(ctx) : undefined,
          history: conversationHistory
        })
      })

      const data = await response.json()
      const rawContent = data.response || "Je n'ai pas pu traiter ta demande."
      const { cleanContent, actions } = parseActions(rawContent)

      const today = new Date()
      if (today.getDay() === 0 && text.toLowerCase().includes('bilan')) {
        const weekNumber = Math.ceil((today.getDate()) / 7)
        await supabase.from('weekly_debriefs').insert({
          user_id: user?.id,
          week_number: weekNumber,
          week_start: today.toISOString().split('T')[0],
          debrief_text: cleanContent,
          stats: {
            tasks_done: appContext?.tasks.filter((t: any) => t.status === 'completed').length || 0,
            routines_done: appContext?.routines.filter((r: any) => r.completed).length || 0,
            program_day: appContext?.programProgress?.current_day || 0
          }
        })
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        actions
      }])

      persistMessage('assistant', cleanContent)
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Erreur de connexion. Réessaie.",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatContent = (content: string) => {
    return content
      .replace(/### (.*?)(<br\/>|$)/g, '<strong style="font-size:0.9em;text-transform:uppercase;letter-spacing:0.05em;color:#9b8b7a;">$1</strong><br/>')
      .replace(/## (.*?)(<br\/>|$)/g, '<strong>$1</strong><br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  const resetToHome = () => {
    setShowHome(true)
  }

  if (authLoading || !historyLoaded) {
    return (
      <div className="flex flex-col h-screen bg-novae-cream items-center justify-center">
        <div className="text-novae-anthracite/40 text-sm">Chargement de NOVAÉ...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-novae-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-novae-beige/30 bg-white/80 backdrop-blur-sm">
        {showHome ? (
          <Link href="/" className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">←</span>
            <span className="text-sm">Accueil</span>
          </Link>
        ) : (
          <button onClick={resetToHome} className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">←</span>
            <span className="text-sm">Agent</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-sm font-bold">N</div>
          <div>
            <div className="font-semibold text-novae-anthracite text-sm">Agent NOVAÉ</div>
            <div className="text-xs text-novae-anthracite/50 flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${contextLoading ? 'bg-orange-400 animate-pulse' : appContext ? 'bg-green-400' : 'bg-gray-300'}`}></div>
              {contextLoading
                ? 'Synchronisation...'
                : appContext
                  ? `${appContext.tasks.length} tâches · ${appContext.mealPlans.length} repas · ${appContext.familyMembers.length} proches${appContext.currentMission ? ` · J${appContext.currentMission.day}` : ''}`
                  : 'Non connecté'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showHome && messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-novae-anthracite/30 hover:text-red-500 transition-colors p-1"
              title="Effacer l'historique"
            >
              🗑️
            </button>
          )}
          <button onClick={loadAppContext} className="text-novae-anthracite/40 hover:text-novae-gold transition-colors p-1" title="Actualiser">
            🔄
          </button>
        </div>
      </div>

      {/* Ecran d'accueil */}
      {showHome && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">N</div>
              <h1 className="text-2xl font-serif text-novae-anthracite mb-1">Agent NOVAÉ</h1>
              <p className="text-sm text-novae-anthracite/50">
                {appContext ? `Connecté · ${appContext.tasks.length} tâches · ${appContext.routines.length} routines · ${appContext.mealPlans.length} repas · Jour ${appContext.programProgress?.current_day || 0}/90` : 'Chargement de tes données...'}
              </p>
              {appContext?.currentMission && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(196,149,106,0.12), rgba(123,111,160,0.10))',
                  border: '1px solid rgba(196,149,106,0.3)',
                }}>
                  <p style={{ fontSize: 9, color: '#8b6f55', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, margin: '0 0 4px' }}>
                    🎯 Mission du jour · J{appContext.currentMission.day}
                  </p>
                  <p style={{ fontSize: 13, color: '#3d2618', fontWeight: 600, margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>
                    {appContext.currentMission.title}
                  </p>
                </div>
              )}
              {messages.length > 0 && (
                <p className="text-xs text-novae-gold/70 mt-2">
                  ✦ {messages.length} message{messages.length > 1 ? 's' : ''} dans ton historique
                </p>
              )}
              <p className="text-xs text-novae-anthracite/30 mt-2 italic px-4" style={{ lineHeight: 1.5 }}>
                ⚠️ Guide IA uniquement — Ne remplace pas un professionnel de santé, de coaching ou un médecin.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button key={idx} onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-2 p-3 bg-white rounded-xl border border-novae-beige/30 text-left hover:border-novae-gold/50 hover:bg-novae-gold/5 transition-all">
                  <span className="text-xl">{qp.icon}</span>
                  <span className="text-xs text-novae-anthracite/70 font-medium">{qp.label}</span>
                </button>
              ))}
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => setShowHome(false)}
                className="w-full py-3 mb-3 bg-novae-gold/10 border border-novae-gold/30 text-novae-gold rounded-xl text-sm font-medium hover:bg-novae-gold hover:text-white transition-all"
              >
                ✦ Reprendre la conversation
              </button>
            )}

            <div className="bg-white rounded-xl border border-novae-beige/20 p-4">
              <p className="text-xs text-novae-anthracite/40 mb-2 font-medium uppercase tracking-wide">Question libre</p>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ex: Ajoute une tâche demain à 9h..."
                  className="flex-1 text-sm text-novae-anthracite placeholder-novae-anthracite/30 bg-transparent focus:outline-none" />
                <button onClick={() => sendMessage()} disabled={!input.trim()}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${input.trim() ? 'bg-novae-gold text-white' : 'bg-novae-beige/30 text-novae-anthracite/30'}`}>
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ecran chat */}
      {!showHome && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1 ml-1">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-xs font-bold">N</div>
                      <span className="text-xs text-novae-anthracite/40">NOVAÉ</span>
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user'
                    ? 'bg-novae-gold text-white rounded-tr-sm'
                    : 'bg-white text-novae-anthracite rounded-tl-sm shadow-sm border border-novae-beige/20'
                    }`}>
                    <div dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
                  </div>
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 ml-1">
                      {message.actions.map((action, idx) => (
                        <button key={idx} onClick={() => executeAction(action)}
                          className="px-3 py-1.5 bg-novae-gold/10 border border-novae-gold/30 text-novae-gold rounded-full text-xs hover:bg-novae-gold hover:text-white transition-all">
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`text-xs text-novae-anthracite/30 mt-1 ${message.role === 'user' ? 'text-right' : 'ml-1'}`}>
                    {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-novae-beige/20">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="w-2 h-2 bg-novae-gold/60 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }}></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 pb-4 pt-2 bg-white/80 backdrop-blur-sm border-t border-novae-beige/20">
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Demande à NOVAÉ..."
                className="flex-1 resize-none rounded-xl border border-novae-beige/40 px-4 py-3 text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-2 focus:ring-novae-gold/30 bg-novae-cream/50 max-h-32"
                rows={1} style={{ minHeight: '44px' }} />
              <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${input.trim() && !isLoading ? 'bg-novae-gold text-white shadow-sm' : 'bg-novae-beige/30 text-novae-anthracite/30 cursor-not-allowed'}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}