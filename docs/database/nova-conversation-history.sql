-- NOVA V2 : historique privé des conversations
-- À exécuter dans Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.nova_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.nova_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.nova_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nova_conversations_user_last_message_idx
  on public.nova_conversations(user_id, last_message_at desc);

create index if not exists nova_conversation_messages_conversation_created_idx
  on public.nova_conversation_messages(conversation_id, created_at asc);

alter table public.nova_conversations enable row level security;
alter table public.nova_conversation_messages enable row level security;

 drop policy if exists "nova_conversations_select_own" on public.nova_conversations;
create policy "nova_conversations_select_own"
  on public.nova_conversations for select
  using (auth.uid() = user_id);

 drop policy if exists "nova_conversations_insert_own" on public.nova_conversations;
create policy "nova_conversations_insert_own"
  on public.nova_conversations for insert
  with check (auth.uid() = user_id);

 drop policy if exists "nova_conversations_update_own" on public.nova_conversations;
create policy "nova_conversations_update_own"
  on public.nova_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

 drop policy if exists "nova_conversations_delete_own" on public.nova_conversations;
create policy "nova_conversations_delete_own"
  on public.nova_conversations for delete
  using (auth.uid() = user_id);

 drop policy if exists "nova_messages_select_own" on public.nova_conversation_messages;
create policy "nova_messages_select_own"
  on public.nova_conversation_messages for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.nova_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

 drop policy if exists "nova_messages_insert_own" on public.nova_conversation_messages;
create policy "nova_messages_insert_own"
  on public.nova_conversation_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.nova_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

 drop policy if exists "nova_messages_delete_own" on public.nova_conversation_messages;
create policy "nova_messages_delete_own"
  on public.nova_conversation_messages for delete
  using (auth.uid() = user_id);

comment on table public.nova_conversations is 'Conversations privées de Nova V2, séparées des données métier.';
comment on table public.nova_conversation_messages is 'Messages privés des conversations Nova V2. La suppression d’une conversation ne supprime pas les tâches ou rappels déjà créés.';
