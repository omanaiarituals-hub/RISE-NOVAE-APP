import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBankingProvider } from '../provider-factory'

async function reconcilePendingManualMovements(userId: string) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 10)
  const [{ data: pending }, { data: txs }] = await Promise.all([
    supabaseAdmin.from('finance_manual_bank_movements').select('id,bank_delta,occurred_on').eq('user_id', userId).eq('status', 'pending'),
    supabaseAdmin.from('finance_transactions').select('id,amount,transaction_date').eq('user_id', userId).gte('transaction_date', since).order('transaction_date', { ascending: false }),
  ])
  for (const move of pending ?? []) {
    const wanted = Math.abs(Number(move.bank_delta || 0))
    const moveDate = new Date(`${move.occurred_on}T12:00:00`).getTime()
    const match = (txs ?? []).find((tx) => Math.abs(Math.abs(Number(tx.amount || 0)) - wanted) < 0.01 && Math.abs(new Date(`${tx.transaction_date}T12:00:00`).getTime() - moveDate) <= 1000 * 60 * 60 * 24 * 3)
    if (match) await supabaseAdmin.from('finance_manual_bank_movements').update({ status: 'matched', matched_transaction_id: match.id, updated_at: new Date().toISOString() }).eq('id', move.id).eq('user_id', userId)
  }
}

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

    // Le fournisseur renvoie uniquement les comptes autorisés pour la session courante.
    const accounts = await provider.listAccounts(connection.providerConnectionId)
    const providerAccountIds = accounts.map((account) => account.providerAccountId)
    const accountIdByProvider = new Map<string, string>()

    // Tout compte précédemment découvert mais plus renvoyé doit cesser
    // contributing to balances, analyses and transaction imports.
    const { data: existingAccounts, error: existingAccountsError } = await supabaseAdmin
      .from('finance_accounts')
      .select('id,provider_account_id')
      .eq('user_id', userId)
      .eq('connection_id', savedConnection.id)
    if (existingAccountsError) throw new Error(existingAccountsError.message)
    const returned = new Set(providerAccountIds)
    const staleIds = (existingAccounts ?? []).filter((item) => !returned.has(String(item.provider_account_id))).map((item) => item.id)
    if (staleIds.length) {
      const { error: staleError } = await supabaseAdmin
        .from('finance_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .in('id', staleIds)
      if (staleError) throw new Error(staleError.message)
    }

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
        .select('id,user_enabled')
        .single()

      if (accountError || !savedAccount) throw new Error(accountError?.message || 'Compte Finance non enregistré')
      if (savedAccount.user_enabled !== false) accountIdByProvider.set(account.providerAccountId, savedAccount.id)
      accountCount++
    }

    const transactions = await provider.listTransactions({ providerConnectionId: connection.providerConnectionId })
    for (const transaction of transactions) {
      const localAccountId = accountIdByProvider.get(transaction.providerAccountId)
      if (!localAccountId) continue
      const signedAmount = transaction.direction === 'debit' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)
      const { error: txError } = await supabaseAdmin.from('finance_transactions').upsert({
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
      transactionCount++
    }
  }

  // Dès qu'un fournisseur actif renvoie une connexion valide, les anciens
  // fournisseurs (ex. sandbox Powens) sont archivés localement pour éviter tout
  // mélange entre données de test et finances réelles. L'historique est conservé.
  if (connections.length > 0) {
    const { data: legacyConnections, error: legacyError } = await supabaseAdmin
      .from('finance_connections')
      .select('id')
      .eq('user_id', userId)
      .neq('provider', provider.id)
      .is('disconnected_at', null)
    if (legacyError) throw new Error(legacyError.message)

    const legacyIds = (legacyConnections ?? []).map((item) => item.id)
    if (legacyIds.length) {
      const now = new Date().toISOString()
      const { error: accountsArchiveError } = await supabaseAdmin
        .from('finance_accounts')
        .update({ is_active: false, user_enabled: false, updated_at: now })
        .eq('user_id', userId)
        .in('connection_id', legacyIds)
      if (accountsArchiveError) throw new Error(accountsArchiveError.message)

      const { error: connectionArchiveError } = await supabaseAdmin
        .from('finance_connections')
        .update({ status: 'disconnected', disconnected_at: now, updated_at: now })
        .eq('user_id', userId)
        .in('id', legacyIds)
      if (connectionArchiveError) throw new Error(connectionArchiveError.message)
    }
  }

  await reconcilePendingManualMovements(userId)
  return { connections: connections.length, accounts: accountCount, transactions: transactionCount }
}
