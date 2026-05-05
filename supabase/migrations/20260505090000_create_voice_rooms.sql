create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists avatar_id text,
  add column if not exists monthly_paid_room_allowance int not null default 0,
  add column if not exists monthly_paid_room_used int not null default 0,
  add column if not exists paid_room_allowance_month text;

create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('night', 'dert_sira')),
  pricing_type text not null check (pricing_type in ('free', 'paid')),
  name text default 'Şu anda bu oda müsaittir',
  owner_id uuid,
  status text default 'open' check (status in ('open', 'full', 'active', 'expired', 'closed')),
  capacity int not null,
  current_count int default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.voice_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.voice_rooms(id) on delete cascade,
  user_id uuid not null,
  role text default 'listener' check (role in ('owner', 'speaker', 'listener', 'member')),
  seat_index int,
  mic_enabled boolean default false,
  speaker_enabled boolean default false,
  status text default 'joined' check (status in ('joined', 'kicked', 'left', 'pending')),
  joined_at timestamptz default now(),
  unique(room_id, user_id),
  unique(room_id, seat_index)
);

create table if not exists public.voice_room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.voice_rooms(id) on delete cascade,
  requester_id uuid not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz default now()
);

create table if not exists public.voice_room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.voice_rooms(id) on delete cascade,
  user_id uuid,
  event_type text,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.voice_room_paid_allowances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan text not null check (plan in ('plus', 'vip')),
  month_key text not null,
  allowance_count int not null,
  used_count int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month_key)
);

create index if not exists voice_rooms_night_idx
  on public.voice_rooms (room_type, pricing_type, status, created_at);

create index if not exists voice_room_members_room_status_idx
  on public.voice_room_members (room_id, status, seat_index);

create index if not exists voice_room_members_user_status_idx
  on public.voice_room_members (user_id, status);

create index if not exists voice_room_join_requests_room_status_idx
  on public.voice_room_join_requests (room_id, status, created_at);

create index if not exists voice_room_events_room_created_idx
  on public.voice_room_events (room_id, created_at desc);

alter table public.voice_rooms enable row level security;
alter table public.voice_room_members enable row level security;
alter table public.voice_room_join_requests enable row level security;
alter table public.voice_room_events enable row level security;
alter table public.voice_room_paid_allowances enable row level security;

drop policy if exists "voice rooms open read" on public.voice_rooms;
create policy "voice rooms open read"
on public.voice_rooms for select
using (status in ('open', 'full', 'active'));

drop policy if exists "voice rooms owner update" on public.voice_rooms;
create policy "voice rooms owner update"
on public.voice_rooms for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "voice members visible read" on public.voice_room_members;
create policy "voice members visible read"
on public.voice_room_members for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.voice_rooms vr
    where vr.id = room_id
      and vr.status in ('open', 'full', 'active')
  )
);

drop policy if exists "voice join requests visible read" on public.voice_room_join_requests;
create policy "voice join requests visible read"
on public.voice_room_join_requests for select
using (
  auth.uid() = requester_id
  or exists (
    select 1
    from public.voice_rooms vr
    where vr.id = room_id
      and vr.owner_id = auth.uid()
  )
);

drop policy if exists "voice join requests requester insert" on public.voice_room_join_requests;
create policy "voice join requests requester insert"
on public.voice_room_join_requests for insert
with check (auth.uid() = requester_id);

drop policy if exists "voice join requests owner update" on public.voice_room_join_requests;
create policy "voice join requests owner update"
on public.voice_room_join_requests for update
using (
  exists (
    select 1
    from public.voice_rooms vr
    where vr.id = room_id
      and vr.owner_id = auth.uid()
  )
);

drop policy if exists "voice events participant read" on public.voice_room_events;
create policy "voice events participant read"
on public.voice_room_events for select
using (
  exists (
    select 1
    from public.voice_room_members vm
    where vm.room_id = voice_room_events.room_id
      and vm.user_id = auth.uid()
      and vm.status = 'joined'
  )
);

drop policy if exists "voice allowances owner read" on public.voice_room_paid_allowances;
create policy "voice allowances owner read"
on public.voice_room_paid_allowances for select
using (auth.uid() = user_id);

drop policy if exists "profiles voice room visible read" on public.profiles;
create policy "profiles voice room visible read"
on public.profiles for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.voice_room_members viewer
    join public.voice_room_members target
      on target.room_id = viewer.room_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'joined'
      and target.status = 'joined'
      and target.user_id = profiles.user_id
  )
  or exists (
    select 1
    from public.voice_room_join_requests req
    join public.voice_rooms room
      on room.id = req.room_id
    where room.owner_id = auth.uid()
      and req.requester_id = profiles.user_id
      and req.status = 'pending'
  )
);

create or replace function public.touch_voice_room_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_voice_room_updated_at on public.voice_rooms;
create trigger touch_voice_room_updated_at
before update on public.voice_rooms
for each row execute function public.touch_voice_room_updated_at();

create or replace function public.refresh_voice_room_count(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count int;
  v_capacity int;
  v_pricing text;
  v_expires_at timestamptz;
begin
  select count(*) into v_count
  from public.voice_room_members
  where room_id = p_room_id
    and status = 'joined';

  select capacity, pricing_type, expires_at
  into v_capacity, v_pricing, v_expires_at
  from public.voice_rooms
  where id = p_room_id;

  if v_capacity is null then
    return;
  end if;

  update public.voice_rooms
  set
    current_count = v_count,
    starts_at = case
      when v_pricing = 'free' and v_count < v_capacity then null
      else starts_at
    end,
    expires_at = case
      when v_pricing = 'free' and v_count < v_capacity then null
      else expires_at
    end,
    status = case
      when v_count >= v_capacity then 'full'
      else 'open'
    end
  where id = p_room_id;

  if v_pricing = 'free' and v_count < v_capacity then
    update public.voice_room_members
    set mic_enabled = false,
        speaker_enabled = false
    where room_id = p_room_id
      and status = 'joined';
  end if;
end;
$$;

create or replace function public.reset_voice_room(p_room_id uuid, p_reason text default 'expired')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.voice_room_events (room_id, event_type, payload)
  values (p_room_id, p_reason, jsonb_build_object('reset_at', now()));

  delete from public.voice_room_join_requests
  where room_id = p_room_id;

  delete from public.voice_room_members
  where room_id = p_room_id;

  update public.voice_rooms
  set
    name = 'Şu anda bu oda müsaittir',
    owner_id = null,
    status = 'open',
    current_count = 0,
    starts_at = null,
    expires_at = null
  where id = p_room_id;
end;
$$;

create or replace function public.join_voice_room_seat(p_room_id uuid, p_seat_index int)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.voice_rooms%rowtype;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_seat_index is null or p_seat_index < 0 then
    raise exception 'invalid_seat';
  end if;

  select * into v_room
  from public.voice_rooms
  where id = p_room_id
  for update;

  if v_room.id is null or v_room.room_type <> 'night' or v_room.pricing_type <> 'free' then
    raise exception 'room_unavailable';
  end if;

  if v_room.expires_at is not null and v_room.expires_at <= now() then
    perform public.reset_voice_room(p_room_id, 'expired');
    select * into v_room
    from public.voice_rooms
    where id = p_room_id
    for update;
  end if;

  if p_seat_index >= v_room.capacity then
    raise exception 'invalid_seat';
  end if;

  delete from public.voice_room_members
  where user_id = v_user_id
    and status = 'joined'
    and room_id <> p_room_id;

  insert into public.voice_room_members (
    room_id,
    user_id,
    role,
    seat_index,
    mic_enabled,
    speaker_enabled,
    status,
    joined_at
  )
  values (
    p_room_id,
    v_user_id,
    'member',
    p_seat_index,
    false,
    false,
    'joined',
    now()
  )
  on conflict (room_id, user_id) do update
  set
    seat_index = excluded.seat_index,
    status = 'joined',
    joined_at = now();

  select count(*) into v_count
  from public.voice_room_members
  where room_id = p_room_id
    and status = 'joined';

  if v_count >= v_room.capacity then
    update public.voice_rooms
    set
      status = 'full',
      current_count = v_count,
      starts_at = coalesce(starts_at, now()),
      expires_at = coalesce(expires_at, now() + interval '30 minutes')
    where id = p_room_id;

    update public.voice_room_members
    set mic_enabled = true,
        speaker_enabled = true
    where room_id = p_room_id
      and status = 'joined';
  else
    update public.voice_rooms
    set
      status = 'open',
      current_count = v_count,
      starts_at = null,
      expires_at = null
    where id = p_room_id;

    update public.voice_room_members
    set mic_enabled = false,
        speaker_enabled = false
    where room_id = p_room_id
      and status = 'joined';
  end if;
end;
$$;

create or replace function public.leave_voice_room(p_room_id uuid)
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

  delete from public.voice_room_members
  where room_id = p_room_id
    and user_id = v_user_id;

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

create or replace function public.rename_voice_room(p_room_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.voice_rooms%rowtype;
  v_first_member uuid;
  v_clean_name text := left(nullif(trim(p_name), ''), 48);
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_clean_name is null then
    v_clean_name := 'Şu anda bu oda müsaittir';
  end if;

  select * into v_room
  from public.voice_rooms
  where id = p_room_id
  for update;

  select user_id into v_first_member
  from public.voice_room_members
  where room_id = p_room_id
    and status = 'joined'
  order by joined_at asc
  limit 1;

  if v_room.owner_id = v_user_id or (v_room.pricing_type = 'free' and v_first_member = v_user_id) then
    update public.voice_rooms
    set name = v_clean_name
    where id = p_room_id;
    return;
  end if;

  raise exception 'not_allowed';
end;
$$;

create or replace function public.request_paid_voice_room_join(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.voice_rooms%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_room
  from public.voice_rooms
  where id = p_room_id
  for update;

  if v_room.id is null or v_room.pricing_type <> 'paid' or v_room.owner_id is null or v_room.current_count >= v_room.capacity then
    raise exception 'room_unavailable';
  end if;

  if v_room.owner_id = v_user_id then
    return;
  end if;

  insert into public.voice_room_join_requests (room_id, requester_id, status, created_at)
  values (p_room_id, v_user_id, 'pending', now());
end;
$$;

create or replace function public.decide_paid_voice_room_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.voice_room_join_requests%rowtype;
  v_room public.voice_rooms%rowtype;
  v_seat int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_request
  from public.voice_room_join_requests
  where id = p_request_id
  for update;

  select * into v_room
  from public.voice_rooms
  where id = v_request.room_id
  for update;

  if v_room.owner_id <> v_user_id then
    raise exception 'not_allowed';
  end if;

  if not p_approve then
    update public.voice_room_join_requests
    set status = 'rejected'
    where id = p_request_id;
    return;
  end if;

  if v_room.current_count >= v_room.capacity then
    update public.voice_room_join_requests
    set status = 'rejected'
    where id = p_request_id;
    return;
  end if;

  select seat_index into v_seat
  from generate_series(0, v_room.capacity - 1) as seat_index
  where not exists (
    select 1
    from public.voice_room_members vm
    where vm.room_id = v_room.id
      and vm.seat_index = seat_index
      and vm.status = 'joined'
  )
  limit 1;

  insert into public.voice_room_members (
    room_id,
    user_id,
    role,
    seat_index,
    mic_enabled,
    speaker_enabled,
    status,
    joined_at
  )
  values (
    v_room.id,
    v_request.requester_id,
    'member',
    v_seat,
    true,
    true,
    'joined',
    now()
  )
  on conflict (room_id, user_id) do update
  set
    status = 'joined',
    seat_index = excluded.seat_index,
    mic_enabled = true,
    speaker_enabled = true,
    joined_at = now();

  update public.voice_room_join_requests
  set status = 'approved'
  where id = p_request_id;

  perform public.refresh_voice_room_count(v_room.id);
end;
$$;

create or replace function public.remove_voice_room_member(p_room_id uuid, p_member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.voice_rooms
    where id = p_room_id
      and owner_id = v_user_id
  ) then
    raise exception 'not_allowed';
  end if;

  delete from public.voice_room_members
  where room_id = p_room_id
    and user_id = p_member_user_id
    and role <> 'owner';

  perform public.refresh_voice_room_count(p_room_id);
end;
$$;

create or replace function public.set_voice_room_member_audio(
  p_room_id uuid,
  p_member_user_id uuid,
  p_mic_enabled boolean,
  p_speaker_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.voice_rooms
    where id = p_room_id
      and owner_id = v_user_id
  ) then
    raise exception 'not_allowed';
  end if;

  update public.voice_room_members
  set mic_enabled = p_mic_enabled,
      speaker_enabled = p_speaker_enabled
  where room_id = p_room_id
    and user_id = p_member_user_id;
end;
$$;

create or replace function public.expire_voice_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_expires_at timestamptz;
begin
  select expires_at into v_expires_at
  from public.voice_rooms
  where id = p_room_id
  for update;

  if v_expires_at is not null and v_expires_at <= now() + interval '5 seconds' then
    perform public.reset_voice_room(p_room_id, 'expired');
  end if;
end;
$$;

insert into public.voice_rooms (room_type, pricing_type, name, status, capacity, current_count, created_at)
select 'night', 'free', 'Şu anda bu oda müsaittir', 'open', 4, 0, now() + (slot * interval '1 second')
from generate_series(1, 5) as slot
where not exists (
  select 1
  from public.voice_rooms
  where room_type = 'night'
    and pricing_type = 'free'
);

insert into public.voice_rooms (room_type, pricing_type, name, status, capacity, current_count, created_at)
select 'night', 'paid', 'Şu anda bu oda müsaittir', 'open', 4, 0, now() + ((slot + 5) * interval '1 second')
from generate_series(1, 5) as slot
where not exists (
  select 1
  from public.voice_rooms
  where room_type = 'night'
    and pricing_type = 'paid'
);

revoke all on table public.voice_rooms from anon;
revoke all on table public.voice_room_members from anon;
revoke all on table public.voice_room_join_requests from anon;
revoke all on table public.voice_room_events from anon;
revoke all on table public.voice_room_paid_allowances from anon;

grant select on table public.voice_rooms to authenticated;
grant select on table public.voice_room_members to authenticated;
grant select, insert, update on table public.voice_room_join_requests to authenticated;
grant select on table public.voice_room_events to authenticated;
grant select on table public.voice_room_paid_allowances to authenticated;

grant execute on function public.join_voice_room_seat(uuid, int) to authenticated;
grant execute on function public.leave_voice_room(uuid) to authenticated;
grant execute on function public.rename_voice_room(uuid, text) to authenticated;
grant execute on function public.request_paid_voice_room_join(uuid) to authenticated;
grant execute on function public.decide_paid_voice_room_request(uuid, boolean) to authenticated;
grant execute on function public.remove_voice_room_member(uuid, uuid) to authenticated;
grant execute on function public.set_voice_room_member_audio(uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.expire_voice_room(uuid) to authenticated;
