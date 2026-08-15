import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getBankingProvider } from '@/lib/finance/provider-factory'
import { getRequestUser } from '@/lib/supabase/request-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteProviderCredential } from '@/lib/finance/credential-store'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(user.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const provider = getBankingProvider()
  try {
    const { data: connections } = await supabaseAdmin
      .from('finance_connections')
      .select('provider_connection_id')
      .eq('user_id', user.id)
      .eq('provider', provider.id)
      .is('disconnected_at', null)

    for (const row of connections || []) {
      try { await provider.disconnectConnection(String(row.provider_connection_id)) } catch { /* on nettoie quand même NOVAÉ */ }
    }

    await supabaseAdmin
      .from('finance_connections')
      .update({ status: 'disconnected', disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', provider.id)

    if (provider.id !== 'disabled') await deleteProviderCredential(user.id, provider.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[finance][banking][disconnect]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ error: 'banking_disconnect_failed' }, { status: 500 })
  }
}
