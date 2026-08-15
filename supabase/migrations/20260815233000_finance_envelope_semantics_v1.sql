-- NOVAÉ Finance — PATCH 5.1
-- Sépare la progression d'une enveloppe (dépensé / injecté / remboursé)
-- du cash physique restant. Prépare aussi l'historique de clôture par cycle.

begin;

alter table public.finance_envelopes
  add column if not exists cash_balance numeric(14,2) not null default 0 check (cash_balance >= 0);

-- Compatibilité avec les premiers tests du lot 5 : pour les enveloppes physiques
-- mensuelles/temporaire, current_amount représentait encore le cash disponible.
-- On le déplace une seule fois vers cash_balance afin que current_amount puisse
-- désormais signifier "dépensé ce cycle".
update public.finance_envelopes
set cash_balance = current_amount,
    current_amount = 0,
    updated_at = now()
where cash_enabled = true
  and envelope_type in ('monthly','temporary')
  and cash_balance = 0
  and current_amount > 0;

create table if not exists public.finance_envelope_cycle_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  envelope_id uuid not null,
  cycle_start date not null,
  cycle_end date not null,
  target_amount numeric(14,2) not null default 0,
  spent_amount numeric(14,2) not null default 0,
  injected_amount numeric(14,2) not null default 0,
  withdrawn_amount numeric(14,2) not null default 0,
  remainder_amount numeric(14,2) not null default 0,
  transferred_to_savings_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  foreign key (envelope_id, user_id) references public.finance_envelopes(id, user_id) on delete cascade,
  unique (envelope_id, cycle_start, cycle_end)
);

create index if not exists idx_finance_envelope_cycle_snapshots_user_year
  on public.finance_envelope_cycle_snapshots(user_id, cycle_end desc);

alter table public.finance_envelope_cycle_snapshots enable row level security;
drop policy if exists "Finance envelope snapshots own read" on public.finance_envelope_cycle_snapshots;
create policy "Finance envelope snapshots own read" on public.finance_envelope_cycle_snapshots
for select to authenticated using (auth.uid() = user_id);

-- Retrait DAB : le compte baisse une fois, le cash physique monte.
-- Pour une enveloppe d'épargne/dette en cash, l'injection augmente aussi la progression.
create or replace function public.finance_apply_cash_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_allocations jsonb,
  p_occurred_on date default current_date,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_item jsonb;
  v_envelope uuid;
  v_amount numeric;
  v_movement uuid;
  v_type text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid withdrawal amount'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then raise exception 'allocations required'; end if;

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    v_envelope := (v_item->>'envelope_id')::uuid;
    v_amount := (v_item->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then raise exception 'invalid allocation'; end if;
    if not exists (
      select 1 from public.finance_envelopes e
      where e.id = v_envelope and e.user_id = p_user_id and e.is_active and e.cash_enabled
    ) then raise exception 'invalid cash envelope'; end if;
    v_total := v_total + v_amount;
  end loop;

  if abs(v_total - p_amount) > 0.009 then raise exception 'allocations must equal withdrawal amount'; end if;

  insert into public.finance_manual_bank_movements(user_id,movement_type,bank_delta,occurred_on,note)
  values (p_user_id,'cash_withdrawal',-p_amount,coalesce(p_occurred_on,current_date),p_note)
  returning id into v_movement;

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    v_envelope := (v_item->>'envelope_id')::uuid;
    v_amount := (v_item->>'amount')::numeric;
    select envelope_type into v_type from public.finance_envelopes where id=v_envelope and user_id=p_user_id for update;

    update public.finance_envelopes
      set cash_balance = cash_balance + v_amount,
          current_amount = case when v_type in ('goal','cumulative','debt') then current_amount + v_amount else current_amount end,
          updated_at = now()
      where id = v_envelope and user_id = p_user_id;

    insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values (p_user_id,v_envelope,'cash_deposit',v_amount,coalesce(p_occurred_on,current_date),-v_amount,p_note,
        jsonb_build_object('manual_bank_movement_id',v_movement,'semantic','cash_funding'));
  end loop;
  return v_movement;
end;
$$;

-- Dépense cash : le compte ne bouge pas une seconde fois.
-- Mensuelle/temporaire => dépensé ce cycle augmente.
-- Épargne/cumulative/dette => le montant constitué diminue.
create or replace function public.finance_apply_cash_expense(
  p_user_id uuid,
  p_envelope_id uuid,
  p_amount numeric,
  p_occurred_on date default current_date,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cash numeric;
  v_type text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid expense amount'; end if;
  select cash_balance,envelope_type into v_cash,v_type from public.finance_envelopes
    where id=p_envelope_id and user_id=p_user_id and is_active and cash_enabled for update;
  if v_cash is null then raise exception 'cash envelope not found'; end if;
  if v_cash < p_amount then raise exception 'insufficient envelope cash balance'; end if;

  update public.finance_envelopes
    set cash_balance = cash_balance - p_amount,
        current_amount = case
          when v_type in ('monthly','temporary') then current_amount + p_amount
          else greatest(0,current_amount - p_amount)
        end,
        updated_at = now()
    where id=p_envelope_id and user_id=p_user_id;

  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
    values(p_user_id,p_envelope_id,'expense',p_amount,coalesce(p_occurred_on,current_date),0,p_note,
      jsonb_build_object('semantic','cash_expense'))
    returning id into v_id;
  return v_id;
end;
$$;

-- Ajustement :
-- * enveloppe physique mensuelle + effet banque => alimente/retourne du cash sans modifier "dépensé";
-- * mensuelle sans effet banque => correction manuelle du dépensé;
-- * épargne/objectif/dette => modifie le montant constitué/remboursé.
create or replace function public.finance_adjust_envelope(
  p_user_id uuid,
  p_envelope_id uuid,
  p_amount numeric,
  p_direction text,
  p_bank_effect boolean default false,
  p_occurred_on date default current_date,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_current numeric;
  v_cash_balance numeric;
  v_cash boolean;
  v_type text;
  v_delta numeric;
  v_kind text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid adjustment amount'; end if;
  if p_direction not in ('add','remove') then raise exception 'invalid direction'; end if;

  select current_amount,cash_balance,cash_enabled,envelope_type
    into v_current,v_cash_balance,v_cash,v_type
  from public.finance_envelopes
  where id=p_envelope_id and user_id=p_user_id and is_active for update;
  if v_current is null then raise exception 'envelope not found'; end if;

  v_delta := case when p_direction='add' then p_amount else -p_amount end;

  if v_cash and v_type in ('monthly','temporary') and p_bank_effect then
    if p_direction='remove' and v_cash_balance < p_amount then raise exception 'insufficient envelope cash balance'; end if;
    update public.finance_envelopes
      set cash_balance = cash_balance + v_delta, updated_at=now()
      where id=p_envelope_id and user_id=p_user_id;
  else
    if p_direction='remove' and v_current < p_amount then raise exception 'insufficient envelope balance'; end if;
    update public.finance_envelopes
      set current_amount = current_amount + v_delta, updated_at=now()
      where id=p_envelope_id and user_id=p_user_id;
  end if;

  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
    values(p_user_id,p_envelope_id,'adjustment',v_delta,coalesce(p_occurred_on,current_date),
      case when p_bank_effect then -v_delta else 0 end,p_note,
      jsonb_build_object('direction',p_direction,'bank_effect',p_bank_effect,'semantic',
        case when v_cash and v_type in ('monthly','temporary') and p_bank_effect then 'cash_balance' else 'progress' end))
    returning id into v_id;

  if p_bank_effect then
    v_kind := case
      when v_cash and v_type in ('monthly','temporary') and p_direction='add' then 'cash_withdrawal'
      when v_cash and v_type in ('monthly','temporary') and p_direction='remove' then 'cash_return'
      when p_direction='add' then 'savings_transfer'
      else 'manual_adjustment'
    end;
    insert into public.finance_manual_bank_movements(user_id,movement_type,bank_delta,occurred_on,note)
      values(p_user_id,v_kind,-v_delta,coalesce(p_occurred_on,current_date),p_note);
  end if;

  return v_id;
end;
$$;

revoke all on function public.finance_apply_cash_withdrawal(uuid,numeric,jsonb,date,text) from public,anon,authenticated;
revoke all on function public.finance_apply_cash_expense(uuid,uuid,numeric,date,text) from public,anon,authenticated;
revoke all on function public.finance_adjust_envelope(uuid,uuid,numeric,text,boolean,date,text) from public,anon,authenticated;
grant execute on function public.finance_apply_cash_withdrawal(uuid,numeric,jsonb,date,text) to service_role;
grant execute on function public.finance_apply_cash_expense(uuid,uuid,numeric,date,text) to service_role;
grant execute on function public.finance_adjust_envelope(uuid,uuid,numeric,text,boolean,date,text) to service_role;

commit;
