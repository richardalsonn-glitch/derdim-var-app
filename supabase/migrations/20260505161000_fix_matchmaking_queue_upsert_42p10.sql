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
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists mode text,
  add column if not exists status text default 'waiting',
  add column if not exists matched_with uuid,
  add column if not exists match_room_id text,
  add column if not exists room_id text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.matchmaking_queue
set id = gen_random_uuid()
where id is null;

update public.matchmaking_queue
set status = 'waiting'
where status is null;

update public.matchmaking_queue
set mode = 'derdim'
where mode is null;

delete from public.matchmaking_queue
where user_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.matchmaking_queue'::regclass
      and contype = 'p'
  ) then
    alter table public.matchmaking_queue
      add constraint matchmaking_queue_pkey primary key (id);
  end if;
end
$$;

alter table public.matchmaking_queue
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column user_id set not null,
  alter column mode set not null,
  alter column status set default 'waiting',
  alter column status set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.matchmaking_queue
)
delete from public.matchmaking_queue as mq
using ranked
where mq.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_matchmaking_queue_user_id_unique
  on public.matchmaking_queue(user_id);

create index if not exists idx_matchmaking_queue_status_mode
  on public.matchmaking_queue(status, mode);

create index if not exists idx_matchmaking_queue_match_room_id
  on public.matchmaking_queue(match_room_id);

alter table public.matchmaking_queue replica identity full;

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
  v_self public.matchmaking_queue%rowtype;
  v_candidate public.matchmaking_queue%rowtype;
  v_room_id text;
begin
  select *
  into v_self
  from public.matchmaking_queue as mq
  where mq.id = p_queue_id
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
  from public.matchmaking_queue as mq
  where mq.mode = case when v_self.mode = 'derdim' then 'derman' else 'derdim' end
    and mq.status = 'waiting'
    and mq.user_id <> v_self.user_id
  order by mq.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
    return;
  end if;

  v_room_id := coalesce(v_self.match_room_id, v_self.room_id, v_candidate.match_room_id, v_candidate.room_id, gen_random_uuid()::text);

  update public.matchmaking_queue as mq
  set status = 'matched',
      matched_with = v_self.user_id,
      match_room_id = v_room_id,
      room_id = v_room_id,
      updated_at = now()
  where mq.id = v_candidate.id
    and mq.status = 'waiting';

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id, v_self.room_id, v_self.updated_at;
    return;
  end if;

  update public.matchmaking_queue as mq
  set status = 'matched',
      matched_with = v_candidate.user_id,
      match_room_id = v_room_id,
      room_id = v_room_id,
      updated_at = now()
  where mq.id = v_self.id
    and mq.status = 'waiting'
  returning *
  into v_self;

  if not found then
    update public.matchmaking_queue as mq
    set status = 'waiting',
        matched_with = null,
        match_room_id = null,
        room_id = null,
        updated_at = now()
    where mq.id = v_candidate.id
      and mq.status = 'matched'
      and mq.matched_with = v_self.user_id;

    select *
    into v_self
    from public.matchmaking_queue as mq
    where mq.id = p_queue_id;
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
