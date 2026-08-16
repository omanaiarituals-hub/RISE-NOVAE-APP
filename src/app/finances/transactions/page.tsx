import { redirect } from 'next/navigation'
import { getFinanceServerIdentity } from '@/lib/finance/auth'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { supabaseAdmin } from '@/lib/supabase-admin'
import FinanceTransactionList from '@/components/finance/FinanceTransactionList'

export default async function Page() {
  const identity = await getFinanceServerIdentity()
  if (!identity || !isFinanceBetaAllowed(identity.id)) redirect('/finances')

  const { data: usableAccounts } = await supabaseAdmin.from('finance_accounts').select('id').eq('user_id', identity.id).eq('is_active', true).eq('user_enabled', true)
  const accountIds = (usableAccounts || []).map((item) => item.id)
  if (!accountIds.length) return <FinanceTransactionList items={[]} />

  const { data: transactions, error } = await supabaseAdmin.from('finance_transactions')
    .select('id,transaction_date,amount,currency,raw_label,merchant_name,account:finance_accounts(name,custom_name,masked_identifier)')
    .eq('user_id', identity.id).in('account_id', accountIds).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(150)
  if (error) return <FinanceTransactionList items={[]} />

  const ids = (transactions || []).map((item) => item.id)
  const { data: annotations } = ids.length ? await supabaseAdmin.from('finance_transaction_annotations').select('transaction_id,financial_nature,confidence_score,user_corrected,category:finance_categories(name)').eq('user_id', identity.id).in('transaction_id', ids) : { data: [] as any[] }
  const annotationMap = new Map((annotations || []).map((item: any) => [item.transaction_id, item]))

  const items = (transactions || []).map((transaction: any) => {
    const account = Array.isArray(transaction.account) ? transaction.account[0] : transaction.account
    const annotation: any = annotationMap.get(transaction.id)
    const category = Array.isArray(annotation?.category) ? annotation.category[0] : annotation?.category
    return {
      id: transaction.id,
      transaction_date: transaction.transaction_date,
      amount: Number(transaction.amount),
      currency: transaction.currency || 'EUR',
      label: transaction.merchant_name || transaction.raw_label || 'Opération bancaire',
      account: account?.custom_name || account?.name || null,
      masked: account?.masked_identifier || null,
      category: category?.name || null,
      nature: annotation?.financial_nature || null,
      confidence: annotation?.confidence_score == null ? null : Number(annotation.confidence_score),
      userCorrected: !!annotation?.user_corrected,
    }
  })
  return <FinanceTransactionList items={items} />
}
