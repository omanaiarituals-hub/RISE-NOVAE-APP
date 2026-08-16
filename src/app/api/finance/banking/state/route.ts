import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const { data: connections, error: connectionError } = await supabaseAdmin
    .from('finance_connections')
    .select('id,provider,institution_name,status,last_synced_at,consent_expires_at,disconnected_at')
    .eq('user_id', identity.id)
    .order('created_at', { ascending: false })

  if (connectionError) {
    return NextResponse.json({ error: 'finance_connections_read_failed' }, { status: 500 })
  }

  const activeConnectionIds = (connections || [])
    .filter((item) => !item.disconnected_at)
    .map((item) => item.id)

  let accounts: Array<Record<string, unknown>> = []
  if (activeConnectionIds.length) {
    const { data, error } = await supabaseAdmin
      .from('finance_accounts')
      .select('id,connection_id,name,custom_name,account_type,currency,balance,available_balance,masked_identifier,is_active,user_enabled,last_synced_at')
      .eq('user_id', identity.id)
      .in('connection_id', activeConnectionIds)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'finance_accounts_read_failed' }, { status: 500 })
    accounts = data || []
  }

  return NextResponse.json({
    connections: connections || [],
    accounts,
    connected: activeConnectionIds.length > 0,
  })
}
