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

  const { data: transactions, error: transactionError } = await supabaseAdmin
    .from('finance_transactions')
    .select('id')
    .eq('user_id', identity.id)
    .in('id', ids)

  if (transactionError) {
    return NextResponse.json({ error: 'bulk_transactions_load_failed', detail: transactionError.message }, { status: 500 })
  }

  const allowed = new Set((transactions || []).map((item) => item.id))
  const rows = ids
    .filter((id) => allowed.has(id))
    .map((transactionId) => ({
      user_id: identity.id,
      transaction_id: transactionId,
      category_id: categoryId,
      confidence_score: 1,
      classification_source: 'user',
      updated_at: new Date().toISOString(),
    }))

  if (!rows.length) return financeBadRequest('Aucune opération valide.')

  const { error } = await supabaseAdmin
    .from('finance_transaction_annotations')
    .upsert(rows, { onConflict: 'transaction_id' })

  if (error) {
    return NextResponse.json({ error: 'bulk_categorize_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: rows.length })
}
