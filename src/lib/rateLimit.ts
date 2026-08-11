// src/lib/rateLimit.ts
// Rate limiter atomique pour les routes API coûteuses de NOVAÉ.
// La décision + l'incrément sont effectués dans UNE fonction Postgres,
// sous verrou transactionnel par user/action. Les routes coûteuses sont fail-closed.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
}

export async function rateLimit(
  db: SupabaseClient,
  userId: string,
  action: string,
  { max = 20, windowMinutes = 60 }: { max?: number; windowMinutes?: number } = {}
): Promise<RateLimitResult> {
  const safeMax = Math.max(1, Math.min(10_000, Math.trunc(max)))
  const safeWindow = Math.max(1, Math.min(24 * 60, Math.trunc(windowMinutes)))
  const fallbackReset = new Date(Date.now() + safeWindow * 60 * 1000).toISOString()

  try {
    const { data, error } = await db.rpc('consume_api_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_max: safeMax,
      p_window_minutes: safeWindow,
    })

    if (error) {
      console.error('[rateLimit] RPC failed', { action, message: error.message })
      return { allowed: false, remaining: 0, resetAt: fallbackReset }
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row.allowed !== 'boolean') {
      console.error('[rateLimit] invalid RPC response', { action })
      return { allowed: false, remaining: 0, resetAt: fallbackReset }
    }

    return {
      allowed: row.allowed,
      remaining: Number.isFinite(Number(row.remaining)) ? Math.max(0, Number(row.remaining)) : 0,
      resetAt: typeof row.reset_at === 'string' ? row.reset_at : fallbackReset,
    }
  } catch (error) {
    console.error('[rateLimit] unexpected failure', {
      action,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return { allowed: false, remaining: 0, resetAt: fallbackReset }
  }
}
