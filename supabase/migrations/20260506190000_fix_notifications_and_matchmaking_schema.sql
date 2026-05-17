create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.notifications
  add column if not exists user_id uuid,
  add column if not exists actor_id uuid,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists data jsonb,
  add column if not exists is_read boolean,
  add column if not exists created_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'user_id'
      and data_type <> 'uuid'
  ) then
    alter table public.notifications
      alter column user_id type uuid using nullif(user_id::text, '')::uuid;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'actor_id'
      and data_type <> 'uuid'
  ) then
    alter table public.notifications
      alter column actor_id type uuid using nullif(actor_id::text, '')::uuid;
  end if;
end
$$;

alter table if exists public.notifications
  alter column id set default gen_random_uuid(),
  alter column user_id set not null,
  alter column type set not null,
  alter column title set not null,
  alter column data set default '{}'::jsonb,
  alter column is_read set default false,
  alter column is_read set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

update public.notifications
set data = '{}'::jsonb
where data is null;

update public.notifications
set is_read = false
where is_read is null;

update public.notifications
set created_at = now()
where created_at is null;

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_type_idx
  on public.notifications (type);

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

create or replace function public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, type, title, body, data)
  values (p_user_id, p_actor_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end;
$$;

grant select, insert, update on table public.notifications to authenticated;
grant execute on function public.create_notification(uuid, uuid, text, text, text, jsonb) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;

alter table if exists public.matchmaking_queue
  drop constraint if exists matchmaking_queue_status_check,
  add constraint matchmaking_queue_status_check
  check (status in ('waiting', 'matched', 'ended', 'cancelled', 'expired'));

alter table if exists public.profiles
  add column if not exists username text;

update public.profiles as p
set username = coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
  nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
  'user_' || substr(replace(p.user_id::text, '-', ''), 1, 8)
)
from auth.users as u
where u.id::text = p.user_id::text
  and (p.username is null or btrim(p.username) = '');
