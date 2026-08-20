import type { NovaAIProvider, NovaPlanStreamOptions } from './provider'
import { AnthropicNovaProvider } from './providers/anthropic'
import { OpenAINovaProvider } from './providers/openai'
import {
  NOVA_PROVIDER_IDS,
  type NovaPlanInput,
  type NovaPlanResult,
  type NovaProviderId,
  type NovaProviderPreference,
} from './types'

const PROVIDERS: Record<NovaProviderId, NovaAIProvider> = {
  anthropic: new AnthropicNovaProvider(),
  openai: new OpenAINovaProvider(),
}

function configuredOrder(): NovaProviderId[] {
  const requested = (process.env.NOVA_AI_PROVIDER_ORDER || 'anthropic,openai')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is NovaProviderId => NOVA_PROVIDER_IDS.includes(value as NovaProviderId))

  return Array.from(new Set(requested.length > 0 ? requested : NOVA_PROVIDER_IDS))
}

export function availableNovaProviders(): NovaProviderId[] {
  return NOVA_PROVIDER_IDS.filter((id) => PROVIDERS[id].isConfigured())
}

export async function createNovaActionPlan(
  input: NovaPlanInput,
  preference: NovaProviderPreference = 'auto',
  options?: NovaPlanStreamOptions
): Promise<NovaPlanResult> {
  const startedAt = Date.now()
  const order = preference === 'auto' ? configuredOrder() : [preference]
  const attemptedProviders: NovaProviderId[] = []
  const failures: string[] = []

  for (const providerId of order) {
    const provider = PROVIDERS[providerId]
    if (!provider.isConfigured()) {
      failures.push(`${providerId}: non configuré`)
      continue
    }

    attemptedProviders.push(providerId)

    try {
      const result = await provider.plan(input, options)
      return {
        ...result,
        attemptedProviders,
        durationMs: Date.now() - startedAt,
        dryRun: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      failures.push(`${providerId}: ${message}`)
    }
  }

  throw new Error(
    failures.length > 0
      ? `Aucun fournisseur IA n’a pu produire le plan. ${failures.join(' | ')}`
      : 'Aucun fournisseur IA n’est configuré.'
  )
}
