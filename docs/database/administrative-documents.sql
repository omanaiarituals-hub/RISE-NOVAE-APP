-- NOVAE - Module administratif V1
-- Ce fichier est un plan SQL de reference.
-- Ne pas executer en production sans validation finale.

-- Objectif :
-- Stocker les courriers/documents administratifs analyses par Nova,
-- sans creer automatiquement de tache, evenement ou rappel.
-- Toute action vers planner_events ou todo_list doit etre validee par l'utilisateur.

create table if not exists administrative_documents (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  title text,
  document_type text,
  sender text,
  received_date date,
  due_date date,
  amount numeric(12,2),
  currency text default 'EUR',

  action_required text,
  summary text,

  extracted_json jsonb,
  user_corrections jsonb,

  status text not null default 'draft',
  validation_status text not null default 'pending',

  storage_bucket text not null default 'administrative-documents',
  storage_path text,

  linked_todo_id uuid,
  linked_planner_event_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint administrative_documents_status_check
    check (status in ('draft', 'extracted', 'validated', 'archived', 'deleted')),

  constraint administrative_documents_validation_status_check
    check (validation_status in ('pending', 'confirmed', 'rejected'))
);

alter table administrative_documents enable row level security;

create policy "Users can read their own administrative documents"
on administrative_documents
for select
using (auth.uid() = user_id);

create policy "Users can insert their own administrative documents"
on administrative_documents
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own administrative documents"
on administrative_documents
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own administrative documents"
on administrative_documents
for delete
using (auth.uid() = user_id);

-- Storage bucket a creer cote Supabase :
-- Nom : administrative-documents
-- Public : false
--
-- Chemin recommande :
-- {user_id}/{document_id}/{timestamp}-document.jpg
--
-- Regle importante :
-- Ne jamais utiliser getPublicUrl() pour ces fichiers.
-- Utiliser uniquement des signed URLs temporaires cote serveur.
