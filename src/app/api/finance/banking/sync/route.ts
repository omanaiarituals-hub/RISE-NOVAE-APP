import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { syncFinanceUser } from '@/lib/finance/services/sync-user'

export async function POST(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(identity.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  try {
    const result = await syncFinanceUser(identity.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[finance][banking][sync]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ error: 'banking_sync_failed' }, { status: 500 })
  }
}
