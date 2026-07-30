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

function isPositiveConfirmation(value: string): boolean {
  return /^(oui|oui je confirme|je confirme|confirme|ok|d'accord|d’accord)$/i.test(value.trim())
}

function isNegativeConfirmation(value: string): boolean {
  return /^(non|annule|annuler|je refuse|ne fais rien)$/i.test(value.trim())
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
  const [conversations, setConversations] = useState<NovaConversationSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [listening, setListening] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
    const autoVoiceStartedRef = useRef(false)



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

    useEffect(() => {
    if (!voiceMode || autoVoiceStartedRef.current) return

    autoVoiceStartedRef.current = true

    const timeout = window.setTimeout(() => {
      toggleVoiceInput(true)
    }, 500)

    return () => window.clearTimeout(timeout)
    // Le démarrage doit avoir lieu une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode])

  async function refreshHistory() {
    try {
      const rows = await history.listConversations()
      setConversations(rows)
    } catch {
      // L'interface conversationnelle reste utilisable même si l'historique échoue.
    }
  }

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (conversationId) return conversationId
    const created = await history.createConversation(firstMessage)
    setConversationId(created.id)
    setConversations((current) => [created, ...current])
    return created.id
  }

  async function addMessage(
    role: ChatMessage['role'],
    text: string,
    activeConversationId?: string | null,
    metadata: Record<string, unknown> = {}
  ) {
    setMessages((current) => [...current, { id: createId(role), role, text }])

    const targetId = activeConversationId || conversationId
    if (!targetId) return

    try {
      await history.saveMessage(targetId, role, text, metadata)
      await refreshHistory()
    } catch {
      // Ne pas bloquer Nova si l'historique rencontre une erreur ponctuelle.
    }
  }

  function buildContextualRequest(userAnswer: string): string {
    const transcript = messages
      .filter((message) => message.text !== WELCOME)
      .slice(-12)
      .map((message) => `${message.role === 'user' ? 'Utilisateur' : 'Nova'} : ${message.text}`)
      .join('\n')

    if (!result && !transcript) return userAnswer

    const missing = result?.plan.missing_information
      .map((item) => `${item.field}: ${item.question}`)
      .join(' | ')

    const actions = result?.plan.proposed_actions
      .map((action) => `${action.type}: ${action.title}`)
      .join(' | ')

    return [
      'Tu poursuis une conversation avec l’utilisateur.',
      rootRequest ? `Demande initiale : ${rootRequest}` : '',
      transcript ? `Historique récent :\n${transcript}` : '',
      result?.plan.summary ? `Résumé actuel : ${result.plan.summary}` : '',
      `Informations encore manquantes : ${missing || 'aucune'}`,
      `Actions déjà proposées : ${actions || 'aucune'}`,
      `Nouvelle réponse de l’utilisateur : ${userAnswer}`,
      'Recalcule le plan complet en tenant compte du contexte. Ne prétends jamais avoir exécuté une action.',
    ].filter(Boolean).join('\n')
  }

  async function requestPlan(visibleMessage: string) {
    if (!visibleMessage.trim() || loading || status === 'executing') return

    const normalized = visibleMessage.trim()

    if (status === 'waiting_confirmation' && isPositiveConfirmation(normalized)) {
      await confirmPreparedActions()
      return
    }

    if (status === 'waiting_confirmation' && isNegativeConfirmation(normalized)) {
      await cancelPreparedActions()
      return
    }

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
        body: JSON.stringify({ message: buildContextualRequest(normalized), provider: 'auto' }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.message || 'Nova n’a pas pu analyser cette demande pour le moment.')
      }

      const nextResult = payload as NovaPlanResult
      setResult(nextResult)
      if (!rootRequest) setRootRequest(normalized)

      await addMessage('nova', nextResult.plan.assistant_message, activeConversationId, {
        type: 'plan',
        intent: nextResult.plan.intent,
        action_types: nextResult.plan.proposed_actions.map((action) => action.type),
      })

      if (nextResult.plan.missing_information.length > 0) {
        setStatus('waiting_information')
      } else if (nextResult.plan.proposed_actions.some((action) => action.requires_confirmation)) {
        setStatus('waiting_confirmation')
      } else {
        setStatus('idle')
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Une erreur est survenue pendant l’analyse.'
      setError(message)
      await addMessage('system', message, activeConversationId)
    } finally {
      setLoading(false)
    }
  }

  async function confirmPreparedActions() {
    if (!result || loading || status === 'executing') return

    const activeConversationId = conversationId
    await addMessage('user', 'Oui, je confirme.', activeConversationId)
    setLoading(true)
    setStatus('executing')
    setError('')

    try {
      if (!result.executionToken) {
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
        body: JSON.stringify({ executionToken: result.executionToken }),
      })

      const payload = (await response.json()) as Partial<NovaExecutionResult> & { message?: string }
      if (!response.ok) {
        if (response.status === 409 && payload.message) {
          await addMessage('nova', payload.message, activeConversationId, {
            type: 'execution_result', success: false, requires_modification: true,
          })
          setResult(null)
          setStatus('completed')
          return
        }
        throw new Error(payload.message || 'La proposition a été validée, mais elle n’a pas pu être exécutée.')
      }

      const finalMessage = payload.message || 'C’est fait. L’action a été exécutée.'
      await addMessage('nova', finalMessage, activeConversationId, {
        type: 'execution_result',
        success: true,
      })
      setStatus('completed')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'L’action n’a pas pu être exécutée.'
      setError(message)
      await addMessage('system', message, activeConversationId, {
        type: 'execution_result',
        success: false,
      })
      setStatus('waiting_confirmation')
    } finally {
      setLoading(false)
    }
  }

  async function cancelPreparedActions() {
    await addMessage('user', 'Non, annule.', conversationId)
    await addMessage('nova', 'D’accord. Je n’exécute rien et je laisse cette proposition de côté.', conversationId)
    setStatus('cancelled')
  }

  async function askForModification() {
    await addMessage('user', 'Je veux modifier la proposition.', conversationId)
    await addMessage('nova', 'Très bien. Dis-moi précisément ce que tu veux changer.', conversationId)
    setStatus('waiting_information')
    setInput('')
  }

  function startNewConversation() {
    setConversationId(null)
    setInput('')
    setResult(null)
    setRootRequest('')
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
      setConversationId(conversation.id)
      setMessages(storedMessages.length > 0
        ? storedMessages.map((message) => ({ id: message.id, role: message.role, text: message.text }))
        : [{ id: createId('empty'), role: 'nova', text: 'Cette conversation est vide.' }]
      )
      const firstUserMessage = storedMessages.find((message) => message.role === 'user')
      setRootRequest(firstUserMessage?.text || '')
      setResult(null)
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

   function toggleVoiceInput(autoSubmit = false) {
    if (listening) return

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

    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.continuous = false

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
          'Autorise l’accès au microphone dans ton navigateur, puis appuie de nouveau sur le micro.',
        )
        return
      }

      if (event?.error === 'no-speech') {
        setError("Je n’ai rien entendu. Réessaie en parlant un peu plus près du micro.")
        return
      }

      setError("Je n’ai pas réussi à entendre la dictée. Réessaie.")
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || ''

      if (!transcript) return

      if (autoSubmit || voiceMode) {
        void requestPlan(transcript)
        return
      }

      setInput((current) => (current ? `${current} ${transcript}` : transcript))
    }

    try {
      recognition.start()
    } catch {
      setListening(false)
      setError('Le microphone est déjà utilisé. Attends une seconde puis réessaie.')
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

      <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#796F68]">Version privée</p>
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
              <button type="button" onClick={() => toggleVoiceInput(false)} disabled={loading || status === 'executing'} title="Dicter un message" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${listening ? 'border-[#6F5B8E] bg-[#EEE7F4] text-[#5D477D]' : 'border-[#CBC3BB] bg-white text-[#514B46]'}`}>{listening ? 'Écoute…' : '🎤'}</button>
              <button type="submit" disabled={loading || !input.trim() || status === 'executing'} className="rounded-xl bg-[#332E2A] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Envoyer</button>
            </form>
            {error ? <p className="mt-3 text-xs text-[#7B2921]">{error}</p> : null}
          </div>
        </section>
      </div>
    </main>
  )
}
