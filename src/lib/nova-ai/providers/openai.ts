import { extractJsonObject } from '../json'
import { normalizeNovaActionPlan } from '../normalize'
import type { NovaAIProvider } from '../provider'
import { NovaProviderError } from '../provider'
import { buildNovaPlannerSystemPrompt, buildNovaPlannerUserPrompt } from '../prompt'
import { NOVA_ACTION_PLAN_JSON_SCHEMA } from '../schema'
import type { NovaPlanInput, NovaProviderResult } from '../types'

type OpenAIResponse = {
  status?: string
  incomplete_details?: { reason?: string }
  output_text?: string
  output?: Array<{
    type?: string
    status?: string
    content?: Array<{ type?: string; text?: string }>
  }>
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

function readOutputText(data: OpenAIResponse): string | null {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text
      }
    }
  }

  return null
}

export class OpenAINovaProvider implements NovaAIProvider {
  readonly id = 'openai' as const

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY)
  }

  async plan(input: NovaPlanInput): Promise<NovaProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.NOVA_OPENAI_MODEL || 'gpt-5.6-luna'

    if (!apiKey) {
      throw new NovaProviderError({ provider: this.id, message: 'Clé OpenAI absente.', retryable: false })
    }

    let response: Response
    try {
      response = await fetchWithTimeout(
        'https://api.openai.com/v1/responses',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            store: false,
            max_output_tokens: 6000,
            input: [
              {
                role: 'system',
                content: [{ type: 'input_text', text: buildNovaPlannerSystemPrompt() }],
              },
              {
                role: 'user',
                content: [{ type: 'input_text', text: buildNovaPlannerUserPrompt(input) }],
              },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'nova_action_plan',
                strict: true,
                schema: NOVA_ACTION_PLAN_JSON_SCHEMA,
              },
            },
          }),
        },
        18_000
      )
    } catch (error) {
      throw new NovaProviderError({
        provider: this.id,
        message: error instanceof Error ? error.message : 'Erreur réseau OpenAI.',
      })
    }

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new NovaProviderError({
        provider: this.id,
        status: response.status,
        retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
        message: `OpenAI a répondu ${response.status}: ${detail}`,
      })
    }

    const data = (await response.json()) as OpenAIResponse

    if (
      data.status === 'incomplete' ||
      (data.output || []).some((item) => item.status === 'incomplete')
    ) {
      throw new NovaProviderError({
        provider: this.id,
        message: `Réponse OpenAI incomplète${data.incomplete_details?.reason ? ` : ${data.incomplete_details.reason}` : ''}.`,
        retryable: true,
      })
    }

    const text = readOutputText(data)

    if (!text) {
      throw new NovaProviderError({ provider: this.id, message: 'Réponse OpenAI vide.' })
    }

    let parsed: unknown
    try {
      parsed = extractJsonObject(text)
    } catch (error) {
      throw new NovaProviderError({
        provider: this.id,
        message: `JSON OpenAI invalide : ${error instanceof Error ? error.message : 'erreur de parsing'}`,
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
