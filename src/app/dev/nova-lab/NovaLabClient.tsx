'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { NovaPlanResult } from '@/lib/nova-ai/types'

type ConversationStatus =
  | 'idle'
  | 'waiting_information'
  | 'waiting_confirmation'
  | 'confirmed'
  | 'cancelled'

type ChatMessage = {
  id: string
  role: 'user' | 'nova' | 'system'
  text: string
}

const EXAMPLES = [
  'Je dois envoyer mon dossier à la CPAM avant vendredi.',
  'Mardi à 14 h, j’ai rendez-vous chez le dentiste avec Inaya.',
  'J’ai reçu une facture d’électricité de 126 euros à payer avant le 10 août.',
  'Note que cette semaine j’ai les enfants mercredi, jeudi et vendredi.',
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

export default function NovaLabClient({ userEmail }: { userEmail?: string }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId('welcome'),
      role: 'nova',
      text: 'Bonjour. Confie-moi une situation, un rendez-vous, une échéance ou une information à retenir. Je préparerai la suite sans rien exécuter.',
    },
  ])
  const [result, setResult] = useState<NovaPlanResult | null>(null)
  const [rootRequest, setRootRequest] = useState('')
  const [status, setStatus] = useState<ConversationStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, result, status, loading])

  function addMessage(role: ChatMessage['role'], text: string) {
    setMessages((current) => [
      ...current,
      { id: createId(role), role, text },
    ])
  }

  function buildContextualRequest(userAnswer: string): string {
    if (!result || !rootRequest) return userAnswer

    const missing = result.plan.missing_information
      .map((item) => `${item.field}: ${item.question}`)
      .join(' | ')

    const actions = result.plan.proposed_actions
      .map((action) => `${action.type}: ${action.title}`)
      .join(' | ')

    return [
      'Tu poursuis une conversation avec l’utilisateur.',
      `Demande initiale : ${rootRequest}`,
      `Résumé actuel : ${result.plan.summary}`,
      `Informations encore manquantes : ${missing || 'aucune'}`,
      `Actions déjà proposées : ${actions || 'aucune'}`,
      `Nouvelle réponse de l’utilisateur : ${userAnswer}`,
      'Recalcule le plan complet en tenant compte de cette nouvelle réponse. Ne prétends jamais avoir exécuté une action.',
    ].join('\n')
  }

  async function requestPlan(visibleMessage: string) {
    if (!visibleMessage.trim() || loading) return

    const normalized = visibleMessage.trim()

    if (status === 'waiting_confirmation' && isPositiveConfirmation(normalized)) {
      confirmPreparedActions()
      return
    }

    if (status === 'waiting_confirmation' && isNegativeConfirmation(normalized)) {
      cancelPreparedActions()
      return
    }

    addMessage('user', normalized)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) {
        throw new Error('Ta session a expiré. Reconnecte-toi à NOVAÉ.')
      }

      const requestMessage = buildContextualRequest(normalized)

      const response = await fetch('/api/nova/plan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: requestMessage,
          provider: 'auto',
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            'Nova n’a pas pu analyser cette demande pour le moment.'
        )
      }

      const nextResult = payload as NovaPlanResult
      setResult(nextResult)

      if (!rootRequest) {
        setRootRequest(normalized)
      }

      addMessage('nova', nextResult.plan.assistant_message)

      if (nextResult.plan.missing_information.length > 0) {
        setStatus('waiting_information')
      } else if (
        nextResult.plan.proposed_actions.some(
          (action) => action.requires_confirmation
        )
      ) {
        setStatus('waiting_confirmation')
      } else {
        setStatus('idle')
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'Une erreur est survenue pendant l’analyse.'
      setError(message)
      addMessage('system', message)
    } finally {
      setLoading(false)
    }
  }

  function confirmPreparedActions() {
    addMessage('user', 'Oui, je confirme.')
    addMessage(
      'nova',
      'Validation reçue. L’exécution sécurisée n’est pas encore activée dans ce laboratoire, donc aucune donnée n’a été créée. La prochaine étape sera de connecter cette validation au moteur concerné.'
    )
    setStatus('confirmed')
  }

  function cancelPreparedActions() {
    addMessage('user', 'Non, annule.')
    addMessage('nova', 'D’accord. Je n’exécute rien et je laisse cette proposition de côté.')
    setStatus('cancelled')
  }

  function askForModification() {
    addMessage('user', 'Je veux modifier la proposition.')
    addMessage('nova', 'Très bien. Dis-moi précisément ce que tu veux changer.')
    setStatus('waiting_information')
    setInput('')
  }

  function startNewConversation() {
    setInput('')
    setResult(null)
    setRootRequest('')
    setStatus('idle')
    setError('')
    setMessages([
      {
        id: createId('welcome'),
        role: 'nova',
        text: 'Nouvelle demande. Que veux-tu me confier ?',
      },
    ])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void requestPlan(input)
  }

  const confirmableActions =
    result?.plan.proposed_actions.filter(
      (action) => action.requires_confirmation
    ) || []

  return (
    <main className="min-h-screen bg-[#F7F5F1] px-4 py-8 text-[#282522]">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#796F68]">
              Laboratoire privé
            </p>
            <h1 className="font-serif text-3xl font-semibold">Nova V2</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#625B55]">
              Une conversation de test pour comprendre, préciser et valider une action. Aucune exécution réelle n’est encore activée.
            </p>
            {userEmail ? (
              <p className="mt-1 text-xs text-[#847A72]">Compte : {userEmail}</p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-full border border-[#CFC7BF] bg-white px-4 py-2 text-sm"
            >
              Nouvelle demande
            </button>
            <Link
              href="/"
              className="rounded-full border border-[#CFC7BF] bg-white px-4 py-2 text-sm"
            >
              Retour
            </Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[#D7D0C8] bg-white shadow-sm">
          <div className="border-b border-[#E8E2DC] bg-[#FBFAF8] px-5 py-3">
            <span className="rounded-full bg-[#EFEAE5] px-3 py-1 text-xs font-medium text-[#625B55]">
              Mode test, sans exécution
            </span>
          </div>

          <div className="max-h-[58vh] min-h-[420px] space-y-4 overflow-y-auto px-5 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-[#6F5B8E] text-white'
                      : message.role === 'system'
                        ? 'rounded-bl-md border border-[#C8A6A1] bg-[#F8EFEE] text-[#7B2921]'
                        : 'rounded-bl-md border border-[#E1DBD5] bg-[#F8F5F1] text-[#3D3834]'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-[#E1DBD5] bg-[#F8F5F1] px-4 py-3 text-sm text-[#6B625B]">
                  Nova prépare la suite…
                </div>
              </div>
            ) : null}

            {result && status === 'waiting_information' ? (
              <div className="rounded-2xl border border-[#D7D0C8] bg-[#FCFBF9] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#796F68]">
                  À préciser
                </p>
                <div className="mt-3 space-y-2">
                  {result.plan.missing_information.map((information, index) => (
                    <p
                      key={`${information.field}-${index}`}
                      className="text-sm leading-6 text-[#514B46]"
                    >
                      {information.question}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {result && status === 'waiting_confirmation' ? (
              <div className="rounded-2xl border border-[#D7D0C8] bg-[#FCFBF9] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#796F68]">
                  Proposition à valider
                </p>

                <div className="mt-3 space-y-3">
                  {confirmableActions.map((action) => (
                    <article
                      key={action.id}
                      className="rounded-xl border border-[#E1DBD5] bg-white p-4"
                    >
                      <strong className="text-sm">{action.title}</strong>
                      <p className="mt-1 text-sm leading-6 text-[#5E5751]">
                        {action.reason}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={confirmPreparedActions}
                    className="rounded-lg bg-[#332E2A] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={askForModification}
                    className="rounded-lg border border-[#CFC7BF] bg-white px-4 py-2 text-sm font-semibold"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={cancelPreparedActions}
                    className="rounded-lg border border-[#CFC7BF] bg-white px-4 py-2 text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : null}

            {status === 'confirmed' ? (
              <div className="rounded-xl border border-[#BFC7BC] bg-[#F2F5F1] p-4 text-sm leading-6 text-[#3F5140]">
                Validation enregistrée dans la conversation. Aucune exécution réelle n’a encore eu lieu.
              </div>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="border-t border-[#E8E2DC] bg-[#FBFAF8] p-4">
            {messages.length <= 1 ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setInput(example)}
                    className="rounded-full border border-[#DDD6CF] bg-white px-3 py-1.5 text-xs hover:bg-[#F4F0EC]"
                  >
                    {example.slice(0, 42)}
                    {example.length > 42 ? '…' : ''}
                  </button>
                ))}
              </div>
            ) : null}

            <form onSubmit={submit} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (input.trim() && !loading) {
                      void requestPlan(input)
                    }
                  }
                }}
                rows={2}
                placeholder={
                  status === 'waiting_information'
                    ? 'Réponds à Nova…'
                    : 'Écris à Nova…'
                }
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-[#CBC3BB] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#7B6F66]"
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-[#332E2A] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Envoyer
              </button>
            </form>

            {error ? (
              <p className="mt-3 text-xs text-[#7B2921]">{error}</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
