import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized, financeBadRequest } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeMerchant, type FinancialNature } from '@/lib/finance/transaction-intelligence'

const allowedNature = new Set<FinancialNature>(['income','expense','internal_transfer','third_party_advance','refund','reimbursable_expense','exceptional_expense','installment','subscription','cash_withdrawal','cash_expense'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await params

  const [{ data: transaction, error: txError }, { data: annotation, error: annotationError }, { data: categories, error: categoryError }] = await Promise.all([
    supabaseAdmin.from('finance_transactions').select('id,transaction_date,value_date,amount,currency,raw_label,merchant_name,direction,provider_category,account:finance_accounts(name,custom_name,masked_identifier)').eq('id', id).eq('user_id', identity.id).maybeSingle(),
    supabaseAdmin.from('finance_transaction_annotations').select('category_id,financial_nature,is_recurring,is_subscription,is_installment,is_exceptional,is_reimbursable,is_internal_transfer,confidence_score,user_corrected,note,analysis_reason,analysis_source,normalized_merchant').eq('transaction_id', id).eq('user_id', identity.id).maybeSingle(),
    supabaseAdmin.from('finance_categories').select('id,slug,name,user_id').or(`user_id.is.null,user_id.eq.${identity.id}`).order('sort_order', { ascending: true }),
  ])
  if (txError || annotationError || categoryError) return NextResponse.json({ error: 'transaction_load_failed', detail: txError?.message || annotationError?.message || categoryError?.message }, { status: 500 })
  if (!transaction) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ transaction, annotation, categories: categories || [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return financeBadRequest('Payload invalide.')
  if (!allowedNature.has(body.financial_nature)) return financeBadRequest('Nature financière invalide.')

  const { data: transaction, error: txError } = await supabaseAdmin.from('finance_transactions').select('id,raw_label,merchant_name').eq('id', id).eq('user_id', identity.id).maybeSingle()
  if (txError) return NextResponse.json({ error: 'transaction_load_failed', detail: txError.message }, { status: 500 })
  if (!transaction) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const normalizedMerchant = normalizeMerchant({ merchant_name: transaction.merchant_name, raw_label: transaction.raw_label })
  const nature = body.financial_nature as FinancialNature
  const { error } = await supabaseAdmin.from('finance_transaction_annotations').upsert({
    user_id: identity.id,
    transaction_id: id,
    category_id: body.category_id || null,
    financial_nature: nature,
    is_recurring: !!body.is_recurring,
    is_subscription: nature === 'subscription' || !!body.is_subscription,
    is_installment: nature === 'installment' || !!body.is_installment,
    is_exceptional: nature === 'exceptional_expense' || !!body.is_exceptional,
    is_reimbursable: nature === 'reimbursable_expense' || !!body.is_reimbursable,
    is_internal_transfer: nature === 'internal_transfer',
    confidence_score: 1,
    user_corrected: true,
    note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
    normalized_merchant: normalizedMerchant,
    analysis_source: 'user',
    analysis_version: 'lot8-v1',
    analysis_reason: 'Correction utilisateur prioritaire.',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'transaction_id' })
  if (error) return NextResponse.json({ error: 'annotation_save_failed', detail: error.message }, { status: 500 })

  if (body.remember_rule && normalizedMerchant && normalizedMerchant !== 'operation') {
    await supabaseAdmin.from('finance_merchant_rules').upsert({
      user_id: identity.id,
      merchant_pattern: normalizedMerchant,
      normalized_merchant: normalizedMerchant,
      category_id: body.category_id || null,
      financial_nature: nature,
      confidence: 1,
      source: 'user',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,merchant_pattern' })
  }

  return NextResponse.json({ ok: true, learned: !!body.remember_rule })
}
