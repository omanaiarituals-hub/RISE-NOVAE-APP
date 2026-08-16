-- NOVAÉ Finance — Patch 6.1
-- Unifie les calculs autour de 3 modes : spend, accumulate, repay.
begin;

alter table public.finance_envelopes
  add column if not exists tracking_mode text;
update public.finance_envelopes
set tracking_mode = case
  when envelope_type='debt' then 'repay'
  when envelope_type in ('cumulative','goal') then 'accumulate'
  else 'spend'
end
where tracking_mode is null;
alter table public.finance_envelopes alter column tracking_mode set default 'spend';
alter table public.finance_envelopes alter column tracking_mode set not null;
alter table public.finance_envelopes drop constraint if exists finance_envelopes_tracking_mode_check;
alter table public.finance_envelopes add constraint finance_envelopes_tracking_mode_check check (tracking_mode in ('spend','accumulate','repay'));

alter table public.finance_goals
  add column if not exists tracking_mode text,
  add column if not exists repayment_kind text,
  add column if not exists starting_balance numeric(14,2),
  add column if not exists target_balance numeric(14,2) not null default 0;
update public.finance_goals
set tracking_mode = case when goal_type in ('overdraft','debt') then 'repay' else 'accumulate' end
where tracking_mode is null;
alter table public.finance_goals alter column tracking_mode set default 'accumulate';
alter table public.finance_goals alter column tracking_mode set not null;
alter table public.finance_goals drop constraint if exists finance_goals_tracking_mode_check;
alter table public.finance_goals add constraint finance_goals_tracking_mode_check check (tracking_mode in ('spend','accumulate','repay'));
alter table public.finance_goals drop constraint if exists finance_goals_repayment_kind_check;
alter table public.finance_goals add constraint finance_goals_repayment_kind_check check (repayment_kind is null or repayment_kind in ('overdraft','debt','credit'));
update public.finance_goals set repayment_kind='overdraft' where goal_type='overdraft' and repayment_kind is null;
update public.finance_goals set repayment_kind='debt' where goal_type='debt' and repayment_kind is null;

alter table public.finance_user_profiles
  add column if not exists minimum_account_buffer numeric(14,2) not null default 0 check (minimum_account_buffer >= 0);

alter table public.finance_recurring_commitments drop constraint if exists finance_recurring_commitments_commitment_type_check;
alter table public.finance_recurring_commitments
  add constraint finance_recurring_commitments_commitment_type_check
  check (commitment_type in ('bill','subscription','installment','fixed_credit','rent','income','other'));

commit;
