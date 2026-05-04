create extension if not exists pgcrypto;

create table if not exists public.livekit_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  peer_user_id text,
  room_id text,
  requester_ip text,
  status text not null check (status in ('success', 'error')),
  status_code integer not null,
  rejection_reason text,
  request_path text,
  request_method text not null default 'POST',
  created_at timestamptz not null default now()
);

create index if not exists livekit_request_logs_created_at_idx
  on public.livekit_request_logs (created_at desc);

create index if not exists livekit_request_logs_user_created_at_idx
  on public.livekit_request_logs (user_id, created_at desc);

create index if not exists livekit_request_logs_status_created_at_idx
  on public.livekit_request_logs (status, created_at desc);

alter table public.livekit_request_logs enable row level security;

revoke all on table public.livekit_request_logs from anon, authenticated;

create or replace view public.livekit_requests_per_minute as
select
  date_trunc('minute', created_at) as minute_bucket,
  count(*) as request_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'error') as error_count
from public.livekit_request_logs
group by 1
order by 1 desc;

create or replace view public.livekit_active_rooms_count as
select
  count(distinct room_name) as active_rooms_count
from public.livekit_room_sessions
where status = 'active'
  and expires_at > now();

create or replace view public.livekit_abuse_count_per_user as
select
  coalesce(user_id, 'anonymous') as user_id,
  count(*) as abuse_count,
  max(created_at) as last_abuse_at
from public.livekit_abuse_events
group by 1
order by abuse_count desc, last_abuse_at desc;
