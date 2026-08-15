import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { getBankingProvider, getConfiguredBankingProviderId } from '@/lib/finance/provider-factory'

export async function GET(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const provider = getBankingProvider()
  return NextResponse.json({
    mode: 'read_only',
    configuredProvider: getConfiguredBankingProviderId(),
    adapterReady: provider.isConfigured(),
    paymentsEnabled: false,
    transfersEnabled: false,
    authSource: identity.source,
  })
}
