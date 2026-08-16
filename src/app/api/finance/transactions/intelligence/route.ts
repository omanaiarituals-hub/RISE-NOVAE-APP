import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Tx = { id:string; transaction_date:string; amount:number|string; currency:string|null; raw_label:string|null; merchant_name:string|null }
type Annotation = { transaction_id:string; financial_nature:string|null; is_recurring:boolean; is_subscription:boolean; is_installment:boolean; confidence_score:number|string|null; category:any }
type CategoryTransaction = { id:string; date:string; label:string; amount:number; currency:string }
type CategoryGroup = { id:string; slug:string; name:string; amount:number; count:number; transactions:CategoryTransaction[] }

const expenseNatures = new Set(['expense','subscription','installment','exceptional_expense','reimbursable_expense'])

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const [{ data: annotations, error: annotationError }, { data: recurring, error: recurringError }, { data: insights, error: insightError }] = await Promise.all([
    supabaseAdmin.from('finance_transaction_annotations').select('transaction_id,financial_nature,is_recurring,is_subscription,is_installment,confidence_score,category:finance_categories(id,slug,name)').eq('user_id', identity.id),
    supabaseAdmin.from('finance_recurring_commitments').select('id,name,commitment_type,amount,frequency,next_due_date,confidence').eq('user_id', identity.id).eq('source', 'transaction_engine').eq('is_active', true).order('amount', { ascending: false }).limit(12),
    supabaseAdmin.from('finance_insights').select('id,title,summary,confidence').eq('user_id', identity.id).eq('source', 'transaction_engine').is('dismissed_at', null).order('created_at', { ascending: false }).limit(6),
  ])
  if (annotationError || recurringError || insightError) return NextResponse.json({ error: 'intelligence_load_failed', detail: annotationError?.message || recurringError?.message || insightError?.message }, { status: 500 })

  const rows = (annotations || []) as Annotation[]
  const ids = rows.map((a) => a.transaction_id)
  let transactions: Tx[] = []
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('finance_transactions').select('id,transaction_date,amount,currency,raw_label,merchant_name').eq('user_id', identity.id).in('id', ids)
    if (error) return NextResponse.json({ error: 'intelligence_transactions_load_failed', detail: error.message }, { status: 500 })
    transactions = (data || []) as Tx[]
  }
  const txById = new Map(transactions.map((tx) => [tx.id, tx]))

  const total = rows.length
  const categorised = rows.filter((item) => item.category).length
  const subscriptions = rows.filter((item) => item.is_subscription).length
  const installments = rows.filter((item) => item.is_installment).length
  const recurringOperations = rows.filter((item) => item.is_recurring).length
  const avgConfidence = total ? rows.reduce((sum, item) => sum + Number(item.confidence_score || 0), 0) / total : 0

  const groups = new Map<string, CategoryGroup>()
  let expenseTotal = 0
  for (const annotation of rows) {
    if (!expenseNatures.has(annotation.financial_nature || '')) continue
    const tx = txById.get(annotation.transaction_id)
    if (!tx) continue
    const amount = Math.abs(Number(tx.amount || 0))
    if (!amount) continue
    const category = Array.isArray(annotation.category) ? annotation.category[0] : annotation.category
    const key = category?.id || 'uncategorised'
    const current: CategoryGroup = groups.get(key) || { id:key, slug:category?.slug || 'uncategorised', name:category?.name || 'Non catégorisé', amount:0, count:0, transactions:[] }
    current.amount += amount
    current.count += 1
    current.transactions.push({ id:tx.id, date:tx.transaction_date, label:tx.merchant_name || tx.raw_label || 'Opération bancaire', amount:Number(tx.amount || 0), currency:tx.currency || 'EUR' })
    groups.set(key, current)
    expenseTotal += amount
  }
  const categories = Array.from(groups.values()).map((g) => ({ ...g, amount:Math.round(g.amount*100)/100, percentage:expenseTotal ? Math.round((g.amount/expenseTotal)*1000)/10 : 0, transactions:g.transactions.sort((a: CategoryTransaction,b: CategoryTransaction)=>b.date.localeCompare(a.date)).slice(0,20) })).sort((a,b)=>b.amount-a.amount)

  return NextResponse.json({
    summary: { total, categorised, uncategorised: total - categorised, subscriptions, installments, recurring: (recurring || []).length, recurring_operations: recurringOperations, average_confidence: avgConfidence },
    recurring: recurring || [], insights: insights || [], categories, expense_total: Math.round(expenseTotal*100)/100,
  })
}
