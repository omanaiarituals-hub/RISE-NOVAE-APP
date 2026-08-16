alter table public.finance_accounts
  add column if not exists custom_name text,
  add column if not exists user_enabled boolean not null default true;

create index if not exists idx_finance_accounts_user_enabled
  on public.finance_accounts(user_id, user_enabled, is_active, created_at desc);
