import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  monthlyEquivalent,
  resolveFinanceCycleOffset,
  resolveFinanceYearWindow,
} from '@/lib/finance/cycle'

type Tx = {
  id: string
  transaction_date: string
  amount: number | string
  currency: string | null
  raw_label: string | null
  merchant_name: string | null
  direction: 'credit' | 'debit'
}

type Annotation = {
  transaction_id: string
  financial_nature: string | null
  is_recurring: boolean
  is_subscription: boolean
  is_installment: boolean
  confidence_score: number | string | null
  category: any
}

type CategoryTransaction = {
  id: string
  date: string
  label: string
  amount: number
  currency: string
}

type CategoryGroup = {
  id: string
  slug: string
  name: string
  amount: number
  count: number
  transactions: CategoryTransaction[]
}

const expenseNatures = new Set([
  'expense',
  'subscription',
  'installment',
  'exceptional_expense',
  'reimbursable_expense',
  'cash_expense',
])

const mandatoryTypes = new Set(['bill', 'subscription', 'installment', 'rent', 'other'])

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function periodFactor(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
  return days / 30.4375
}

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const url = new URL(request.url)
  const view = url.searchParams.get('view') === 'year' ? 'year' : 'cycle'
  const offsetRaw = Number(url.searchParams.get('offset') || 0)
  const offset = Number.isInteger(offsetRaw) ? Math.max(-36, Math.min(0, offsetRaw)) : 0

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('finance_user_profiles')
    .select('usual_income_day,usual_net_income,safety_floor')
    .eq('user_id', identity.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: 'finance_profile_unavailable', detail: profileError.message }, { status: 500 })
  }

  const period = view === 'year'
    ? resolveFinanceYearWindow()
    : resolveFinanceCycleOffset(profile?.usual_income_day ?? null, offset)

  const { data: activeAccounts, error: activeAccountError } = await supabaseAdmin
    .from('finance_accounts')
    .select('id')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .eq('user_enabled', true)

  if (activeAccountError) {
    return NextResponse.json({ error: 'active_accounts_load_failed', detail: activeAccountError.message }, { status: 500 })
  }

  const activeAccountIds = (activeAccounts || []).map((item) => item.id)

  let transactions: Tx[] = []
  if (activeAccountIds.length) {
    const { data, error } = await supabaseAdmin
      .from('finance_transactions')
      .select('id,transaction_date,amount,currency,raw_label,merchant_name,direction')
      .eq('user_id', identity.id)
      .in('account_id', activeAccountIds)
      .gte('transaction_date', period.start)
      .lte('transaction_date', period.end)
      .order('transaction_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'active_transactions_load_failed', detail: error.message }, { status: 500 })
    }
    transactions = (data || []) as Tx[]
  }

  const transactionIds = transactions.map((item) => item.id)
  const transactionIdSet = new Set(transactionIds)

  let annotations: any[] = []
  if (transactionIds.length) {
    const { data, error } = await supabaseAdmin
      .from('finance_transaction_annotations')
      .select(
        'transaction_id,financial_nature,is_recurring,is_subscription,is_installment,confidence_score,category:finance_categories(id,slug,name)',
      )
      .eq('user_id', identity.id)

    if (error) {
      return NextResponse.json({ error: 'annotations_load_failed', detail: error.message }, { status: 500 })
    }
    annotations = (data || []).filter((item) => transactionIdSet.has(String(item.transaction_id)))
  }

  const [commitmentsResult, insightsResult, provisionsResult] = await Promise.all([
    supabaseAdmin
      .from('finance_recurring_commitments')
      .select('id,name,commitment_type,amount,frequency,next_due_date,confidence,source,detection_key,is_active')
      .eq('user_id', identity.id)
      .eq('is_active', true)
      .order('amount', { ascending: false }),
    supabaseAdmin
      .from('finance_insights')
      .select('id,title,summary,confidence')
      .eq('user_id', identity.id)
      .eq('source', 'transaction_engine')
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabaseAdmin
      .from('finance_future_provisions')
      .select('monthly_amount')
      .eq('user_id', identity.id)
      .eq('is_active', true),
  ])

  const fatal = commitmentsResult.error || insightsResult.error || provisionsResult.error
  if (fatal) {
    return NextResponse.json({ error: 'intelligence_load_failed', detail: fatal.message }, { status: 500 })
  }

  const rows = annotations as Annotation[]
  const txById = new Map(transactions.map((tx) => [tx.id, tx]))

  const total = rows.length
  const categorised = rows.filter((item) => item.category).length
  const subscriptions = rows.filter((item) => item.is_subscription).length
  const installments = rows.filter((item) => item.is_installment).length
  const recurringOperations = rows.filter((item) => item.is_recurring).length
  const avgConfidence = total
    ? rows.reduce((sum, item) => sum + Number(item.confidence_score || 0), 0) / total
    : 0

  const groups = new Map<string, CategoryGroup>()
  let expenseTotal = 0
  let variableSpent = 0
  let recurringPaid = 0
  let observedIncome = 0

  const annotationById = new Map(rows.map((item) => [item.transaction_id, item]))

  for (const tx of transactions) {
    const annotation = annotationById.get(tx.id)
    const nature = annotation?.financial_nature || null
    const amount = Math.abs(Number(tx.amount || 0))

    if (tx.direction === 'credit' && (nature === 'income' || (!nature && amount > 0))) {
      observedIncome += amount
    }

    if (!annotation || !expenseNatures.has(nature || '')) continue
    if (!amount) continue

    const category = Array.isArray(annotation.category)
      ? annotation.category[0]
      : annotation.category
    const key = category?.id || 'uncategorised'

    const current: CategoryGroup = groups.get(key) || {
      id: key,
      slug: category?.slug || 'uncategorised',
      name: category?.name || 'Non catégorisé',
      amount: 0,
      count: 0,
      transactions: [],
    }

    current.amount += amount
    current.count += 1
    current.transactions.push({
      id: tx.id,
      date: tx.transaction_date,
      label: tx.merchant_name || tx.raw_label || 'Opération bancaire',
      amount: Number(tx.amount || 0),
      currency: tx.currency || 'EUR',
    })
    groups.set(key, current)
    expenseTotal += amount

    if (annotation.is_recurring || annotation.is_subscription || annotation.is_installment) recurringPaid += amount
    else variableSpent += amount
  }

  const commitments = commitmentsResult.data || []
  const confirmedFixed = commitments.filter(
    (item) => item.source === 'user' && mandatoryTypes.has(String(item.commitment_type)),
  )
  const detectedFixed = commitments.filter(
    (item) => item.source === 'transaction_engine' && mandatoryTypes.has(String(item.commitment_type)),
  )

  const confirmedMonthly = confirmedFixed.reduce(
    (sum, item) => sum + monthlyEquivalent(Number(item.amount || 0), item.frequency),
    0,
  )
  const provisionsMonthly = (provisionsResult.data || []).reduce(
    (sum, item) => sum + Math.max(0, Number(item.monthly_amount || 0)),
    0,
  )

  const factor = view === 'year' ? periodFactor(period.start, period.end) : 1
  const fixedReserved = confirmedMonthly * factor
  const provisionsReserved = provisionsMonthly * factor
  const safetyFloor = Math.max(0, Number(profile?.safety_floor || 0))
  const referenceIncome = observedIncome > 0
    ? observedIncome
    : Math.max(0, Number(profile?.usual_net_income || 0)) * factor

  const pilotableBeforeVariable = Math.max(
    0,
    referenceIncome - fixedReserved - provisionsReserved - safetyFloor,
  )
  const remainingPilotable = pilotableBeforeVariable - variableSpent

  const categories = Array.from(groups.values())
    .map((group) => ({
      ...group,
      amount: round2(group.amount),
      percentage: expenseTotal
        ? Math.round((group.amount / expenseTotal) * 1000) / 10
        : 0,
      transactions: group.transactions
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20),
    }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    period: { ...period, view, offset },
    summary: {
      total,
      categorised,
      uncategorised: total - categorised,
      subscriptions,
      installments,
      recurring: commitments.filter((item) => item.source === 'transaction_engine').length,
      recurring_operations: recurringOperations,
      average_confidence: avgConfidence,
    },
    budget: {
      reference_income: round2(referenceIncome),
      observed_income: round2(observedIncome),
      confirmed_fixed_reserved: round2(fixedReserved),
      recurring_paid: round2(recurringPaid),
      provisions_reserved: round2(provisionsReserved),
      safety_floor: round2(safetyFloor),
      variable_spent: round2(variableSpent),
      pilotable_before_variable: round2(pilotableBeforeVariable),
      remaining_pilotable: round2(remainingPilotable),
    },
    fixed: {
      confirmed: confirmedFixed,
      detected: detectedFixed,
    },
    recurring: commitments.filter((item) => item.source === 'transaction_engine').slice(0, 12),
    insights: insightsResult.data || [],
    categories,
    expense_total: round2(expenseTotal),
    needs_analysis: transactionIds.length > 0 && total === 0,
    active_transactions: transactionIds.length,
  })
}
