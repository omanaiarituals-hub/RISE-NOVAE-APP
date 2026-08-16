import { redirect } from 'next/navigation'
import { getFinanceServerIdentity } from '@/lib/finance/auth'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { supabaseAdmin } from '@/lib/supabase-admin'

function money(value: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date)
}

export default async function Page() {
  const identity = await getFinanceServerIdentity()
  if (!identity || !isFinanceBetaAllowed(identity.id)) redirect('/finances')

  const { data: usableAccounts, error: accountError } = await supabaseAdmin
    .from('finance_accounts')
    .select('id')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .eq('user_enabled', true)

  if (accountError) {
    return (
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Lecture bancaire</p>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Transactions</h2>
        <p className="mt-4 text-[var(--novae-text-muted)]">Impossible de charger les opérations pour le moment.</p>
      </section>
    )
  }

  const accountIds = (usableAccounts ?? []).map((item) => item.id)
  let transactions: any[] = []
  let error: { message: string } | null = null
  if (accountIds.length) {
    const result = await supabaseAdmin
      .from('finance_transactions')
      .select('id,transaction_date,amount,currency,raw_label,merchant_name,direction,provider_category,account:finance_accounts(name,custom_name,masked_identifier)')
      .eq('user_id', identity.id)
      .in('account_id', accountIds)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    transactions = result.data ?? []
    error = result.error
  }

  if (error) {
    return (
      <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Lecture bancaire</p>
        <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Transactions</h2>
        <p className="mt-4 text-[var(--novae-text-muted)]">Impossible de charger les opérations pour le moment.</p>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-[var(--novae-border)] bg-[var(--novae-surface)] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[var(--novae-primary)]">Lecture bancaire</p>
          <h2 className="mt-2 font-[var(--novae-font-title)] text-3xl font-semibold">Transactions</h2>
          <p className="mt-2 text-sm text-[var(--novae-text-muted)]">Les 100 opérations les plus récentes des comptes inclus dans NOVAÉ.</p>
        </div>
        <span className="rounded-full border border-[var(--novae-border)] px-3 py-2 text-xs font-bold">{transactions.length} opération(s)</span>
      </div>

      {!transactions.length ? (
        <div className="mt-6 rounded-2xl bg-[var(--novae-background)] p-5 text-sm leading-6 text-[var(--novae-text-muted)]">
          Aucune opération sur les comptes actuellement inclus. Gère tes comptes depuis l’onglet Banque ou lance une synchronisation.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--novae-border)]">
          {transactions.map((transaction, index) => {
            const account = Array.isArray(transaction.account) ? transaction.account[0] : transaction.account
            const amount = Number(transaction.amount)
            const accountName = account?.custom_name || account?.name
            return (
              <div key={transaction.id} className={`grid grid-cols-[56px_1fr_auto] gap-3 p-4 ${index ? 'border-t border-[var(--novae-border)]' : ''}`}>
                <div className="text-xs font-bold text-[var(--novae-text-muted)]">{formatDate(transaction.transaction_date)}</div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{transaction.merchant_name || transaction.raw_label || 'Opération bancaire'}</p>
                  <p className="mt-1 truncate text-xs text-[var(--novae-text-muted)]">
                    {transaction.provider_category || 'À catégoriser'}{accountName ? ` · ${accountName}` : ''}{account?.masked_identifier ? ` ${account.masked_identifier}` : ''}
                  </p>
                </div>
                <div className={`whitespace-nowrap text-right font-black ${amount >= 0 ? 'text-emerald-700' : ''}`}>
                  {money(amount, transaction.currency || 'EUR')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
