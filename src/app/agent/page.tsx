'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import missionsData from '@/data/missions.json'
import { detectStruggleMode, type StruggleState } from '@/lib/struggle/detect'
import Navigation from '@/components/Navigation'
import { logEvent } from '@/lib/events'


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

interface Thread { id: string; title: string | null; updated_at: string }

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

const OWNER_ID = 'cce02eb0-53a1-49c0-82bc-1851a92f1e3c'

const LAV = '#8A6FB0'
const LAV_SOFT = '#D4C4E2'

export default function AgentPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [appContext, setAppContext] = useState<AppContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [showHome, setShowHome] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [novaBadge, setNovaBadge] = useState(false) // badge message Nova en attente

  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const activeThreadIdRef = useRef<string | null>(null)
  useEffect(() => { activeThreadIdRef.current = activeThreadId }, [activeThreadId])

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
  const [paused, setPaused] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [rate, setRate] = useState(1)
  const [pitch, setPitch] = useState(1.05)
  const voiceModeRef = useRef(false)
  const pausedRef = useRef(false)
  const speakingRef = useRef(false)
  const rateRef = useRef(1)
  const pitchRef = useRef(1.05)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speakingRef.current = speaking }, [speaking])
  useEffect(() => { rateRef.current = rate }, [rate])
  useEffect(() => { pitchRef.current = pitch }, [pitch])
  useEffect(() => {
  if (!user) return
  logEvent(supabase, user.id, 'module_programme')   

}, [user])

  // ── Répertoire ──
  const loadThreads = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('agent_threads')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      setThreads((data as Thread[]) || [])
    } catch (err) {
      console.error('[agent] threads load error:', err)
    } finally {
      setHistoryLoaded(true)
    }
  }

  // ── Vérifier si Nova a un message en attente ──
  const checkNovaPendingMessages = async () => {
    if (!user) return
    console.log('User ID:', user?.id)
    try {
      const { data } = await supabase
        .from('nova_pending_messages')
        .select ('id')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .limit(1)
      setNovaBadge((data || []).length > 0)
    } catch (err) {
      console.error('[agent] nova pending check error:', err)
    }
  }

  // ── Ouvrir le thread Nova depuis une notif ──
  const openNovaThread = async (threadId: string) => {
    if (!user) return
    setActiveThreadId(threadId)
    activeThreadIdRef.current = threadId
    setShowHome(false)

    try {
      // Charger le message Nova en attente
      const { data: novaMsgs } = await supabase
        .from('nova_pending_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('thread_id', threadId)
        .eq('is_read', false)
        .limit(1)

      if (novaMsgs && novaMsgs.length > 0) {
        const novaMsg = novaMsgs[0]

        // Marquer comme lu
        await supabase
          .from('nova_pending_messages')
          .update({ is_read: true })
          .eq('id', novaMsg.id)

        setNovaBadge(false)

        // Créer le thread en base si pas encore fait
        const { data: existingThread } = await supabase
          .from('agent_threads')
          .select('id')
          .eq('id', threadId)
          .maybeSingle()

        if (!existingThread) {
          await supabase.from('agent_threads').insert({
            id: threadId,
            user_id: user.id,
            title: 'Nova 💜',
            updated_at: new Date().toISOString()
          })
        }

        // Persister le message Nova en base conversations si pas encore fait
        const { data: existingConv } = await supabase
          .from('agent_conversations')
          .select('id')
          .eq('thread_id', threadId)
          .limit(1)

        if (!existingConv || existingConv.length === 0) {
          await supabase.from('agent_conversations').insert({
            user_id: user.id,
            role: 'assistant',
            content: novaMsg.message,
            thread_id: threadId
          })
        }

        // Afficher le message Nova
        setMessages([{
          id: novaMsg.id,
          role: 'assistant',
          content: novaMsg.message,
          timestamp: new Date(novaMsg.created_at)
        }])

        loadThreads()
      } else {
        // Thread déjà lu, charger les messages normalement
        await openThread(threadId)
      }
    } catch (err) {
      console.error('[agent] openNovaThread error:', err)
    }
  }

  const newConversation = () => {
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setActiveThreadId(id)
    activeThreadIdRef.current = id
    setMessages([])
    setShowHome(false)
  }

  const openThread = async (threadId: string) => {
    if (!user) return
    setActiveThreadId(threadId)
    activeThreadIdRef.current = threadId
    setShowHome(false)
    try {
      const { data } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      setMessages((data || []).map((row: any) => ({
        id: row.id, role: row.role, content: row.content, timestamp: new Date(row.created_at),
      })))
    } catch (err) {
      console.error('[agent] open thread error:', err)
    }
  }

  const deleteThread = async (threadId: string) => {
    if (!user) return
    if (!confirm('Supprimer cette conversation ? Action irréversible.')) return
    try {
      await supabase.from('agent_conversations').delete().eq('user_id', user.id).eq('thread_id', threadId)
      await supabase.from('agent_threads').delete().eq('id', threadId).eq('user_id', user.id)
      setThreads(prev => prev.filter(t => t.id !== threadId))
      if (activeThreadIdRef.current === threadId) {
        setMessages([])
        setActiveThreadId(null)
        activeThreadIdRef.current = null
        setShowHome(true)
      }
    } catch (err) {
      console.error('[agent] delete thread error:', err)
    }
  }

  const threadDate = (s: string) => {
    const d = new Date(s), now = new Date(), diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
    if (mins < 1) return "à l'instant"
    if (mins < 60) return `il y a ${mins} min`
    if (h < 24) return `il y a ${h} h`
    if (days < 7) return `il y a ${days} j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // ── Init ──
  useEffect(() => {
    if (user && !authLoading) {
      loadAppContext()
      loadThreads()
      checkNovaPendingMessages()
    }
  }, [user, authLoading])

  // ── Détecter ?nova_thread= dans l'URL ──
  useEffect(() => {
    if (!user || authLoading) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const novaThread = params.get('nova_thread')
    if (novaThread) {
      openNovaThread(novaThread)
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/agent')
    }
  }, [user, authLoading])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Setup voix ──
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
        rec.onend = () => {
          setListening(false)
          if (voiceModeRef.current && !pausedRef.current && !speakingRef.current) {
            setTimeout(() => {
              if (voiceModeRef.current && !pausedRef.current && !speakingRef.current) {
                try { recognitionRef.current?.start(); setListening(true) } catch {}
              }
            }, 450)
          }
        }
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
      try {
        const r = parseFloat(localStorage.getItem('novae-voice-rate') || '')
        const p = parseFloat(localStorage.getItem('novae-voice-pitch') || '')
        if (!isNaN(r)) { setRate(r); rateRef.current = r }
        if (!isNaN(p)) { setPitch(p); pitchRef.current = p }
      } catch {}
    }
    return () => { try { window.speechSynthesis?.cancel() } catch {} }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('voice') === '1') {
      setVoiceOn(true); voiceOnRef.current = true
      newConversation()
      setVoiceMode(true); voiceModeRef.current = true
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
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, '')
      .replace(/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/g, ' ')
      .replace(/[\u2022\u00B7]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'fr-FR'
    if (ttsVoiceRef.current) u.voice = ttsVoiceRef.current
    u.rate = rateRef.current
    u.pitch = pitchRef.current
    u.onstart = () => {
      setSpeaking(true); speakingRef.current = true
      try { recognitionRef.current?.stop() } catch {}
      setListening(false)
    }
    const reopen = () => {
      setSpeaking(false); speakingRef.current = false
      if (voiceModeRef.current && !pausedRef.current) {
        setTimeout(() => {
          if (voiceModeRef.current && !pausedRef.current) {
            try { recognitionRef.current?.start(); setListening(true) } catch {}
          }
        }, 500)
      }
    }
    u.onend = reopen
    u.onerror = reopen
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

  const enterVoiceMode = () => {
    setVoiceMode(true); voiceModeRef.current = true
    setVoiceOn(true); voiceOnRef.current = true
    setPaused(false); pausedRef.current = false
    setShowHome(false)
    const rec = recognitionRef.current
    if (rec && !listening) {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
        rec.start(); setListening(true)
      } catch {}
    }
  }

  const exitVoiceMode = () => {
    setVoiceMode(false); voiceModeRef.current = false
    setPaused(false); pausedRef.current = false
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false); speakingRef.current = false
    setShowVoiceSettings(false)
  }

  const togglePause = () => {
    if (pausedRef.current) {
      setPaused(false); pausedRef.current = false
      try { recognitionRef.current?.start(); setListening(true) } catch {}
    } else {
      setPaused(true); pausedRef.current = true
      try { recognitionRef.current?.stop() } catch {}
      setListening(false)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
      setSpeaking(false); speakingRef.current = false
    }
  }

  const changeVoice = (name: string) => {
    setVoiceName(name)
    const v = voices.find(x => x.name === name) || null
    ttsVoiceRef.current = v
    try { localStorage.setItem('novae-voice-name', name) } catch {}
  }
  const changeRate = (val: number) => { setRate(val); rateRef.current = val; try { localStorage.setItem('novae-voice-rate', String(val)) } catch {} }
  const changePitch = (val: number) => { setPitch(val); pitchRef.current = val; try { localStorage.setItem('novae-voice-pitch', String(val)) } catch {} }

  // ── Persistance ──
  const persistMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!user) return
    let threadId = activeThreadIdRef.current
    if (!threadId) {
      threadId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setActiveThreadId(threadId); activeThreadIdRef.current = threadId
    }
    try {
      if (role === 'user') {
        const { data: existing } = await supabase.from('agent_threads').select('id').eq('id', threadId).maybeSingle()
        if (!existing) {
          await supabase.from('agent_threads').insert({ id: threadId, user_id: user.id, title: content.slice(0, 48), updated_at: new Date().toISOString() })
        } else {
          await supabase.from('agent_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
        }
      } else {
        await supabase.from('agent_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
      }
      await supabase.from('agent_conversations').insert({ user_id: user.id, role, content, thread_id: threadId })
      loadThreads()
    } catch (err) {
      console.error('[agent] persist error:', err)
    }
  }

  // ── Contexte app ──
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
      const currentMission = currentDay > 0 ? (missionsData as any[]).find((m: any) => m.day === currentDay) || null : null
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

  // ── Suggestions proactives ──
  const proactiveSuggestions: { icon: string; label: string; prompt: string }[] = (() => {
    const ctx = appContext
    if (!ctx) return []
    const out: { icon: string; label: string; prompt: string }[] = []
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    if (today.getDay() === 0)
      out.push({ icon: '📊', label: 'Faire mon bilan de la semaine', prompt: 'Fais-moi le bilan complet de ma semaine et aide-moi à préparer la suivante.' })
    if (ctx.struggle?.active)
      out.push({ icon: '🌙', label: 'Souffler un peu, juste parler', prompt: "Je traverse une période plus calme. J'ai juste besoin d'échanger un moment." })

    const allergyConflict = (() => {
      const members = (ctx.familyMembers || []).filter((m: any) => m.data?.allergies?.length)
      for (const m of members) {
        const al = Array.isArray(m.data.allergies) ? m.data.allergies : [m.data.allergies]
        for (const mp of (ctx.mealPlans || [])) {
          const r = mp.recipes; if (!r) continue
          const ings = Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => (typeof i === 'string' ? i : i.name || '').toLowerCase()) : []
          if (al.some((a: string) => ings.some((ing: string) => ing.includes(String(a).toLowerCase().trim())))) return true
        }
      }
      return false
    })()
    if (allergyConflict)
      out.push({ icon: '⚠️', label: 'Vérifier les allergies de mes repas', prompt: 'Vérifie les allergies dans mes repas planifiés cette semaine et propose des remplacements.' })

    const bday = (ctx.familyMembers || []).find((m: any) => {
      const b = m.data?.birthday; if (!b) return false
      const d = new Date(b); if (isNaN(d.getTime())) return false
      const next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      if (next < todayMid) next.setFullYear(today.getFullYear() + 1)
      const diff = Math.ceil((next.getTime() - todayMid.getTime()) / 86400000)
      return diff >= 0 && diff <= 7
    })
    if (bday)
      out.push({ icon: '🎂', label: 'Anniversaire à venir cette semaine', prompt: "Y a-t-il des anniversaires familiaux dans les 7 prochains jours ? Aide-moi à m'organiser." })

    if (ctx.currentMission)
      out.push({ icon: '🎯', label: `Ma mission du jour (J${ctx.currentMission.day})`, prompt: "Aide-moi sur ma mission du jour : son objectif, un plan d'action concret pour aujourd'hui, et une inspiration adaptée à mon profil." })

    const todayTasks = (ctx.tasks || []).filter((t: any) => t.date && String(t.date).startsWith(todayStr))
    if (todayTasks.length > 0)
      out.push({ icon: '📋', label: `Organiser ma journée (${todayTasks.length})`, prompt: "Qu'est-ce que j'ai prévu aujourd'hui ? Aide-moi à organiser ma journée." })

    if ((ctx.mealPlans || []).length > 0)
      out.push({ icon: '🍳', label: 'Plan batch cooking de la semaine', prompt: 'Regarde mes recettes planifiées et propose un plan batch cooking avec les ingrédients en commun.' })

    out.push({ icon: '⚡', label: 'Détecter les conflits de mon planning', prompt: 'Analyse mon planning (routines, événements, repas) et détecte les conflits. Propose des ajustements.' })

    return out.slice(0, 4)
  })()

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
        return { name, allergies: Array.isArray(a) ? a : [a] }
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
          if (ingredients.some((ing: string) => ing.includes(allergenLower))) {
            allergyConflicts.push(`ALERTE ALLERGIE : ${name} est allergique a "${allergen}" - present dans "${recipe.title}" planifie le ${m.day_of_week} (${m.meal_type})`)
          }
        })
      })
    })
    const allergyConflictsText = allergyConflicts.length > 0 ? '\n\nALERTES ALLERGIE DETECTEES :\n' + allergyConflicts.join('\n') : ''

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

    let missionSection = ''
    if (ctx.currentMission) {
      const m = ctx.currentMission
      const phase = m.phase || (m.day <= 30 ? 'Reprogrammation' : m.day <= 60 ? 'Action & Discipline' : 'Expansion')
      const reflectionQuestion = m.question || m.reflection?.question || ''
      const tasksText = Array.isArray(m.tasks)
        ? m.tasks.map((t: any) => typeof t === 'string' ? t : t.label || '').filter(Boolean).map((s: string) => `  - ${s}`).join('\n')
        : ''
      missionSection = `

=== MISSION DU JOUR (J${m.day}/90 - Phase ${phase}) ===
Titre : ${m.title}
Guide : ${m.guide || m.description || ''}
${tasksText ? `Taches du jour :\n${tasksText}\n` : ''}${reflectionQuestion ? `Question de reflexion : ${reflectionQuestion}` : ''}

Quand l'utilisatrice te parle de "ma mission", "aujourd'hui", "ce que je dois faire", "le programme", c'est de cette mission qu'il s'agit.`
    } else if (ctx.programProgress?.current_day === 0 || !ctx.programProgress) {
      missionSection = `

=== PROGRAMME 90 JOURS ===
L'utilisatrice n'a pas encore demarre son programme 90 jours. Si elle te parle de "mission" ou "programme", encourage-la doucement a le demarrer depuis l'onglet Programme.`
    }

    const struggleSection = ctx.struggle?.active ? `

=== MODE TRAVERSEE DIFFICILE ACTIVE ===
L'utilisatrice n'a pas valide de mission depuis ${ctx.struggle.daysSinceLastResponse} jours (derniere mission : J${ctx.struggle.lastResponseDay}).
ADAPTE TA POSTURE : plus douce, moins de performance, JAMAIS de liste de taches, UNE seule micro-action max, ecoute. Bannis "courage"/"tu peux le faire". En mode proactif (regle 12), ta proactivite devient une simple question douce, pas une suggestion d'action.` : ''

    return `Tu es NOVA, l'agent IA personnel de l'application NOVAÉ (RISE). Tu es bienveillante, directe, orientee action et PROACTIVE.
DISCLAIMER OBLIGATOIRE : Tu es un guide IA, pas un professionnel de sante, de coaching, de nutrition ou de psychologie. Si l'utilisatrice mentionne une detresse emotionnelle serieuse, une maladie ou un probleme medical, oriente-la vers un professionnel qualifie.
Tu as acces en temps reel a TOUTES les donnees de l'utilisatrice ci-dessous. Tu DOIS les utiliser pour repondre - ne dis JAMAIS que tu n'y as pas acces.
Tu as aussi acces a ton historique de conversations passees avec elle - utilise-le pour assurer une continuite.
Aujourd'hui : ${ctx.dayOfWeek} ${ctx.todayDate}.${isSunday ? ' C est dimanche - propose un bilan hebdomadaire complet en fin de reponse.' : ''}
${struggleSection}
${missionSection}

=== DONNEES REELLES DE L'UTILISATRICE ===

TACHES AUJOURD'HUI (${todayTasks.length}) :
${todayTasks.length > 0 ? JSON.stringify(todayTasks, null, 2) : 'Aucune tache prevue aujourd hui'}

TACHES A VENIR (${futureTasks.length} total) :
${JSON.stringify(futureTasks.slice(0, 15), null, 2)}

ROUTINES - FAITES (${doneRoutines.length}) :
${JSON.stringify(doneRoutines, null, 2)}

ROUTINES - EN ATTENTE (${pendingRoutines.length}) :
${JSON.stringify(pendingRoutines, null, 2)}

RECETTES DISPONIBLES (${ctx.recipes.length}) :
${ctx.recipes.slice(0, 10).map((r: any) => {
      const ingredientList = Array.isArray(r.ingredients) ? r.ingredients.map((i: any) => typeof i === 'string' ? i : i.name || '').filter(Boolean).join(', ') : ''
      return `- ${r.title} (${r.course || 'plat'}) : ${ingredientList}`
    }).join('\n')}

REPAS PLANIFIES - aujourd'hui c'est ${currentDayName} (${ctx.mealPlans.length} repas) :
${mealPlansText}

LISTE DE COURSES (${ctx.shoppingList.length} articles) :
${ctx.shoppingList.slice(0, 20).map((s: any) => `- ${s.ingredient}${s.quantity ? ' : ' + s.quantity : ''}`).join('\n') || 'Liste vide'}

MEMBRES DE LA FAMILLE (${ctx.familyMembers.length}) :
${JSON.stringify(ctx.familyMembers, null, 2)}

ALLERGIES FAMILLE (CRITIQUE) :
${allergiesText}
${allergyConflictsText}

PROGRAMME 90 JOURS :
${ctx.programProgress ? JSON.stringify(ctx.programProgress, null, 2) : 'Aucun programme demarre'}

${ctx.profile ? `
=== PROFIL DE L'UTILISATRICE ===
- Pseudo : ${ctx.profile.pseudo || 'non renseigne'}
- Objectif : ${ctx.profile.objectif || 'non renseigne'}
- Bloqueurs : ${ctx.profile.bloqueurs || 'non renseignes'}
- Temps disponible/jour : ${ctx.profile.temps_disponible || 'non renseigne'}
- Motivation profonde : ${ctx.profile.motivation || 'non renseignee'}
- Domaine prioritaire : ${ctx.profile.domaine_prioritaire || 'non renseigne'}
- Ton souhaite : ${ctx.profile.ton_souhaite || 'bienveillant'}
ADAPTE TON TON ET TES CONSEILS a ce profil. Cale tes propositions sur le temps disponible.
` : ''}

=== TES REGLES ===
1. Tu UTILISES toujours les donnees ci-dessus. Tu ne demandes JAMAIS a l'utilisatrice d'aller verifier elle-meme.
2. MISSION DU JOUR : refere-toi a la section dediee ci-dessus.
3. ARBITRE DU TEMPS : detecte les conflits entre routines, planner et recettes.
4. BATCH COOKING : si des recettes planifiees partagent des ingredients, propose un plan.
5. ALLERGIES - REGLE ABSOLUE : pour chaque recette, verifie les allergenes. Si conflit : "ALLERGIE : [prenom] est allergique a [ingredient] present dans [recette]."
6. FAMILLE : alerte sur les anniversaires dans les 7 prochains jours (champ birthday).
7. BILAN HEBDO : chaque dimanche, analyse tous les modules.
8. CONTINUITE : refere-toi aux messages precedents quand pertinent.
9. ACTIONS : pour ajouter une tache ou cocher une routine, ajoute en fin de message : ACTION_JSON:{"type":"add_task","data":{"title":"...","date":"...","category":"self"}}
10. Tu tutoies toujours. Reponses concises (max 4-5 phrases) sauf bilans. Max 4 points par liste. Jamais de ### ou ## (gras **texte** uniquement).
11. Tu reponds UNIQUEMENT sur les sujets lies a l'app. Sinon, redirige poliment.
12. PROACTIVITE (IMPORTANT) : tu ANTICIPES. Apres avoir traite la demande, repere le besoin le plus pertinent a venir (conflit de planning, alerte allergie, anniversaire <7j, mission en retard, dimanche=bilan, courses manquantes) et propose SPONTANEMENT une seule prochaine action utile - sans qu'on te le demande, en une phrase. En mode traversee difficile, cette proactivite devient une simple question douce.`
  }

  const executeAction = async (action: Action) => {
    if (!user) return
    try {
    if (action.type === 'add_task') {
        const { data } = await supabase.from('todo_list').insert({
          user_id: user.id, status: 'pending', priority: 'medium',
          title: action.data.title, due_date: action.data.date ?? null,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).select().single()
        if (data) {
          setAppContext(prev => prev ? { ...prev, tasks: [...prev.tasks, data] } : prev)
          addSystemMessage('Tache "' + action.data.title + '" ajoutee a ta to-do !')
        }
      } else if (action.type === 'complete_routine') {
        await supabase.from('routines').update({ completed: true, last_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', action.data.id).eq('user_id', user.id)
        setAppContext(prev => prev ? { ...prev, routines: prev.routines.map(r => r.id === action.data.id ? { ...r, completed: true } : r) } : prev)
        addSystemMessage('Routine marquee comme completee !')
      } else if (action.type === 'add_shopping') {
        const { data } = await supabase.from('shopping_list').insert({
          user_id: user.id, checked: false, in_stock: false, to_buy: true,
          ...action.data, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
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
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: text, timestamp: new Date() }])
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
        const labels: Record<string, string> = { add_task: 'Ajouter au planner', complete_routine: 'Marquer comme fait', add_shopping: 'Ajouter aux courses', update_plan: 'Mettre a jour' }
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

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    persistMessage('user', text)

    try {
      const ctx = appContext
      const conversationHistory = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Session expirée. Reconnecte-toi pour continuer.", timestamp: new Date() }])
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({message: text, history: conversationHistory 
        })
      })

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `🔒 **L'Agent IA est réservé aux membres Premium**\n\n${errorData.message || "Souscris pour échanger sans limite avec ton coach NOVA."}\n\n[**✦ Découvrir Premium →**](/subscribe)`, timestamp: new Date() }])
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
          user_id: user?.id, week_number: weekNumber, week_start: today.toISOString().split('T')[0], debrief_text: cleanContent,
          stats: {
            tasks_done: appContext?.tasks.filter((t: any) => t.status === 'completed').length || 0,
            routines_done: appContext?.routines.filter((r: any) => r.completed).length || 0,
            program_day: appContext?.programProgress?.current_day || 0
          }
        })
      }

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: cleanContent, timestamp: new Date(), actions }])
      persistMessage('assistant', cleanContent)
      if (voiceOnRef.current) speak(cleanContent)
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Erreur de connexion. Reessaie.", timestamp: new Date() }])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { sendRef.current = sendMessage })

  const startFromInput = () => {
    const t = input.trim()
    if (!t) return
    newConversation()
    setTimeout(() => sendMessage(t), 30)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showHome) startFromInput()
      else sendMessage()
    }
  }

  const formatContent = (content: string) => {
    return content
      .replace(/### (.*?)(<br\/>|$)/g, '<strong style="font-size:0.9em;text-transform:uppercase;letter-spacing:0.05em;color:#9b8b7a;">$1</strong><br/>')
      .replace(/## (.*?)(<br\/>|$)/g, '<strong>$1</strong><br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  if (authLoading || !historyLoaded) {
    return (
      <div className="flex flex-col h-screen bg-novae-cream items-center justify-center">
        <div className="text-novae-anthracite/40 text-sm">Chargement de NOVA...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-novae-cream" style={{ height: 'calc(100dvh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-novae-beige/30 bg-white/80 backdrop-blur-sm">
        {showHome ? (
          <Link href="/" className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">{'<-'}</span><span className="text-sm">Accueil</span>
          </Link>
        ) : (
          <button onClick={() => setShowHome(true)} className="flex items-center gap-2 text-novae-anthracite/60 hover:text-novae-anthracite transition-colors">
            <span className="text-lg">{'<-'}</span><span className="text-sm">Conversations</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${LAV_SOFT}, ${LAV})` }}>N</div>
            {/* Badge message Nova en attente */}
            {novaBadge && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-400 border-2 border-white animate-pulse" />
            )}
          </div>
          <div>
            <div className="font-semibold text-novae-anthracite text-sm">NOVA</div>
            <div className="text-xs text-novae-anthracite/50 flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${contextLoading ? 'bg-orange-400 animate-pulse' : appContext ? 'bg-green-400' : 'bg-gray-300'}`}></div>
              {contextLoading ? 'Synchronisation...' : appContext ? 'À jour avec tes données' : 'Non connecte'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {user?.id === OWNER_ID && (
            <Link href="/presentation" title="Page presentation (toi seule)" className="text-novae-anthracite/30 hover:text-[#8A6FB0] transition-colors p-1 text-base leading-none">🎬</Link>
          )}
          {ttsSupported && (
            <button onClick={toggleVoice} className="p-1 transition-colors" style={{ color: voiceOn ? LAV : undefined }} title={voiceOn ? 'Voix activée' : 'Activer la voix'}>
              <span className={voiceOn ? '' : 'text-novae-anthracite/30'}>{voiceOn ? '🔊' : '🔇'}</span>
            </button>
          )}
          <button onClick={() => { loadAppContext(); loadThreads() }} className="text-novae-anthracite/40 hover:text-[#8A6FB0] transition-colors p-1" title="Actualiser">🔄</button>
        </div>
      </div>

      {/* Accueil */}
      {showHome && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-5xl mx-auto">

            {/* Bannière Nova si message en attente */}
            {novaBadge && (
              <button
                onClick={async () => {
                  const { data } = await supabase
                    .from('nova_pending_messages')
                    .select('thread_id')
                    .eq('user_id', user?.id)
                    .eq('is_read', false)
                    .limit(1)
                  if (data?.[0]?.thread_id) openNovaThread(data[0].thread_id)
                }}
                className="w-full mb-4 px-4 py-3 rounded-xl text-left flex items-center gap-3 transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${LAV_SOFT}, ${LAV}33)`, border: `1px solid ${LAV}4D` }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${LAV_SOFT}, ${LAV})` }}>N</div>
                <div>
                  <p className="text-sm font-semibold text-novae-anthracite">Nova t'a laissé un message 💜</p>
                  <p className="text-xs text-novae-anthracite/50">Appuie pour lire</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-rose-400 animate-pulse flex-shrink-0" />
              </button>
            )}

            <button onClick={newConversation} className="w-full py-3 mb-6 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2" style={{ background: LAV }}>
              <span className="text-lg leading-none">+</span> Nouvelle conversation
            </button>

            <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
              {/* COLONNE 1 — répertoire + saisie */}
              <div className="mb-6 lg:mb-0">
                <p className="text-xs text-novae-anthracite/40 mb-2 font-medium uppercase tracking-wide">Tes conversations</p>
                {threads.length === 0 ? (
                  <p className="text-xs text-novae-anthracite/30 italic px-1 py-2 mb-4">Aucune conversation pour l'instant. Lance-toi !</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {threads.map(t => (
                      <div key={t.id} className="flex items-center gap-2 bg-white rounded-xl border border-novae-beige/20 px-3 py-2.5 hover:border-[#8A6FB0]/40 transition-all">
                        <button onClick={() => openThread(t.id)} className="flex-1 text-left min-w-0">
                          <p className="text-sm text-novae-anthracite font-medium truncate">{t.title || 'Conversation'}</p>
                          <p className="text-xs text-novae-anthracite/35">{threadDate(t.updated_at)}</p>
                        </button>
                        <button onClick={() => deleteThread(t.id)} className="text-novae-anthracite/25 hover:text-red-500 transition-colors p-1 flex-shrink-0" title="Supprimer">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white rounded-xl border border-novae-beige/20 p-4">
                  <p className="text-xs text-novae-anthracite/40 mb-2 font-medium uppercase tracking-wide">Démarrer par un message</p>
                  <div className="flex gap-2">
                    <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="Ex: Ajoute une tâche demain à 9h…"
                      className="flex-1 text-sm text-novae-anthracite placeholder-novae-anthracite/30 bg-transparent focus:outline-none" />
                    {sttSupported && (
                      <button onClick={() => { newConversation(); enterVoiceMode() }} title="Parler à Nova"
                        className="px-3 py-1.5 rounded-lg text-sm transition-all text-novae-anthracite/60 hover:opacity-80" style={{ background: `${LAV_SOFT}80` }}>🎙️</button>
                    )}
                    <button onClick={startFromInput} disabled={!input.trim()}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${input.trim() ? 'text-white' : 'bg-novae-beige/30 text-novae-anthracite/30'}`}
                      style={input.trim() ? { background: LAV } : undefined}>→</button>
                  </div>
                </div>
              </div>

              {/* COLONNE 2 — suggestions proactives */}
              <div>
                {proactiveSuggestions.length > 0 && (
                  <>
                    <p className="text-xs text-novae-anthracite/40 mb-2 font-medium uppercase tracking-wide">Je peux déjà t'aider sur</p>
                    <div className="grid grid-cols-1 gap-2">
                      {proactiveSuggestions.map((s, idx) => (
                        <button key={idx} onClick={() => { newConversation(); setTimeout(() => sendMessage(s.prompt), 30) }}
                          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-novae-beige/30 text-left hover:border-[#8A6FB0]/50 transition-all">
                          <span className="text-lg">{s.icon}</span>
                          <span className="text-sm text-novae-anthracite/75 font-medium">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <p className="text-[11px] text-novae-anthracite/30 mt-6 text-center italic">NOVA est un guide, pas un professionnel de santé.</p>
          </div>
        </div>
      )}

      {/* Chat */}
      {!showHome && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%]">
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-1 mb-1 ml-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: `linear-gradient(135deg, ${LAV_SOFT}, ${LAV})` }}>N</div>
                        <span className="text-xs text-novae-anthracite/40">NOVA</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-white text-novae-anthracite rounded-tl-sm shadow-sm border border-novae-beige/20'}`}
                      style={message.role === 'user' ? { background: LAV } : undefined}>
                      <div dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} />
                    </div>
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 ml-1">
                        {message.actions.map((action, idx) => (
                          <button key={idx} onClick={() => executeAction(action)} className="px-3 py-1.5 rounded-full text-xs transition-all hover:text-white"
                            style={{ background: `${LAV}1A`, border: `1px solid ${LAV}4D`, color: LAV }}>{action.label}</button>
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
                      {[0, 150, 300].map(delay => (<div key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ background: `${LAV}99`, animationDelay: `${delay}ms` }}></div>))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="px-4 pb-4 pt-2 bg-white/80 backdrop-blur-sm border-t border-novae-beige/20">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Réponds à Nova..."
                className="flex-1 resize-none rounded-xl border border-novae-beige/40 px-4 py-3 text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-2 bg-novae-cream/50 max-h-32"
                style={{ ['--tw-ring-color' as any]: `${LAV}4D` }}
                rows={1} />
              {sttSupported && (
                <button onClick={enterVoiceMode} title="Parler à Nova" className="w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 text-novae-anthracite/60 hover:opacity-80" style={{ background: `${LAV_SOFT}80` }}>🎙️</button>
              )}
              <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${input.trim() && !isLoading ? 'text-white shadow-sm' : 'bg-novae-beige/30 text-novae-anthracite/30 cursor-not-allowed'}`}
                style={input.trim() && !isLoading ? { background: LAV } : undefined}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Mode vocal */}
      {voiceMode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(212,196,226,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
          <button onClick={() => setShowVoiceSettings(s => !s)} title="Réglages de la voix" style={{ position: 'absolute', top: 18, left: 18, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(138,111,176,0.35)', background: 'rgba(255,255,255,0.7)', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
          <button onClick={exitVoiceMode} style={{ position: 'absolute', top: 18, right: 18, border: '1px solid rgba(138,111,176,0.35)', background: 'rgba(255,255,255,0.7)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#5b4b7a', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>✕ Écrire</button>

          <div className={`vo-stage${(listening || speaking) ? ' vo-active' : ''}`}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="vo-ray-wrap" style={{ transform: `rotate(${i * 15}deg)` }}>
                <div className="vo-ray" style={{ animationDelay: `${i * 0.05}s` }} />
              </div>
            ))}
            <div className="vo-core">N</div>
          </div>

          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 22, color: '#3d2618', margin: 0, textAlign: 'center' }}>
            {paused ? 'En pause' : speaking ? 'Nova répond…' : listening ? "Je t'écoute…" : 'Un instant…'}
          </p>

          <button onClick={togglePause} title={paused ? 'Reprendre' : 'Pause'} style={{ width: 66, height: 66, borderRadius: '50%', border: 'none', cursor: 'pointer', background: paused ? 'linear-gradient(135deg,#a98fce,#8a6fb0)' : 'linear-gradient(135deg,#c44757,#8b2d3d)', color: '#fff', fontSize: 26, boxShadow: '0 8px 22px rgba(138,111,176,0.4)' }}>{paused ? '🎙️' : '⏸'}</button>

          <p style={{ fontSize: 11, color: '#7a6a9a', margin: 0, textAlign: 'center' }}>
            {paused ? 'Touche le micro pour reprendre' : 'Le micro reste ouvert. Parle quand tu veux.'}
          </p>

          {showVoiceSettings && (
            <div style={{ marginTop: 6, background: 'rgba(255,255,255,0.92)', borderRadius: 18, border: '1px solid rgba(138,111,176,0.22)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, width: 280, maxWidth: '90vw', boxShadow: '0 12px 30px rgba(138,111,176,0.18)' }}>
              {voices.length > 1 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a6a9a', fontWeight: 700 }}>Voix de Nova</span>
                  <select value={voiceName} onChange={(e) => changeVoice(e.target.value)} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#3d2618', background: '#fff', border: '1px solid rgba(138,111,176,0.3)', borderRadius: 10, padding: '8px 10px' }}>
                    {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a6a9a', fontWeight: 700 }}>Vitesse {rate.toFixed(2)}</span>
                <input type="range" min={0.6} max={1.3} step={0.05} value={rate} onChange={(e) => changeRate(parseFloat(e.target.value))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a6a9a', fontWeight: 700 }}>Tonalité {pitch.toFixed(2)}</span>
                <input type="range" min={0.7} max={1.5} step={0.05} value={pitch} onChange={(e) => changePitch(parseFloat(e.target.value))} />
              </label>
              <button onClick={() => setShowVoiceSettings(false)} style={{ marginTop: 4, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '10px 0', background: 'linear-gradient(135deg,#a98fce,#8a6fb0)', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>Validé</button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .vo-stage { position: relative; width: 240px; height: 240px; display: flex; align-items: center; justify-content: center; }
        .vo-ray-wrap { position: absolute; inset: 0; display: flex; justify-content: center; }
        .vo-ray { width: 4px; height: 16px; margin-top: 8px; border-radius: 4px; background: linear-gradient(#C4A9DC, #8A6FB0); transform-origin: center top; transform: scaleY(0.6); opacity: .45; }
        .vo-stage.vo-active .vo-ray { animation: voRay 1.1s ease-in-out infinite; }
        @keyframes voRay { 0%, 100% { transform: scaleY(0.5); opacity: .4; } 50% { transform: scaleY(1.5); opacity: 1; } }
        .vo-core { width: 130px; height: 130px; border-radius: 50%; background: radial-gradient(120% 120% at 35% 30%, #EFE6F6, #C4A9DC 45%, #8A6FB0 100%); display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 700; font-size: 58px; box-shadow: 0 12px 40px rgba(138,111,176,.4); z-index: 2; }
      `}</style>
      <Navigation />
    </div>
  )
}