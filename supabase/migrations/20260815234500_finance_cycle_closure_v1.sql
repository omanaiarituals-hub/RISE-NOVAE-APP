-- NOVAÉ Finance — LOT 6
-- Clôture de cycle : reliquats, report, réaffectation vers épargne, snapshots et remise à zéro mensuelle.
-- Aucune transaction bancaire n'est exécutée par NOVAÉ.

begin;

alter table public.finance_envelopes
  add column if not exists carryover_amount numeric(14,2) not null default 0 check (carryover_amount >= 0);

alter table public.finance_cycle_closures
  add column if not exists cycle_start date,
  add column if not exists cycle_end date,
  add column if not exists total_remainder numeric(14,2) not null default 0,
  add column if not exists allocation_plan jsonb not null default '[]'::jsonb,
  add column if not exists envelopes_closed integer not null default 0;

create unique index if not exists idx_finance_cycle_closures_user_period_unique
  on public.finance_cycle_closures(user_id, cycle_start, cycle_end)
  where cycle_start is not null and cycle_end is not null;

create or replace function public.finance_close_budget_cycle(
  p_user_id uuid,
  p_cycle_start date,
  p_cycle_end date,
  p_actions jsonb default '[]'::jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure uuid;
  v_env record;
  v_action jsonb;
  v_action_type text;
  v_destination uuid;
  v_remainder numeric;
  v_total_remainder numeric := 0;
  v_savings_allocated numeric := 0;
  v_bank_remainder numeric := 0;
  v_count integer := 0;
  v_destination_type text;
  v_destination_cash boolean;
begin
  if p_cycle_start is null or p_cycle_end is null or p_cycle_end < p_cycle_start then
    raise exception 'invalid cycle period';
  end if;
  if jsonb_typeof(coalesce(p_actions,'[]'::jsonb)) <> 'array' then
    raise exception 'actions must be an array';
  end if;
  if exists (
    select 1 from public.finance_cycle_closures c
    where c.user_id=p_user_id and c.cycle_start=p_cycle_start and c.cycle_end=p_cycle_end
  ) then
    raise exception 'cycle already closed';
  end if;

  insert into public.finance_cycle_closures(
    user_id,cycle_start,cycle_end,bank_remainder,cash_remainder,savings_allocated,total_remainder,allocation_plan,envelopes_closed,note
  ) values (
    p_user_id,p_cycle_start,p_cycle_end,0,0,0,0,coalesce(p_actions,'[]'::jsonb),0,p_note
  ) returning id into v_closure;

  for v_env in
    select id,name,target_amount,current_amount,cash_balance,cash_enabled,rollover_enabled,carryover_amount
    from public.finance_envelopes
    where user_id=p_user_id and is_active=true and envelope_type='monthly'
    order by priority, created_at
    for update
  loop
    v_remainder := case
      when v_env.cash_enabled then greatest(0,coalesce(v_env.cash_balance,0))
      else greatest(0,coalesce(v_env.target_amount,0)-coalesce(v_env.current_amount,0))
    end;

    select value into v_action
    from jsonb_array_elements(coalesce(p_actions,'[]'::jsonb))
    where value->>'envelope_id'=v_env.id::text
    limit 1;

    v_action_type := coalesce(v_action->>'action', case when v_env.rollover_enabled then 'rollover' else 'leave' end);
    v_destination := null;
    if nullif(v_action->>'destination_envelope_id','') is not null then
      v_destination := (v_action->>'destination_envelope_id')::uuid;
    end if;

    if v_action_type not in ('leave','rollover','save','return_to_bank') then
      raise exception 'invalid closure action for envelope %', v_env.id;
    end if;
    if v_env.cash_enabled and v_action_type='leave' then
      v_action_type := 'rollover';
    end if;
    if not v_env.cash_enabled and v_action_type='return_to_bank' then
      v_action_type := 'leave';
    end if;

    if v_action_type='save' and v_remainder > 0 then
      if v_destination is null then raise exception 'savings destination required'; end if;
      select envelope_type,cash_enabled into v_destination_type,v_destination_cash
      from public.finance_envelopes
      where id=v_destination and user_id=p_user_id and is_active=true
      for update;
      if v_destination_type is null or v_destination_type not in ('cumulative','goal') then
        raise exception 'invalid savings destination';
      end if;

      update public.finance_envelopes
      set current_amount=current_amount+v_remainder,
          cash_balance=case when v_env.cash_enabled and v_destination_cash then cash_balance+v_remainder else cash_balance end,
          updated_at=now()
      where id=v_destination and user_id=p_user_id;

      if v_env.cash_enabled then
        update public.finance_envelopes
        set cash_balance=greatest(0,cash_balance-v_remainder),updated_at=now()
        where id=v_env.id and user_id=p_user_id;
      end if;

      insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values(p_user_id,v_env.id,'transfer_between_envelopes',-v_remainder,p_cycle_end,0,'Clôture du cycle',jsonb_build_object('closure_id',v_closure,'destination_envelope_id',v_destination,'semantic','cycle_remainder_transfer'));
      insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values(p_user_id,v_destination,'transfer_between_envelopes',v_remainder,p_cycle_end,0,'Reliquat reçu à la clôture',jsonb_build_object('closure_id',v_closure,'source_envelope_id',v_env.id,'semantic','cycle_remainder_savings'));

      v_savings_allocated := v_savings_allocated + v_remainder;
    elsif v_action_type='rollover' and v_remainder > 0 then
      update public.finance_envelopes
      set carryover_amount=v_remainder,updated_at=now()
      where id=v_env.id and user_id=p_user_id;
      insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values(p_user_id,v_env.id,'rollover',v_remainder,p_cycle_end,0,'Reliquat reporté au cycle suivant',jsonb_build_object('closure_id',v_closure,'semantic','cycle_rollover'));
    elsif v_action_type='return_to_bank' and v_remainder > 0 then
      update public.finance_envelopes
      set cash_balance=greatest(0,cash_balance-v_remainder),carryover_amount=0,updated_at=now()
      where id=v_env.id and user_id=p_user_id;
      insert into public.finance_manual_bank_movements(user_id,movement_type,bank_delta,occurred_on,status,note)
      values(p_user_id,'cash_return',v_remainder,p_cycle_end,'pending','Retour d’espèces au compte à la clôture');
      v_bank_remainder := v_bank_remainder + v_remainder;
    else
      update public.finance_envelopes
      set carryover_amount=0,updated_at=now()
      where id=v_env.id and user_id=p_user_id;
      if not v_env.cash_enabled then v_bank_remainder := v_bank_remainder + v_remainder; end if;
    end if;

    v_total_remainder := v_total_remainder + v_remainder;

    insert into public.finance_envelope_cycle_snapshots(
      user_id,envelope_id,cycle_start,cycle_end,target_amount,spent_amount,injected_amount,withdrawn_amount,remainder_amount,transferred_to_savings_amount
    ) values (
      p_user_id,v_env.id,p_cycle_start,p_cycle_end,coalesce(v_env.target_amount,0),coalesce(v_env.current_amount,0),0,0,v_remainder,
      case when v_action_type='save' then v_remainder else 0 end
    ) on conflict (envelope_id,cycle_start,cycle_end) do nothing;

    update public.finance_envelopes
    set current_amount=0,updated_at=now()
    where id=v_env.id and user_id=p_user_id;

    v_count := v_count + 1;
  end loop;

  update public.finance_cycle_closures
  set bank_remainder=v_bank_remainder,
      cash_remainder=(select coalesce(sum(cash_balance),0) from public.finance_envelopes where user_id=p_user_id and is_active=true and cash_enabled=true),
      savings_allocated=v_savings_allocated,
      total_remainder=v_total_remainder,
      envelopes_closed=v_count
  where id=v_closure;

  return v_closure;
end;
$$;

revoke all on function public.finance_close_budget_cycle(uuid,date,date,jsonb,text) from public,anon,authenticated;
grant execute on function public.finance_close_budget_cycle(uuid,date,date,jsonb,text) to service_role;

commit;
