-- NOVA V2 : liaison planner / tâches et champs utilisés par l’orchestrateur
alter table public.planner_events add column if not exists source_todo_id uuid references public.todo_list(id) on delete set null;
alter table public.planner_events add column if not exists start_minutes integer;
alter table public.planner_events add column if not exists end_minutes integer;
alter table public.planner_events add column if not exists recurrence_days text[] default '{}';
alter table public.planner_events add column if not exists status text default 'pending';
create index if not exists idx_planner_events_source_todo on public.planner_events(user_id, source_todo_id) where source_todo_id is not null;
