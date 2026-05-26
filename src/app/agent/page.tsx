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

// Ton compte uniquement (bouton vers la page presentation privee)
const OWNER_ID = 'cce02eb0-53a1-49c0-82bc-1851a92f1e3c'

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

  // ── Voix (Web Speech API : micro + synthèse vocale) ──────────────────────
  const [voiceOn, setVoiceOn] = useState(false)
  const voiceOnRef = useRef(false)
  const [listening, setListening] = useState(false)
  const [sttSupported, setSttSupported] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const ttsVoiceRef = useRef<any>(null)
  const sendRef = useRef<(t?: string) => void>(() => {})
  const [speaking, setSpeaking] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voices, setVoices] = useState<any[]>([])
  const [voiceName, setVoiceName] = useState('')

  useEffect(() => {
    if (user && !authLoading) {
      loadAppContext()
      loadConversationHistory()
    }
  }, [user, authLoading])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Setup voix (une seule fois) ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      try {
        const rec = new SR()
        rec.lang = 'fr-FR'
        rec.interimResults = false
        rec.continuous = false
        rec.maxAlternatives = 1
        rec.onresult = (e: any) => {
          const transcript = e.results?.[0]?.[0]?.transcript || ''
          setListening(false)
          if (transcript.trim()) sendRef.current(transcript.trim())
        }
        rec.onerror = () => setListening(false)
        rec.onend = () => setListening(false)
        recognitionRef.current = rec
        setSttSupported(true)
      } catch { setSttSupported(false) }
    }
    if ('speechSynthesis' in window) {
      setTtsSupported(true)
      const loadVoices = () => {
        const all = window.speechSynthesis.getVoices()
        const fr = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('fr'))
        setVoices(fr)
        let chosen: any = null
        try {
          const saved = localStorage.getItem('novae-voice-name')
          if (saved) chosen = fr.find(v => v.name === saved) || null
        } catch {}
        if (!chosen) {
          chosen = fr.find(v => /amélie|audrey|virginie|f(é|e)min|female|google/i.test(v.name)) || fr[0] || null
        }
        ttsVoiceRef.current = chosen
        if (chosen) setVoiceName(chosen.name)
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
    return () => { try { window.speechSynthesis?.cancel() } catch {} }
  }, [])

  // Si on arrive depuis le bouton micro de l'accueil (/agent?voice=1) : voix ON + ecoute directe
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('voice') === '1') {
      setVoiceOn(true)
      voiceOnRef.current = true
      setVoiceMode(true)
      setShowHome(false)
      const t = setTimeout(() => {
        try { recognitionRef.current?.start(); setListening(true) } catch {}
      }, 800)
      return () => clearTimeout(t)
    }
  }, [])

  const speak = (raw: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const clean = raw
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/[#*_>`~]/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')              // emojis (chariot, cartable...)
      .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, '')                 // variation selectors / jointures
      .replace(/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/g, ' ')  // fleches, symboles, etoiles (✦ ✓ ☀)
      .replace(/[\u2022\u00B7]/g, ' ')                             // puces
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'fr-FR'
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current
    u.rate = 1
    u.pitch = 1.05
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }

  const toggleVoice = () => {
    setVoiceOn(prev => {
      const next = !prev
      voiceOnRef.current = next
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      return next
    })
  }

  const toggleMic = () => {
    const rec = recognitionRef.current
    if (!rec) return
    if (listening) { try { rec.stop() } catch {} ; setListening(false); return }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      rec.start()
      setListening(true)
    } catch { setListening(false) }
  }

  const enterVoiceMode = () => {
    setVoiceMode(true)
    setVoiceOn(true)
    voiceOnRef.current = true
    setShowHome(false)
    const rec = recognitionRef.current
    if (rec && !listening) {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
        rec.start()
        setListening(true)
      } catch {}
    }
  }

  const exitVoiceMode = () => {
    setVoiceMode(false)
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const changeVoice = (name: string) => {
    setVoiceName(name)
    const v = voices.find(x => x.name === name) || null
    ttsVoiceRef.current = v
    try { localStorage.setItem('novae-voice-name', name) } catch {}
  }

  // ── Memoire conversationnelle ────────────────────────────────────────────
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
    if (!confirm('Effacer tout ton historique de conversation avec NOVAE ? Cette action est irreversible.')) return
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

      const currentDay = progressRes.data?.current_day || 0
      const currentMission = currentDay > 0
        ? (missionsData as any[]).find((m: any) => m.day === currentDay) || null
        : null

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
      : 'Aucune allergie declaree'

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
            allergyConflicts.push(`ALERTE ALLERGIE : ${name} est allergique a "${allergen}" - present dans "${recipe.title}" planifie le ${m.day_of_week} (${m.meal_type})`)
          }
        })
      })
    })
    const allergyConflictsText = allergyConflicts.length > 0
      ? '\n\nALERTES ALLERGIE DETECTEES :\n' + allergyConflicts.join('\n')
      : ''

    const mealPlansText = relevantMealPlans.length > 0
      ? relevantMealPlans.map((m: any) => {
        const recipe = m.recipes
        if (!recipe) return `${m.day_of_week} ${m.meal_type} : ${m.custom_meal || 'Repas sans detail'}`
        const ingredientList = Array.isArray(recipe.ingredients)
          ? recipe.ingredients.map((i: any) => typeof i === 'string' ? i : i.name || '').filter(Boolean).join(', ')
          : ''
        return `${m.day_of_week} ${m.meal_type} : ${recipe.title} (ingredients : ${ingredientList || 'non renseignes'})`
      }).join('\n')
      : 'Aucun repas planifie pour le reste de la semaine'

    // Section MISSION DU JOUR
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

=== MISSION DU JOUR (J${m.day}/90 - Phase ${phase}) ===
Titre : ${m.title}
Guide : ${m.guide || m.description || ''}
${tasksText ? `Taches du jour :\n${tasksText}\n` : ''}${reflectionQuestion ? `Question de reflexion : ${reflectionQuestion}` : ''}

Quand l'utilisatrice te parle de "ma mission", "aujourd'hui", "ce que je dois faire", "le programme", c'est de cette mission qu'il s'agit. Tu peux la guider pour la reussir, expliquer le sens profond de la mission, l'aider a formuler sa reflexion, ou la motiver si elle traine.`
    } else if (ctx.programProgress?.current_day === 0 || !ctx.programProgress) {
      missionSection = `

=== PROGRAMME 90 JOURS ===
L'utilisatrice n'a pas encore demarre son programme 90 jours. Si elle te parle de "mission" ou "programme", encourage-la doucement a le demarrer depuis l'onglet Programme.`
    }

    // Section MODE TRAVERSEE DIFFICILE
    const struggleSection = ctx.struggle?.active ? `

=== MODE TRAVERSEE DIFFICILE ACTIVE ===
L'utilisatrice n'a pas valide de mission depuis ${ctx.struggle.daysSinceLastResponse} jours (derniere mission : J${ctx.struggle.lastResponseDay}).
Elle traverse peut-etre une periode compliquee. ADAPTE TA POSTURE :
- Sois plus douce, plus patiente, moins dans la performance
- N'empile JAMAIS de taches ni d'objectifs supplementaires
- Reconnais que c'est OK de ralentir, que la transformation n'est pas lineaire
- Propose UNE SEULE micro-action accessible (pas une liste)
- Demande-lui comment elle va, sans la presser de repondre
- Si elle veut juste parler, ecoute. Si elle veut juste etre validee, valide.
- BANNIS les phrases du type "tu peux le faire", "courage", "remets-toi en selle" - c'est l'inverse de ce dont elle a besoin
- Le plus important : elle compte, independamment de sa productivite
- Tu peux lui rappeler que reprendre ou elle s'est arretee est toujours possible - pas besoin de tout recommencer` : ''

    return `Tu es NOVAE, l'agent IA personnel de l'application RISE NOVAE. Tu es bienveillante, directe et orientee action.
DISCLAIMER OBLIGATOIRE : Tu es un guide IA, pas un professionnel de sante, de coaching, de nutrition ou de psychologie. Si l'utilisatrice mentionne une detresse emotionnelle serieuse, une maladie ou un probleme medical, oriente-la vers un professionnel qualifie.
Tu as acces en temps reel a TOUTES les donnees de l'utilisatrice ci-dessous. Tu DOIS les utiliser pour repondre - ne dis JAMAIS que tu n'y as pas acces.
Tu as aussi acces a ton historique de conversations passees avec elle - utilise-le pour assurer une continuite (rappels de discussions precedentes, suivi des engagements pris).
Aujourd'hui : ${ctx.dayOfWeek} ${ctx.todayDate}.${isSunday ? ' C est dimanche - propose un bilan hebdomadaire complet en fin de reponse.' : ''}
${struggleSection}
${missionSection}

=== DONNEES REELLES DE L'UTILISATRICE ===

TACHES AUJOURD'HUI (${todayTasks.length}) :
${todayTasks.length > 0 ? JSON.stringify(todayTasks, null, 2) : 'Aucune tache prevue aujourd hui'}

TACHES A VENIR - present et futur uniquement (${futureTasks.length} total) :
${JSON.stringify(futureTasks.slice(0, 15), null, 2)}

ROUTINES - FAITES (${doneRoutines.length}) :
${JSON.stringify(doneRoutines, null, 2)}

ROUTINES - EN ATTENTE (${pendingRoutines.length}) :
${JSON.stringify(pendingRoutines, null, 2)}

RECETTES DISPONIBLES (${ctx.recipes.length}) :
${ctx.recipes.slice(0, 10).map((r: any) => {
      const ingredientList = Array.isArray(r.ingredients)
        ? r.ingredients.map((i: any) => typeof i === 'string' ? i : i.name || '').filter(Boolean).join(', ')
        : ''
      return `- ${r.title} (${r.course || 'plat'}) : ${ingredientList}`
    }).join('\n')}

REPAS PLANIFIES CETTE SEMAINE - aujourd'hui c'est ${currentDayName} (${ctx.mealPlans.length} repas au total) :
${mealPlansText}

LISTE DE COURSES (${ctx.shoppingList.length} articles) :
${ctx.shoppingList.slice(0, 20).map((s: any) => `- ${s.ingredient}${s.quantity ? ' : ' + s.quantity : ''}`).join('\n') || 'Liste vide'}

MEMBRES DE LA FAMILLE (${ctx.familyMembers.length}) :
${JSON.stringify(ctx.familyMembers, null, 2)}

ALLERGIES FAMILLE (CRITIQUE - VERIFIER POUR CHAQUE RECETTE MENTIONNEE) :
${allergiesText}
${allergyConflictsText}

PROGRAMME 90 JOURS - Avancement :
${ctx.programProgress ? JSON.stringify(ctx.programProgress, null, 2) : 'Aucun programme demarre'}

${ctx.profile ? `
=== PROFIL PSYCHOLOGIQUE DE L'UTILISATRICE ===
- Pseudo : ${ctx.profile.pseudo || 'non renseigne'}
- Objectif : ${ctx.profile.objectif || 'non renseigne'}
- Bloqueurs : ${ctx.profile.bloqueurs || 'non renseignes'}
- Etat emotionnel de depart : ${ctx.profile.etat_emotionnel || 'non renseigne'}
- Temps disponible/jour : ${ctx.profile.temps_disponible || 'non renseigne'}
- Motivation profonde : ${ctx.profile.motivation || 'non renseignee'}
- Reaction a l'echec : ${ctx.profile.reaction_echec || 'non renseignee'}
- Environnement social : ${ctx.profile.environnement_social || 'non renseigne'}
- Domaine prioritaire : ${ctx.profile.domaine_prioritaire || 'non renseigne'}
- Vision succes 90j : ${ctx.profile.signal_succes || 'non renseignee'}
- Ton souhaite : ${ctx.profile.ton_souhaite || 'bienveillant'}
ADAPTE TON TON ET TES CONSEILS a ce profil a chaque reponse. Cale tes propositions sur le temps disponible (ne propose pas 1h de meditation si elle a 15 min).
` : ''}

=== TES REGLES ===
1. Tu UTILISES toujours les donnees ci-dessus pour repondre. Tu ne demandes JAMAIS a l'utilisatrice d'aller verifier elle-meme.
2. MISSION DU JOUR : Si elle te demande quelque chose en lien avec son programme/mission/aujourd hui, refere-toi a la section "MISSION DU JOUR" ci-dessus.
3. ARBITRE DU TEMPS : Detecte automatiquement les conflits entre routines, planner et recettes.
4. BATCH COOKING : Si des recettes planifiees ont des ingredients communs, propose un plan batch cooking.
5. ALLERGIES - REGLE ABSOLUE : Pour chaque recette mentionnee ou analysee, verifie IMMEDIATEMENT si ses ingredients contiennent un allergene de la section "ALLERGIES FAMILLE". Si oui, affiche : "ALLERGIE : [prenom] est allergique a [ingredient] present dans [recette]."
6. FAMILLE : Alerte sur les anniversaires dans les 7 prochains jours (champ birthday dans data JSONB).
7. BILAN HEBDO : Chaque dimanche, analyse tous les modules automatiquement.
8. CONTINUITE : Refere-toi aux messages precedents quand pertinent.
9. MODIFICATIONS : Quand tu proposes d'ajouter une tache ou cocher une routine, ajoute en fin de message : ACTION_JSON:{"type":"add_task","data":{"title":"...","date":"...","category":"self"}}
10. Tu tutoies toujours l'utilisatrice. Reponses concises sauf pour les bilans.
11. Tu reponds UNIQUEMENT sur les sujets lies a l'app. Pour tout autre sujet, redirige poliment.
- Maximum 4-5 phrases sauf pour les bilans. Pas de listes a 6+ points - maximum 4 points par liste.
- N'utilise JAMAIS ### ou ## dans tes reponses. Utilise uniquement le gras **texte** pour les titres.`
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
          addSystemMessage('Tache "' + action.data.title + '" ajoutee au planner !')
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
        addSystemMessage('Routine marquee comme completee !')
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
          addSystemMessage('Article ajoute a la liste de courses !')
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
          add_task: 'Ajouter au planner',
          complete_routine: 'Marquer comme fait',
          add_shopping: 'Ajouter aux courses',
          update_plan: 'Mettre a jour'
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

      // Auth : récupère le token Supabase pour l'envoyer à l'API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Session expirée. Reconnecte-toi pour continuer.",
          timestamp: new Date()
        }])
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          clientContext: ctx ? buildSystemPrompt(ctx) : undefined,
          history: conversationHistory
        })
      })

      // 403 = pas Premium → on affiche un paywall dans la conversation
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `🔒 **L'Agent IA est réservé aux membres Premium**\n\n${errorData.message || "Souscris pour échanger sans limite avec ton coach NOVAÉ."}\n\n[**✦ Découvrir Premium →**](/subscribe)`,
          timestamp: new Date()
        }])
        setIsLoading(false)
        return
      }

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
      if (voiceOnRef.current) speak(cleanContent)
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Erreur de connexion. Reessaie.",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Garde sendRef a jour pour que le micro envoie toujours avec le contexte frais
  useEffect(() => { sendRef.current = sendMessage })

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
        <div className="text-novae-anthracite/40 text-sm">Chargement de NOVAE...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-novae-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-novae-beige/30 bg-white/80 backdrop-blur-sm">
        {showHome ? (
          <Link href="/" className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">{'<-'}</span>
            <span className="text-sm">Accueil</span>
          </Link>
        ) : (
          <button onClick={resetToHome} className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">{'<-'}</span>
            <span className="text-sm">Agent</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-sm font-bold">N</div>
          <div>
            <div className="font-semibold text-novae-anthracite text-sm">Agent NOVAE</div>
            <div className="text-xs text-novae-anthracite/50 flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${contextLoading ? 'bg-orange-400 animate-pulse' : appContext ? 'bg-green-400' : 'bg-gray-300'}`}></div>
              {contextLoading
                ? 'Synchronisation...'
                : appContext
                  ? `${appContext.tasks.length} taches - ${appContext.mealPlans.length} repas - ${appContext.familyMembers.length} proches${appContext.currentMission ? ' - J' + appContext.currentMission.day : ''}`
                  : 'Non connecte'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {user?.id === OWNER_ID && (
            <Link
              href="/presentation"
              title="Page presentation (toi seule)"
              className="text-novae-anthracite/30 hover:text-novae-gold transition-colors p-1 text-base leading-none"
            >
              🎬
            </Link>
          )}
          {ttsSupported && (
            <button
              onClick={toggleVoice}
              className={`p-1 transition-colors ${voiceOn ? 'text-novae-gold' : 'text-novae-anthracite/30 hover:text-novae-gold'}`}
              title={voiceOn ? 'Voix de Nova activee (clique pour couper)' : 'Activer la voix de Nova'}
            >
              {voiceOn ? '🔊' : '🔇'}
            </button>
          )}
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

      {/* Ecran d accueil */}
      {showHome && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-novae-gold to-novae-rose flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">N</div>
              <h1 className="text-2xl font-serif text-novae-anthracite mb-1">Agent NOVAE</h1>
              <p className="text-sm text-novae-anthracite/50">
                {appContext
                  ? 'Connecte - ' + appContext.tasks.length + ' taches - ' + appContext.routines.length + ' routines - ' + appContext.mealPlans.length + ' repas - Jour ' + (appContext.programProgress?.current_day || 0) + '/90'
                  : 'Chargement de tes donnees...'}
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
                    Mission du jour - J{appContext.currentMission.day}
                  </p>
                  <p style={{ fontSize: 13, color: '#3d2618', fontWeight: 600, margin: 0, fontFamily: "'Cormorant Garamond', serif" }}>
                    {appContext.currentMission.title}
                  </p>
                </div>
              )}
              {messages.length > 0 && (
                <p className="text-xs text-novae-gold/70 mt-2">
                  {messages.length} message{messages.length > 1 ? 's' : ''} dans ton historique
                </p>
              )}
              <p className="text-xs text-novae-anthracite/30 mt-2 italic px-4" style={{ lineHeight: 1.5 }}>
                Guide IA uniquement - Ne remplace pas un professionnel de sante, de coaching ou un medecin.
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
                Reprendre la conversation
              </button>
            )}

            <div className="bg-white rounded-xl border border-novae-beige/20 p-4">
              <p className="text-xs text-novae-anthracite/40 mb-2 font-medium uppercase tracking-wide">Question libre</p>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Ex: Ajoute une tache demain a 9h..."
                  className="flex-1 text-sm text-novae-anthracite placeholder-novae-anthracite/30 bg-transparent focus:outline-none" />
                {sttSupported && (
                  <button onClick={enterVoiceMode}
                    title="Parler a Nova"
                    className="px-3 py-1.5 rounded-lg text-sm transition-all bg-novae-rose/20 text-novae-anthracite/50 hover:bg-novae-rose/40">
                    🎙️
                  </button>
                )}
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
                      <span className="text-xs text-novae-anthracite/40">NOVAE</span>
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
                placeholder="Demande a NOVAE..."
                className="flex-1 resize-none rounded-xl border border-novae-beige/40 px-4 py-3 text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-2 focus:ring-novae-gold/30 bg-novae-cream/50 max-h-32"
                rows={1} style={{ minHeight: '44px' }} />
              {sttSupported && (
                <button onClick={enterVoiceMode}
                  title="Parler a Nova"
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 bg-novae-rose/20 text-novae-anthracite/60 hover:bg-novae-rose/40">
                  🎙️
                </button>
              )}
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

      {/* ════ MODE VOCAL : orbe centre, transcription derriere ════ */}
      {voiceMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(243, 220, 198, 0.80)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 18, padding: 24,
        }}>
          <button onClick={exitVoiceMode} style={{
            position: 'absolute', top: 18, right: 18, border: '1px solid rgba(139,90,60,0.3)',
            background: 'rgba(255,255,255,0.7)', borderRadius: 999, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, color: '#5c4530', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>✕ Écrire</button>

          <div className={`vo-stage${(listening || speaking) ? ' vo-active' : ''}`}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="vo-ray-wrap" style={{ transform: `rotate(${i * 15}deg)` }}>
                <div className="vo-ray" style={{ animationDelay: `${i * 0.05}s` }} />
              </div>
            ))}
            <div className="vo-core">N</div>
          </div>

          <p style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
            fontSize: 22, color: '#3d2618', margin: 0, textAlign: 'center',
          }}>
            {listening ? "Je t'écoute…" : speaking ? 'Nova répond…' : 'Touche le micro et parle-moi'}
          </p>

          <button onClick={toggleMic} style={{
            width: 66, height: 66, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: listening ? 'linear-gradient(135deg,#c44757,#8b2d3d)' : 'linear-gradient(135deg,#c4956a,#b07d5a)',
            color: '#fff', fontSize: 26, boxShadow: '0 8px 22px rgba(176,125,90,0.4)',
          }}>{listening ? '⏹' : '🎙️'}</button>

          {voices.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8b6f55', fontWeight: 600 }}>
                Voix de Nova
              </span>
              <select value={voiceName} onChange={(e) => changeVoice(e.target.value)} style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#3d2618',
                background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(139,90,60,0.3)',
                borderRadius: 10, padding: '8px 12px', maxWidth: 280,
              }}>
                {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <style>{`
        .vo-stage { position: relative; width: 240px; height: 240px; display: flex; align-items: center; justify-content: center; }
        .vo-ray-wrap { position: absolute; inset: 0; display: flex; justify-content: center; }
        .vo-ray { width: 4px; height: 16px; margin-top: 8px; border-radius: 4px;
          background: linear-gradient(#C9A96E, #E0A9B6); transform-origin: center top;
          transform: scaleY(0.6); opacity: .45; }
        .vo-stage.vo-active .vo-ray { animation: voRay 1.1s ease-in-out infinite; }
        @keyframes voRay { 0%, 100% { transform: scaleY(0.5); opacity: .4; } 50% { transform: scaleY(1.5); opacity: 1; } }
        .vo-core { width: 130px; height: 130px; border-radius: 50%;
          background: radial-gradient(120% 120% at 35% 30%, #F4D7B0, #C9A96E 45%, #E0A9B6 100%);
          display: flex; align-items: center; justify-content: center; color: #fff;
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 700; font-size: 58px;
          box-shadow: 0 12px 40px rgba(196,149,106,.4); z-index: 2; }
      `}</style>

    </div>
  )
}