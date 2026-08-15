import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, integerOr, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const goalTypes = new Set(['overdraft', 'emergency_fund', 'travel', 'project', 'debt', 'savings', 'custom'])
const statuses = new Set(['active', 'paused', 'completed', 'cancelled'])
type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('finance_goals')
    .select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status,created_at,updated_at')
    .eq('id', id)
    .eq('user_id', identity.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_goal_unavailable', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ goal: data })
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
    if (!name) return financeBadRequest('Le nom de l’objectif est obligatoire.')
    patch.name = name
  }
  if ('goal_type' in body) {
    const type = String(body.goal_type)
    if (!goalTypes.has(type)) return financeBadRequest('Type d’objectif invalide.')
    patch.goal_type = type
  }
  if ('target_amount' in body) {
    const value = numberOrNull(body.target_amount)
    if (value === null || value <= 0) return financeBadRequest('Montant cible invalide.')
    patch.target_amount = value
  }
  if ('current_amount' in body) {
    const value = numberOrNull(body.current_amount)
    if (value === null || value < 0) return financeBadRequest('Montant actuel invalide.')
    patch.current_amount = value
  }
  if ('monthly_target' in body) patch.monthly_target = numberOrNull(body.monthly_target)
  if ('target_date' in body) patch.target_date = body.target_date ? String(body.target_date) : null
  if ('priority' in body) patch.priority = integerOr(body.priority, 100)
  if ('status' in body) {
    const status = String(body.status)
    if (!statuses.has(status)) return financeBadRequest('Statut invalide.')
    patch.status = status
  }

  const { data, error } = await supabaseAdmin
    .from('finance_goals')
    .update(patch)
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status,created_at,updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_goal_update_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ goal: data })
}

export async function DELETE(request: NextRequest, context: Context) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('finance_goals')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', identity.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'finance_goal_delete_failed', detail: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
