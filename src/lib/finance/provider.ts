import type {
  BankingConnection,
  BankingConnectionSession,
  BankingProviderId,
  BankingSyncResult,
  BankingWebhookEvent,
  FinanceAccount,
  FinanceTransaction,
} from './types'

/**
 * Contrat NOVAÉ volontairement limité à la LECTURE SEULE.
 * Aucune méthode de paiement, virement ou initiation de paiement ne doit être ajoutée
 * dans Finance V1.
 */
export interface BankingProvider {
  readonly id: BankingProviderId
  isConfigured(): boolean

  createReadOnlyConnectionSession(input: {
    novaeUserId: string
    returnUrl: string
  }): Promise<BankingConnectionSession>

  listConnections(novaeUserId: string): Promise<BankingConnection[]>
  listAccounts(providerConnectionId: string): Promise<FinanceAccount[]>
  listTransactions(input: {
    providerConnectionId: string
    since?: string
  }): Promise<FinanceTransaction[]>

  syncConnection(providerConnectionId: string): Promise<BankingSyncResult>
  disconnectConnection(providerConnectionId: string): Promise<void>
  parseWebhook(input: {
    headers: Headers
    rawBody: string
  }): Promise<BankingWebhookEvent>
}

export class BankingProviderError extends Error {
  readonly provider: BankingProviderId
  readonly status?: number
  readonly retryable: boolean

  constructor(input: {
    provider: BankingProviderId
    message: string
    status?: number
    retryable?: boolean
  }) {
    super(input.message)
    this.name = 'BankingProviderError'
    this.provider = input.provider
    this.status = input.status
    this.retryable = input.retryable ?? true
  }
}
