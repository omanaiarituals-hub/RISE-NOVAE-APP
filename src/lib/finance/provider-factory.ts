import type { BankingProvider } from './provider'
import { DisabledBankingProvider } from './providers/disabled'
import { PowensBankingProvider } from './providers/powens'
import type { BankingProviderId } from './types'

function configuredProviderId(): BankingProviderId {
  const value = (process.env.FINANCE_BANKING_PROVIDER || 'disabled').toLowerCase()
  if (value === 'powens' || value === 'bridge' || value === 'tink') return value
  return 'disabled'
}

export function getBankingProvider(): BankingProvider {
  const providerId = configuredProviderId()
  if (providerId === 'powens') return new PowensBankingProvider()
  return new DisabledBankingProvider()
}

export function getConfiguredBankingProviderId(): BankingProviderId {
  return configuredProviderId()
}
