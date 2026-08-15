import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import {
  getBankingProvider,
  getConfiguredBankingProviderId,
} from '@/lib/finance/provider-factory'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isFinanceBetaAllowed(user.id)) {
    return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })
  }

  const provider = getBankingProvider()
  return NextResponse.json({
    mode: 'read_only',
    configuredProvider: getConfiguredBankingProviderId(),
    adapterReady: provider.isConfigured(),
    paymentsEnabled: false,
    transfersEnabled: false,
  })
}
