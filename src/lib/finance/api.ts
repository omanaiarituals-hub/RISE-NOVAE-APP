import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getFinanceRequestIdentity } from '@/lib/finance/auth'
import { isFinanceBetaAllowed } from '@/lib/finance/access'

export async function requireFinanceIdentity(request: NextRequest) {
  const identity = await getFinanceRequestIdentity(request)
  if (!identity || !isFinanceBetaAllowed(identity.id)) return null
  return identity
}

export function financeUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function financeBadRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function integerOr(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}
