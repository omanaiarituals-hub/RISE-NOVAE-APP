import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { financeUnauthorized, numberOrNull, requireFinanceIdentity } from '@/lib/finance/api'
import { buildFinanceForecast } from '@/lib/finance/services/forecast'

export async function GET(request: NextRequest) {
  const identity = await requireFinanceIdentity(request)
  if (!identity) return financeUnauthorized()
  const url = new URL(request.url)
  const extraSpend = numberOrNull(url.searchParams.get('extra_spend')) ?? 0
  const extraSavings = numberOrNull(url.searchParams.get('extra_savings')) ?? 0
  try {
    return NextResponse.json(await buildFinanceForecast(identity.id, { extraSpend, extraSavings }))
  } catch (error) {
    return NextResponse.json({ error: 'finance_forecast_failed', detail: error instanceof Error ? error.message : 'Erreur de prévision.' }, { status: 500 })
  }
}
