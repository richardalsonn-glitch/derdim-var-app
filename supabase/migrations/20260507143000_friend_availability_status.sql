create or replace function public.get_friend_availability(p_user_ids uuid[])
returns table (
  user_id uuid,
  availability_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    return;
  end if;

  return query
  with visible_users as (
    select p.user_id
    from public.profiles p
    where p.user_id = any(p_user_ids)
      and (
        p.user_id = v_current_user_id
        or exists (
          select 1
          from public.friendships f
          where f.status = 'accepted'
            and (
              (f.requester_id = v_current_user_id and f.receiver_id = p.user_id)
              or (f.receiver_id = v_current_user_id and f.requester_id = p.user_id)
            )
        )
      )
  )
  select
    p.user_id,
    case
      when not (
        coalesce(p.is_online, false)
        or lower(coalesce(p.presence_status, '')) = 'online'
        or coalesce(p.last_seen_at, p.last_seen) > now() - interval '90 seconds'
      ) or coalesce(p.call_status, 'offline') = 'offline' then 'offline'
      when exists (
        select 1
        from public.matchmaking_queue q
        where q.status = 'waiting'
          and q.user_id = p.user_id
      ) then 'searching'
      when coalesce(p.call_status, 'available') = 'busy'
        or exists (
          select 1
          from public.matchmaking_queue q
          where q.status = 'matched'
            and (q.user_id = p.user_id or q.matched_with = p.user_id)
        )
        or exists (
          select 1
          from public.friend_call_invites i
          where (i.caller_id = p.user_id or i.receiver_id = p.user_id)
            and i.status in ('ringing', 'accepted')
            and (i.status = 'accepted' or i.expires_at > now())
        )
        or exists (
          select 1
          from public.voice_room_members vm
          join public.voice_rooms vr on vr.id = vm.room_id
          where vm.user_id = p.user_id
            and vm.status = 'joined'
            and vr.status in ('open', 'full', 'active')
        ) then 'busy'
      else 'available'
    end as availability_status
  from public.profiles p
  join visible_users vu on vu.user_id = p.user_id;
end;
$$;

grant execute on function public.get_friend_availability(uuid[]) to authenticated;

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
    now() + interval '45 seconds'
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.create_friend_call_invite(uuid) to authenticated;
