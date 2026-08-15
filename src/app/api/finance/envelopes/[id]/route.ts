import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const envelopeTypes = new Set(['monthly', 'cumulative', 'goal', 'debt', 'temporary'])

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .eq('id', id)
    .eq('user_id', identity.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_envelope_unavailable', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ envelope: data })
}

export async function PATCH(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in body) {
    const name = String(body.name ?? '').trim()
    if (!name) return financeBadRequest('Le nom de l’enveloppe est obligatoire.')
    patch.name = name
  }
  if ('envelope_type' in body) {
    const type = String(body.envelope_type)
    if (!envelopeTypes.has(type)) return financeBadRequest('Type d’enveloppe invalide.')
    patch.envelope_type = type
  }
  if ('target_amount' in body) {
    const value = numberOrNull(body.target_amount)
    if (value === null || value < 0) return financeBadRequest('Montant cible invalide.')
    patch.target_amount = value
  }
  if ('current_amount' in body) {
    const value = numberOrNull(body.current_amount)
    if (value === null || value < 0) return financeBadRequest('Montant courant invalide.')
    patch.current_amount = value
  }
  if ('rollover_enabled' in body) patch.rollover_enabled = Boolean(body.rollover_enabled)
  if ('cash_enabled' in body) patch.cash_enabled = Boolean(body.cash_enabled)
  if ('priority' in body) patch.priority = integerOr(body.priority, 100)

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .update(patch)
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_envelope_update_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ envelope: data })
}

export async function DELETE(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_envelope_delete_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
