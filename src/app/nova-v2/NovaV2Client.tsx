'use client'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useNovaConversationHistory, type NovaConversationSummary } from '@/hooks/useNovaConversationHistory'
import type { NovaExecutionResult, NovaPlanResult } from '@/lib/nova-ai/types'

type ConversationStatus =
  | 'idle'
  | 'waiting_information'
  | 'waiting_confirmation'
  | 'executing'
  | 'completed'
  | 'cancelled'

type ChatMessage = {
  id: string
  role: 'user' | 'nova' | 'system'
  text: string
}

const WELCOME = 'Bonjour. Confie-moi une situation, une échéance ou une information à retenir. Je peux créer tes tâches, programmer tes rappels et fusionner les doublons après ta validation.'

const EXAMPLES = [
  'Je dois envoyer mon dossier à la CPAM avant vendredi.',
  'Rappelle-moi la tâche CPAM demain à 19 h.',
  'Fusionne mes tâches CPAM si elles correspondent à la même démarche.',
  'Mardi à 14 h, j’ai rendez-vous chez le dentiste avec Inaya.',
]

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const CONV_STORAGE_KEY = 'novae-v2-active-conversation'
// Fenêtre pendant laquelle un rechargement de page est considéré comme la
// CONTINUATION de la même conversation (veille du téléphone, micro qui se
// réactive) plutôt qu'un nouveau démarrage.
const CONV_RESUME_WINDOW_MS = 10 * 60 * 1000 // 10 minutes (vocal, anti-veille)
const CONV_TEXT_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 heures (écrit, reprise du jour)

function persistActiveConversation(id: string | null) {
  try {
    if (!id) {
      window.localStorage.removeItem(CONV_STORAGE_KEY)
      return
    }
    window.localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify({ id, at: Date.now() }))
  } catch {
    // localStorage indisponible : on ignore, la persistance est un bonus.
  }
}

function readPersistedConversation(maxAgeMs: number): string | null {
  try {
    const raw = window.localStorage.getItem(CONV_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { id?: string; at?: number }
    if (!parsed?.id || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > maxAgeMs) return null
    return parsed.id
  } catch {
    return null
  }
}

function normalizeConfirmationInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/[.,!?\u2026]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPositiveConfirmation(value: string): boolean {
  const v = normalizeConfirmationInput(value)
  // Garde-fou : "aussi"/"également" ou une tournure interrogative trahissent une
  // question de suivi ou une continuation, jamais une confirmation franche.
  if (/\b(aussi|egalement|également)\b/.test(v)) return false
  if (/(est-ce|est ce|\btu as\b|as-tu|as tu|\bquand\b|\bquoi\b|\bcomment\b|\bpourquoi\b)/.test(v)) return false
  // "merci" en fin n'empêche pas une confirmation ("c'est parfait merci").
  const vv = v.replace(/\s+(merci|stp|s'il te plait|s il te plait)$/,'').trim()
  // Formes courtes exactes.
  if (/^(oui|ouais|ok|okay|d'accord|d accord|dac|parfait|c'est parfait|c est parfait|valide|confirme|go|nickel|super|c'est bon|c est bon|ca marche|ça marche|tres bien|très bien|impeccable|c'est top|c est top)$/.test(vv)) return true
  // "oui / ok / d'accord / vas-y / c'est bon / c'est parfait..." en tête, suivi de contexte.
  if (/^(oui|ouais|ok|okay|d'accord|d accord|vas[- ]?y|allez|c'est bon|c est bon|c'est parfait|c est parfait|confirme|valide|parfait|go)\b/.test(vv)) return true
  return false
}

function isNegativeConfirmation(value: string): boolean {
  const v = normalizeConfirmationInput(value)
  return /^(non|nan|annule|annuler|stop|laisse tomber|laisse beton|je refuse|ne fais rien|surtout pas|pas maintenant)\b/.test(v)
}

function formatConversationDate(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return `Aujourd’hui · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Hier · ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NovaV2Client({ userId, userEmail }: { userId: string; userEmail?: string }) {
    const searchParams = useSearchParams()
  const voiceMode = searchParams.get('voice') === '1'
  const history = useNovaConversationHistory(userId)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: createId('welcome'), role: 'nova', text: WELCOME },
  ])
  const [result, setResult] = useState<NovaPlanResult | null>(null)
  const [rootRequest, setRootRequest] = useState('')
  const [status, setStatus] = useState<ConversationStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const conversationRestoredRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)
  const conversationCreationRef = useRef<Promise<string> | null>(null)
  const requestInFlightRef = useRef(false)
  const pendingVoiceTranscriptRef = useRef('')
  const voiceSubmitTimerRef = useRef<number | null>(null)
  const lastVoiceSubmissionRef = useRef({ text: '', submittedAt: 0 })
  const messagesRef = useRef<ChatMessage[]>([])
  const [conversations, setConversations] = useState<NovaConversationSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(voiceMode)
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceName, setVoiceName] = useState('')
  const [voiceRate, setVoiceRate] = useState(1)
  const [voicePitch, setVoicePitch] = useState(1.03)
  const [voiceVolume, setVoiceVolume] = useState(1)
  const recognitionRef = useRef<any>(null)
  const voiceOverlayOpenRef = useRef(voiceMode)
  const pausedRef = useRef(false)
  const speakingRef = useRef(false)
  const loadingRef = useRef(false)
  const voiceRateRef = useRef(1)
  const voicePitchRef = useRef(1.03)
  const voiceVolumeRef = useRef(1)
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const lastNovaSpeechRef = useRef('')
  const lastNovaSpeechEndedAtRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)
  const autoVoiceStartedRef = useRef(false)
  const statusRef = useRef<ConversationStatus>('idle')
  const resultRef = useRef<NovaPlanResult | null>(null)
  const confirmActionsRef = useRef<null | (() => Promise<void>)>(null)
  const cancelActionsRef = useRef<null | (() => Promise<void>)>(null)



  useEffect(() => {
    voiceOverlayOpenRef.current = voiceOverlayOpen
  }, [voiceOverlayOpen])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    resultRef.current = result
  }, [result])

  // Toujours pointer vers les dernières versions des fonctions de validation,
  // pour que le callback vocal (créé plus tôt) ne fige pas un état périmé.
  useEffect(() => {
    confirmActionsRef.current = confirmPreparedActions
    cancelActionsRef.current = cancelPreparedActions
  })

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    speakingRef.current = speaking
  }, [speaking])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    voiceRateRef.current = voiceRate
  }, [voiceRate])

  useEffect(() => {
    voicePitchRef.current = voicePitch
  }, [voicePitch])

  useEffect(() => {
    voiceVolumeRef.current = voiceVolume
  }, [voiceVolume])

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const loadVoices = () => {
      const frenchVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang?.toLowerCase().startsWith('fr'))

      setVoices(frenchVoices)

      let selected: SpeechSynthesisVoice | null = null
      try {
        const savedName = window.localStorage.getItem('novae-v2-voice-name')
        if (savedName) {
          selected = frenchVoices.find((voice) => voice.name === savedName) || null
        }
      } catch {}

      if (!selected) {
        selected =
          frenchVoices.find((voice) =>
            /amélie|audrey|virginie|female|fémin/i.test(voice.name),
          ) ||
          frenchVoices[0] ||
          null
      }

      selectedVoiceRef.current = selected
      setVoiceName(selected?.name || '')
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    try {
      const savedRate = Number(window.localStorage.getItem('novae-v2-voice-rate'))
      const savedPitch = Number(window.localStorage.getItem('novae-v2-voice-pitch'))
      const savedVolume = Number(window.localStorage.getItem('novae-v2-voice-volume'))

      if (Number.isFinite(savedRate) && savedRate >= 0.6 && savedRate <= 1.4) {
        setVoiceRate(savedRate)
        voiceRateRef.current = savedRate
      }
      if (Number.isFinite(savedPitch) && savedPitch >= 0.7 && savedPitch <= 1.4) {
        setVoicePitch(savedPitch)
        voicePitchRef.current = savedPitch
      }
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
        setVoiceVolume(savedVolume)
        voiceVolumeRef.current = savedVolume
      }
    } catch {}

    return () => {
      if (voiceSubmitTimerRef.current !== null) {
        window.clearTimeout(voiceSubmitTimerRef.current)
      }
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [])

  const filteredConversations = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('fr-FR')
    if (!query) return conversations
    return conversations.filter((conversation) =>
      conversation.title.toLocaleLowerCase('fr-FR').includes(query)
    )
  }, [conversations, historySearch])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, result, status, loading])

  useEffect(() => {
    void refreshHistory()
    // Le hook dépend uniquement de userId, déjà stable pour cette page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Sauvegarde l'identifiant de la conversation active à chaque changement,
  // pour qu'elle survive aux rechargements de page (veille, navigation).
  useEffect(() => {
    conversationIdRef.current = conversationId
    persistActiveConversation(conversationId)
  }, [conversationId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Au montage : restaure le fil selon le contexte.
  // - vocal : on ne restaure QUE si le dernier fil est très récent (rechargement
  //   de veille en pleine session). Sinon, nouveau démarrage vocal = fil neuf.
  // - écrit : on restaure la conversation du jour (fenêtre 6h) ; le choix
  //   Nouvelle/Historique de l'utilisatrice reste prioritaire ensuite.
  useEffect(() => {
    if (conversationRestoredRef.current) return
    conversationRestoredRef.current = true

    const windowMs = voiceMode ? CONV_RESUME_WINDOW_MS : CONV_TEXT_WINDOW_MS
    const persistedId = readPersistedConversation(windowMs)
    if (!persistedId) return

    // On recharge les messages de ce fil pour le reprendre là où il s'était arrêté.
    void (async () => {
      try {
        const storedMessages = await history.loadMessages(persistedId)
        if (storedMessages.length === 0) return
        setConversationId(persistedId)
        setMessages(storedMessages.map((message) => ({ id: message.id, role: message.role, text: message.text })))
        setRootRequest('')
      } catch {
        // Fil introuvable ou supprimé : on démarre normalement.
      }
    })()
    // Au montage uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!voiceMode || autoVoiceStartedRef.current) return

    autoVoiceStartedRef.current = true
    setVoiceOverlayOpen(true)

    const timeout = window.setTimeout(() => {
      toggleVoiceInput(true)
    }, 700)

    return () => window.clearTimeout(timeout)
    // Le démarrage doit avoir lieu une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode])

  function cleanSpeechText(value: string): string {
    return value
      .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[#*_>`~]/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ')
      .replace(/[\uFE00-\uFE0F\u200D\u20E3]/g, ' ')
      .replace(/[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/g, ' ')
      .replace(/[•·▪◦]/g, ' ')
      .replace(/([!?.,;:])\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function normalizeForEcho(value: string): string {
    return cleanSpeechText(value)
      .toLocaleLowerCase('fr-FR')
      .replace(/[’']/g, ' ')
      .replace(/[^a-zà-ÿ0-9 ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function isLikelyNovaEcho(value: string): boolean {
    const heard = normalizeForEcho(value)
    const spoken = normalizeForEcho(lastNovaSpeechRef.current)

    if (!heard || !spoken) return false

    const tooSoonAfterSpeech =
      Date.now() - lastNovaSpeechEndedAtRef.current < 1600

    if (!tooSoonAfterSpeech) return false

    return (
      spoken.includes(heard) ||
      heard.includes(spoken.slice(0, Math.min(spoken.length, 80)))
    )
  }

  function speakNova(value: string) {
    if (!voiceOverlayOpenRef.current || typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return

    const clean = cleanSpeechText(value)
    if (!clean) return

    lastNovaSpeechRef.current = clean

    try {
      recognitionRef.current?.abort?.()
      recognitionRef.current?.stop?.()
    } catch {}

    setListening(false)
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'fr-FR'
    utterance.rate = voiceRateRef.current
    utterance.pitch = voicePitchRef.current
    utterance.volume = voiceVolumeRef.current
    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current

    utterance.onstart = () => {
      setSpeaking(true)
      speakingRef.current = true
      setListening(false)
    }

    const reopen = () => {
      setSpeaking(false)
      speakingRef.current = false
      lastNovaSpeechEndedAtRef.current = Date.now()

      if (voiceOverlayOpenRef.current && !pausedRef.current) {
        window.setTimeout(() => {
          if (
            voiceOverlayOpenRef.current &&
            !pausedRef.current &&
            !speakingRef.current &&
            !loadingRef.current &&
            !requestInFlightRef.current &&
            statusRef.current !== 'waiting_confirmation' &&
            statusRef.current !== 'executing'
          ) {
            toggleVoiceInput(true)
          }
        }, 950)
      }
    }

    utterance.onend = reopen
    utterance.onerror = reopen
    window.speechSynthesis.speak(utterance)
  }

  function previewVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const utterance = new SpeechSynthesisUtterance(
      'Bonjour, je suis Nova. Cette voix sera utilisée pour te répondre.',
    )
    utterance.lang = 'fr-FR'
    utterance.rate = voiceRateRef.current
    utterance.pitch = voicePitchRef.current
    utterance.volume = voiceVolumeRef.current
    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current

    try {
      recognitionRef.current?.abort?.()
      recognitionRef.current?.stop?.()
    } catch {}

    setListening(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  function changeVoice(name: string) {
    setVoiceName(name)
    selectedVoiceRef.current =
      voices.find((voice) => voice.name === name) || null
    try {
      window.localStorage.setItem('novae-v2-voice-name', name)
    } catch {}
  }

  function changeVoiceRate(value: number) {
    setVoiceRate(value)
    voiceRateRef.current = value
    try {
      window.localStorage.setItem('novae-v2-voice-rate', String(value))
    } catch {}
  }

  function changeVoicePitch(value: number) {
    setVoicePitch(value)
    voicePitchRef.current = value
    try {
      window.localStorage.setItem('novae-v2-voice-pitch', String(value))
    } catch {}
  }

  function changeVoiceVolume(value: number) {
    setVoiceVolume(value)
    voiceVolumeRef.current = value
    try {
      window.localStorage.setItem('novae-v2-voice-volume', String(value))
    } catch {}
  }

  function closeVoiceOverlay() {
    setVoiceOverlayOpen(false)
    voiceOverlayOpenRef.current = false
    setPaused(false)
    pausedRef.current = false
    setListening(false)
    setSpeaking(false)
    speakingRef.current = false
    setShowVoiceSettings(false)

    try {
      recognitionRef.current?.abort?.()
      recognitionRef.current?.stop?.()
    } catch {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  function toggleVoicePause() {
    if (pausedRef.current) {
      setPaused(false)
      pausedRef.current = false
      window.setTimeout(() => toggleVoiceInput(true), 250)
      return
    }

    setPaused(true)
    pausedRef.current = true
    setListening(false)

    try {
      recognitionRef.current?.abort?.()
      recognitionRef.current?.stop?.()
    } catch {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    setSpeaking(false)
    speakingRef.current = false
  }

  async function refreshHistory() {
    try {
      const rows = await history.listConversations()
      setConversations(rows)
    } catch {
      // L'interface conversationnelle reste utilisable même si l'historique échoue.
    }
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    const current = conversationIdRef.current ?? conversationId
    if (current) return current

    // Verrou asynchrone : deux transcriptions vocales rapprochées doivent attendre
    // la même création au lieu d'insérer deux conversations en parallèle.
    if (conversationCreationRef.current) return conversationCreationRef.current

    const creation = history.createConversation(firstMessage).then((created) => {
      conversationIdRef.current = created.id
      setConversationId(created.id)
      setConversations((currentRows) => [
        created,
        ...currentRows.filter((row) => row.id !== created.id),
      ])
      return created.id
    })

    conversationCreationRef.current = creation
    try {
      return await creation
    } finally {
      conversationCreationRef.current = null
    }
  }

  async function addMessage(
    role: ChatMessage['role'],
    text: string,
    activeConversationId?: string | null,
    metadata: Record<string, unknown> = {}
  ) {
    setMessages((current) => [...current, { id: createId(role), role, text }])

    if (role === 'nova') {
      speakNova(text)
    }

    const targetId = activeConversationId || conversationId
    if (!targetId) return

    try {
      await history.saveMessage(targetId, role, text, metadata)
      await refreshHistory()
    } catch {
      // Ne pas bloquer Nova si l'historique rencontre une erreur ponctuelle.
    }
  }

  function buildWorkflowContext(): string {
    const missing = result?.plan.missing_information
      .map((item) => `${item.field}: ${item.question}`)
      .join(' | ')

    const actions = result?.plan.proposed_actions
      .map((action) => `${action.type}: ${action.title}`)
      .join(' | ')

    if (!rootRequest && !result) return ''

    return [
      rootRequest ? `Sujet actif : ${rootRequest}` : '',
      result?.plan.summary ? `Résumé du sujet actif : ${result.plan.summary}` : '',
      `Informations encore manquantes : ${missing || 'aucune'}`,
      `Actions déjà proposées : ${actions || 'aucune'}`,
    ].filter(Boolean).join('\n')
  }

  async function requestPlan(visibleMessage: string) {
    if (
      !visibleMessage.trim() ||
      loadingRef.current ||
      requestInFlightRef.current ||
      statusRef.current === 'executing'
    ) return

    const normalized = visibleMessage.trim()
    const currentStatus = statusRef.current
    const currentResult = resultRef.current

    if (currentStatus === 'waiting_confirmation' && isPositiveConfirmation(normalized)) {
      await confirmPreparedActions()
      return
    }

    if (currentStatus === 'waiting_confirmation' && isNegativeConfirmation(normalized)) {
      await cancelPreparedActions()
      return
    }

    // Garde-fou anti-confusion : tant qu'une proposition attend, une réponse qui
    // n'est ni un oui ni un non clairs ne part PAS à l'IA (qui confondrait les
    // propositions). Nova redemande de confirmer ou annuler celle en cours, en la
    // nommant, pour que l'utilisatrice sache exactement de quoi il s'agit.
    if (currentStatus === 'waiting_confirmation' && currentResult) {
      const pendingTitle =
        currentResult.plan.proposed_actions.find((action) => action.requires_confirmation)?.title ||
        currentResult.plan.proposed_actions[0]?.title ||
        'la proposition en cours'
      setInput('')
      const activeConversationId = conversationId
      await addMessage('user', normalized, activeConversationId)
      await addMessage(
        'nova',
        `J'ai encore une proposition en attente : « ${pendingTitle} ». Tu confirmes (dis « oui ») ou tu l'annules (dis « non ») ? On passe à la suite juste après.`,
        activeConversationId
      )
      return
    }

    requestInFlightRef.current = true
    setInput('')
    setLoading(true)
    setError('')

    let activeConversationId: string | null = conversationId

    try {
      activeConversationId = await ensureConversation(normalized)
      await addMessage('user', normalized, activeConversationId)

      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Ta session a expiré. Reconnecte-toi à NOVAÉ.')

      const response = await fetch('/api/nova/plan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: normalized,
          conversationId: activeConversationId,
          workflowContext: buildWorkflowContext(),
          provider: 'auto',
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Nova n’a pas pu analyser cette demande pour le moment.')
      }

      const nextResult = payload as NovaPlanResult
      resultRef.current = nextResult
      setResult(nextResult)
      if (!rootRequest) setRootRequest(normalized)

      await addMessage('nova', nextResult.plan.assistant_message, activeConversationId, {
        type: 'plan',
        intent: nextResult.plan.intent,
        action_types: nextResult.plan.proposed_actions.map((action) => action.type),
      })

      if (nextResult.plan.missing_information.length > 0) {
        statusRef.current = 'waiting_information'
        setStatus('waiting_information')
      } else if (nextResult.plan.proposed_actions.some((action) => action.requires_confirmation)) {
        setStatus('waiting_confirmation')
        statusRef.current = 'waiting_confirmation'
        setPaused(true)
        pausedRef.current = true
        setListening(false)
        try {
          recognitionRef.current?.abort?.()
          recognitionRef.current?.stop?.()
        } catch {}
      } else {
        statusRef.current = 'idle'
        setStatus('idle')
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Une erreur est survenue pendant l’analyse.'
      setError(message)
      await addMessage('system', message, activeConversationId)
    } finally {
      requestInFlightRef.current = false
      setLoading(false)
    }
  }

  async function confirmPreparedActions() {
    const currentResult = resultRef.current
    if (
      !currentResult ||
      loadingRef.current ||
      requestInFlightRef.current ||
      statusRef.current === 'executing'
    ) return

    loadingRef.current = true
    requestInFlightRef.current = true
    statusRef.current = 'executing'

    const activeConversationId = conversationId
    await addMessage('user', 'Oui, je confirme.', activeConversationId)
    setLoading(true)
    setStatus('executing')
    setError('')

    try {
      if (!currentResult.executionToken) {
        throw new Error('La validation est reçue, mais l’exécution n’est pas encore configurée sur ce serveur.')
      }

      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Ta session a expiré. Reconnecte-toi à NOVAÉ.')

      const response = await fetch('/api/nova/execute', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ executionToken: currentResult.executionToken }),
      })

      const payload = (await response.json()) as Partial<NovaExecutionResult> & { message?: string }
      if (!response.ok) {
        if (response.status === 409 && payload.message) {
          await addMessage('nova', payload.message, activeConversationId, {
            type: 'execution_result', success: false, requires_modification: true,
          })
          resultRef.current = null
          setResult(null)
          setRootRequest('')
          statusRef.current = 'completed'
          setStatus('completed')
          return
        }
        throw new Error(payload.message || 'La proposition a été validée, mais elle n’a pas pu être exécutée.')
      }

      const finalMessage = payload.message || 'C’est fait. L’action a été exécutée.'
      setPaused(false)
      pausedRef.current = false
      resultRef.current = null
      setResult(null)
      setRootRequest('')
      statusRef.current = 'completed'
      setStatus('completed')
      await addMessage('nova', finalMessage, activeConversationId, {
        type: 'execution_result',
        success: true,
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'L’action n’a pas pu être exécutée.'
      setError(message)
      await addMessage('system', message, activeConversationId, {
        type: 'execution_result',
        success: false,
      })
      setStatus('waiting_confirmation')
      statusRef.current = 'waiting_confirmation'
      setPaused(true)
      pausedRef.current = true
    } finally {
      loadingRef.current = false
      requestInFlightRef.current = false
      setLoading(false)
    }
  }

  async function cancelPreparedActions() {
    if (loadingRef.current || requestInFlightRef.current) return
    await addMessage('user', 'Non, annule.', conversationId)
    resultRef.current = null
    setResult(null)
    setRootRequest('')
    setStatus('cancelled')
    statusRef.current = 'cancelled'
    setPaused(false)
    pausedRef.current = false
    await addMessage('nova', 'D’accord, je n’exécute rien.', conversationId)
  }

  async function askForModification() {
    if (loadingRef.current || requestInFlightRef.current) return
    await addMessage('user', 'Je veux modifier la proposition.', conversationId)
    setStatus('waiting_information')
    statusRef.current = 'waiting_information'
    setPaused(false)
    pausedRef.current = false
    setInput('')
    await addMessage('nova', 'D’accord. Dis-moi ce que tu veux changer.', conversationId)
  }

  function startNewConversation() {
    persistActiveConversation(null)
    conversationIdRef.current = null
    setConversationId(null)
    setInput('')
    resultRef.current = null
    setResult(null)
    setRootRequest('')
    statusRef.current = 'idle'
    setStatus('idle')
    setError('')
    setMessages([{ id: createId('welcome'), role: 'nova', text: 'Nouvelle conversation. Que veux-tu me confier ?' }])
    setHistoryOpen(false)
  }

  async function openConversation(conversation: NovaConversationSummary) {
    setHistoryLoading(true)
    setError('')
    try {
      const storedMessages = await history.loadMessages(conversation.id)
      conversationIdRef.current = conversation.id
      setConversationId(conversation.id)
      setMessages(storedMessages.length > 0
        ? storedMessages.map((message) => ({ id: message.id, role: message.role, text: message.text }))
        : [{ id: createId('empty'), role: 'nova', text: 'Cette conversation est vide.' }]
      )
      setRootRequest('')
      resultRef.current = null
      setResult(null)
      statusRef.current = 'idle'
      setStatus('idle')
      setInput('')
      setHistoryOpen(false)
    } catch {
      setError('Impossible d’ouvrir cette conversation pour le moment.')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function removeConversation(conversation: NovaConversationSummary) {
    const confirmed = window.confirm(`Supprimer la conversation « ${conversation.title} » ? Les tâches et rappels déjà créés seront conservés.`)
    if (!confirmed) return

    try {
      await history.deleteConversation(conversation.id)
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      if (conversationId === conversation.id) startNewConversation()
    } catch {
      setError('La conversation n’a pas pu être supprimée.')
    }
  }

  function queueVoiceTranscript(rawTranscript: string) {
    const transcript = rawTranscript.replace(/\s+/g, ' ').trim()
    if (
      !transcript ||
      loadingRef.current ||
      requestInFlightRef.current ||
      statusRef.current === 'waiting_confirmation' ||
      statusRef.current === 'executing'
    ) return

    const pending = pendingVoiceTranscriptRef.current
    const incomingLower = transcript.toLocaleLowerCase('fr-FR')
    const pendingLower = pending.toLocaleLowerCase('fr-FR')

    if (!pending || incomingLower.startsWith(pendingLower)) {
      pendingVoiceTranscriptRef.current = transcript
    } else if (!pendingLower.startsWith(incomingLower) && incomingLower !== pendingLower) {
      pendingVoiceTranscriptRef.current = `${pending} ${transcript}`.replace(/\s+/g, ' ').trim()
    }

    if (voiceSubmitTimerRef.current !== null) {
      window.clearTimeout(voiceSubmitTimerRef.current)
    }

    voiceSubmitTimerRef.current = window.setTimeout(() => {
      const finalTranscript = pendingVoiceTranscriptRef.current.trim()
      pendingVoiceTranscriptRef.current = ''
      voiceSubmitTimerRef.current = null

      if (
        !finalTranscript ||
        loadingRef.current ||
        requestInFlightRef.current ||
        statusRef.current === 'waiting_confirmation' ||
        statusRef.current === 'executing'
      ) return

      const previous = lastVoiceSubmissionRef.current
      const normalized = finalTranscript.toLocaleLowerCase('fr-FR')
      const previousNormalized = previous.text.toLocaleLowerCase('fr-FR')
      const elapsed = Date.now() - previous.submittedAt

      if (
        (normalized === previousNormalized && elapsed < 15_000) ||
        (elapsed < 6_000 && previousNormalized.length >= 8 &&
          (normalized.startsWith(previousNormalized) || previousNormalized.startsWith(normalized)))
      ) return

      lastVoiceSubmissionRef.current = { text: finalTranscript, submittedAt: Date.now() }
      void requestPlan(finalTranscript)
    }, 1400)
  }

  function toggleVoiceInput(autoSubmit = false) {
    if (
      listening ||
      speakingRef.current ||
      pausedRef.current ||
      loadingRef.current ||
      requestInFlightRef.current ||
      statusRef.current === 'waiting_confirmation' ||
      statusRef.current === 'executing'
    ) {
      return
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setError(
        'La dictée vocale n’est pas disponible dans ce navigateur. Utilise Chrome ou Edge.',
      )
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition

    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setError('')
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognition.onerror = (event: any) => {
      setListening(false)

      if (event?.error === 'not-allowed') {
        setError(
          'Autorise l’accès au microphone dans ton navigateur, puis touche le logo Nova.',
        )
        return
      }

      if (event?.error === 'no-speech' || event?.error === 'aborted') return
      setError("Je n’ai pas réussi à entendre la dictée. Réessaie.")
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ''
      setListening(false)

      if (!transcript || isLikelyNovaEcho(transcript)) return

      // Validation orale : si une proposition attend, un « oui » dit à voix
      // haute déclenche la même exécution que le bouton Confirmer.
      if (statusRef.current === 'waiting_confirmation') {
        if (isPositiveConfirmation(transcript)) {
          void confirmActionsRef.current?.()
          return
        }
        if (isNegativeConfirmation(transcript)) {
          void cancelActionsRef.current?.()
          return
        }
      }

      if (autoSubmit || voiceOverlayOpenRef.current) {
        queueVoiceTranscript(transcript)
        return
      }

      setInput((current) => (current ? `${current} ${transcript}` : transcript))
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void requestPlan(input)
  }

  const confirmableActions = result?.plan.proposed_actions.filter((action) => action.requires_confirmation) || []
  const executableTaskCount = confirmableActions.filter((action) => action.type === 'create_task' && action.engine === 'tasks').length
  const executableReminderCount = confirmableActions.filter((action) => action.type === 'create_reminder' && action.engine === 'notifications').length
  const executableCalendarCount = confirmableActions.filter((action) => action.type === 'create_calendar_event' && action.engine === 'calendar').length
  const executableMergeCount = confirmableActions.filter((action) => action.type === 'merge_tasks' && action.engine === 'tasks').length
  const executableLifecycleCount = confirmableActions.filter((action) => ['update_task','cancel_task','update_reminder','cancel_reminder','update_calendar_event','cancel_calendar_event'].includes(action.type)).length
  const executableActionCount = executableTaskCount + executableReminderCount + executableMergeCount + executableCalendarCount + executableLifecycleCount
  const otherActionCount = confirmableActions.length - executableActionCount

  return (
    <main className="min-h-screen bg-[#F7F5F1] text-[#282522]">
      {historyOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/30" onClick={() => setHistoryOpen(false)}>
          <aside
            className="h-full w-[88%] max-w-sm overflow-y-auto border-r border-[#D7D0C8] bg-[#FBFAF8] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#796F68]">Nova</p>
                <h2 className="font-serif text-2xl font-semibold">Conversations</h2>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-full border border-[#D7D0C8] bg-white px-3 py-1.5 text-sm">Fermer</button>
            </div>

            <button type="button" onClick={startNewConversation} className="mb-4 w-full rounded-xl bg-[#332E2A] px-4 py-3 text-sm font-semibold text-white">＋ Nouvelle conversation</button>

            <input
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Rechercher une conversation…"
              className="mb-4 w-full rounded-xl border border-[#CBC3BB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7B6F66]"
            />

            <div className="space-y-2">
              {historyLoading ? <p className="text-sm text-[#766D66]">Chargement…</p> : null}
              {!historyLoading && filteredConversations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#D7D0C8] p-4 text-sm leading-6 text-[#766D66]">Aucune conversation enregistrée pour le moment.</p>
              ) : null}
              {filteredConversations.map((conversation) => (
                <div key={conversation.id} className={`rounded-xl border p-3 ${conversation.id === conversationId ? 'border-[#8C75A8] bg-[#F0EBF4]' : 'border-[#E1DBD5] bg-white'}`}>
                  <button type="button" onClick={() => void openConversation(conversation)} className="w-full text-left">
                    <p className="line-clamp-2 text-sm font-semibold leading-5">{conversation.title}</p>
                    <p className="mt-1 text-xs text-[#82786F]">{formatConversationDate(conversation.last_message_at)}</p>
                  </button>
                  <button type="button" onClick={() => void removeConversation(conversation)} className="mt-2 text-xs text-[#8A4A43]">Supprimer la conversation</button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {voiceOverlayOpen ? (
        <div className="nova-voice-overlay">
          <button
            type="button"
            className="nova-voice-settings-button"
            onClick={() => setShowVoiceSettings((current) => !current)}
            aria-label="Réglages de la voix"
          >
            ⚙️
          </button>

          <button
            type="button"
            className="nova-voice-write"
            onClick={closeVoiceOverlay}
          >
            ✕ Écrire
          </button>

          <button
            type="button"
            className={`nova-voice-stage ${listening || speaking ? 'is-active' : ''}`}
            onClick={() => {
              if (!listening && !speaking && !paused && !loading) {
                toggleVoiceInput(true)
              }
            }}
            aria-label="Parler à Nova"
          >
            {Array.from({ length: 24 }).map((_, index) => (
              <span
                key={index}
                className="nova-voice-ray-wrap"
                style={{ transform: `rotate(${index * 15}deg)` }}
              >
                <i
                  className="nova-voice-ray"
                  style={{ animationDelay: `${index * 0.05}s` }}
                />
              </span>
            ))}
            <span className="nova-voice-core" aria-hidden="true" />
          </button>

          <p className="nova-voice-state">
            {paused
              ? 'En pause'
              : speaking
                ? 'Nova répond…'
                : listening
                  ? 'Je t’écoute…'
                  : loading
                    ? 'Nova réfléchit…'
                    : 'Parle-moi'}
          </p>

          <button
            type="button"
            className="nova-voice-pause"
            onClick={toggleVoicePause}
            aria-label={paused ? 'Reprendre le mode vocal' : 'Mettre le mode vocal en pause'}
          >
            {paused ? '🎙️' : '⏸'}
          </button>

          <p className="nova-voice-hint">
            {paused
              ? 'Touche le micro pour reprendre.'
              : 'Le micro se réactive après chaque réponse.'}
          </p>


          {result && status === 'waiting_confirmation' ? (
            <section
              className="nova-voice-validation-card"
              role="dialog"
              aria-modal="true"
              aria-label="Proposition de Nova à valider"
            >
              <p className="nova-voice-validation-eyebrow">Proposition à valider</p>
              <strong className="nova-voice-validation-title">
                {confirmableActions.length === 1
                  ? confirmableActions[0].title
                  : `${confirmableActions.length} actions proposées`}
              </strong>

              {confirmableActions.length === 1 ? (
                <p className="nova-voice-validation-description">
                  {confirmableActions[0].reason}
                </p>
              ) : (
                <div className="nova-voice-validation-list">
                  {confirmableActions.slice(0, 3).map((action) => (
                    <span key={action.id}>{action.title}</span>
                  ))}
                </div>
              )}

              <div className="nova-voice-validation-actions">
                <button
                  type="button"
                  className="nova-voice-validation-confirm"
                  onClick={() => void confirmPreparedActions()}
                  disabled={loading}
                >
                  Valider
                </button>
                <button
                  type="button"
                  className="nova-voice-validation-modify"
                  onClick={() => void askForModification()}
                  disabled={loading}
                >
                  Modifier
                </button>
              </div>

              <button
                type="button"
                className="nova-voice-validation-cancel"
                onClick={() => void cancelPreparedActions()}
                disabled={loading}
              >
                Annuler
              </button>
            </section>
          ) : null}

          {showVoiceSettings ? (
            <section className="nova-voice-settings-panel">
              <div className="nova-voice-settings-heading">
                <div>
                  <strong>Réglages vocaux</strong>
                  <small>Ils seront conservés sur cet appareil.</small>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(false)}
                  aria-label="Fermer les réglages"
                >
                  ×
                </button>
              </div>

              {voices.length > 0 ? (
                <label>
                  <span>Voix</span>
                  <select
                    value={voiceName}
                    onChange={(event) => changeVoice(event.target.value)}
                  >
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                <span>Vitesse : {voiceRate.toFixed(2)}</span>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={voiceRate}
                  onChange={(event) =>
                    changeVoiceRate(Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Tonalité : {voicePitch.toFixed(2)}</span>
                <input
                  type="range"
                  min="0.7"
                  max="1.4"
                  step="0.05"
                  value={voicePitch}
                  onChange={(event) =>
                    changeVoicePitch(Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Volume : {Math.round(voiceVolume * 100)} %</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(event) =>
                    changeVoiceVolume(Number(event.target.value))
                  }
                />
              </label>

              <button
                type="button"
                className="nova-voice-preview"
                onClick={previewVoice}
              >
                Écouter un aperçu
              </button>
            </section>
          ) : null}

          {error ? <p className="nova-voice-error">{error}</p> : null}
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#796F68]">Assistant de vie</p>
            <h1 className="font-serif text-3xl font-semibold">Nova</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#625B55]">Ton espace de test réel. Les tâches, rappels, notifications et fusions sont actifs après validation. Les tâches, rappels, rendez-vous et leurs modifications sont actifs après validation.</p>
            {userEmail ? <p className="mt-1 text-xs text-[#847A72]">Compte : {userEmail}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setHistoryOpen(true)} className="rounded-full border border-[#CFC7BF] bg-white px-4 py-2 text-sm">☰ Historique</button>
            <button type="button" onClick={startNewConversation} className="rounded-full border border-[#CFC7BF] bg-white px-4 py-2 text-sm">Nouvelle conversation</button>
            <Link href="/" className="rounded-full border border-[#CFC7BF] bg-white px-4 py-2 text-sm">Retour</Link>
          </div>
        </header>
        <section className="overflow-hidden rounded-2xl border border-[#D7D0C8] bg-white shadow-sm">
          <div className="border-b border-[#E8E2DC] bg-[#FBFAF8] px-5 py-3">
            <span className="rounded-full bg-[#E8EFE7] px-3 py-1 text-xs font-medium text-[#425642]">Tâches, rappels, agenda, modifications et annulations actifs</span>
          </div>

          <div className="max-h-[62vh] min-h-[440px] space-y-4 overflow-y-auto px-4 py-5 sm:px-5 sm:py-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-[#6F5B8E] text-white'
                    : message.role === 'system'
                      ? 'rounded-bl-md border border-[#C8A6A1] bg-[#F8EFEE] text-[#7B2921]'
                      : 'rounded-bl-md border border-[#E1DBD5] bg-[#F8F5F1] text-[#3D3834]'
                }`}>{message.text}</div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-[#E1DBD5] bg-[#F8F5F1] px-4 py-3 text-sm text-[#6B625B]">{status === 'executing' ? 'Nova vérifie et exécute les actions…' : 'Nova prépare la suite…'}</div></div>
            ) : null}

            {result && status === 'waiting_information' ? (
              <div className="rounded-2xl border border-[#D7D0C8] bg-[#FCFBF9] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#796F68]">À préciser</p>
                <div className="mt-3 space-y-2">{result.plan.missing_information.map((information, index) => <p key={`${information.field}-${index}`} className="text-sm leading-6 text-[#514B46]">{information.question}</p>)}</div>
              </div>
            ) : null}

            {result && status === 'waiting_confirmation' ? (
              <div className="rounded-2xl border border-[#D7D0C8] bg-[#FCFBF9] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#796F68]">Proposition à valider</p>
                <div className="mt-3 space-y-3">
                  {confirmableActions.map((action) => (
                    <article key={action.id} className="rounded-xl border border-[#E1DBD5] bg-white p-4">
                      <strong className="text-sm">{action.title}</strong>
                      <p className="mt-1 text-sm leading-6 text-[#5E5751]">{action.reason}</p>
                      <p className="mt-2 text-xs text-[#7B716A]">{
                        action.type === 'create_task' && action.engine === 'tasks'
                          ? 'Cette tâche sera créée après confirmation.'
                          : action.type === 'create_reminder' && action.engine === 'notifications'
                            ? 'Ce rappel sera programmé après confirmation.'
                            : action.type === 'create_calendar_event' && action.engine === 'calendar'
                              ? 'Ce rendez-vous sera ajouté au planning après confirmation.'
                            : action.type === 'merge_tasks' && action.engine === 'tasks'
                              ? 'La tâche choisie sera conservée et le doublon sera archivé après confirmation.'
                              : action.type.startsWith('update_')
                                ? 'La modification sera appliquée après confirmation.'
                                : action.type.startsWith('cancel_')
                                  ? 'L’annulation sera appliquée après confirmation, sans suppression silencieuse.'
                                  : 'Cette action reste en simulation pour le moment.'
                      }</p>
                    </article>
                  ))}
                </div>

                {otherActionCount > 0 ? <p className="mt-3 text-xs leading-5 text-[#766D66]">Seules les actions prises en charge et validées seront réellement exécutées. Les autres propositions resteront en simulation.</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void confirmPreparedActions()} disabled={loading} className="rounded-lg bg-[#332E2A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {executableActionCount === 0
                      ? 'Confirmer'
                      : executableMergeCount > 0 && executableActionCount === executableMergeCount
                        ? executableMergeCount > 1 ? 'Confirmer et fusionner les tâches' : 'Confirmer la fusion'
                        : executableActionCount > 1
                          ? 'Confirmer les actions'
                          : executableLifecycleCount > 0
                            ? 'Confirmer la modification'
                          : executableCalendarCount > 0
                            ? 'Confirmer et ajouter au planning'
                          : executableReminderCount > 0
                            ? 'Confirmer et programmer le rappel'
                            : executableTaskCount > 0
                              ? 'Confirmer et créer la tâche'
                              : 'Confirmer'}
                  </button>
                  <button type="button" onClick={() => void askForModification()} disabled={loading} className="rounded-lg border border-[#CFC7BF] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Modifier</button>
                  <button type="button" onClick={() => void cancelPreparedActions()} disabled={loading} className="rounded-lg border border-[#CFC7BF] bg-white px-4 py-2 text-sm disabled:opacity-50">Annuler</button>
                </div>
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="border-t border-[#E8E2DC] bg-[#FBFAF8] p-4">
            {messages.length <= 1 ? (
              <div className="mb-3 flex flex-wrap gap-2">{EXAMPLES.map((example) => <button type="button" key={example} onClick={() => setInput(example)} className="rounded-full border border-[#DDD6CF] bg-white px-3 py-1.5 text-xs hover:bg-[#F4F0EC]">{example.slice(0, 42)}{example.length > 42 ? '…' : ''}</button>)}</div>
            ) : null}

            <form onSubmit={submit} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (input.trim() && !loading && status !== 'executing') void requestPlan(input)
                  }
                }}
                rows={2}
                placeholder={status === 'waiting_information' ? 'Réponds à Nova…' : 'Écris à Nova…'}
                disabled={loading || status === 'executing'}
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-[#CBC3BB] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#7B6F66] disabled:bg-[#F2EFEC]"
              />
              <button type="button" onClick={() => { setVoiceOverlayOpen(true); voiceOverlayOpenRef.current = true; window.setTimeout(() => toggleVoiceInput(true), 180) }} disabled={loading || status === 'executing'} title="Parler à Nova" className="rounded-xl border border-[var(--novae-border)] bg-[var(--novae-surface)] px-4 py-3 text-sm font-semibold text-[var(--novae-text-main)]">🎤</button>
              <button type="submit" disabled={loading || !input.trim() || status === 'executing'} className="rounded-xl bg-[#332E2A] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Envoyer</button>
            </form>
            {error ? <p className="mt-3 text-xs text-[#7B2921]">{error}</p> : null}
          </div>
        </section>
      </div>

      <style jsx>{`
        .nova-voice-overlay {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 24px;
          color: var(--novae-text-main);
          background:
            radial-gradient(
              circle at 50% 35%,
              color-mix(in srgb, var(--novae-primary-soft) 78%, transparent),
              transparent 44%
            ),
            color-mix(in srgb, var(--novae-background) 93%, transparent);
          backdrop-filter: blur(18px);
        }

        .nova-voice-settings-button,
        .nova-voice-write {
          position: absolute;
          top: 18px;
          color: var(--novae-text-main);
          background: color-mix(in srgb, var(--novae-surface) 88%, transparent);
          border: 1px solid var(--novae-border);
          cursor: pointer;
        }

        .nova-voice-settings-button {
          left: 18px;
          width: 42px;
          height: 42px;
          border-radius: 50%;
        }

        .nova-voice-write {
          right: 18px;
          padding: 9px 16px;
          border-radius: 999px;
          font-weight: 800;
        }

        .nova-voice-stage {
          position: relative;
          display: flex;
          width: min(68vw, 270px);
          height: min(68vw, 270px);
          align-items: center;
          justify-content: center;
          padding: 0;
          background: transparent;
          border: 0;
          cursor: pointer;
        }

        .nova-voice-ray-wrap {
          position: absolute;
          inset: 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }

        .nova-voice-ray {
          width: 4px;
          height: 18px;
          margin-top: 8px;
          background: linear-gradient(
            var(--novae-metal),
            var(--novae-primary)
          );
          border-radius: 999px;
          opacity: 0.42;
          transform: scaleY(0.62);
          transform-origin: center top;
        }

        .nova-voice-stage.is-active .nova-voice-ray {
          animation: novaVoiceRay 1.1s ease-in-out infinite;
        }

        .nova-voice-core {
          position: relative;
          z-index: 2;
          display: block;
          width: 58%;
          aspect-ratio: 484 / 303;
          background: var(--novae-metal);
          filter:
            drop-shadow(0 16px 28px var(--novae-shadow))
            drop-shadow(
              0 0 22px
                color-mix(in srgb, var(--novae-metal) 38%, transparent)
            );
          -webkit-mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
          mask:
            url('/nova-monogramme-no-mask.png')
            center / contain no-repeat;
          animation: novaVoiceBreath 2.8s ease-in-out infinite;
        }

        .nova-voice-state {
          margin: 0;
          font-family: var(--novae-font-title);
          font-size: clamp(24px, 5vw, 34px);
          text-align: center;
        }

        .nova-voice-pause {
          width: 68px;
          height: 68px;
          color: var(--novae-background);
          background: linear-gradient(
            145deg,
            var(--novae-primary),
            var(--novae-hero-end)
          );
          border: 1px solid var(--novae-metal);
          border-radius: 50%;
          box-shadow: 0 14px 34px var(--novae-shadow);
          font-size: 25px;
          cursor: pointer;
        }

        .nova-voice-hint {
          margin: 0;
          color: var(--novae-text-muted);
          font-size: 12px;
          text-align: center;
        }

        .nova-voice-validation-card {
          position: fixed;
          left: 50%;
          bottom: max(22px, env(safe-area-inset-bottom));
          z-index: 145;
          width: min(calc(100vw - 28px), 440px);
          transform: translateX(-50%);
          padding: 18px;
          color: var(--novae-text-main);
          text-align: left;
          background: color-mix(in srgb, var(--novae-surface) 97%, transparent);
          border: 1px solid var(--novae-border);
          border-radius: 22px;
          box-shadow: 0 24px 60px var(--novae-shadow);
          animation: novaValidationRise 220ms ease-out;
        }

        .nova-voice-validation-eyebrow {
          margin: 0 0 7px;
          color: var(--novae-text-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .nova-voice-validation-title {
          display: block;
          color: var(--novae-primary);
          font-family: var(--novae-font-title);
          font-size: 19px;
          line-height: 1.25;
        }

        .nova-voice-validation-description {
          display: -webkit-box;
          margin: 8px 0 0;
          overflow: hidden;
          color: var(--novae-text-muted);
          font-size: 13px;
          line-height: 1.45;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .nova-voice-validation-list {
          display: grid;
          gap: 5px;
          margin-top: 9px;
          color: var(--novae-text-muted);
          font-size: 13px;
        }

        .nova-voice-validation-list span::before {
          content: '•';
          margin-right: 7px;
          color: var(--novae-primary);
        }

        .nova-voice-validation-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
        }

        .nova-voice-validation-confirm,
        .nova-voice-validation-modify {
          min-height: 46px;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .nova-voice-validation-confirm {
          color: var(--novae-background);
          background: var(--novae-primary);
          border: 1px solid var(--novae-primary);
        }

        .nova-voice-validation-modify {
          color: var(--novae-primary);
          background: transparent;
          border: 1px solid var(--novae-primary);
        }

        .nova-voice-validation-cancel {
          display: block;
          margin: 12px auto 0;
          padding: 4px 10px;
          color: var(--novae-text-muted);
          background: transparent;
          border: 0;
          font-size: 12px;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }

        .nova-voice-validation-confirm:disabled,
        .nova-voice-validation-modify:disabled,
        .nova-voice-validation-cancel:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        @keyframes novaValidationRise {
          from {
            opacity: 0;
            transform: translate(-50%, 12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .nova-voice-settings-panel {
          position: absolute;
          top: 72px;
          left: 18px;
          display: grid;
          width: min(330px, calc(100vw - 36px));
          gap: 14px;
          padding: 18px;
          background: color-mix(in srgb, var(--novae-surface) 96%, transparent);
          border: 1px solid var(--novae-border);
          border-radius: 18px;
          box-shadow: 0 18px 46px var(--novae-shadow);
        }

        .nova-voice-settings-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .nova-voice-settings-heading div {
          display: grid;
          gap: 3px;
        }

        .nova-voice-settings-heading small,
        .nova-voice-settings-panel label span {
          color: var(--novae-text-muted);
          font-size: 11px;
        }

        .nova-voice-settings-heading button {
          width: 30px;
          height: 30px;
          color: var(--novae-text-main);
          background: var(--novae-surface-alt);
          border: 1px solid var(--novae-border);
          border-radius: 50%;
          cursor: pointer;
        }

        .nova-voice-settings-panel label {
          display: grid;
          gap: 7px;
        }

        .nova-voice-settings-panel select {
          width: 100%;
          padding: 10px;
          color: var(--novae-text-main);
          background: var(--novae-background);
          border: 1px solid var(--novae-border);
          border-radius: 10px;
        }

        .nova-voice-preview {
          padding: 11px 13px;
          color: var(--novae-background);
          background: var(--novae-primary);
          border: 0;
          border-radius: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .nova-voice-error {
          max-width: 520px;
          margin: 0;
          padding: 10px 14px;
          color: var(--novae-text-main);
          text-align: center;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 12px;
        }

        @keyframes novaVoiceRay {
          0%,
          100% {
            opacity: 0.35;
            transform: scaleY(0.5);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.55);
          }
        }

        @keyframes novaVoiceBreath {
          0%,
          100% {
            opacity: 0.78;
            transform: scale(0.96);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }
      `}</style>
    </main>
  )
}