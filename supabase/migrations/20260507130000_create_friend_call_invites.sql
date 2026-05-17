create extension if not exists pgcrypto;

create table if not exists public.friend_call_invites (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null,
  status text not null default 'ringing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  accepted_at timestamptz,
  rejected_at timestamptz,
  ended_at timestamptz,
  constraint friend_call_invites_no_self_check check (caller_id <> receiver_id),
  constraint friend_call_invites_status_check check (status in ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'cancelled'))
);

create index if not exists friend_call_invites_receiver_status_created_idx
  on public.friend_call_invites (receiver_id, status, created_at desc);

create index if not exists friend_call_invites_caller_status_created_idx
  on public.friend_call_invites (caller_id, status, created_at desc);

create index if not exists friend_call_invites_room_id_idx
  on public.friend_call_invites (room_id);

alter table public.friend_call_invites replica identity full;
alter table public.friend_call_invites enable row level security;

create or replace function public.touch_friend_call_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_friend_call_invites_updated_at on public.friend_call_invites;
create trigger touch_friend_call_invites_updated_at
before update on public.friend_call_invites
for each row
execute function public.touch_friend_call_invites_updated_at();

drop policy if exists "friend_call_invites participants read" on public.friend_call_invites;
create policy "friend_call_invites participants read"
on public.friend_call_invites
for select
using (auth.uid() = caller_id or auth.uid() = receiver_id);

drop policy if exists "friend_call_invites caller insert" on public.friend_call_invites;
create policy "friend_call_invites caller insert"
on public.friend_call_invites
for insert
with check (auth.uid() = caller_id and caller_id <> receiver_id and status = 'ringing');

drop policy if exists "friend_call_invites receiver decision update" on public.friend_call_invites;
create policy "friend_call_invites receiver decision update"
on public.friend_call_invites
for update
using (auth.uid() = receiver_id and status = 'ringing')
with check (auth.uid() = receiver_id and status in ('accepted', 'rejected'));

drop policy if exists "friend_call_invites caller cancel update" on public.friend_call_invites;
create policy "friend_call_invites caller cancel update"
on public.friend_call_invites
for update
using (auth.uid() = caller_id and status = 'ringing')
with check (auth.uid() = caller_id and status = 'cancelled');

drop policy if exists "friend_call_invites participants end update" on public.friend_call_invites;
create policy "friend_call_invites participants end update"
on public.friend_call_invites
for update
using ((auth.uid() = caller_id or auth.uid() = receiver_id) and status in ('ringing', 'accepted'))
with check ((auth.uid() = caller_id or auth.uid() = receiver_id) and status = 'ended');

create or replace function public.expire_old_friend_call_invites()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer := 0;
begin
  update public.friend_call_invites
  set
    status = 'missed',
    updated_at = now()
  where status = 'ringing'
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.create_friend_call_invite(p_receiver_id uuid)
returns public.friend_call_invites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id uuid := auth.uid();
  v_receiver_is_online boolean := false;
  v_receiver_last_seen_at timestamptz;
  v_receiver_last_seen timestamptz;
  v_receiver_presence_status text;
  v_receiver_call_status text := 'offline';
  v_receiver_online boolean := false;
  v_caller_busy boolean := false;
  v_receiver_busy boolean := false;
  v_room_id text;
  v_invite public.friend_call_invites%rowtype;
begin
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_receiver_id is null or p_receiver_id = v_caller_id then
    raise exception 'invalid_receiver';
  end if;

  perform public.expire_old_friend_call_invites();

  if not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_caller_id and f.receiver_id = p_receiver_id)
        or (f.requester_id = p_receiver_id and f.receiver_id = v_caller_id)
      )
  ) then
    raise exception 'not_friends';
  end if;

  select
    coalesce(p.is_online, false),
    p.last_seen_at,
    p.last_seen,
    p.presence_status,
    coalesce(p.call_status, 'offline')
  into
    v_receiver_is_online,
    v_receiver_last_seen_at,
    v_receiver_last_seen,
    v_receiver_presence_status,
    v_receiver_call_status
  from public.profiles p
  where p.user_id = p_receiver_id
  limit 1;

  v_receiver_online := coalesce(v_receiver_is_online, false)
    or lower(coalesce(v_receiver_presence_status, '')) = 'online'
    or coalesce(v_receiver_last_seen_at, v_receiver_last_seen) > now() - interval '90 seconds';

  if not coalesce(v_receiver_online, false) or coalesce(v_receiver_call_status, 'offline') = 'offline' then
    raise exception 'receiver_offline';
  end if;

  select exists (
    select 1
    from public.friend_call_invites i
    where (i.caller_id = v_caller_id or i.receiver_id = v_caller_id)
      and i.status in ('ringing', 'accepted')
      and (i.status = 'accepted' or i.expires_at > now())
  ) or exists (
    select 1
    from public.matchmaking_queue q
    where q.status = 'matched'
      and (q.user_id = v_caller_id or q.matched_with = v_caller_id)
  )
  into v_caller_busy;

  if v_caller_busy then
    raise exception 'caller_busy';
  end if;

  select exists (
    select 1
    from public.friend_call_invites i
    where (i.caller_id = p_receiver_id or i.receiver_id = p_receiver_id)
      and i.status in ('ringing', 'accepted')
      and (i.status = 'accepted' or i.expires_at > now())
  ) or exists (
    select 1
    from public.matchmaking_queue q
    where q.status = 'matched'
      and (q.user_id = p_receiver_id or q.matched_with = p_receiver_id)
  )
  into v_receiver_busy;

  if v_receiver_busy or coalesce(v_receiver_call_status, 'offline') = 'busy' then
    raise exception 'receiver_busy';
  end if;

  v_room_id := 'friend-call-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.friend_call_invites (
    caller_id,
    receiver_id,
    room_id,
    status,
    expires_at
  )
  values (
    v_caller_id,
    p_receiver_id,
    v_room_id,
    'ringing',
    now() + interval '45 seconds'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.respond_friend_call_invite(p_invite_id uuid, p_action text)
returns public.friend_call_invites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.friend_call_invites%rowtype;
  v_normalized_action text := lower(trim(coalesce(p_action, '')));
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform public.expire_old_friend_call_invites();

  select *
  into v_invite
  from public.friend_call_invites
  where id = p_invite_id
  for update;

  if not found or v_invite.receiver_id <> v_user_id then
    raise exception 'invite_not_found';
  end if;

  if v_invite.status <> 'ringing' then
    raise exception 'invite_not_ringing';
  end if;

  if v_invite.expires_at <= now() then
    update public.friend_call_invites
    set status = 'missed'
    where id = p_invite_id
    returning * into v_invite;

    raise exception 'invite_expired';
  end if;

  if v_normalized_action = 'accept' then
    update public.friend_call_invites
    set
      status = 'accepted',
      accepted_at = now()
    where id = p_invite_id
    returning * into v_invite;

    return v_invite;
  end if;

  if v_normalized_action = 'reject' then
    update public.friend_call_invites
    set
      status = 'rejected',
      rejected_at = now()
    where id = p_invite_id
    returning * into v_invite;

    return v_invite;
  end if;

  raise exception 'invalid_action';
end;
$$;

create or replace function public.end_friend_call_invite(p_room_id text)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.friend_call_invites
  set
    status = 'ended',
    ended_at = now()
  where room_id = p_room_id
    and status in ('ringing', 'accepted')
    and (caller_id = v_user_id or receiver_id = v_user_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.create_friend_call_invite(uuid) to authenticated;
grant execute on function public.respond_friend_call_invite(uuid, text) to authenticated;
grant execute on function public.end_friend_call_invite(text) to authenticated;
grant execute on function public.expire_old_friend_call_invites() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_call_invites'
  ) then
    alter publication supabase_realtime add table public.friend_call_invites;
  end if;
exception
  when undefined_object then
    null;
end
$$;
