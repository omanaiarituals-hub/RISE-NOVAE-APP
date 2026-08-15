import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getBankingProvider } from '@/lib/finance/provider-factory'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(user.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  const provider = getBankingProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: 'banking_provider_not_configured' }, { status: 503 })
  }

  try {
    const origin = new URL(request.url).origin
    const session = await provider.createReadOnlyConnectionSession({
      novaeUserId: user.id,
      returnUrl: `${origin}/finances/banking?connection=return`,
    })
    return NextResponse.json({ url: session.url, mode: 'read_only' })
  } catch (error) {
    console.error('[finance][banking][connect]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ error: 'banking_connection_session_failed' }, { status: 500 })
  }
}
