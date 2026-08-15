import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'

type EnvelopeInput = { name: string; envelope_type: string; target_amount: number; rollover_enabled?: boolean; cash_enabled?: boolean }
type GoalInput = { name: string; goal_type: string; target_amount: number; monthly_target?: number | null }

const envelopeTypes = new Set(['monthly', 'cumulative', 'goal', 'debt', 'temporary'])
const goalTypes = new Set(['overdraft', 'emergency_fund', 'travel', 'project', 'debt', 'savings', 'custom'])

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as { confirmed?: boolean; envelopes?: EnvelopeInput[]; goals?: GoalInput[] } | null
  if (!body?.confirmed) return financeBadRequest('Une validation explicite est obligatoire avant toute création par Nova.')

  const envelopes = Array.isArray(body.envelopes) ? body.envelopes : []
  const goals = Array.isArray(body.goals) ? body.goals : []
  if (envelopes.length > 20 || goals.length > 20) return financeBadRequest('Trop d’éléments à créer en une seule fois.')

  const cleanEnvelopes = envelopes.filter((item) => item?.name?.trim() && envelopeTypes.has(item.envelope_type) && Number(item.target_amount) >= 0)
  const cleanGoals = goals.filter((item) => item?.name?.trim() && goalTypes.has(item.goal_type) && Number(item.target_amount) > 0)

  const [existingEnvelopes, existingGoals] = await Promise.all([
    supabaseAdmin.from('finance_envelopes').select('name').eq('user_id', identity.id).eq('is_active', true),
    supabaseAdmin.from('finance_goals').select('goal_type').eq('user_id', identity.id).eq('status', 'active'),
  ])
  if (existingEnvelopes.error || existingGoals.error) return NextResponse.json({ error: 'finance_recommendation_check_failed' }, { status: 500 })

  const existingNames = new Set((existingEnvelopes.data ?? []).map((item) => item.name.trim().toLowerCase()))
  const existingGoalTypes = new Set((existingGoals.data ?? []).map((item) => item.goal_type))
  const envelopeRows = cleanEnvelopes
    .filter((item) => !existingNames.has(item.name.trim().toLowerCase()))
    .map((item, index) => ({
      user_id: identity.id,
      name: item.name.trim(),
      envelope_type: item.envelope_type,
      target_amount: Number(item.target_amount),
      current_amount: 0,
      rollover_enabled: Boolean(item.rollover_enabled),
      cash_enabled: Boolean(item.cash_enabled),
      priority: 100 + index,
      is_active: true,
    }))
  const goalRows = cleanGoals
    .filter((item) => !existingGoalTypes.has(item.goal_type))
    .map((item, index) => ({
      user_id: identity.id,
      name: item.name.trim(),
      goal_type: item.goal_type,
      target_amount: Number(item.target_amount),
      current_amount: 0,
      monthly_target: item.monthly_target == null ? null : Number(item.monthly_target),
      priority: 100 + index,
      status: 'active',
    }))

  const created: { envelopes: number; goals: number } = { envelopes: 0, goals: 0 }
  if (envelopeRows.length) {
    const result = await supabaseAdmin.from('finance_envelopes').insert(envelopeRows).select('id')
    if (result.error) return NextResponse.json({ error: 'finance_recommended_envelopes_create_failed', detail: result.error.message }, { status: 500 })
    created.envelopes = result.data?.length ?? 0
  }
  if (goalRows.length) {
    const result = await supabaseAdmin.from('finance_goals').insert(goalRows).select('id')
    if (result.error) return NextResponse.json({ error: 'finance_recommended_goals_create_failed', detail: result.error.message }, { status: 500 })
    created.goals = result.data?.length ?? 0
  }

  return NextResponse.json({ ok: true, created })
}
