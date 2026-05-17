create extension if not exists pgcrypto;

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null,
  status text not null default 'waiting',
  matched_with uuid,
  match_room_id text,
  room_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.matchmaking_queue
  add column if not exists match_room_id text,
  add column if not exists room_id text,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'match_room_id'
      and data_type <> 'text'
  ) then
    alter table public.matchmaking_queue
      alter column match_room_id type text using match_room_id::text;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'room_id'
      and data_type <> 'text'
  ) then
    alter table public.matchmaking_queue
      alter column room_id type text using room_id::text;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'user_id'
      and data_type <> 'uuid'
  ) then
    alter table public.matchmaking_queue
      alter column user_id type uuid using user_id::uuid;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matchmaking_queue'
      and column_name = 'matched_with'
      and data_type <> 'uuid'
  ) then
    alter table public.matchmaking_queue
      alter column matched_with type uuid using nullif(matched_with::text, '')::uuid;
  end if;
end
$$;

alter table public.matchmaking_queue
  alter column user_id set not null,
  alter column mode set not null,
  alter column status set not null,
  alter column status set default 'waiting',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.matchmaking_queue
  drop constraint if exists matchmaking_queue_mode_check,
  add constraint matchmaking_queue_mode_check
  check (mode in ('derdim', 'derman'));

alter table public.matchmaking_queue
  drop constraint if exists matchmaking_queue_status_check,
  add constraint matchmaking_queue_status_check
  check (status in ('waiting', 'matched'));

alter table public.matchmaking_queue
  drop constraint if exists matchmaking_queue_user_id_key;

create index if not exists idx_matchmaking_queue_user_id
  on public.matchmaking_queue(user_id);

create index if not exists idx_matchmaking_queue_status_mode
  on public.matchmaking_queue(status, mode);

create index if not exists idx_matchmaking_queue_match_room_id
  on public.matchmaking_queue(match_room_id);

create unique index if not exists idx_matchmaking_queue_active_user
  on public.matchmaking_queue(user_id)
  where status in ('waiting', 'matched');

alter table public.matchmaking_queue replica identity full;

drop function if exists public.claim_matchmaking_pair(uuid);

create or replace function public.claim_matchmaking_pair(p_queue_id uuid)
returns table (
  id uuid,
  user_id uuid,
  mode text,
  status text,
  matched_with uuid,
  created_at timestamptz,
  match_room_id text,
  room_id text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self matchmaking_queue%rowtype;
  v_candidate matchmaking_queue%rowtype;
  v_room_id text;
begin
  select *
  into v_self
  from matchmaking_queue
  where matchmaking_queue.id = p_queue_id
  for update;

  if not found then
    return;
  end if;

  if v_self.status = 'matched' then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
    return;
  end if;

  select *
  into v_candidate
  from matchmaking_queue
  where mode = case when v_self.mode = 'derdim' then 'derman' else 'derdim' end
    and status = 'waiting'
    and user_id <> v_self.user_id
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
    return;
  end if;

  v_room_id := coalesce(v_self.match_room_id, v_self.room_id, v_candidate.match_room_id, v_candidate.room_id, gen_random_uuid()::text);

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_self.user_id,
      match_room_id = v_room_id,
      room_id = v_room_id,
      updated_at = now()
  where matchmaking_queue.id = v_candidate.id
    and matchmaking_queue.status = 'waiting';

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
    return;
  end if;

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_candidate.user_id,
      match_room_id = v_room_id,
      room_id = v_room_id,
      updated_at = now()
  where matchmaking_queue.id = v_self.id
    and matchmaking_queue.status = 'waiting'
  returning *
  into v_self;

  if not found then
    update matchmaking_queue
    set status = 'waiting',
        matched_with = null,
        match_room_id = null,
        room_id = null,
        updated_at = now()
    where matchmaking_queue.id = v_candidate.id
      and matchmaking_queue.status = 'matched'
      and matchmaking_queue.matched_with = v_self.user_id;

    select *
    into v_self
    from matchmaking_queue
    where matchmaking_queue.id = p_queue_id;
  end if;

  return query
  select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
end;
$$;

grant execute on function public.claim_matchmaking_pair(uuid) to anon, authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.matchmaking_queue;
exception
  when duplicate_object then null;
end
$$;
