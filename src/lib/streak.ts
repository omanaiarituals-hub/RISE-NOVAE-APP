import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { badgesUnlockedByStreak } from './badges';
import { grantBadges } from './badge-grant';
import { logEvent } from './events';

export type StreakState = {
  current: number;
  longest: number;
  freezesRemaining: number;
  lastActivityDate: string | null;
  flameLitAt: string | null;
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export type CheckInResult = StreakState & {
  alreadyCheckedInToday: boolean;
  usedFreeze: boolean;
  wasReset: boolean;
  newlyEarnedBadges: string[];
};

export function getFlameLevel(streak: number): StreakState['level'] {
  if (streak <= 0) return 0;
  if (streak < 3) return 1;
  if (streak < 7) return 2;
  if (streak < 14) return 3;
  if (streak < 30) return 4;
  if (streak < 60) return 5;
  if (streak < 90) return 6;
  return 7;
}

function todayDateString(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.floor((db - da) / (1000 * 60 * 60 * 24));
}

export async function getStreak(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
): Promise<StreakState | null> {
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const { data } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const today = todayDateString();
  let current = data.current_streak;

  if (data.last_activity_date) {
    const gap = daysBetween(data.last_activity_date, today);
    if (gap > 1) {
      const missed = gap - 1;
      if (data.freezes_remaining < missed) {
        current = 0;
      }
    }
  }

  return {
    current,
    longest: data.longest_streak,
    freezesRemaining: data.freezes_remaining,
    lastActivityDate: data.last_activity_date,
    flameLitAt: data.flame_lit_at,
    level: getFlameLevel(current),
  };
}

export async function recordCheckIn(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
): Promise<CheckInResult> {
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);
  const today = todayDateString();
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // ----- Première fois -----
  if (!existing) {
    await supabase.from('user_streaks').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
      freezes_remaining: 1,
      freezes_last_reset: today,
      flame_lit_at: nowIso,
    });
    await logEvent(supabase, userId, 'streak_check_in', { day: 1 });
    const newlyEarned = await grantBadges(
      supabase,
      userId,
      badgesUnlockedByStreak(1)
    );
    return {
      current: 1,
      longest: 1,
      freezesRemaining: 1,
      lastActivityDate: today,
      flameLitAt: nowIso,
      level: getFlameLevel(1),
      alreadyCheckedInToday: false,
      usedFreeze: false,
      wasReset: false,
      newlyEarnedBadges: newlyEarned,
    };
  }

  // ----- Régénération éventuelle des répits -----
  let freezes = existing.freezes_remaining;
  if (existing.freezes_last_reset) {
    const sinceReset = daysBetween(existing.freezes_last_reset, today);
    if (sinceReset >= 7 && freezes < 1) {
      freezes = 1;
    }
  }

  // ----- Déjà check-in aujourd'hui -----
  if (existing.last_activity_date === today) {
    return {
      current: existing.current_streak,
      longest: existing.longest_streak,
      freezesRemaining: freezes,
      lastActivityDate: existing.last_activity_date,
      flameLitAt: existing.flame_lit_at,
      level: getFlameLevel(existing.current_streak),
      alreadyCheckedInToday: true,
      usedFreeze: false,
      wasReset: false,
      newlyEarnedBadges: [],
    };
  }

  // ----- Calcul du nouveau streak -----
  let newStreak = existing.current_streak;
  let usedFreeze = false;
  let wasReset = false;
  let returnedAfterAbsence = false;
  let freezesLastReset = existing.freezes_last_reset;

  if (!existing.last_activity_date) {
    newStreak = 1;
  } else {
    const gap = daysBetween(existing.last_activity_date, today);

    if (gap === 1) {
      newStreak = existing.current_streak + 1;
    } else if (gap > 1) {
      const missed = gap - 1;
      if (freezes >= missed) {
        freezes -= missed;
        usedFreeze = true;
        freezesLastReset = today;
        newStreak = existing.current_streak + 1;
      } else {
        newStreak = 1;
        wasReset = true;
        returnedAfterAbsence = true;
      }
    } else {
      newStreak = 1;
    }
  }

  const newLongest = Math.max(newStreak, existing.longest_streak);
  const flameLitAt =
    newStreak === 1 && wasReset
      ? nowIso
      : existing.flame_lit_at || nowIso;

  await supabase
    .from('user_streaks')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
      freezes_remaining: freezes,
      freezes_last_reset: freezesLastReset,
      flame_lit_at: flameLitAt,
      updated_at: nowIso,
    })
    .eq('user_id', userId);

  // ----- Logging events (foundations Cercle) -----
  await logEvent(supabase, userId, 'streak_check_in', { streak: newStreak });
  if (usedFreeze) {
    await logEvent(supabase, userId, 'streak_freeze_used', { streak: newStreak });
  }
  if (wasReset) {
    await logEvent(supabase, userId, 'streak_reset', { previous: existing.current_streak });
  }
  if (returnedAfterAbsence) {
    await logEvent(supabase, userId, 'returned_after_absence', { previous: existing.current_streak });
  }
  if ([3, 7, 14, 30, 60, 90].includes(newStreak)) {
    await logEvent(supabase, userId, 'streak_milestone', { streak: newStreak });
  }
  if ([30, 60, 90].includes(newStreak)) {
    await logEvent(supabase, userId, 'phase_completed', { day: newStreak });
  }

  // ----- Attribution des badges streak -----
  const newlyEarned = await grantBadges(
    supabase,
    userId,
    badgesUnlockedByStreak(newStreak)
  );

  return {
    current: newStreak,
    longest: newLongest,
    freezesRemaining: freezes,
    lastActivityDate: today,
    flameLitAt,
    level: getFlameLevel(newStreak),
    alreadyCheckedInToday: false,
    usedFreeze,
    wasReset,
    newlyEarnedBadges: newlyEarned,
  };
}