-- LOT 4 — notifications utiles et scalables palier 100
-- Exécuter dans Supabase avant typecheck/build.

begin;

-- 1. Préférences explicites de la nouvelle NOVAÉ.
alter table public.push_subscriptions
  add column if not exists notif_morning_brief boolean not null default true,
  add column if not exists notif_evening_prepare boolean not null default true,
  add column if not exists notif_weekly_review boolean not null default true,
  add column if not exists notif_planner_reminders boolean not null default true;

-- Respecter les anciens choix des utilisatrices déjà inscrites.
update public.push_subscriptions
set
  notif_morning_brief = coalesce(notif_routines, true),
  notif_evening_prepare = coalesce(notif_routines, true),
  notif_weekly_review = coalesce(notif_bilan, true),
  notif_planner_reminders = coalesce(notif_conflits, true);

-- 2. Idempotence des briefs matin / soir / semaine.
create table if not exists public.scheduled_notification_receipts (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, notification_type, period_key)
);

alter table public.scheduled_notification_receipts enable row level security;

create index if not exists idx_scheduled_notification_receipts_claimed
  on public.scheduled_notification_receipts (claimed_at desc);

-- 3. Un reçu par rappel Planner, y compris si l'événement est déplacé.
create table if not exists public.planner_event_reminder_receipts (
  event_id uuid not null references public.planner_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reminder_minutes_before integer not null check (reminder_minutes_before > 0),
  event_start text not null,
  sent_at timestamptz not null default now(),
  primary key (event_id, reminder_minutes_before, event_start)
);

alter table public.planner_event_reminder_receipts enable row level security;

create index if not exists idx_planner_reminder_receipts_user_sent
  on public.planner_event_reminder_receipts (user_id, sent_at desc);

-- Les événements déjà marqués reminder_sent=true avant ce lot ne doivent pas
-- renvoyer un ancien rappel après migration.
insert into public.planner_event_reminder_receipts (
  event_id,
  user_id,
  reminder_minutes_before,
  event_start,
  sent_at
)
select
  e.id,
  e.user_id,
  reminder_value,
  e.start_date::text,
  now()
from public.planner_events e
cross join lateral unnest(coalesce(e.reminder_minutes_before, '{}'::integer[])) as reminder_value
where e.reminder_sent = true
  and reminder_value > 0
on conflict do nothing;

-- 4. Indexes ciblés pour les crons.
create index if not exists idx_planner_events_start_date_status
  on public.planner_events (start_date, status);

create index if not exists idx_task_reminders_status_scheduled_for
  on public.task_reminders (status, scheduled_for);

create index if not exists idx_todo_list_due_date_status
  on public.todo_list (due_date, status);

create index if not exists idx_todo_list_completed_at
  on public.todo_list (completed_at desc)
  where completed_at is not null;

commit;
