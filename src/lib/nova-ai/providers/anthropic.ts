import { extractJsonObject } from '../json'
import { normalizeNovaActionPlan } from '../normalize'
import type { NovaAIProvider } from '../provider'
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

  async plan(input: NovaPlanInput): Promise<NovaProviderResult> {
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

    const data = (await response.json()) as AnthropicResponse
    const text = data.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text

    if (!text) {
      throw new NovaProviderError({ provider: this.id, message: 'Réponse Anthropic vide.' })
    }

    if (data.stop_reason === 'max_tokens') {
      throw new NovaProviderError({
        provider: this.id,
        message: 'Réponse Anthropic tronquée avant la fin du JSON.',
        retryable: true,
      })
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
