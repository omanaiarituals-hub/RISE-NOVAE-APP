import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { getBankingProvider } from '@/lib/finance/provider-factory'

export async function POST(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const provider = getBankingProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: 'banking_provider_not_configured' }, { status: 503 })
  }

  try {
    const origin = new URL(request.url).origin
    const session = await provider.createReadOnlyConnectionSession({
      novaeUserId: identity.id,
      returnUrl: `${origin}/finances/banking?connection=return`,
    })
    return NextResponse.json({ url: session.url, mode: 'read_only' })
  } catch (error) {
    console.error('[finance][banking][connect]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ error: 'banking_connection_session_failed' }, { status: 500 })
  }
}
