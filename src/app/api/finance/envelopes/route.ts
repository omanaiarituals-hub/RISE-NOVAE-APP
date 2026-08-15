import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const envelopeTypes = new Set(['monthly', 'cumulative', 'goal', 'debt', 'temporary'])

type EnvelopeRow = {
  id: string
  name: string
  envelope_type: string
  target_amount: number | string
  current_amount: number | string
  cash_balance: number | string
  rollover_enabled: boolean
  cash_enabled: boolean
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type YearStats = {
  spent: number
  injected: number
  withdrawn: number
  remainder_saved: number
}

function emptyStats(): YearStats {
  return { spent: 0, injected: 0, withdrawn: 0, remainder_saved: 0 }
}

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const { data, error } = await supabaseAdmin
    .from('finance_envelopes')
    .select('id,name,envelope_type,target_amount,current_amount,cash_balance,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .eq('user_id', identity.id)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'finance_envelopes_unavailable', detail: error.message }, { status: 500 })

  const envelopes = (data ?? []) as EnvelopeRow[]
  if (envelopes.length === 0) return NextResponse.json({ envelopes: [] })

  const year = new Date().getFullYear()
  const start = `${year}-01-01`
  const ids = envelopes.map((item) => item.id)
  const [{ data: movements, error: movementsError }, { data: snapshots, error: snapshotsError }] = await Promise.all([
    supabaseAdmin
      .from('finance_envelope_movements')
      .select('envelope_id,movement_type,amount,bank_impact,metadata,occurred_on')
      .eq('user_id', identity.id)
      .in('envelope_id', ids)
      .gte('occurred_on', start),
    supabaseAdmin
      .from('finance_envelope_cycle_snapshots')
      .select('envelope_id,transferred_to_savings_amount,cycle_end')
      .eq('user_id', identity.id)
      .in('envelope_id', ids)
      .gte('cycle_end', start),
  ])

  if (movementsError) return NextResponse.json({ error: 'finance_envelope_stats_unavailable', detail: movementsError.message }, { status: 500 })
  if (snapshotsError) return NextResponse.json({ error: 'finance_envelope_snapshots_unavailable', detail: snapshotsError.message }, { status: 500 })

  const stats = new Map<string, YearStats>()
  for (const id of ids) stats.set(id, emptyStats())

  for (const movement of movements ?? []) {
    const s = stats.get(String(movement.envelope_id)) ?? emptyStats()
    const amount = Number(movement.amount || 0)
    const bankImpact = Number(movement.bank_impact || 0)
    const metadata = (movement.metadata ?? {}) as Record<string, unknown>
    const direction = String(metadata.direction ?? '')

    if (movement.movement_type === 'expense') s.spent += Math.abs(amount)
    if (movement.movement_type === 'adjustment' && bankImpact !== 0) {
      if (direction === 'add' || amount > 0) s.injected += Math.abs(amount)
      if (direction === 'remove' || amount < 0) s.withdrawn += Math.abs(amount)
    }
    if (movement.movement_type === 'cash_deposit') {
      const envelope = envelopes.find((item) => item.id === movement.envelope_id)
      if (envelope && ['goal', 'cumulative', 'debt'].includes(envelope.envelope_type)) s.injected += Math.abs(amount)
    }
    stats.set(String(movement.envelope_id), s)
  }

  for (const snapshot of snapshots ?? []) {
    const s = stats.get(String(snapshot.envelope_id)) ?? emptyStats()
    s.remainder_saved += Number(snapshot.transferred_to_savings_amount || 0)
    stats.set(String(snapshot.envelope_id), s)
  }

  return NextResponse.json({
    envelopes: envelopes.map((item) => ({ ...item, year_stats: stats.get(item.id) ?? emptyStats() })),
  })
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
      cash_balance: 0,
      rollover_enabled: Boolean(body.rollover_enabled),
      cash_enabled: Boolean(body.cash_enabled),
      priority: integerOr(body.priority, 100),
      is_active: true,
    })
    .select('id,name,envelope_type,target_amount,current_amount,cash_balance,rollover_enabled,cash_enabled,priority,is_active,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: 'finance_envelope_create_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ envelope: data }, { status: 201 })
}
