import type { BankingProvider } from './provider'
import { DisabledBankingProvider } from './providers/disabled'
import type { BankingProviderId } from './types'

function configuredProviderId(): BankingProviderId {
  const value = (process.env.FINANCE_BANKING_PROVIDER || 'disabled').toLowerCase()
  if (value === 'powens' || value === 'bridge' || value === 'tink') return value
  return 'disabled'
}

/**
 * Lot 0 : seul le provider désactivé est instancié.
 * Le prochain lot branchera Powens derrière CE contrat sans modifier le moteur Finance.
 */
export function getBankingProvider(): BankingProvider {
  const providerId = configuredProviderId()

  if (providerId !== 'disabled') {
    // Fail closed tant que l’adaptateur réel n’est pas installé.
    return new DisabledBankingProvider()
  }

  return new DisabledBankingProvider()
}

export function getConfiguredBankingProviderId(): BankingProviderId {
  return configuredProviderId()
}
