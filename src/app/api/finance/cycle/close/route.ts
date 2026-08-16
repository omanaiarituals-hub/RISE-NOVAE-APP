import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const cycleStart = String(body.cycle_start ?? '')
  const cycleEnd = String(body.cycle_end ?? '')
  const actions = Array.isArray(body.actions) ? body.actions : []
  const note = body.note ? String(body.note) : null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleStart) || !/^\d{4}-\d{2}-\d{2}$/.test(cycleEnd)) {
    return financeBadRequest('Période de cycle invalide.')
  }

  const today = new Date().toISOString().slice(0, 10)
  if (cycleEnd > today) return financeBadRequest('Ce cycle n’est pas encore terminé. La clôture sera disponible à sa date de fin.')

  const { data, error } = await supabaseAdmin.rpc('finance_close_budget_cycle', {
    p_user_id: identity.id,
    p_cycle_start: cycleStart,
    p_cycle_end: cycleEnd,
    p_actions: actions,
    p_note: note,
  })

  if (error) {
    return NextResponse.json({ error: 'finance_cycle_close_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ closure_id: data })
}
