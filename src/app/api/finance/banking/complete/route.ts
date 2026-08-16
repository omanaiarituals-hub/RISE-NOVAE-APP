import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { getBankingProvider } from '@/lib/finance/provider-factory'
import { BankingProviderError } from '@/lib/finance/provider'
import { syncFinanceUser } from '@/lib/finance/services/sync-user'

export async function POST(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { code?: string } | null
  const code = body?.code?.trim()
  if (!code) return NextResponse.json({ error: 'banking_authorization_code_missing' }, { status: 400 })

  const provider = getBankingProvider()
  if (!provider.completeReadOnlyConnectionSession) {
    return NextResponse.json({ ok: true, completionRequired: false })
  }

  try {
    await provider.completeReadOnlyConnectionSession({ novaeUserId: identity.id, code })
    const result = await syncFinanceUser(identity.id)
    return NextResponse.json({ ok: true, completionRequired: true, ...result })
  } catch (error) {
    if (error instanceof BankingProviderError) {
      console.error('[finance][banking][complete]', {
        provider: error.provider,
        status: error.status ?? null,
        retryable: error.retryable,
        message: error.message,
      })
      return NextResponse.json(
        { error: 'banking_authorization_completion_failed', message: error.message },
        { status: 502 },
      )
    }
    console.error('[finance][banking][complete]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json(
      { error: 'banking_authorization_completion_failed', message: 'Impossible de finaliser le consentement bancaire.' },
      { status: 500 },
    )
  }
}
