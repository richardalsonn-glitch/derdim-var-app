create extension if not exists pgcrypto;

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  mode text not null check (mode in ('derdim', 'derman')),
  status text not null default 'waiting' check (status in ('waiting', 'matched')),
  matched_with text,
  created_at timestamptz not null default now()
);

create index if not exists matchmaking_queue_mode_status_created_at_idx
  on public.matchmaking_queue (mode, status, created_at);

create index if not exists matchmaking_queue_matched_with_idx
  on public.matchmaking_queue (matched_with);

alter table public.matchmaking_queue replica identity full;
alter table public.matchmaking_queue disable row level security;

do $$
begin
  alter publication supabase_realtime add table public.matchmaking_queue;
exception
  when duplicate_object then null;
end
$$;
