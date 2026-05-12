// lib/permissions.ts
// Single source of truth pour le contrôle d'accès par tier dans NOVAÉ.
// Créé : 12 mai 2026
//
// Usage côté API route :
//   import { canAccess } from '@/lib/permissions';
//   const result = await canAccess(supabase, 'scan_recipe', userId);
//   if (!result.allowed) return Response.json({ error: result.reason }, { status: 403 });

import type { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'trial' | 'premium' | 'expired';

export type Feature =
  | 'scan_recipe'
  | 'ai_coach_unlimited'
  | 'program_90_days'
  | 'community_access'
  | 'weekly_debrief'
  | 'circle_of_week'
  | 'premium_content';

export type AccessReason =
  | 'premium_required'
  | 'monthly_limit_reached'
  | 'daily_limit_reached'
  | 'user_not_found';

export type AccessResult = {
  allowed: boolean;
  reason?: AccessReason;
  quota_remaining?: number;
  quota_max?: number;
  reset_at?: string;
};

const FREE_LIMITS = {
  scan_recipe_per_month: 5,
  ai_chat_per_day: 10,
} as const;

/**
 * Vérifie si une utilisatrice peut accéder à une feature.
 * À appeler côté server (API routes, Server Components).
 */
export async function canAccess(
  supabase: SupabaseClient,
  feature: Feature,
  userId: string
): Promise<AccessResult> {
  // 1. Récupérer le tier et le trial
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('subscription_tier, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    return { allowed: false, reason: 'user_not_found' };
  }

  const tier: SubscriptionTier = (user.subscription_tier as SubscriptionTier) || 'free';

  // 2. Trial actif = accès complet
  const isTrialActive =
    tier === 'trial' &&
    user.trial_ends_at &&
    new Date(user.trial_ends_at) > new Date();

  const isPremiumActive = tier === 'premium';

  if (isPremiumActive || isTrialActive) {
    return { allowed: true };
  }

  // 3. Free tier (ou trial expiré) → gating sélectif
  switch (feature) {
    case 'scan_recipe': {
      const quota = await getOrCreateQuota(supabase, userId);
      const remaining = FREE_LIMITS.scan_recipe_per_month - quota.scan_count_month;
      return {
        allowed: remaining > 0,
        reason: remaining <= 0 ? 'monthly_limit_reached' : undefined,
        quota_remaining: Math.max(0, remaining),
        quota_max: FREE_LIMITS.scan_recipe_per_month,
        reset_at: quota.scan_count_reset_at,
      };
    }
    case 'ai_coach_unlimited':
    case 'program_90_days':
    case 'community_access':
    case 'weekly_debrief':
    case 'circle_of_week':
    case 'premium_content':
      return { allowed: false, reason: 'premium_required' };
    default:
      return { allowed: true };
  }
}

/**
 * Incrémente le compteur de scans (à appeler APRÈS un scan réussi).
 */
export async function incrementScanCount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const quota = await getOrCreateQuota(supabase, userId);
  const { error } = await supabase
    .from('user_quotas')
    .update({
      scan_count_month: quota.scan_count_month + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[incrementScanCount] failed:', error);
    throw new Error(`Failed to increment scan count: ${error.message}`);
  }
}

/**
 * Récupère le quota d'une user, le crée si absent, et reset si périmé.
 */
async function getOrCreateQuota(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Pas de ligne → créer
  if (!existing) {
    const { data: created, error } = await supabase
      .from('user_quotas')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) throw new Error(`Failed to create quota: ${error.message}`);
    return created;
  }

  // Auto-reset mensuel
  const now = new Date();
  const scanResetAt = new Date(existing.scan_count_reset_at);

  if (now >= scanResetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const { data: reset, error } = await supabase
      .from('user_quotas')
      .update({
        scan_count_month: 0,
        scan_count_reset_at: nextReset.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reset quota: ${error.message}`);
    return reset;
  }

  return existing;
}