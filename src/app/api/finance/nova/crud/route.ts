import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'

type Body = {
  confirmed?: boolean
  entity?: 'envelope' | 'goal'
  action?: 'create' | 'update' | 'delete'
  id?: string
  data?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as Body | null
  if (!body?.confirmed) return financeBadRequest('Nova doit obtenir une confirmation explicite avant de modifier le budget.')
  if (!body.entity || !body.action) return financeBadRequest('Action incomplète.')

  const table = body.entity === 'envelope' ? 'finance_envelopes' : 'finance_goals'
  const allowedEnvelope = new Set(['name','envelope_type','target_amount','current_amount','rollover_enabled','cash_enabled','priority'])
  const allowedGoal = new Set(['name','goal_type','target_amount','current_amount','target_date','priority','monthly_target','status'])
  const allowed = body.entity === 'envelope' ? allowedEnvelope : allowedGoal
  const data = Object.fromEntries(Object.entries(body.data ?? {}).filter(([key]) => allowed.has(key)))

  if (body.action === 'create') {
    if (!String(data.name ?? '').trim()) return financeBadRequest('Nom obligatoire.')
    const row = {
      ...data,
      user_id: identity.id,
      ...(body.entity === 'envelope' ? { is_active: true } : { status: data.status ?? 'active' }),
    }
    const result = await supabaseAdmin.from(table).insert(row).select('*').single()
    if (result.error) return NextResponse.json({ error: 'finance_nova_create_failed', detail: result.error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: result.data })
  }

  if (!body.id) return financeBadRequest('Identifiant manquant.')

  if (body.action === 'update') {
    const result = await supabaseAdmin.from(table).update({ ...data, updated_at: new Date().toISOString() }).eq('id', body.id).eq('user_id', identity.id).select('*').maybeSingle()
    if (result.error) return NextResponse.json({ error: 'finance_nova_update_failed', detail: result.error.message }, { status: 500 })
    if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true, item: result.data })
  }

  const patch = body.entity === 'envelope'
    ? { is_active: false, updated_at: new Date().toISOString() }
    : { status: 'cancelled', updated_at: new Date().toISOString() }
  const result = await supabaseAdmin.from(table).update(patch).eq('id', body.id).eq('user_id', identity.id).select('id').maybeSingle()
  if (result.error) return NextResponse.json({ error: 'finance_nova_delete_failed', detail: result.error.message }, { status: 500 })
  if (!result.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
