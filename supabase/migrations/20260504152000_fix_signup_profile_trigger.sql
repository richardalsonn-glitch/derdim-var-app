create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  username text,
  plan text default 'free',
  gender text,
  status text default 'active',
  is_frozen boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists username text,
  add column if not exists plan text default 'free',
  add column if not exists gender text,
  add column if not exists status text default 'active',
  add column if not exists is_frozen boolean default false,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
end $$;

do $$
begin
  delete from public.profiles where user_id is null;
  alter table public.profiles alter column user_id set not null;
exception
  when others then
    raise notice 'profiles.user_id not-null skipped: %', sqlerrm;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_user_id_key'
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

alter table public.profiles
  alter column plan set default 'free',
  alter column status set default 'active',
  alter column is_frozen set default false,
  alter column created_at set default now();

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

  if v_username is null then
    v_username := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;

  if v_username is null then
    v_username := 'user';
  end if;

  insert into public.profiles (
    user_id,
    username,
    plan,
    status,
    is_frozen,
    created_at
  )
  values (
    new.id,
    v_username,
    'free',
    'active',
    false,
    now()
  )
  on conflict (user_id) do update
  set
    username = coalesce(nullif(public.profiles.username, ''), excluded.username),
    plan = coalesce(public.profiles.plan, 'free'),
    status = 'active',
    is_frozen = false;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (
  user_id,
  username,
  plan,
  status,
  is_frozen,
  created_at
)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'username'), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'user'),
  'free',
  'active',
  false,
  now()
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.user_id = u.id
)
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "profiles owner read" on public.profiles;
create policy "profiles owner read"
on public.profiles
for select
using (auth.uid() = user_id);

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
