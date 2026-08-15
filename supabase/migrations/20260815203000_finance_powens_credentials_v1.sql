-- NOVAÉ Finance — LOT 1 / Credentials Open Banking read-only
-- Aucun identifiant bancaire utilisateur n'est stocké ici.
-- Seul le jeton API fournisseur nécessaire à la synchronisation automatique est conservé chiffré côté serveur.

begin;

create table if not exists public.finance_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('powens','bridge','tink')),
  provider_user_id text,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.finance_provider_credentials enable row level security;
-- Volontairement AUCUNE policy client : service_role uniquement.

create index if not exists idx_finance_provider_credentials_provider_user
  on public.finance_provider_credentials(provider, provider_user_id);

commit;
