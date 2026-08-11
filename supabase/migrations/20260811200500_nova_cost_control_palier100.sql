begin;

-- ============================================================
-- LOT 2A — NOVA : anti-abus + coût mesurable + quotas atomiques
-- ============================================================

-- 1) Historique minimal d'usage IA (aucun prompt / aucune donnée métier)
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  route text not null,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created
  on public.ai_usage (user_id, created_at desc);
create index if not exists idx_ai_usage_created
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
-- Pas de policy utilisateur : écrit/lu uniquement via service_role côté serveur.

-- 2) Index du rate limiter (utile même si la table existait déjà)
create index if not exists idx_api_rate_limits_user_action_created
  on public.api_rate_limits (user_id, action, created_at desc);

-- 3) Rate limit atomique sous verrou transactionnel user+action.
create or replace function public.consume_api_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max integer,
  p_window_minutes integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_max integer := greatest(1, least(coalesce(p_max, 20), 10000));
  v_minutes integer := greatest(1, least(coalesce(p_window_minutes, 60), 1440));
begin
  if p_user_id is null or nullif(trim(p_action), '') is null then
    raise exception 'invalid rate-limit arguments';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_action));
  v_window_start := v_now - make_interval(mins => v_minutes);

  select count(*)::integer into v_count
  from public.api_rate_limits
  where user_id = p_user_id
    and action = p_action
    and created_at >= v_window_start;

  if v_count >= v_max then
    return query select false, 0, v_now + make_interval(mins => v_minutes);
    return;
  end if;

  insert into public.api_rate_limits(user_id, action, created_at)
  values (p_user_id, p_action, v_now);

  -- Purge opportuniste ; garde la table bornée sans cron supplémentaire.
  delete from public.api_rate_limits
  where created_at < v_now - interval '48 hours';

  return query select true, greatest(0, v_max - v_count - 1), v_now + make_interval(mins => v_minutes);
end;
$$;

revoke all on function public.consume_api_rate_limit(uuid,text,integer,integer) from public;
grant execute on function public.consume_api_rate_limit(uuid,text,integer,integer) to service_role;

-- 4) Incrément mensuel atomique pour scan / IA.
create or replace function public.increment_user_monthly_quota(
  p_user_id uuid,
  p_quota text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_reset timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  if p_user_id is null then
    raise exception 'missing user id';
  end if;
  if p_quota not in ('scan', 'ai_chat') then
    raise exception 'invalid quota';
  end if;

  insert into public.user_quotas(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if p_quota = 'scan' then
    update public.user_quotas
    set scan_count_month = case
          when scan_count_reset_at is null or scan_count_reset_at <= now() then 1
          else coalesce(scan_count_month, 0) + 1
        end,
        scan_count_reset_at = case
          when scan_count_reset_at is null or scan_count_reset_at <= now() then v_next_reset
          else scan_count_reset_at
        end,
        updated_at = now()
    where user_id = p_user_id;
  else
    update public.user_quotas
    set ai_chat_count_month = case
          when ai_chat_count_reset_at is null or ai_chat_count_reset_at <= now() then 1
          else coalesce(ai_chat_count_month, 0) + 1
        end,
        ai_chat_count_reset_at = case
          when ai_chat_count_reset_at is null or ai_chat_count_reset_at <= now() then v_next_reset
          else ai_chat_count_reset_at
        end,
        updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.increment_user_monthly_quota(uuid,text) from public;
grant execute on function public.increment_user_monthly_quota(uuid,text) to service_role;

commit;
