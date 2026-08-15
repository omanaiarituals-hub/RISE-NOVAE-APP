import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'
import { buildFinanceRecommendations } from '@/lib/finance/recommendations'

const daysBetween = (a: string, b: string) => Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000))

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const [profileResult, transactionsResult, annotationsResult, categoriesResult, commitmentsResult, envelopesResult, goalsResult] = await Promise.all([
    supabaseAdmin.from('finance_user_profiles').select('usual_net_income,current_overdraft,overdraft_limit').eq('user_id', identity.id).maybeSingle(),
    supabaseAdmin.from('finance_transactions').select('id,transaction_date,amount,direction').eq('user_id', identity.id).gte('transaction_date', ninetyDaysAgo).order('transaction_date', { ascending: true }),
    supabaseAdmin.from('finance_transaction_annotations').select('transaction_id,category_id,financial_nature,is_exceptional,is_internal_transfer').eq('user_id', identity.id),
    supabaseAdmin.from('finance_categories').select('id,slug').or(`user_id.is.null,user_id.eq.${identity.id}`),
    supabaseAdmin.from('finance_recurring_commitments').select('amount,frequency,is_active').eq('user_id', identity.id).eq('is_active', true),
    supabaseAdmin.from('finance_envelopes').select('name').eq('user_id', identity.id).eq('is_active', true),
    supabaseAdmin.from('finance_goals').select('goal_type').eq('user_id', identity.id).eq('status', 'active'),
  ])

  const fatal = [transactionsResult.error, annotationsResult.error, categoriesResult.error, commitmentsResult.error, envelopesResult.error, goalsResult.error].find(Boolean)
  if (fatal) return NextResponse.json({ error: 'finance_recommendations_unavailable', detail: fatal.message }, { status: 500 })

  const profile = profileResult.error ? null : profileResult.data
  const transactions = transactionsResult.data ?? []
  const annotations = new Map((annotationsResult.data ?? []).map((item) => [item.transaction_id, item]))
  const categorySlug = new Map((categoriesResult.data ?? []).map((item) => [item.id, item.slug]))

  const firstDate = transactions[0]?.transaction_date ?? null
  const lastDate = transactions.at(-1)?.transaction_date ?? null
  const days = firstDate && lastDate ? daysBetween(firstDate, lastDate) + 1 : 0
  const months = days > 0 ? Math.max(1, days / 30.4375) : 0

  let income = 0
  let expenses = 0
  const categoryTotals: Record<string, number> = {}
  for (const tx of transactions) {
    const ann = annotations.get(tx.id)
    const nature = ann?.financial_nature
    if (ann?.is_internal_transfer || nature === 'internal_transfer' || nature === 'third_party_advance') continue
    const amount = Math.abs(Number(tx.amount || 0))
    if (tx.direction === 'credit' && (!nature || nature === 'income' || nature === 'refund')) income += amount
    if (tx.direction === 'debit' && nature !== 'refund' && !ann?.is_exceptional) {
      expenses += amount
      const slug = ann?.category_id ? categorySlug.get(ann.category_id) : null
      if (slug) categoryTotals[slug] = (categoryTotals[slug] || 0) + amount
    }
  }

  const monthlyCategory: Record<string, number> = {}
  for (const [slug, total] of Object.entries(categoryTotals)) monthlyCategory[slug] = months > 0 ? total / months : total

  const commitments = (commitmentsResult.data ?? []).reduce((sum, item) => {
    const amount = Math.abs(Number(item.amount || 0))
    const frequency = String(item.frequency || 'monthly').toLowerCase()
    if (frequency === 'yearly' || frequency === 'annual') return sum + amount / 12
    if (frequency === 'weekly') return sum + amount * 52 / 12
    return sum + amount
  }, 0)

  const recommendations = buildFinanceRecommendations({
    usualIncome: profile?.usual_net_income == null ? null : Number(profile.usual_net_income),
    observedMonthlyIncome: months > 0 && income > 0 ? income / months : null,
    observedMonthlyExpenses: months > 0 && expenses > 0 ? expenses / months : null,
    currentOverdraft: Math.max(0, Number(profile?.current_overdraft || 0)),
    overdraftLimit: Math.max(0, Number(profile?.overdraft_limit || 0)),
    monthsAnalysed: Math.round(months * 10) / 10,
    transactionsCount: transactions.length,
    recurringCommitmentsMonthly: commitments,
    categoryMonthly: monthlyCategory,
    existingEnvelopeNames: (envelopesResult.data ?? []).map((item) => item.name),
    existingGoalTypes: (goalsResult.data ?? []).map((item) => item.goal_type),
  })

  return NextResponse.json(recommendations)
}
