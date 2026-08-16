import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { getBankingProvider, getConfiguredBankingProviderId } from '@/lib/finance/provider-factory'

function normalizedPowensDomain() {
  const raw = process.env.POWENS_DOMAIN?.trim()
  if (!raw) return null
  const host = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return host.endsWith('.biapi.pro') ? host : `${host}.biapi.pro`
}

export async function GET(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const provider = getBankingProvider()
  const configuredProvider = getConfiguredBankingProviderId()
  const domain = configuredProvider === 'powens' ? normalizedPowensDomain() : null

  return NextResponse.json({
    mode: 'read_only',
    configuredProvider,
    adapterReady: provider.isConfigured(),
    environment: domain?.includes('-sandbox.biapi.pro') ? 'sandbox' : domain ? 'production_or_custom' : 'disabled',
    domainConfigured: Boolean(domain),
    clientConfigured: Boolean(process.env.POWENS_CLIENT_ID?.trim()),
    secretConfigured: Boolean(process.env.POWENS_CLIENT_SECRET?.trim()),
    connectorFilterConfigured: Boolean(process.env.POWENS_CONNECTOR_IDS?.trim()),
    paymentsEnabled: false,
    transfersEnabled: false,
    authSource: identity.source,
  })
}
