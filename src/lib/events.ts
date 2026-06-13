import { SupabaseClient } from '@supabase/supabase-js';

export type EventType =
  // ── Existants ──────────────────────────────────────
  | 'streak_check_in'
  | 'streak_milestone'
  | 'streak_reset'
  | 'streak_freeze_used'
  | 'badge_earned'
  | 'badge_shared'
  | 'returned_after_absence'
  | 'phase_completed'
  | 'community_post'
  | 'community_comment'
  | 'community_like_given'
  // ── Modules (usage partenariats) ────────────────────
  | 'module_programme'
  | 'module_planner'
  | 'module_tracker'
  | 'module_routines'
  | 'module_agent'
  | 'module_recettes'
  | 'module_famille'
  | 'module_notes'
  | 'module_astuces'
  | 'module_communaute'
  | 'module_defis';

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
    console.error('[logEvent] error', error, { userId, eventType });
  }
}