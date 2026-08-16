import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const envelopeId = String(body.envelope_id || '')
  const amount = numberOrNull(body.amount)
  if (!envelopeId) return financeBadRequest('Enveloppe obligatoire.')
  if (amount === null || amount <= 0) return financeBadRequest('Montant invalide.')

  const occurredOn = body.occurred_on ? String(body.occurred_on) : new Date().toISOString().slice(0, 10)
  const note = body.note ? String(body.note) : null
  const { data, error } = await supabaseAdmin.rpc('finance_apply_cash_expense', {
    p_user_id: identity.id,
    p_envelope_id: envelopeId,
    p_amount: amount,
    p_occurred_on: occurredOn,
    p_note: note,
  })

  if (error) {
    const detail = error.message || ''
    if (detail.includes('insufficient envelope cash balance')) return financeBadRequest('Pas assez d’espèces dans cette enveloppe.')
    if (detail.includes('insufficient tracked amount')) return financeBadRequest('Le montant suivi dans cette enveloppe est insuffisant.')
    if (detail.includes('cash envelope not found')) return financeBadRequest('Cette enveloppe espèces n’est plus disponible.')
    return NextResponse.json({ error: 'finance_cash_expense_failed', detail }, { status: 500 })
  }

  return NextResponse.json({ ok: true, movement_id: data })
}
