import { NextResponse, type NextRequest } from 'next/server'
import { syncFinanceUser } from '@/lib/finance/services/sync-user'

function betaUserIds() {
  return (process.env.FINANCE_PRIVATE_BETA_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: Array<{ userId: string; ok: boolean; error?: string }> = []
  for (const userId of betaUserIds()) {
    try {
      await syncFinanceUser(userId)
      results.push({ userId, ok: true })
    } catch (error) {
      console.error('[finance][cron-sync]', userId, error instanceof Error ? error.message : 'unknown_error')
      results.push({ userId, ok: false, error: 'sync_failed' })
    }
  }

  return NextResponse.json({ ok: results.every((item) => item.ok), count: results.length, results })
}
