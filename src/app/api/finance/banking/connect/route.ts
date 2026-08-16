import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { getBankingProvider } from '@/lib/finance/provider-factory'
import { BankingProviderError } from '@/lib/finance/provider'

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
    if (error instanceof BankingProviderError) {
      console.error('[finance][banking][connect]', {
        provider: error.provider,
        status: error.status ?? null,
        retryable: error.retryable,
        message: error.message,
      })
      return NextResponse.json(
        {
          error: 'banking_connection_session_failed',
          message: error.status === 401 || error.status === 403
            ? 'Powens refuse les identifiants de l’application. Vérifie le Client ID et le Client Secret dans .env.local.'
            : error.message,
        },
        { status: error.status && error.status >= 400 && error.status < 500 ? 502 : 500 },
      )
    }

    console.error('[finance][banking][connect]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json(
      { error: 'banking_connection_session_failed', message: 'Impossible de créer la session bancaire de test.' },
      { status: 500 },
    )
  }
}
