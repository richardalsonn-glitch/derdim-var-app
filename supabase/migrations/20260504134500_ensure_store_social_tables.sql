create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists is_frozen boolean not null default false,
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean not null default false;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  receiver_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_no_self_check check (requester_id <> receiver_id)
);

create unique index if not exists friendships_pair_unique_idx
  on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null,
  user2_id uuid not null,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_threads_no_self_check check (user1_id <> user2_id)
);

create unique index if not exists chat_threads_pair_unique_idx
  on public.chat_threads (least(user1_id, user2_id), greatest(user1_id, user2_id));

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null,
  receiver_id uuid not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_at_idx
  on public.chat_messages (thread_id, created_at);

create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  receiver_id uuid not null,
  gift_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists gift_transactions_sender_idx
  on public.gift_transactions (sender_id, created_at desc);

create index if not exists gift_transactions_receiver_idx
  on public.gift_transactions (receiver_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.gift_transactions enable row level security;

drop policy if exists "friendships participants read" on public.friendships;
create policy "friendships participants read"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = receiver_id);

drop policy if exists "friendships requester insert" on public.friendships;
create policy "friendships requester insert"
on public.friendships for insert
with check (auth.uid() = requester_id);

drop policy if exists "friendships participants update" on public.friendships;
create policy "friendships participants update"
on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = receiver_id)
with check (auth.uid() = requester_id or auth.uid() = receiver_id);

drop policy if exists "chat_threads participants read" on public.chat_threads;
create policy "chat_threads participants read"
on public.chat_threads for select
using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_threads participants insert" on public.chat_threads;
create policy "chat_threads participants insert"
on public.chat_threads for insert
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_threads participants update" on public.chat_threads;
create policy "chat_threads participants update"
on public.chat_threads for update
using (auth.uid() = user1_id or auth.uid() = user2_id)
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_messages participants read" on public.chat_messages;
create policy "chat_messages participants read"
on public.chat_messages for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "chat_messages sender insert" on public.chat_messages;
create policy "chat_messages sender insert"
on public.chat_messages for insert
with check (auth.uid() = sender_id);

drop policy if exists "chat_messages participants update" on public.chat_messages;
create policy "chat_messages participants update"
on public.chat_messages for update
using (auth.uid() = sender_id or auth.uid() = receiver_id)
with check (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "gift_transactions participants read" on public.gift_transactions;
create policy "gift_transactions participants read"
on public.gift_transactions for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "gift_transactions sender insert" on public.gift_transactions;
create policy "gift_transactions sender insert"
on public.gift_transactions for insert
with check (auth.uid() = sender_id);
