import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const envelopeTypes = new Set(['monthly', 'cumulative', 'goal', 'debt', 'temporary'])

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'finance_envelopes_unavailable', detail: error.message }, { status: 500 })
  return NextResponse.json({ envelopes: data ?? [] })
}

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const name = String(body.name ?? '').trim()
  const envelopeType = String(body.envelope_type ?? 'monthly')
  const targetAmount = numberOrNull(body.target_amount)
  const currentAmount = numberOrNull(body.current_amount) ?? 0
  if (!name) return financeBadRequest('Le nom de l’enveloppe est obligatoire.')
  if (!envelopeTypes.has(envelopeType)) return financeBadRequest('Type d’enveloppe invalide.')
  if (targetAmount === null || targetAmount < 0) return financeBadRequest('Le montant cible doit être positif ou nul.')
  if (currentAmount < 0) return financeBadRequest('Le montant courant doit être positif ou nul.')

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .insert({
      user_id: identity.id,
      name,
      envelope_type: envelopeType,
      target_amount: targetAmount,
      current_amount: currentAmount,
      rollover_enabled: Boolean(body.rollover_enabled),
      cash_enabled: Boolean(body.cash_enabled),
      priority: integerOr(body.priority, 100),
      is_active: true,
    })
    .select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: 'finance_envelope_create_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ envelope: data }, { status: 201 })
}
