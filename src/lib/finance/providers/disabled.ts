import type { BankingProvider } from '../provider'
import { BankingProviderError } from '../provider'
import type {
  BankingConnection,
  BankingConnectionSession,
  BankingSyncResult,
  BankingWebhookEvent,
  FinanceAccount,
  FinanceTransaction,
} from '../types'

export class DisabledBankingProvider implements BankingProvider {
  readonly id = 'disabled' as const

  isConfigured() {
    return false
  }

  private unavailable(): never {
    throw new BankingProviderError({
      provider: this.id,
      message: 'La synchronisation bancaire Finance n’est pas encore configurée.',
      retryable: false,
    })
  }

  async createReadOnlyConnectionSession(): Promise<BankingConnectionSession> {
    return this.unavailable()
  }

  async listConnections(): Promise<BankingConnection[]> {
    return []
  }

  async listAccounts(): Promise<FinanceAccount[]> {
    return []
  }

  async listTransactions(): Promise<FinanceTransaction[]> {
    return []
  }

  async syncConnection(): Promise<BankingSyncResult> {
    return this.unavailable()
  }

  async disconnectConnection(): Promise<void> {
    return this.unavailable()
  }

  async parseWebhook(): Promise<BankingWebhookEvent> {
    return this.unavailable()
  }
}
