import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')
  const amount = numberOrNull(body.amount)
  if (amount === null || amount <= 0) return financeBadRequest('Montant invalide.')
  const action = String(body.action || '')
  const occurredOn = body.occurred_on ? String(body.occurred_on) : new Date().toISOString().slice(0, 10)
  const note = body.note ? String(body.note) : null

  if (action === 'cash_expense') {
    const { data, error } = await supabaseAdmin.rpc('finance_apply_cash_expense', {
      p_user_id: identity.id, p_envelope_id: id, p_amount: amount, p_occurred_on: occurredOn, p_note: note,
    })
    if (error) return NextResponse.json({ error: 'finance_cash_expense_failed', detail: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, movement_id: data })
  }

  if (action === 'add' || action === 'remove') {
    const { data, error } = await supabaseAdmin.rpc('finance_adjust_envelope', {
      p_user_id: identity.id,
      p_envelope_id: id,
      p_amount: amount,
      p_direction: action,
      p_bank_effect: Boolean(body.bank_effect),
      p_occurred_on: occurredOn,
      p_note: note,
    })
    if (error) return NextResponse.json({ error: 'finance_envelope_adjustment_failed', detail: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, movement_id: data })
  }
  return financeBadRequest('Action inconnue.')
}
