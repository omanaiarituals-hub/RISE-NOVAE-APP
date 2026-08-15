import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')
  const amount = numberOrNull(body.amount)
  const allocations = Array.isArray(body.allocations) ? body.allocations : []
  if (amount === null || amount <= 0) return financeBadRequest('Montant de retrait invalide.')
  if (!allocations.length) return financeBadRequest('Répartis le retrait dans au moins une enveloppe.')

  const normalized = allocations.map((value) => {
    const item = value as Record<string, unknown>
    return { envelope_id: String(item.envelope_id || ''), amount: Number(item.amount || 0) }
  })
  const total = normalized.reduce((sum, item) => sum + item.amount, 0)
  if (normalized.some((item) => !item.envelope_id || !Number.isFinite(item.amount) || item.amount <= 0)) return financeBadRequest('Répartition invalide.')
  if (Math.abs(total - amount) > 0.009) return financeBadRequest('Le total réparti doit être égal au retrait.')

  const { data, error } = await supabaseAdmin.rpc('finance_apply_cash_withdrawal', {
    p_user_id: identity.id,
    p_amount: amount,
    p_allocations: normalized,
    p_occurred_on: body.occurred_on ? String(body.occurred_on) : new Date().toISOString().slice(0, 10),
    p_note: body.note ? String(body.note) : null,
  })
  if (error) return NextResponse.json({ error: 'finance_cash_withdrawal_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, movement_id: data })
}
