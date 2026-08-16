import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'
import { buildNovaAdvancedPlan } from '@/lib/finance/services/nova-advanced'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const url = new URL(request.url)
  try {
    const plan = await buildNovaAdvancedPlan(identity.id, {
      extraSpend: numberOrNull(url.searchParams.get('extra_spend')) ?? 0,
      extraSavings: numberOrNull(url.searchParams.get('extra_savings')) ?? 0,
      spendReduction: numberOrNull(url.searchParams.get('spend_reduction')) ?? 0,
      incomeDelta: numberOrNull(url.searchParams.get('income_delta')) ?? 0,
    })
    return NextResponse.json(plan)
  } catch (error) {
    return NextResponse.json({ error: 'finance_nova_advanced_failed', detail: error instanceof Error ? error.message : 'Analyse avancée indisponible.' }, { status: 500 })
  }
}

type Action =
  | { type: 'envelope_target'; envelope_id: string; target_amount: number }
  | { type: 'goal_monthly_target'; goal_id: string; monthly_target: number }
  | { type: 'goal_priority'; goal_id: string; priority: number }

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as { confirmed?: boolean; actions?: Action[] } | null
  if (!body?.confirmed) return financeBadRequest('Validation explicite requise.')
  const actions = Array.isArray(body.actions) ? body.actions.slice(0, 20) : []
  if (actions.length === 0) return financeBadRequest('Aucune modification à appliquer.')

  let applied = 0
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    if (action.type === 'envelope_target') {
      const amount = Number(action.target_amount)
      if (!action.envelope_id || !Number.isFinite(amount) || amount < 0) continue
      const { error } = await supabaseAdmin.from('finance_envelopes').update({ target_amount: amount }).eq('user_id', identity.id).eq('id', action.envelope_id)
      if (error) return NextResponse.json({ error: 'finance_nova_apply_failed', detail: error.message }, { status: 500 })
      applied += 1
    } else if (action.type === 'goal_monthly_target') {
      const amount = Number(action.monthly_target)
      if (!action.goal_id || !Number.isFinite(amount) || amount < 0) continue
      const { error } = await supabaseAdmin.from('finance_goals').update({ monthly_target: amount }).eq('user_id', identity.id).eq('id', action.goal_id)
      if (error) return NextResponse.json({ error: 'finance_nova_apply_failed', detail: error.message }, { status: 500 })
      applied += 1
    } else if (action.type === 'goal_priority') {
      const priority = Math.max(1, Math.min(999, Math.round(Number(action.priority))))
      if (!action.goal_id || !Number.isFinite(priority)) continue
      const { error } = await supabaseAdmin.from('finance_goals').update({ priority }).eq('user_id', identity.id).eq('id', action.goal_id)
      if (error) return NextResponse.json({ error: 'finance_nova_apply_failed', detail: error.message }, { status: 500 })
      applied += 1
    }
  }

  return NextResponse.json({ ok: true, applied })
}
