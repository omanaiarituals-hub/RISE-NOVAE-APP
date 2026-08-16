-- NOVAÉ Finance — LOT 8 / Intelligence transactionnelle V1
-- Moteur déterministe : catégorisation, récurrences, règles marchands et synthèses.

begin;

alter table public.finance_transaction_annotations
  add column if not exists normalized_merchant text,
  add column if not exists analysis_source text not null default 'system',
  add column if not exists analysis_version text,
  add column if not exists analysis_reason text;

alter table public.finance_transaction_annotations
  drop constraint if exists finance_transaction_annotations_analysis_source_check;
alter table public.finance_transaction_annotations
  add constraint finance_transaction_annotations_analysis_source_check
  check (analysis_source in ('system','merchant_rule','user'));

alter table public.finance_merchant_rules
  add column if not exists apply_count integer not null default 0,
  add column if not exists last_applied_at timestamptz;

alter table public.finance_recurring_commitments
  add column if not exists source text not null default 'user',
  add column if not exists detection_key text,
  add column if not exists confidence numeric(4,3),
  add column if not exists last_detected_at timestamptz;

alter table public.finance_recurring_commitments
  drop constraint if exists finance_recurring_commitments_source_check;
alter table public.finance_recurring_commitments
  add constraint finance_recurring_commitments_source_check
  check (source in ('user','transaction_engine','nova'));

alter table public.finance_recurring_commitments
  drop constraint if exists finance_recurring_commitments_detection_key_unique;
alter table public.finance_recurring_commitments
  add constraint finance_recurring_commitments_detection_key_unique unique (user_id, detection_key);

alter table public.finance_insights
  add column if not exists source text not null default 'system',
  add column if not exists analysis_version text;

create index if not exists idx_finance_annotations_nature
  on public.finance_transaction_annotations(user_id, financial_nature, is_recurring);
create index if not exists idx_finance_annotations_category
  on public.finance_transaction_annotations(user_id, category_id);

commit;
