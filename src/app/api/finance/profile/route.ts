import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeBadRequest, financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'

const profileSelect = 'usual_income_day,usual_net_income,current_overdraft,overdraft_limit,cash_mode,analysis_period_months,manual_bank_balance,safety_floor,close_cycle_mode,onboarding_completed_at'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const { data, error } = await supabaseAdmin.from('finance_user_profiles').select(profileSelect).eq('user_id', identity.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'finance_profile_unavailable', detail: error.message }, { status: 500 })
  return NextResponse.json({ profile: data ?? null })
}

export async function PATCH(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return financeBadRequest('Données invalides.')

  const income = numberOrNull(body.usual_net_income)
  const overdraft = numberOrNull(body.current_overdraft) ?? 0
  const limit = numberOrNull(body.overdraft_limit) ?? 0
  const manualBalance = numberOrNull(body.manual_bank_balance)
  const safetyFloor = numberOrNull(body.safety_floor) ?? 0
  const dayRaw = Number(body.usual_income_day)
  const day = Number.isInteger(dayRaw) && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : null
  if (income !== null && income < 0) return financeBadRequest('Revenu invalide.')
  if (overdraft < 0 || limit < 0 || safetyFloor < 0) return financeBadRequest('Montant invalide.')

  const payload: Record<string, unknown> = {
    user_id: identity.id,
    usual_net_income: income,
    usual_income_day: day,
    current_overdraft: overdraft,
    overdraft_limit: limit,
    updated_at: new Date().toISOString(),
  }
  if ('manual_bank_balance' in body) payload.manual_bank_balance = manualBalance
  if ('safety_floor' in body) payload.safety_floor = safetyFloor
  if ('close_cycle_mode' in body) payload.close_cycle_mode = String(body.close_cycle_mode || 'manual')
  if ('analysis_period_months' in body) {
    const months = Number(body.analysis_period_months)
    if (Number.isInteger(months) && months >= 1 && months <= 24) payload.analysis_period_months = months
  }
  if (body.onboarding_completed === true) payload.onboarding_completed_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin.from('finance_user_profiles').upsert(payload, { onConflict: 'user_id' }).select(profileSelect).single()
  if (error) return NextResponse.json({ error: 'finance_profile_update_failed', detail: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
