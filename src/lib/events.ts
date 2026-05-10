import { SupabaseClient } from '@supabase/supabase-js';

export type EventType =
  | 'streak_check_in'
  | 'streak_milestone'
  | 'streak_reset'
  | 'streak_freeze_used'
  | 'badge_earned'
  | 'badge_shared'
  | 'returned_after_absence'
  | 'phase_completed'
  | 'community_post'           // à déclencher depuis ton code communauté existant
  | 'community_comment'        // à déclencher depuis ton code communauté existant
  | 'community_like_given';    // à déclencher depuis ton code communauté existant

export async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: EventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from('user_events').insert({
    user_id: userId,
    event_type: eventType,
    payload,
  });
  if (error) {
    // Non bloquant : on log mais on n'échoue pas la requête principale
    console.error('[logEvent] error', error, { userId, eventType });
  }
}