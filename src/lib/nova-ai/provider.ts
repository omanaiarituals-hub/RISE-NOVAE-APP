import type { NovaPlanInput, NovaProviderId, NovaProviderResult } from './types'

export interface NovaAIProvider {
  readonly id: NovaProviderId
  isConfigured(): boolean
  plan(input: NovaPlanInput): Promise<NovaProviderResult>
}

export class NovaProviderError extends Error {
  readonly provider: NovaProviderId
  readonly status?: number
  readonly retryable: boolean

  constructor({
    provider,
    message,
    status,
    retryable = true,
  }: {
    provider: NovaProviderId
    message: string
    status?: number
    retryable?: boolean
  }) {
    super(message)
    this.name = 'NovaProviderError'
    this.provider = provider
    this.status = status
    this.retryable = retryable
  }
}
