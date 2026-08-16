-- NOVAÉ Finance — Patch 11.1 / Enable Banking read-only
-- Ajoute Enable Banking au contrat fournisseur existant.
-- Aucun paiement / virement / PIS n'est activé.

begin;

alter table public.finance_connections
  drop constraint if exists finance_connections_provider_check;

alter table public.finance_connections
  add constraint finance_connections_provider_check
  check (provider in ('powens','enable_banking','bridge','tink','disabled'));

alter table public.finance_provider_credentials
  drop constraint if exists finance_provider_credentials_provider_check;

alter table public.finance_provider_credentials
  add constraint finance_provider_credentials_provider_check
  check (provider in ('powens','enable_banking','bridge','tink'));

commit;
