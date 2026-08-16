import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const types = new Set(['bill','subscription','installment','rent','income','other'])

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const { data, error } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .select('id,name,commitment_type,amount,frequency,next_due_date,end_date,is_active,source,confidence,detection_key')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .order('next_due_date', { ascending: true })

  if (error) return NextResponse.json({ error: 'finance_upcoming_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ commitments: data ?? [] })
}

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as Record<string,unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const name = String(body.name || '').trim()
  const type = String(body.commitment_type || 'bill')
  const amount = numberOrNull(body.amount)
  if (!name || amount === null || amount <= 0 || !types.has(type)) return financeBadRequest('Engagement invalide.')

  const { data, error } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .insert({
      user_id: identity.id,
      name,
      commitment_type: type,
      amount,
      frequency: String(body.frequency || 'monthly'),
      next_due_date: body.next_due_date ? String(body.next_due_date) : null,
      end_date: body.end_date ? String(body.end_date) : null,
      is_active: true,
      source: 'user',
    })
    .select('id,name,commitment_type,amount,frequency,next_due_date,end_date,is_active,source,confidence,detection_key')
    .single()

  if (error) return NextResponse.json({ error: 'finance_upcoming_create_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ commitment: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as Record<string,unknown> | null
  if (!body) return financeBadRequest('Données invalides.')
  const id = String(body.id || '').trim()
  const action = String(body.action || '').trim()
  if (!id || !['confirm_fixed','ignore','update'].includes(action)) return financeBadRequest('Action invalide.')

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (action === 'confirm_fixed') {
    payload.source = 'user'
    payload.is_active = true
    const type = String(body.commitment_type || '')
    if (type && types.has(type) && type !== 'income') payload.commitment_type = type
    const amount = numberOrNull(body.amount)
    if (amount !== null && amount > 0) payload.amount = amount
  } else if (action === 'ignore') {
    payload.source = 'user'
    payload.is_active = false
  } else {
    const type = String(body.commitment_type || '')
    if (type && types.has(type)) payload.commitment_type = type
    const amount = numberOrNull(body.amount)
    if (amount !== null && amount > 0) payload.amount = amount
    if ('name' in body && String(body.name || '').trim()) payload.name = String(body.name).trim()
    payload.source = 'user'
  }

  const { data, error } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .update(payload)
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id,name,commitment_type,amount,frequency,next_due_date,end_date,is_active,source,confidence,detection_key')
    .single()

  if (error) return NextResponse.json({ error: 'finance_upcoming_update_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ commitment: data })
}

export async function DELETE(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return financeBadRequest('Identifiant manquant.')

  const { error } = await supabaseAdmin
    .from('finance_recurring_commitments')
    .update({ is_active: false, source: 'user', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', identity.id)

  if (error) return NextResponse.json({ error: 'finance_upcoming_delete_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
