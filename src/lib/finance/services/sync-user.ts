import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBankingProvider } from '../provider-factory'

export async function syncFinanceUser(userId: string) {
  const provider = getBankingProvider()
  if (!provider.isConfigured()) return { connections: 0, accounts: 0, transactions: 0 }

  const connections = await provider.listConnections(userId)
  let accountCount = 0
  let transactionCount = 0

  for (const connection of connections) {
    const { data: savedConnection, error: connectionError } = await supabaseAdmin
      .from('finance_connections')
      .upsert({
        user_id: userId,
        provider: provider.id,
        provider_user_id: connection.providerUserId || null,
        provider_connection_id: connection.providerConnectionId,
        institution_name: connection.institutionName || null,
        status: connection.status,
        last_synced_at: connection.lastSyncedAt || null,
        consent_expires_at: connection.consentExpiresAt || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider,provider_connection_id' })
      .select('id')
      .single()
    if (connectionError || !savedConnection) throw new Error(connectionError?.message || 'Connexion Finance non enregistrée')

    const accounts = await provider.listAccounts(connection.providerConnectionId)
    const accountIdByProvider = new Map<string, string>()
    for (const account of accounts) {
      const { data: savedAccount, error: accountError } = await supabaseAdmin
        .from('finance_accounts')
        .upsert({
          user_id: userId,
          connection_id: savedConnection.id,
          provider_account_id: account.providerAccountId,
          name: account.name,
          account_type: account.type || null,
          currency: account.currency,
          balance: account.balance ?? null,
          available_balance: account.availableBalance ?? null,
          masked_identifier: account.maskedIdentifier || null,
          is_active: account.isActive,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'connection_id,provider_account_id' })
        .select('id')
        .single()
      if (accountError || !savedAccount) throw new Error(accountError?.message || 'Compte Finance non enregistré')
      accountIdByProvider.set(account.providerAccountId, savedAccount.id)
      accountCount += 1
    }

    const transactions = await provider.listTransactions({ providerConnectionId: connection.providerConnectionId })
    for (const transaction of transactions) {
      const localAccountId = accountIdByProvider.get(transaction.providerAccountId)
      if (!localAccountId) continue
      const signedAmount = transaction.direction === 'debit' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)
      const { error: txError } = await supabaseAdmin
        .from('finance_transactions')
        .upsert({
          user_id: userId,
          account_id: localAccountId,
          provider_transaction_id: transaction.providerTransactionId,
          transaction_date: transaction.transactionDate,
          value_date: transaction.valueDate || null,
          amount: signedAmount,
          currency: transaction.currency,
          raw_label: transaction.rawLabel || null,
          merchant_name: transaction.merchantName || null,
          direction: transaction.direction,
          provider_category: transaction.providerCategory || null,
          provider_metadata: transaction.metadata || {},
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'account_id,provider_transaction_id' })
      if (txError) throw new Error(txError.message)
      transactionCount += 1
    }
  }

  return { connections: connections.length, accounts: accountCount, transactions: transactionCount }
}
