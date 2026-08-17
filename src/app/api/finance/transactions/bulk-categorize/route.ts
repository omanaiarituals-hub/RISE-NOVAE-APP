import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeBadRequest, financeUnauthorized } from '@/lib/finance/api'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as {
    transaction_ids?: string[]
    category_id?: string
  } | null

  const ids = Array.isArray(body?.transaction_ids)
    ? Array.from(new Set(body!.transaction_ids.filter(Boolean)))
    : []
  const categoryId = String(body?.category_id || '').trim()

  if (!ids.length || !categoryId) return financeBadRequest('Sélection ou catégorie manquante.')
  if (ids.length > 250) return financeBadRequest('250 opérations maximum par lot.')

  const [{ data: category, error: categoryError }, { data: transactions, error: transactionError }] =
    await Promise.all([
      supabaseAdmin
        .from('finance_categories')
        .select('id')
        .eq('id', categoryId)
        .or(`user_id.is.null,user_id.eq.${identity.id}`)
        .maybeSingle(),
      supabaseAdmin
        .from('finance_transactions')
        .select('id,direction')
        .eq('user_id', identity.id)
        .in('id', ids),
    ])

  if (categoryError || transactionError) {
    return NextResponse.json(
      {
        error: 'bulk_categorize_load_failed',
        detail: categoryError?.message || transactionError?.message,
      },
      { status: 500 },
    )
  }

  if (!category) return financeBadRequest('Catégorie invalide.')

  const transactionMap = new Map((transactions || []).map((item) => [item.id, item]))

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('finance_transaction_annotations')
    .select(
      'transaction_id,financial_nature,is_recurring,is_subscription,is_installment,is_exceptional,is_reimbursable,is_internal_transfer,note,normalized_merchant',
    )
    .eq('user_id', identity.id)
    .in('transaction_id', ids)

  if (existingError) {
    return NextResponse.json(
      { error: 'bulk_annotations_load_failed', detail: existingError.message },
      { status: 500 },
    )
  }

  const existingMap = new Map((existing || []).map((item) => [item.transaction_id, item]))

  const rows = ids.flatMap((transactionId) => {
    const transaction = transactionMap.get(transactionId)
    if (!transaction) return []

    const current = existingMap.get(transactionId)
    const nature = current?.financial_nature || (transaction.direction === 'credit' ? 'income' : 'expense')

    return [{
      user_id: identity.id,
      transaction_id: transactionId,
      category_id: categoryId,
      financial_nature: nature,
      is_recurring: !!current?.is_recurring,
      is_subscription: nature === 'subscription' || !!current?.is_subscription,
      is_installment: nature === 'installment' || !!current?.is_installment,
      is_exceptional: nature === 'exceptional_expense' || !!current?.is_exceptional,
      is_reimbursable: nature === 'reimbursable_expense' || !!current?.is_reimbursable,
      is_internal_transfer: nature === 'internal_transfer' || !!current?.is_internal_transfer,
      confidence_score: 1,
      user_corrected: true,
      note: current?.note || null,
      normalized_merchant: current?.normalized_merchant || null,
      analysis_source: 'user',
      analysis_version: 'lot11.7-v1',
      analysis_reason: 'Catégorisation groupée utilisateur.',
      updated_at: new Date().toISOString(),
    }]
  })

  if (!rows.length) return financeBadRequest('Aucune opération valide.')

  const { error } = await supabaseAdmin
    .from('finance_transaction_annotations')
    .upsert(rows, { onConflict: 'transaction_id' })

  if (error) {
    return NextResponse.json(
      { error: 'bulk_categorize_failed', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ updated: rows.length })
}
