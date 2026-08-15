import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { financeUnauthorized, requireFinanceIdentity } from '@/lib/finance/api'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  const [accountsResult, envelopesResult, goalsResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from('finance_accounts')
      .select('id,name,balance,available_balance,currency,is_active')
      .eq('user_id', identity.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('finance_envelopes')
      .select('id,name,envelope_type,target_amount,current_amount,rollover_enabled,cash_enabled,priority')
      .eq('user_id', identity.id)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(3),
    supabaseAdmin
      .from('finance_goals')
      .select('id,name,goal_type,target_amount,current_amount,target_date,priority,monthly_target,status')
      .eq('user_id', identity.id)
      .eq('status', 'active')
      .order('priority', { ascending: true })
      .limit(1),
    supabaseAdmin
      .from('finance_user_profiles')
      .select('current_overdraft,overdraft_limit,onboarding_completed_at')
      .eq('user_id', identity.id)
      .maybeSingle(),
  ])

  const errors = [accountsResult.error, envelopesResult.error, goalsResult.error]
    .filter(Boolean)
    .map((error) => error?.message)
  if (errors.length) return NextResponse.json({ error: 'finance_dashboard_unavailable', detail: errors.join(' | ') }, { status: 500 })

  const accounts = accountsResult.data ?? []
  const bankBalance = accounts.reduce((sum, account) => sum + Number(account.available_balance ?? account.balance ?? 0), 0)
  const hasAccounts = accounts.length > 0
  const profile = profileResult.error ? null : profileResult.data

  return NextResponse.json({
    bank: {
      connected: hasAccounts,
      balance: hasAccounts ? bankBalance : null,
      accounts_count: accounts.length,
    },
    envelopes: envelopesResult.data ?? [],
    primary_goal: goalsResult.data?.[0] ?? null,
    overdraft: profile && Number(profile.current_overdraft ?? 0) > 0
      ? { current: Number(profile.current_overdraft), limit: Number(profile.overdraft_limit ?? 0) }
      : null,
  })
}
