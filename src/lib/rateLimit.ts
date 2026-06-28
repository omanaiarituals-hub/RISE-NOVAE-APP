// src/lib/rate-limit.ts
// Rate limiter léger pour les routes API coûteuses (agent NOVA, scan recette).
// Stocke un compteur par user_id + fenêtre en base Supabase (table api_rate_limits).
// Si la table n'existe pas, rate limit est IGNORÉ (fail-open) — jamais bloquant.
//
// Usage dans une API route :
//   import { rateLimit } from '@/lib/rate-limit'
//   const rl = await rateLimit(supabaseAdmin, userId, 'nova_chat', { max: 20, windowMinutes: 60 })
//   if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes. Réessaie dans une minute.' }, { status: 429 })

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: string
}

/**
 * Vérifie et incrémente le compteur d'une utilisatrice pour une action donnée.
 * @param db         Client Supabase admin (service role)
 * @param userId     ID de l'utilisatrice
 * @param action     Identifiant de l'action ('nova_chat', 'scan_recipe', etc.)
 * @param max        Nombre max d'appels dans la fenêtre (défaut 20)
 * @param windowMinutes  Taille de la fenêtre en minutes (défaut 60)
 */
export async function rateLimit(
  db: SupabaseClient,
  userId: string,
  action: string,
  { max = 20, windowMinutes = 60 }: { max?: number; windowMinutes?: number } = {}
): Promise<RateLimitResult> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString()

    // Compte les appels récents
    const { count, error } = await db
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', windowStart)

    if (error) {
      // Table absente ou erreur → fail-open (on ne bloque pas)
      return { allowed: true, remaining: max, resetAt }
    }

    const calls = count ?? 0
    if (calls >= max) {
      return { allowed: false, remaining: 0, resetAt }
    }

    // Enregistre l'appel
    await db.from('api_rate_limits').insert({
      user_id: userId,
      action,
      created_at: new Date().toISOString(),
    })

    return { allowed: true, remaining: max - calls - 1, resetAt }
  } catch {
    // Fail-open : si le rate limiter plante, on ne bloque pas l'utilisatrice
    return { allowed: true, remaining: max, resetAt: new Date().toISOString() }
  }
}

// Migration SQL à exécuter dans Supabase (si la table n'existe pas encore) :
//
// CREATE TABLE IF NOT EXISTS api_rate_limits (
//   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//   action      text NOT NULL,
//   created_at  timestamptz DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_ts
//   ON api_rate_limits (user_id, action, created_at DESC);
// ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Service role only" ON api_rate_limits USING (false);