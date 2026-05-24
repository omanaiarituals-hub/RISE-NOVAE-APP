// lib/permissions.ts
// Single source of truth pour le contrôle d'accès par tier dans NOVAÉ.
// Spec verrouillée le 24/05/2026.
//
// Usage côté API route :
//   import { canAccess, incrementAiChatCount } from '@/lib/permissions';
//   const result = await canAccess(supabase, 'ai_coach', userId);
//   if (!result.allowed) return Response.json({ error: result.reason }, { status: 403 });

import type { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'trial' | 'premium' | 'expired';

export type Feature =
  // Features à quota (free limité)
  | 'scan_recipe'          // 3 / mois
  | 'ai_coach'             // 5 / mois (Haiku en free)
  | 'challenge_join'       // 5 au total (à vie)
  // Features gratuites
  | 'community_read'
  | 'astuces_preview'
  | 'family_member'
  | 'family_birthday'
  | 'family_allergy_note'
  | 'routines_basic'
  // Features Premium uniquement
  | 'community_post'
  | 'astuces_details'
  | 'family_conflict_detection'
  | 'program_90_days'
  | 'weekly_debrief'
  | 'circle_of_week'
  | 'routines_ai'
  | 'premium_content';

export type AccessReason =
  | 'premium_required'
  | 'monthly_limit_reached'
  | 'limit_reached'
  | 'user_not_found';

export type AccessResult = {
  allowed: boolean;
  reason?: AccessReason;
  quota_remaining?: number;
  quota_max?: number;
  reset_at?: string;
};

const FREE_LIMITS = {
  scan_recipe_per_month: 3,
  ai_chat_per_month: 5,
  defis_max: 5, // à vie
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

  // 2. Trial actif OU premium = accès complet
  const isTrialActive =
    tier === 'trial' &&
    user.trial_ends_at &&
    new Date(user.trial_ends_at) > new Date();
  const isPremiumActive = tier === 'premium';

  if (isPremiumActive || isTrialActive) {
    return { allowed: true };
  }

  // 3. Free (ou trial expiré) → gating sélectif
  switch (feature) {
    case 'scan_recipe': {
      const quota = await getOrCreateQuota(supabase, userId);
      const remaining = FREE_LIMITS.scan_recipe_per_month - (quota.scan_count_month ?? 0);
      return {
        allowed: remaining > 0,
        reason: remaining <= 0 ? 'monthly_limit_reached' : undefined,
        quota_remaining: Math.max(0, remaining),
        quota_max: FREE_LIMITS.scan_recipe_per_month,
        reset_at: quota.scan_count_reset_at,
      };
    }

    case 'ai_coach': {
      const quota = await getOrCreateQuota(supabase, userId);
      const remaining = FREE_LIMITS.ai_chat_per_month - (quota.ai_chat_count_month ?? 0);
      return {
        allowed: remaining > 0,
        reason: remaining <= 0 ? 'monthly_limit_reached' : undefined,
        quota_remaining: Math.max(0, remaining),
        quota_max: FREE_LIMITS.ai_chat_per_month,
        reset_at: quota.ai_chat_count_reset_at,
      };
    }

    case 'challenge_join': {
      const quota = await getOrCreateQuota(supabase, userId);
      const remaining = FREE_LIMITS.defis_max - (quota.defis_count ?? 0);
      return {
        allowed: remaining > 0,
        reason: remaining <= 0 ? 'limit_reached' : undefined,
        quota_remaining: Math.max(0, remaining),
        quota_max: FREE_LIMITS.defis_max,
      };
    }

    // Features gratuites
    case 'community_read':
    case 'astuces_preview':
    case 'family_member':
    case 'family_birthday':
    case 'family_allergy_note':
    case 'routines_basic':
      return { allowed: true };

    // Premium uniquement
    case 'community_post':
    case 'astuces_details':
    case 'family_conflict_detection':
    case 'program_90_days':
    case 'weekly_debrief':
    case 'circle_of_week':
    case 'routines_ai':
    case 'premium_content':
      return { allowed: false, reason: 'premium_required' };

    default:
      return { allowed: true };
  }
}

/* ------------------------------------------------------------------ */
/* Incréments (à appeler APRÈS une action réussie)                    */
/* ------------------------------------------------------------------ */

export async function incrementScanCount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const quota = await getOrCreateQuota(supabase, userId);
  const { error } = await supabase
    .from('user_quotas')
    .update({
      scan_count_month: (quota.scan_count_month ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) {
    console.error('[incrementScanCount] failed:', error);
    throw new Error(`Failed to increment scan count: ${error.message}`);
  }
}

export async function incrementAiChatCount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const quota = await getOrCreateQuota(supabase, userId);
  const { error } = await supabase
    .from('user_quotas')
    .update({
      ai_chat_count_month: (quota.ai_chat_count_month ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) {
    console.error('[incrementAiChatCount] failed:', error);
    throw new Error(`Failed to increment ai chat count: ${error.message}`);
  }
}

export async function incrementDefisCount(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const quota = await getOrCreateQuota(supabase, userId);
  const { error } = await supabase
    .from('user_quotas')
    .update({
      defis_count: (quota.defis_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) {
    console.error('[incrementDefisCount] failed:', error);
    throw new Error(`Failed to increment defis count: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Quota : récupère, crée si absent, reset mensuel scan + IA          */
/* ------------------------------------------------------------------ */

async function getOrCreateQuota(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Pas de ligne → créer (les défauts SQL initialisent les compteurs)
  if (!existing) {
    const { data: created, error } = await supabase
      .from('user_quotas')
      .insert({ user_id: userId })
      .select()
      .single();
    if (error) throw new Error(`Failed to create quota: ${error.message}`);
    return created;
  }

  // Resets mensuels (scan + IA), défis ne se reset jamais
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const patch: Record<string, any> = {};

  if (existing.scan_count_reset_at && now >= new Date(existing.scan_count_reset_at)) {
    patch.scan_count_month = 0;
    patch.scan_count_reset_at = nextReset;
  }
  if (existing.ai_chat_count_reset_at && now >= new Date(existing.ai_chat_count_reset_at)) {
    patch.ai_chat_count_month = 0;
    patch.ai_chat_count_reset_at = nextReset;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = now.toISOString();
    const { data: updated, error } = await supabase
      .from('user_quotas')
      .update(patch)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new Error(`Failed to reset quota: ${error.message}`);
    return updated;
  }

  return existing;
}