import { SupabaseClient } from '@supabase/supabase-js';
import { BADGES_BY_ID } from './badges';
import { logEvent } from './events';

export type GrantedBadge = {
  badgeId: string;
  alreadyHad: boolean;
};

/**
 * Tente d'attribuer une liste de badges à un user.
 * Renvoie uniquement ceux qui sont *nouvellement* attribués
 * (les déjà-possédés sont ignorés grâce à la contrainte UNIQUE).
 */
export async function grantBadges(
  supabase: SupabaseClient,
  userId: string,
  badgeIds: string[]
): Promise<string[]> {
  if (badgeIds.length === 0) return [];

  const validIds = badgeIds.filter((id) => BADGES_BY_ID[id]);

  const newlyEarned: string[] = [];
  for (const badgeId of validIds) {
    const { data, error } = await supabase
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badgeId })
      .select()
      .maybeSingle();

    // Contrainte UNIQUE → erreur 23505 si déjà possédé : on ignore
    if (!error && data) {
      newlyEarned.push(badgeId);
      await logEvent(supabase, userId, 'badge_earned', { badge_id: badgeId });
    }
  }

  return newlyEarned;
}