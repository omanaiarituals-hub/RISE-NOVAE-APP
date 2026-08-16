-- NOVAÉ Finance — Patch 6.2
-- Les mouvements utilisent tracking_mode comme source de vérité.
-- spend = dépense ; accumulate = épargne ; repay = remboursement.
-- Aucun correctif destructif n'est appliqué aux anciens montants saisis manuellement.

begin;

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
  v_mode text;
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
    select tracking_mode into v_mode from public.finance_envelopes where id=v_envelope and user_id=p_user_id for update;

    update public.finance_envelopes
      set cash_balance = cash_balance + v_amount,
          current_amount = case when v_mode in ('accumulate','repay') then current_amount + v_amount else current_amount end,
          updated_at = now()
      where id = v_envelope and user_id = p_user_id;

    insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
      values (p_user_id,v_envelope,'cash_deposit',v_amount,coalesce(p_occurred_on,current_date),-v_amount,p_note,
        jsonb_build_object('manual_bank_movement_id',v_movement,'semantic','cash_funding','tracking_mode',v_mode));
  end loop;
  return v_movement;
end;
$$;

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
  v_current numeric;
  v_mode text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid expense amount'; end if;
  select cash_balance,current_amount,tracking_mode into v_cash,v_current,v_mode from public.finance_envelopes
    where id=p_envelope_id and user_id=p_user_id and is_active and cash_enabled for update;
  if v_cash is null then raise exception 'cash envelope not found'; end if;
  if v_cash < p_amount then raise exception 'insufficient envelope cash balance'; end if;
  if v_mode in ('accumulate','repay') and v_current < p_amount then raise exception 'insufficient tracked amount'; end if;

  update public.finance_envelopes
    set cash_balance = cash_balance - p_amount,
        current_amount = case
          when v_mode='spend' then current_amount + p_amount
          else current_amount - p_amount
        end,
        updated_at = now()
    where id=p_envelope_id and user_id=p_user_id;

  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
    values(p_user_id,p_envelope_id,'expense',p_amount,coalesce(p_occurred_on,current_date),0,p_note,
      jsonb_build_object('semantic','cash_expense','tracking_mode',v_mode))
    returning id into v_id;
  return v_id;
end;
$$;

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
  v_mode text;
  v_delta numeric;
  v_kind text;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid adjustment amount'; end if;
  if p_direction not in ('add','remove') then raise exception 'invalid direction'; end if;

  select current_amount,cash_balance,cash_enabled,tracking_mode
    into v_current,v_cash_balance,v_cash,v_mode
  from public.finance_envelopes
  where id=p_envelope_id and user_id=p_user_id and is_active for update;
  if v_current is null then raise exception 'envelope not found'; end if;

  v_delta := case when p_direction='add' then p_amount else -p_amount end;

  -- Pour une enveloppe Dépense physique, un retrait/retour bancaire ne change jamais le dépensé.
  if v_cash and v_mode='spend' and p_bank_effect then
    if p_direction='remove' and v_cash_balance < p_amount then raise exception 'insufficient envelope cash balance'; end if;
    update public.finance_envelopes set cash_balance=cash_balance+v_delta,updated_at=now()
      where id=p_envelope_id and user_id=p_user_id;
  else
    if p_direction='remove' and v_current < p_amount then raise exception 'insufficient envelope balance'; end if;
    update public.finance_envelopes set current_amount=current_amount+v_delta,updated_at=now()
      where id=p_envelope_id and user_id=p_user_id;
  end if;

  insert into public.finance_envelope_movements(user_id,envelope_id,movement_type,amount,occurred_on,bank_impact,note,metadata)
    values(p_user_id,p_envelope_id,'adjustment',v_delta,coalesce(p_occurred_on,current_date),
      case when p_bank_effect then -v_delta else 0 end,p_note,
      jsonb_build_object('direction',p_direction,'bank_effect',p_bank_effect,'tracking_mode',v_mode,'semantic',
        case when v_cash and v_mode='spend' and p_bank_effect then 'cash_balance' else 'progress' end))
    returning id into v_id;

  if p_bank_effect then
    v_kind := case
      when v_cash and v_mode='spend' and p_direction='add' then 'cash_withdrawal'
      when v_cash and v_mode='spend' and p_direction='remove' then 'cash_return'
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
