-- NOVAÉ Finance — LOT 5
-- Espèces physiques, solde prévisionnel, provisions, recalibrage et clôture de cycle.
-- Aucun paiement ni virement n'est initié : les mouvements bancaires manuels ne sont que des écritures de prévision/reconciliation.

begin;

alter table public.finance_user_profiles
  add column if not exists manual_bank_balance numeric(14,2),
  add column if not exists safety_floor numeric(14,2) not null default 0,
  add column if not exists close_cycle_mode text not null default 'manual';

alter table public.finance_user_profiles
  drop constraint if exists finance_user_profiles_close_cycle_mode_check;
alter table public.finance_user_profiles
  add constraint finance_user_profiles_close_cycle_mode_check
  check (close_cycle_mode in ('manual','savings','leave'));

alter table public.finance_envelope_movements
  add column if not exists occurred_on date not null default current_date,
  add column if not exists bank_impact numeric(14,2) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.finance_manual_bank_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid references public.finance_accounts(id) on delete set null,
  movement_type text not null check (movement_type in ('cash_withdrawal','savings_transfer','cash_return','manual_adjustment')),
  bank_delta numeric(14,2) not null,
  occurred_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending','matched','cancelled')),
  matched_transaction_id uuid references public.finance_transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_manual_bank_movements_user_status
  on public.finance_manual_bank_movements(user_id, status, occurred_on desc);

create table if not exists public.finance_future_provisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_reserved numeric(14,2) not null default 0 check (current_reserved >= 0),
  due_date date,
  monthly_amount numeric(14,2) not null default 0 check (monthly_amount >= 0),
  envelope_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (envelope_id, user_id) references public.finance_envelopes(id, user_id) on delete set null
);

create index if not exists idx_finance_future_provisions_user_due
  on public.finance_future_provisions(user_id, is_active, due_date);

create table if not exists public.finance_cycle_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_id uuid references public.finance_budget_cycles(id) on delete set null,
  bank_remainder numeric(14,2) not null default 0,
  cash_remainder numeric(14,2) not null default 0,
  savings_allocated numeric(14,2) not null default 0,
  note text,
  closed_at timestamptz not null default now()
);

create index if not exists idx_finance_cycle_closures_user
  on public.finance_cycle_closures(user_id, closed_at desc);

alter table public.finance_manual_bank_movements enable row level security;
alter table public.finance_future_provisions enable row level security;
alter table public.finance_cycle_closures enable row level security;

drop policy if exists "Finance manual bank movements own read" on public.finance_manual_bank_movements;
create policy "Finance manual bank movements own read" on public.finance_manual_bank_movements
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Finance future provisions own CRUD" on public.finance_future_provisions;
create policy "Finance future provisions own CRUD" on public.finance_future_provisions
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Finance cycle closures own CRUD" on public.finance_cycle_closures;
create policy "Finance cycle closures own CRUD" on public.finance_cycle_closures
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Retrait physique atomique : baisse prévisionnelle du compte + alimentation des enveloppes cash.
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
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid withdrawal amount';
  end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocations required';
  end if;

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

  if abs(v_total - p_amount) > 0.009 then
    raise exception 'allocations must equal withdrawal amount';
  end if;

  insert into public.finance_manual_bank_movements(user_id,movement_type,bank_delta,occurred_on,note)
  values (p_user_id,'cash_withdrawal',-p_amount,coalesce(p_occurred_on,current_date),p_note)
  returning id into v_movement;

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    v_envelope := (v_item->>'envelope_id')::uuid;
    v_amount := (v_item->>'amount')::numeric;
    update public.finance_envelopes
      set current_amount = current_amount + v_amount, updated_at = now()
      where id = v_envelope and user_id = p_user_id;
    insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values (p_user_id,v_envelope,'cash_deposit',v_amount,coalesce(p_occurred_on,current_date),-v_amount,p_note,jsonb_build_object('manual_bank_movement_id',v_movement));
  end loop;
  return v_movement;
end;
$$;

-- Dépense cash : uniquement l'enveloppe diminue. Le compte bancaire ne bouge pas une seconde fois.
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
  v_current numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid expense amount'; end if;
  select current_amount into v_current from public.finance_envelopes
    where id=p_envelope_id and user_id=p_user_id and is_active and cash_enabled for update;
  if v_current is null then raise exception 'cash envelope not found'; end if;
  if v_current < p_amount then raise exception 'insufficient envelope balance'; end if;
  update public.finance_envelopes set current_amount=current_amount-p_amount,updated_at=now()
    where id=p_envelope_id and user_id=p_user_id;
  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note)
    values(p_user_id,p_envelope_id,'expense',p_amount,coalesce(p_occurred_on,current_date),0,p_note)
    returning id into v_id;
  return v_id;
end;
$$;

-- Ajustement volontaire d'une enveloppe. bank_delta n'est utilisé que si l'argent quitte/revient réellement au compte.
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
  v_cash boolean;
  v_delta numeric;
  v_kind text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid adjustment amount'; end if;
  if p_direction not in ('add','remove') then raise exception 'invalid direction'; end if;
  select current_amount,cash_enabled into v_current,v_cash from public.finance_envelopes
    where id=p_envelope_id and user_id=p_user_id and is_active for update;
  if v_current is null then raise exception 'envelope not found'; end if;
  if p_direction='remove' and v_current < p_amount then raise exception 'insufficient envelope balance'; end if;
  v_delta := case when p_direction='add' then p_amount else -p_amount end;
  update public.finance_envelopes set current_amount=current_amount+v_delta,updated_at=now()
    where id=p_envelope_id and user_id=p_user_id;
  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
    values(p_user_id,p_envelope_id,'adjustment',v_delta,coalesce(p_occurred_on,current_date),
      case when p_bank_effect then -v_delta else 0 end,p_note,
      jsonb_build_object('direction',p_direction,'bank_effect',p_bank_effect))
    returning id into v_id;
  if p_bank_effect then
    v_kind := case when p_direction='add' and v_cash then 'cash_withdrawal'
                   when p_direction='remove' and v_cash then 'cash_return'
                   when p_direction='add' then 'savings_transfer'
                   else 'manual_adjustment' end;
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
