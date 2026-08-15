export type BankingProviderId = 'powens' | 'bridge' | 'tink' | 'disabled'

export type BankingConnectionStatus =
  | 'pending'
  | 'connected'
  | 'syncing'
  | 'reauth_required'
  | 'error'
  | 'disconnected'

export type FinanceAccount = {
  providerAccountId: string
  name: string
  type?: string
  currency: string
  balance?: number
  availableBalance?: number
  maskedIdentifier?: string
  isActive: boolean
}

export type FinanceTransaction = {
  providerTransactionId: string
  providerAccountId: string
  transactionDate: string
  valueDate?: string
  amount: number
  currency: string
  rawLabel?: string
  merchantName?: string
  direction: 'credit' | 'debit'
  providerCategory?: string
  metadata?: Record<string, unknown>
}

export type BankingConnection = {
  providerConnectionId: string
  providerUserId?: string
  institutionName?: string
  status: BankingConnectionStatus
  lastSyncedAt?: string
  consentExpiresAt?: string
}

export type BankingConnectionSession = {
  url: string
  expiresAt?: string
}

export type BankingWebhookEvent = {
  providerEventId: string
  type: string
  providerConnectionId?: string
}

export type BankingSyncResult = {
  connection: BankingConnection
  accounts: FinanceAccount[]
  transactions: FinanceTransaction[]
}
