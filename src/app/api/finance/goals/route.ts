import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const goalTypes = new Set(['overdraft', 'emergency_fund', 'travel', 'project', 'debt', 'savings', 'custom'])

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const { data, error } = await supabaseAdmin
    .from('finance_goals')
    .select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status,created_at,updated_at')
    .eq('user_id', identity.id)
    .neq('status', 'cancelled')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'finance_goals_unavailable', detail: error.message }, { status: 500 })
  return NextResponse.json({ goals: data ?? [] })
}

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const name = String(body.name ?? '').trim()
  const goalType = String(body.goal_type ?? 'custom')
  const targetAmount = numberOrNull(body.target_amount)
  const currentAmount = numberOrNull(body.current_amount) ?? 0
  const monthlyTarget = numberOrNull(body.monthly_target)
  const targetDate = body.target_date ? String(body.target_date) : null

  if (!name) return financeBadRequest('Le nom de l’objectif est obligatoire.')
  if (!goalTypes.has(goalType)) return financeBadRequest('Type d’objectif invalide.')
  if (targetAmount === null || targetAmount <= 0) return financeBadRequest('Le montant cible doit être supérieur à zéro.')
  if (currentAmount < 0) return financeBadRequest('Le montant actuel doit être positif ou nul.')

  const { data, error } = await supabaseAdmin
    .from('finance_goals')
    .insert({
      user_id: identity.id,
      name,
      goal_type: goalType,
      target_amount: targetAmount,
      current_amount: currentAmount,
      target_date: targetDate,
      priority: integerOr(body.priority, 100),
      monthly_target: monthlyTarget,
      status: 'active',
    })
    .select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status,created_at,updated_at')
    .single()

  if (error) return NextResponse.json({ error: 'finance_goal_create_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ goal: data }, { status: 201 })
}
