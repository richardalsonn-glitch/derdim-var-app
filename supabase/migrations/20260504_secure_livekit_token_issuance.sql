create extension if not exists pgcrypto;

create table if not exists public.livekit_room_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  peer_user_id text not null,
  room_name text not null,
  requester_ip text,
  user_agent text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz,
  status text not null default 'active' check (status in ('active', 'released', 'expired'))
);

create index if not exists livekit_room_sessions_user_status_idx
  on public.livekit_room_sessions (user_id, status, issued_at desc);

create index if not exists livekit_room_sessions_ip_issued_at_idx
  on public.livekit_room_sessions (requester_ip, issued_at desc);

create table if not exists public.livekit_abuse_events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  requester_ip text,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists livekit_abuse_events_user_created_at_idx
  on public.livekit_abuse_events (user_id, created_at desc);

create index if not exists livekit_abuse_events_ip_created_at_idx
  on public.livekit_abuse_events (requester_ip, created_at desc);

alter table public.livekit_room_sessions enable row level security;
alter table public.livekit_abuse_events enable row level security;

create or replace function public.issue_livekit_room_session(
  p_user_id text,
  p_peer_user_id text,
  p_room_name text,
  p_requester_ip text,
  p_user_agent text,
  p_expires_at timestamptz
)
returns table (
  allowed boolean,
  status_code integer,
  reason text,
  session_id uuid,
  active_room_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_active_session public.livekit_room_sessions%rowtype;
  v_user_request_count integer := 0;
  v_ip_request_count integer := 0;
  v_recent_abuse_count integer := 0;
  v_session_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_user_id, '')));

  update public.livekit_room_sessions
  set status = 'expired',
      released_at = coalesce(released_at, v_now)
  where user_id = p_user_id
    and status = 'active'
    and expires_at <= v_now;

  select count(*)
  into v_recent_abuse_count
  from public.livekit_abuse_events
  where (
    user_id = p_user_id
    or (p_requester_ip is not null and requester_ip = p_requester_ip)
  )
    and created_at >= v_now - interval '10 minutes';

  if v_recent_abuse_count >= 5 then
    insert into public.livekit_abuse_events (user_id, requester_ip, reason, details)
    values (
      p_user_id,
      p_requester_ip,
      'abuse_window_exceeded',
      jsonb_build_object('peer_user_id', p_peer_user_id)
    );

    return query
    select false, 429, 'abuse_window_exceeded', null::uuid, null::text;
    return;
  end if;

  select count(*)
  into v_user_request_count
  from public.livekit_room_sessions
  where user_id = p_user_id
    and issued_at >= v_now - interval '1 minute';

  select count(*)
  into v_ip_request_count
  from public.livekit_room_sessions
  where p_requester_ip is not null
    and requester_ip = p_requester_ip
    and issued_at >= v_now - interval '1 minute';

  if v_user_request_count >= 6 or v_ip_request_count >= 12 then
    insert into public.livekit_abuse_events (user_id, requester_ip, reason, details)
    values (
      p_user_id,
      p_requester_ip,
      'rate_limit_exceeded',
      jsonb_build_object(
        'peer_user_id', p_peer_user_id,
        'user_request_count', v_user_request_count,
        'ip_request_count', v_ip_request_count
      )
    );

    return query
    select false, 429, 'rate_limit_exceeded', null::uuid, null::text;
    return;
  end if;

  select *
  into v_active_session
  from public.livekit_room_sessions
  where user_id = p_user_id
    and status = 'active'
    and expires_at > v_now
  order by issued_at desc
  limit 1;

  if found then
    if v_active_session.peer_user_id = p_peer_user_id and v_active_session.room_name = p_room_name then
      update public.livekit_room_sessions
      set issued_at = v_now,
          expires_at = p_expires_at,
          requester_ip = coalesce(p_requester_ip, requester_ip),
          user_agent = coalesce(p_user_agent, user_agent)
      where id = v_active_session.id;

      return query
      select true, 200, 'existing_room_reissued', v_active_session.id, v_active_session.room_name;
      return;
    end if;

    insert into public.livekit_abuse_events (user_id, requester_ip, reason, details)
    values (
      p_user_id,
      p_requester_ip,
      'concurrent_room_attempt',
      jsonb_build_object(
        'existing_room_name', v_active_session.room_name,
        'existing_peer_user_id', v_active_session.peer_user_id,
        'requested_peer_user_id', p_peer_user_id
      )
    );

    return query
    select false, 409, 'active_room_exists', v_active_session.id, v_active_session.room_name;
    return;
  end if;

  insert into public.livekit_room_sessions (
    user_id,
    peer_user_id,
    room_name,
    requester_ip,
    user_agent,
    issued_at,
    expires_at,
    status
  )
  values (
    p_user_id,
    p_peer_user_id,
    p_room_name,
    p_requester_ip,
    p_user_agent,
    v_now,
    p_expires_at,
    'active'
  )
  returning id into v_session_id;

  return query
  select true, 200, 'issued', v_session_id, p_room_name;
end;
$$;

create or replace function public.release_livekit_room_sessions(
  p_user_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row_count integer := 0;
begin
  update public.livekit_room_sessions
  set status = 'released',
      released_at = coalesce(released_at, now())
  where user_id = p_user_id
    and status = 'active';

  get diagnostics v_row_count = row_count;
  return v_row_count;
end;
$$;

revoke all on table public.livekit_room_sessions from anon, authenticated;
revoke all on table public.livekit_abuse_events from anon, authenticated;

grant execute on function public.issue_livekit_room_session(text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.release_livekit_room_sessions(text) to service_role;
