import { extractJsonObject } from '../json'
import { normalizeNovaActionPlan } from '../normalize'
import type { NovaAIProvider, NovaPlanStreamOptions } from '../provider'
import { NovaProviderError } from '../provider'
import { buildNovaPlannerSystemPrompt, buildNovaPlannerUserPrompt } from '../prompt'
import type { NovaPlanInput, NovaProviderResult } from '../types'

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>
  stop_reason?: string | null
  usage?: { input_tokens?: number; output_tokens?: number }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export class AnthropicNovaProvider implements NovaAIProvider {
  readonly id = 'anthropic' as const

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }

  async plan(input: NovaPlanInput, options?: NovaPlanStreamOptions): Promise<NovaProviderResult> {
    const perfStartedAt=performance.now()
    let firstDeltaAt:number|null=null
    const apiKey = process.env.ANTHROPIC_API_KEY
    const model = process.env.NOVA_ANTHROPIC_MODEL || 'claude-haiku-4-5'

    if (!apiKey) {
      throw new NovaProviderError({ provider: this.id, message: 'Clé Anthropic absente.', retryable: false })
    }

    let response: Response
    try {
      response = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 6000,
            system: buildNovaPlannerSystemPrompt(),
            messages: [{ role: 'user', content: buildNovaPlannerUserPrompt(input) }],
            stream: Boolean(options?.onSafeAssistantMessage),
          }),
        },
        18_000
      )
    } catch (error) {
      throw new NovaProviderError({
        provider: this.id,
        message: error instanceof Error ? error.message : 'Erreur réseau Anthropic.',
      })
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new NovaProviderError({
        provider: this.id,
        status: response.status,
        retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
        message: `Anthropic a répondu ${response.status}: ${detail}`,
      })
    }

    let data: AnthropicResponse
    let text = ''

    if (options?.onSafeAssistantMessage) {
      if (!response.body) throw new NovaProviderError({ provider: this.id, message: 'Flux Anthropic vide.' })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let stopReason: string | null | undefined
      let inputTokens: number | undefined
      let outputTokens: number | undefined
      let emitted = false

      const maybeEmit = async () => {
        if (emitted) return

        const actions = text.match(
          /"proposed_actions"\s*:\s*\[([\s\S]*?)\]\s*,\s*"missing_information"/
        )
        if (!actions) return

        // RealTalk garde la sécurité actuelle :
        // aucune prise de parole anticipée si le modèle propose une écriture.
        if (/"type"\s*:\s*"(?!no_action")[^"]+"/.test(actions[1])) return

        const key = '"assistant_message"'
        const keyIndex = text.indexOf(key)
        if (keyIndex < 0) return

        const colonIndex = text.indexOf(':', keyIndex + key.length)
        if (colonIndex < 0) return

        const quoteIndex = text.indexOf('"', colonIndex + 1)
        if (quoteIndex < 0) return

        // On lit le contenu JSON partiel sans attendre la fermeture complète
        // de assistant_message. On n'émet que la PREMIÈRE phrase terminée.
        let raw = ''
        let escaped = false
        for (let i = quoteIndex + 1; i < text.length; i += 1) {
          const ch = text[i]

          if (escaped) {
            raw += `\\${ch}`
            escaped = false
            continue
          }

          if (ch === '\\') {
            escaped = true
            continue
          }

          if (ch === '"') break

          raw += ch

          const enoughText = raw.replace(/\\./g, '').trim().length >= 18
          const sentenceEnd = /[.!?…]$/.test(raw)

          if (enoughText && sentenceEnd) {
            try {
              const message = JSON.parse(`"${raw}"`) as string
              if (message.trim()) {
                emitted = true
                console.log('[realtalk][model-perf]', {
                  first_model_delta_ms:
                    firstDeltaAt === null
                      ? null
                      : Math.round(firstDeltaAt - perfStartedAt),
                  first_safe_sentence_ms: Math.round(
                    performance.now() - perfStartedAt
                  ),
                })
                await options.onSafeAssistantMessage?.(message.trim())
              }
            } catch {
              // Le fragment contient encore une séquence JSON incomplète.
            }
            return
          }
        }
      }

      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        let i = -1
        while ((i = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, i); buffer = buffer.slice(i + 2)
          for (const line of block.split('\n')) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw || raw === '[DONE]') continue
            try {
              const e = JSON.parse(raw) as any
              if (e.type === 'message_start') inputTokens = e.message?.usage?.input_tokens
              if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
                if(firstDeltaAt===null){
                  firstDeltaAt=performance.now()
                  console.log('[realtalk][model-perf]',{
                    first_model_delta_ms:Math.round(firstDeltaAt-perfStartedAt),
                  })
                }
                text += e.delta.text || ''
                await maybeEmit()
              }
              if (e.type === 'message_delta') {
                stopReason = e.delta?.stop_reason ?? stopReason
                outputTokens = e.usage?.output_tokens ?? outputTokens
              }
            } catch {}
          }
        }
      }
      data={content:[{type:'text',text}],stop_reason:stopReason,usage:{input_tokens:inputTokens,output_tokens:outputTokens}}
    } else {
      data=(await response.json()) as AnthropicResponse
      text=data.content?.find((b)=>b.type==='text'&&typeof b.text==='string')?.text || ''
    }

    if (!text) throw new NovaProviderError({ provider: this.id, message: 'Réponse Anthropic vide.' })
    if (data.stop_reason === 'max_tokens') {
      throw new NovaProviderError({provider:this.id,message:'Réponse Anthropic tronquée avant la fin du JSON.',retryable:true})
    }

    let parsed: unknown
    try {
      parsed = extractJsonObject(text)
    } catch (error) {
      throw new NovaProviderError({
        provider: this.id,
        message: `JSON Anthropic invalide : ${error instanceof Error ? error.message : 'erreur de parsing'}`,
        retryable: true,
      })
    }

    const plan = normalizeNovaActionPlan(parsed, input.message)

    return {
      provider: this.id,
      model,
      plan,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
    }
  }
}
