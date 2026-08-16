import { NextResponse, type NextRequest } from 'next/server'
import { requireFinanceIdentity, financeUnauthorized } from '@/lib/finance/api'
import { getConfiguredBankingProviderId } from '@/lib/finance/provider-factory'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()

  if (getConfiguredBankingProviderId() !== 'enable_banking') {
    return NextResponse.json({ error: 'reset_requires_enable_banking' }, { status: 409 })
  }

  const body = await request.json().catch(() => null) as { confirm?: string } | null
  if (body?.confirm !== 'RESET_TEST_DATA') {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 })
  }

  const { data: realConnections, error: realConnectionError } = await supabaseAdmin
    .from('finance_connections')
    .select('id')
    .eq('user_id', identity.id)
    .eq('provider', 'enable_banking')
    .is('disconnected_at', null)
  if (realConnectionError) return NextResponse.json({ error: 'real_connection_check_failed', detail: realConnectionError.message }, { status: 500 })
  if (!(realConnections || []).length) {
    return NextResponse.json({ error: 'real_connection_required', detail: 'Connecte d’abord ton compte réel Enable Banking.' }, { status: 409 })
  }

  // 1. Supprime réellement les anciennes connexions de test. Les comptes,
  // transactions et annotations correspondants disparaissent par CASCADE.
  const { data: legacyConnections, error: legacyLoadError } = await supabaseAdmin
    .from('finance_connections')
    .select('id,provider')
    .eq('user_id', identity.id)
    .neq('provider', 'enable_banking')
  if (legacyLoadError) return NextResponse.json({ error: 'legacy_connections_load_failed', detail: legacyLoadError.message }, { status: 500 })

  const legacyIds = (legacyConnections || []).map((row) => row.id)
  if (legacyIds.length) {
    const { error } = await supabaseAdmin
      .from('finance_connections')
      .delete()
      .eq('user_id', identity.id)
      .in('id', legacyIds)
    if (error) return NextResponse.json({ error: 'legacy_connections_delete_failed', detail: error.message }, { status: 500 })
  }

  // 2. Supprime les conclusions apprises pendant les tests. Elles seront
  // reconstruites uniquement à partir des vraies opérations.
  const cleanupTables: Array<{ table: string; filter?: (query: any) => any }> = [
    { table: 'finance_transaction_annotations' }, // après CASCADE, nettoie tout reliquat manuel/test
    { table: 'finance_merchant_rules' },
    { table: 'finance_recurring_commitments' },
    { table: 'finance_insights' },
    { table: 'finance_manual_bank_movements' },
    { table: 'finance_future_provisions' },
    { table: 'finance_cycle_closures' },
    { table: 'finance_envelope_cycle_snapshots' },
    { table: 'finance_envelope_movements' },
    { table: 'finance_budget_cycles' },
  ]

  for (const item of cleanupTables) {
    const { error } = await supabaseAdmin.from(item.table).delete().eq('user_id', identity.id)
    if (error) return NextResponse.json({ error: 'test_state_cleanup_failed', table: item.table, detail: error.message }, { status: 500 })
  }

  // Les définitions d'enveloppes/objectifs restent en place, mais pas les
  // montants manipulés pendant les tests.
  const now = new Date().toISOString()
  const { error: envelopeResetError } = await supabaseAdmin
    .from('finance_envelopes')
    .update({ current_amount: 0, cash_balance: 0, updated_at: now })
    .eq('user_id', identity.id)
  if (envelopeResetError) return NextResponse.json({ error: 'envelope_reset_failed', detail: envelopeResetError.message }, { status: 500 })

  const { error: goalResetError } = await supabaseAdmin
    .from('finance_goals')
    .update({ current_amount: 0, updated_at: now })
    .eq('user_id', identity.id)
    .neq('status', 'cancelled')
  if (goalResetError) return NextResponse.json({ error: 'goal_reset_failed', detail: goalResetError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    removed_legacy_connections: legacyIds.length,
    preserved: ['enable_banking_connection', 'real_bank_accounts', 'real_bank_transactions', 'finance_profile', 'envelope_definitions', 'goal_definitions'],
  })
}
