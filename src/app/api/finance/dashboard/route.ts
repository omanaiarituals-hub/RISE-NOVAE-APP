import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'
import { buildFinanceForecast } from '@/lib/finance/services/forecast'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const [envelopes, goals, profile] = await Promise.all([
    supabaseAdmin.from('finance_envelopes').select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority').eq('user_id', identity.id).eq('is_active', true).order('priority', { ascending: true }).limit(3),
    supabaseAdmin.from('finance_goals').select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status').eq('user_id', identity.id).eq('status', 'active').order('priority', { ascending: true }).limit(1),
    supabaseAdmin.from('finance_user_profiles').select('current_overdraft,overdraft_limit').eq('user_id', identity.id).maybeSingle(),
  ])
  const error = envelopes.error || goals.error
  if (error) return NextResponse.json({ error: 'finance_dashboard_unavailable', detail: error.message }, { status: 500 })
  try {
    const forecast = await buildFinanceForecast(identity.id)
    const p = profile.error ? null : profile.data
    return NextResponse.json({
      bank: { connected: forecast.balance_source === 'bank', balance: forecast.base_balance, source: forecast.balance_source },
      forecast,
      envelopes: envelopes.data ?? [],
      primary_goal: goals.data?.[0] ?? null,
      overdraft: p && Number(p.current_overdraft ?? 0) > 0 ? { current: Number(p.current_overdraft), limit: Number(p.overdraft_limit ?? 0) } : null,
    })
  } catch (reason) {
    return NextResponse.json({ error: 'finance_dashboard_unavailable', detail: reason instanceof Error ? reason.message : 'Erreur.' }, { status: 500 })
  }
}
