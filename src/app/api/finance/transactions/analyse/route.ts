import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyseTransactions, type TransactionForAnalysis, type MerchantRuleForAnalysis } from '@/lib/finance/transaction-intelligence'

const VERSION = 'lot8-v1'

function monthsAgo(months: number) {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const { data: profile } = await supabaseAdmin
    .from('finance_user_profiles')
    .select('analysis_period_months')
    .eq('user_id', identity.id)
    .maybeSingle()
  const months = Math.max(1, Math.min(6, Number(profile?.analysis_period_months || 3)))

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('finance_accounts')
    .select('id')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .eq('user_enabled', true)
  if (accountsError) return NextResponse.json({ error: 'accounts_load_failed', detail: accountsError.message }, { status: 500 })
  const accountIds = (accounts || []).map((item) => item.id)
  if (!accountIds.length) return NextResponse.json({ analysed: 0, message: 'Aucun compte actif à analyser.' })

  const [{ data: transactions, error: txError }, { data: categories, error: catError }, { data: rules, error: rulesError }, { data: corrected, error: correctedError }] = await Promise.all([
    supabaseAdmin.from('finance_transactions').select('id,transaction_date,amount,direction,raw_label,merchant_name,provider_category,account_id').eq('user_id', identity.id).in('account_id', accountIds).gte('transaction_date', monthsAgo(months)).order('transaction_date', { ascending: true }),
    supabaseAdmin.from('finance_categories').select('id,slug').or(`user_id.is.null,user_id.eq.${identity.id}`),
    supabaseAdmin.from('finance_merchant_rules').select('id,merchant_pattern,normalized_merchant,category_id,financial_nature,confidence').eq('user_id', identity.id),
    supabaseAdmin.from('finance_transaction_annotations').select('transaction_id').eq('user_id', identity.id).eq('user_corrected', true),
  ])
  if (txError || catError || rulesError || correctedError) return NextResponse.json({ error: 'analysis_load_failed', detail: txError?.message || catError?.message || rulesError?.message || correctedError?.message }, { status: 500 })

  const correctedIds = new Set((corrected || []).map((item) => item.transaction_id))
  const categoryIdBySlug = new Map((categories || []).map((item) => [item.slug, item.id]))
  const result = analyseTransactions({
    transactions: (transactions || []) as TransactionForAnalysis[],
    rules: (rules || []) as MerchantRuleForAnalysis[],
    categoryIdBySlug,
  })

  let analysed = 0
  let preserved = 0
  const matchedRuleIds = new Set<string>()
  for (const decision of result.decisions) {
    if (correctedIds.has(decision.transactionId)) { preserved++; continue }
    const { error } = await supabaseAdmin.from('finance_transaction_annotations').upsert({
      user_id: identity.id,
      transaction_id: decision.transactionId,
      category_id: decision.categoryId,
      financial_nature: decision.financialNature,
      is_recurring: decision.isRecurring,
      is_subscription: decision.isSubscription,
      is_installment: decision.isInstallment,
      is_exceptional: decision.isExceptional,
      is_reimbursable: decision.isReimbursable,
      is_internal_transfer: decision.isInternalTransfer,
      confidence_score: decision.confidence,
      user_corrected: false,
      normalized_merchant: decision.normalizedMerchant,
      analysis_source: decision.source,
      analysis_version: VERSION,
      analysis_reason: decision.reason,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'transaction_id' })
    if (error) return NextResponse.json({ error: 'annotation_save_failed', detail: error.message }, { status: 500 })
    if (decision.matchedRuleId) matchedRuleIds.add(decision.matchedRuleId)
    analysed++
  }

  for (const ruleId of Array.from(matchedRuleIds)) {
    const { data: existing } = await supabaseAdmin.from('finance_merchant_rules').select('apply_count').eq('id', ruleId).eq('user_id', identity.id).maybeSingle()
    await supabaseAdmin.from('finance_merchant_rules').update({ apply_count: Number(existing?.apply_count || 0) + 1, last_applied_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ruleId).eq('user_id', identity.id)
  }

  const { data: userRecurringDecisions } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .select('detection_key')
    .eq('user_id', identity.id)
    .eq('source', 'user')
    .not('detection_key', 'is', null)
  const protectedDetectionKeys = new Set(
    (userRecurringDecisions || []).map((item) => String(item.detection_key)),
  )

  for (const pattern of result.recurring) {
    const detectionKey = `merchant:${pattern.key}`
    if (protectedDetectionKeys.has(detectionKey)) continue

    await supabaseAdmin.from('finance_recurring_commitments').upsert({
      user_id: identity.id,
      name: pattern.merchant,
      commitment_type: pattern.isSubscription ? 'subscription' : 'bill',
      amount: pattern.amount,
      frequency: pattern.frequency,
      next_due_date: pattern.nextDueDate,
      is_active: true,
      source: 'transaction_engine',
      detection_key: detectionKey,
      confidence: pattern.confidence,
      last_detected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,detection_key' })
  }

  await supabaseAdmin.from('finance_insights').delete().eq('user_id', identity.id).eq('source', 'transaction_engine')
  const unknownCount = result.decisions.filter((item) => !item.categoryId && item.financialNature === 'expense').length
  const recurringMonthly = result.recurring.filter((item) => item.frequency === 'monthly').reduce((sum, item) => sum + item.amount, 0)
  const insights = [
    result.recurring.length ? { insight_type: 'recurring_detected', title: 'Dépenses récurrentes détectées', summary: `${result.recurring.length} récurrence(s) repérée(s), soit environ ${Math.round(recurringMonthly)} € par mois pour les récurrences mensuelles.`, confidence: 0.85 } : null,
    unknownCount ? { insight_type: 'categorisation_needed', title: 'Quelques opérations à confirmer', summary: `${unknownCount} dépense(s) restent sans catégorie fiable. Les corriger permettra à Nova d’apprendre tes marchands.`, confidence: 1 } : null,
  ].filter(Boolean)
  if (insights.length) await supabaseAdmin.from('finance_insights').insert(insights.map((item: any) => ({ ...item, user_id: identity.id, source: 'transaction_engine', analysis_version: VERSION })))

  return NextResponse.json({ analysed, preserved_user_corrections: preserved, recurring_patterns: result.recurring.length, unknown_expenses: unknownCount, months })
}
