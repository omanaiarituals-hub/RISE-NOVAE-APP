-- NOVAÉ — LOT 1B sécurité critique / palier 100
-- 2026-08-11
-- Objectifs :
-- 1) Empêcher un utilisateur authentifié de modifier ses champs de facturation
--    dans public.users, tout en conservant les mises à jour de profil existantes.
-- 2) Fermer la lecture cross-user de toutes les colonnes de ai_personality_profile.
--
-- IMPORTANT : le backend service_role (Stripe, admin serveur) conserve ses droits.

begin;

-- ---------------------------------------------------------------------------
-- 1. USERS : protection des champs sensibles au niveau DB
-- ---------------------------------------------------------------------------
-- La policy historique autorise UPDATE de sa propre ligne entière.
-- RLS filtre les LIGNES, pas les COLONNES. Un trigger DB protège donc les champs
-- de billing même si un client appelle directement Supabase depuis le navigateur.

create or replace function public.novae_protect_users_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Les opérations serveur de confiance doivent pouvoir gérer Stripe / Premium.
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Comportement actuel de NOVAÉ : tout nouveau compte commence en trial 14 j.
    -- Surtout : impossible de s'insérer directement en premium ou de choisir
    -- un stripe_customer_id / une date d'essai arbitraire depuis le client.
    new.subscription_tier := 'trial';
    new.subscription_status := 'active';
    new.stripe_customer_id := null;
    new.trial_ends_at := now() + interval '14 days';
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Champs immuables depuis une session utilisateur normale.
    new.id := old.id;
    new.email := old.email;
    new.subscription_tier := old.subscription_tier;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.trial_ends_at := old.trial_ends_at;
  end if;

  return new;
end;
$$;

revoke all on function public.novae_protect_users_sensitive_fields() from public;

-- Le trigger est la barrière de colonnes. Il protège aussi l'INSERT initial.
drop trigger if exists trg_novae_protect_users_sensitive_fields on public.users;
create trigger trg_novae_protect_users_sensitive_fields
before insert or update on public.users
for each row
execute function public.novae_protect_users_sensitive_fields();

-- On rend en plus la policy UPDATE explicite et stricte sur l'identité de ligne.
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile"
on public.users
for update
to public
using (auth.uid() = id)
with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. AI PERSONALITY PROFILE : fermeture de la lecture globale
-- ---------------------------------------------------------------------------
-- Cette policy SELECT true exposait toutes les colonnes de la table, pas seulement
-- pseudo. La communauté utilise déjà public.community_profiles pour lire les
-- pseudos des autres utilisatrices.
drop policy if exists "Lecture publique des pseudos" on public.ai_personality_profile;

commit;
