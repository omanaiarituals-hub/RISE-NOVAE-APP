-- NOVAÉ Finance — LOT 0 / Fondations V1
-- 2026-08-15
-- Principes :
-- - Open Banking en LECTURE SEULE uniquement.
-- - Aucun identifiant bancaire (login/mot de passe) n'est stocké dans NOVAÉ.
-- - Les données bancaires brutes synchronisées restent immuables côté client.
-- - Les corrections utilisateur sont stockées séparément des transactions source.
-- - RLS stricte par utilisatrice.
-- - Les événements webhook ne stockent jamais le payload bancaire brut.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Connexions et comptes synchronisés (écriture serveur uniquement)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('powens','bridge','tink','disabled')),
  provider_user_id text,
  provider_connection_id text not null,
  institution_name text,
  status text not null default 'pending',
  last_synced_at timestamptz,
  consent_expires_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_connection_id)
);

create index if not exists idx_finance_connections_user
  on public.finance_connections(user_id, created_at desc);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  connection_id uuid not null references public.finance_connections(id) on delete cascade,
  provider_account_id text not null,
  name text not null,
  account_type text,
  currency text not null default 'EUR',
  balance numeric(14,2),
  available_balance numeric(14,2),
  masked_identifier text,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_account_id)
);

create index if not exists idx_finance_accounts_user
  on public.finance_accounts(user_id, is_active, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Catégories : catalogue NOVAÉ + catégories personnelles
-- ---------------------------------------------------------------------------
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  slug text not null,
  name text not null,
  parent_slug text,
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_finance_system_category_slug
  on public.finance_categories(slug)
  where user_id is null;

create unique index if not exists uq_finance_user_category_slug
  on public.finance_categories(user_id, slug)
  where user_id is not null;

insert into public.finance_categories(user_id, slug, name, sort_order, is_system)
select null, v.slug, v.name, v.sort_order, true
from (values
  ('housing','Logement',10),
  ('groceries','Courses & alimentation',20),
  ('children','Enfants',30),
  ('health','Santé',40),
  ('transport','Transport',50),
  ('leisure','Loisirs',60),
  ('shopping','Shopping',70),
  ('tobacco','Tabac',80),
  ('subscriptions','Abonnements',90),
  ('professional','Professionnel',100),
  ('travel','Voyage',110),
  ('savings','Épargne',120),
  ('debt','Dette / découvert',130),
  ('cash','Espèces',140),
  ('other','Autre',999)
) as v(slug, name, sort_order)
where not exists (
  select 1 from public.finance_categories c
  where c.user_id is null and c.slug = v.slug
);

-- ---------------------------------------------------------------------------
-- 3. Transactions source + annotations utilisateur séparées
-- ---------------------------------------------------------------------------
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid not null references public.finance_accounts(id) on delete cascade,
  provider_transaction_id text not null,
  transaction_date date not null,
  value_date date,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  raw_label text,
  merchant_name text,
  direction text not null check (direction in ('credit','debit')),
  provider_category text,
  provider_metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider_transaction_id),
  unique (id, user_id)
);

create index if not exists idx_finance_transactions_user_date
  on public.finance_transactions(user_id, transaction_date desc, created_at desc);
create index if not exists idx_finance_transactions_account_date
  on public.finance_transactions(account_id, transaction_date desc);

create table if not exists public.finance_transaction_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  transaction_id uuid not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  financial_nature text not null default 'expense' check (financial_nature in (
    'income','expense','internal_transfer','third_party_advance','refund',
    'reimbursable_expense','exceptional_expense','installment','subscription',
    'cash_withdrawal','cash_expense'
  )),
  is_recurring boolean not null default false,
  is_subscription boolean not null default false,
  is_installment boolean not null default false,
  is_exceptional boolean not null default false,
  is_reimbursable boolean not null default false,
  is_internal_transfer boolean not null default false,
  confidence_score numeric(4,3) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  user_corrected boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transaction_id),
  foreign key (transaction_id, user_id) references public.finance_transactions(id, user_id) on delete cascade
);

create index if not exists idx_finance_annotations_user
  on public.finance_transaction_annotations(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 4. Mémoire marchands / règles personnelles
-- ---------------------------------------------------------------------------
create table if not exists public.finance_merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  merchant_pattern text not null,
  normalized_merchant text,
  category_id uuid references public.finance_categories(id) on delete set null,
  financial_nature text check (financial_nature is null or financial_nature in (
    'income','expense','internal_transfer','third_party_advance','refund',
    'reimbursable_expense','exceptional_expense','installment','subscription',
    'cash_withdrawal','cash_expense'
  )),
  envelope_id uuid,
  confidence numeric(4,3) not null default 1 check (confidence >= 0 and confidence <= 1),
  source text not null default 'user' check (source in ('user','nova','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_pattern)
);

-- ---------------------------------------------------------------------------
-- 5. Profil financier et cycles de paie
-- ---------------------------------------------------------------------------
create table if not exists public.finance_user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  income_frequency text not null default 'monthly',
  usual_income_day smallint check (usual_income_day is null or usual_income_day between 1 and 31),
  usual_net_income numeric(14,2),
  current_overdraft numeric(14,2) not null default 0,
  overdraft_limit numeric(14,2) not null default 0,
  cash_mode text not null default 'mixed' check (cash_mode in ('card','mixed','envelopes','card_free')),
  analysis_period_months smallint not null default 3 check (analysis_period_months between 1 and 24),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_budget_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  income_date date,
  expected_income numeric(14,2),
  actual_income numeric(14,2),
  status text not null default 'planned' check (status in ('planned','active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (user_id, start_date, end_date)
);

create index if not exists idx_finance_budget_cycles_user_dates
  on public.finance_budget_cycles(user_id, start_date desc, end_date desc);

-- ---------------------------------------------------------------------------
-- 6. Enveloppes et mouvements (numérique + espèces physiques)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_envelopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  envelope_type text not null check (envelope_type in ('monthly','cumulative','goal','debt','temporary')),
  category_id uuid references public.finance_categories(id) on delete set null,
  target_amount numeric(14,2) not null default 0,
  current_amount numeric(14,2) not null default 0,
  rollover_enabled boolean not null default false,
  cash_enabled boolean not null default false,
  priority smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists idx_finance_envelopes_user_active
  on public.finance_envelopes(user_id, is_active, priority, created_at);

alter table public.finance_merchant_rules
  drop constraint if exists finance_merchant_rules_envelope_fk;
alter table public.finance_merchant_rules
  add constraint finance_merchant_rules_envelope_fk
  foreign key (envelope_id, user_id) references public.finance_envelopes(id, user_id) on delete set null;

create table if not exists public.finance_envelope_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  envelope_id uuid not null,
  movement_type text not null check (movement_type in (
    'allocation','expense','cash_withdrawal','cash_deposit',
    'transfer_between_envelopes','adjustment','rollover'
  )),
  amount numeric(14,2) not null,
  transaction_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (envelope_id, user_id) references public.finance_envelopes(id, user_id) on delete cascade,
  foreign key (transaction_id, user_id) references public.finance_transactions(id, user_id) on delete set null
);

create index if not exists idx_finance_envelope_movements_user_date
  on public.finance_envelope_movements(user_id, created_at desc);
create index if not exists idx_finance_envelope_movements_envelope_date
  on public.finance_envelope_movements(envelope_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Objectifs, engagements récurrents et insights
-- ---------------------------------------------------------------------------
create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in ('overdraft','emergency_fund','travel','project','debt','savings','custom')),
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  target_date date,
  priority smallint not null default 100,
  monthly_target numeric(14,2),
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_goals_user_priority
  on public.finance_goals(user_id, status, priority, created_at);

create table if not exists public.finance_recurring_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  commitment_type text not null check (commitment_type in ('bill','subscription','installment','rent','income','other')),
  amount numeric(14,2) not null,
  frequency text not null default 'monthly',
  next_due_date date,
  end_date date,
  category_id uuid references public.finance_categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_commitments_user_due
  on public.finance_recurring_commitments(user_id, is_active, next_due_date);

create table if not exists public.finance_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  insight_type text not null,
  title text not null,
  summary text not null,
  period_start date,
  period_end date,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  expires_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_insights_user_active
  on public.finance_insights(user_id, created_at desc)
  where dismissed_at is null;

-- ---------------------------------------------------------------------------
-- 8. Idempotence webhooks — aucune donnée bancaire brute dans cette table
-- ---------------------------------------------------------------------------
create table if not exists public.finance_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','failed')),
  error_code text,
  unique (provider, provider_event_id)
);

create index if not exists idx_finance_webhook_receipts_received
  on public.finance_webhook_receipts(received_at desc);

-- ---------------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------------
alter table public.finance_connections enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_transaction_annotations enable row level security;
alter table public.finance_merchant_rules enable row level security;
alter table public.finance_user_profiles enable row level security;
alter table public.finance_budget_cycles enable row level security;
alter table public.finance_envelopes enable row level security;
alter table public.finance_envelope_movements enable row level security;
alter table public.finance_goals enable row level security;
alter table public.finance_recurring_commitments enable row level security;
alter table public.finance_insights enable row level security;
alter table public.finance_webhook_receipts enable row level security;

-- Données Open Banking source : lecture par propriétaire, écriture uniquement serveur.
drop policy if exists "Finance connections owner read" on public.finance_connections;
create policy "Finance connections owner read" on public.finance_connections
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Finance accounts owner read" on public.finance_accounts;
create policy "Finance accounts owner read" on public.finance_accounts
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Finance transactions owner read" on public.finance_transactions;
create policy "Finance transactions owner read" on public.finance_transactions
for select to authenticated using (auth.uid() = user_id);

-- Catégories système visibles par toutes les personnes authentifiées ; catégories perso isolées.
drop policy if exists "Finance categories read" on public.finance_categories;
create policy "Finance categories read" on public.finance_categories
for select to authenticated using (user_id is null or auth.uid() = user_id);

drop policy if exists "Finance categories own insert" on public.finance_categories;
create policy "Finance categories own insert" on public.finance_categories
for insert to authenticated with check (auth.uid() = user_id and is_system = false);

drop policy if exists "Finance categories own update" on public.finance_categories;
create policy "Finance categories own update" on public.finance_categories
for update to authenticated using (auth.uid() = user_id and is_system = false)
with check (auth.uid() = user_id and is_system = false);

drop policy if exists "Finance categories own delete" on public.finance_categories;
create policy "Finance categories own delete" on public.finance_categories
for delete to authenticated using (auth.uid() = user_id and is_system = false);

-- Tables utilisateur CRUD.
do $$
declare
  t text;
begin
  foreach t in array array[
    'finance_transaction_annotations',
    'finance_merchant_rules',
    'finance_budget_cycles',
    'finance_envelopes',
    'finance_envelope_movements',
    'finance_goals',
    'finance_recurring_commitments'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || ' own select', t);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', t || ' own select', t);
    execute format('drop policy if exists %I on public.%I', t || ' own insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', t || ' own insert', t);
    execute format('drop policy if exists %I on public.%I', t || ' own update', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || ' own update', t);
    execute format('drop policy if exists %I on public.%I', t || ' own delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', t || ' own delete', t);
  end loop;
end $$;

-- Profil financier : CRUD sur sa propre ligne.
drop policy if exists "Finance profile own select" on public.finance_user_profiles;
create policy "Finance profile own select" on public.finance_user_profiles
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Finance profile own insert" on public.finance_user_profiles;
create policy "Finance profile own insert" on public.finance_user_profiles
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Finance profile own update" on public.finance_user_profiles;
create policy "Finance profile own update" on public.finance_user_profiles
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Finance profile own delete" on public.finance_user_profiles;
create policy "Finance profile own delete" on public.finance_user_profiles
for delete to authenticated using (auth.uid() = user_id);

-- Insights : lecture + possibilité de masquer/supprimer ses insights. Création serveur uniquement.
drop policy if exists "Finance insights owner read" on public.finance_insights;
create policy "Finance insights owner read" on public.finance_insights
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Finance insights owner update" on public.finance_insights;
create policy "Finance insights owner update" on public.finance_insights
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Finance insights owner delete" on public.finance_insights;
create policy "Finance insights owner delete" on public.finance_insights
for delete to authenticated using (auth.uid() = user_id);

-- Aucun accès client aux reçus webhook.
-- service_role contourne RLS pour le traitement serveur.

commit;
