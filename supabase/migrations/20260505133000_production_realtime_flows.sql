create extension if not exists pgcrypto;

alter table if exists public.matchmaking_queue
  add column if not exists match_room_id uuid;

alter table if exists public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean not null default false,
  add column if not exists presence_status text not null default 'offline';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications owner read" on public.notifications;
create policy "notifications owner read"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "notifications owner update" on public.notifications;
create policy "notifications owner update"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notifications authenticated insert" on public.notifications;
create policy "notifications authenticated insert"
on public.notifications for insert
with check (auth.uid() is not null);

alter table if exists public.friendships
  drop constraint if exists friendships_status_check;

alter table if exists public.friendships
  add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'rejected', 'blocked'));

create or replace function public.set_presence(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set
    is_online = p_is_online,
    presence_status = case when p_is_online then 'online' else 'offline' end,
    last_seen_at = now()
  where user_id = v_user_id;
end;
$$;

drop policy if exists "profiles social visible read" on public.profiles;
create policy "profiles social visible read"
on public.profiles for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where f.status in ('pending', 'accepted')
      and (
        (f.requester_id = auth.uid() and f.receiver_id = profiles.user_id)
        or (f.receiver_id = auth.uid() and f.requester_id = profiles.user_id)
      )
  )
  or exists (
    select 1
    from public.matchmaking_queue q
    where q.user_id = auth.uid()::text
      and q.status = 'matched'
      and q.matched_with = profiles.user_id::text
  )
);

create or replace function public.release_voice_room_member(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select owner_id into v_owner_id
  from public.voice_rooms
  where id = p_room_id
  for update;

  if not found then
    return;
  end if;

  delete from public.voice_room_members
  where room_id = p_room_id
    and user_id = v_user_id;

  delete from public.voice_room_join_requests
  where room_id = p_room_id
    and requester_id = v_user_id
    and status = 'pending';

  if v_owner_id = v_user_id then
    perform public.reset_voice_room(p_room_id, 'owner_left');
    return;
  end if;

  perform public.refresh_voice_room_count(p_room_id);

  if not exists (
    select 1
    from public.voice_room_members
    where room_id = p_room_id
      and status = 'joined'
  ) then
    perform public.reset_voice_room(p_room_id, 'empty');
  end if;
end;
$$;

create or replace function public.leave_voice_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.release_voice_room_member(p_room_id);
end;
$$;

create or replace function public.claim_matchmaking_pair(p_queue_id uuid)
returns table (
  id uuid,
  user_id text,
  mode text,
  status text,
  matched_with text,
  created_at timestamptz,
  match_room_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self matchmaking_queue%rowtype;
  v_candidate matchmaking_queue%rowtype;
  v_match_room_id uuid;
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
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id;
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
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id;
    return;
  end if;

  v_match_room_id := coalesce(v_self.match_room_id, v_candidate.match_room_id, gen_random_uuid());

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_self.user_id,
      match_room_id = v_match_room_id
  where matchmaking_queue.id = v_candidate.id
    and matchmaking_queue.status = 'waiting';

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id;
    return;
  end if;

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_candidate.user_id,
      match_room_id = v_match_room_id
  where matchmaking_queue.id = v_self.id
    and matchmaking_queue.status = 'waiting'
  returning *
  into v_self;

  if not found then
    update matchmaking_queue
    set status = 'waiting',
        matched_with = null,
        match_room_id = null
    where matchmaking_queue.id = v_candidate.id
      and matchmaking_queue.status = 'matched'
      and matchmaking_queue.matched_with = v_self.user_id;

    select *
    into v_self
    from matchmaking_queue
    where matchmaking_queue.id = p_queue_id;
  end if;

  return query
  select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at, v_self.match_room_id;
end;
$$;

grant execute on function public.set_presence(boolean) to authenticated;
grant execute on function public.release_voice_room_member(uuid) to authenticated;
grant execute on function public.leave_voice_room(uuid) to authenticated;
grant execute on function public.claim_matchmaking_pair(uuid) to anon, authenticated, service_role;
grant select, insert, update on table public.notifications to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_threads;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end
$$;
