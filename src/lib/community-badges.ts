// À utiliser depuis tes routes/actions communauté
import { createClient } from '@supabase/supabase-js';
import { grantBadges } from '@/lib/badge-grant';
import { logEvent } from '@/lib/events';

export async function evaluateCommunityBadges(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const toGrant: string[] = [];

  // first_word — premier post
  const { count: postsCount } = await supabase
    .from('community_posts') // adapte au nom de ta table
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((postsCount ?? 0) >= 1) toGrant.push('first_word');

  // presence_to_others — 5 commentaires
  const { count: commentsCount } = await supabase
    .from('community_comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((commentsCount ?? 0) >= 5) toGrant.push('presence_to_others');

  // support — 10 likes donnés
  const { count: likesCount } = await supabase
    .from('community_likes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((likesCount ?? 0) >= 10) toGrant.push('support');

  return await grantBadges(supabase, userId, toGrant);
}