alter table public.friend_call_invites
alter column expires_at set default (now() + interval '20 seconds');

create or replace function public.miss_friend_call_invite(p_invite_id uuid)
returns public.friend_call_invites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.friend_call_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.friend_call_invites
  set
    status = 'missed',
    updated_at = now()
  where id = p_invite_id
    and status = 'ringing'
    and (caller_id = v_user_id or receiver_id = v_user_id)
  returning * into v_invite;

  if not found then
    select *
    into v_invite
    from public.friend_call_invites
    where id = p_invite_id
      and (caller_id = v_user_id or receiver_id = v_user_id);
  end if;

  if not found then
    raise exception 'invite_not_found';
  end if;

  return v_invite;
end;
$$;

grant execute on function public.miss_friend_call_invite(uuid) to authenticated;

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
  v_caller_searching boolean := false;
  v_receiver_busy boolean := false;
  v_receiver_searching boolean := false;
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
    from public.matchmaking_queue q
    where q.status = 'waiting'
      and q.user_id = v_caller_id
  )
  into v_caller_searching;

  if v_caller_searching then
    raise exception 'caller_searching';
  end if;

  select exists (
    select 1
    from public.matchmaking_queue q
    where q.status = 'waiting'
      and q.user_id = p_receiver_id
  )
  into v_receiver_searching;

  if v_receiver_searching then
    raise exception 'receiver_searching';
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
  ) or exists (
    select 1
    from public.voice_room_members vm
    join public.voice_rooms vr on vr.id = vm.room_id
    where vm.user_id = v_caller_id
      and vm.status = 'joined'
      and vr.status in ('open', 'full', 'active')
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
  ) or exists (
    select 1
    from public.voice_room_members vm
    join public.voice_rooms vr on vr.id = vm.room_id
    where vm.user_id = p_receiver_id
      and vm.status = 'joined'
      and vr.status in ('open', 'full', 'active')
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
    now() + interval '20 seconds'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.create_friend_call_invite(uuid) to authenticated;
