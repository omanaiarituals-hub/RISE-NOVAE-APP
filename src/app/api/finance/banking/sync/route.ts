import { NextResponse, type NextRequest } from 'next/server'
import { isFinanceBetaAllowed } from '@/lib/finance/access'
import { syncFinanceUser } from '@/lib/finance/services/sync-user'
import { getRequestUser } from '@/lib/supabase/request-auth'

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isFinanceBetaAllowed(user.id)) return NextResponse.json({ error: 'finance_beta_forbidden' }, { status: 403 })

  try {
    const result = await syncFinanceUser(user.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[finance][banking][sync]', error instanceof Error ? error.message : 'unknown_error')
    return NextResponse.json({ error: 'banking_sync_failed' }, { status: 500 })
  }
}
