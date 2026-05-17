create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists is_online boolean not null default false,
  add column if not exists last_seen timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists presence_status text not null default 'offline';

create index if not exists profiles_user_id_idx
  on public.profiles (user_id);

create index if not exists profiles_last_seen_idx
  on public.profiles (last_seen desc);

create or replace function public.set_presence(p_is_online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text := case when p_is_online then 'online' else 'offline' end;
begin
  if v_user_id is null then
    return;
  end if;

  insert into public.profiles (
    user_id,
    is_online,
    last_seen,
    last_seen_at,
    presence_status
  )
  values (
    v_user_id,
    p_is_online,
    now(),
    now(),
    v_status
  )
  on conflict (user_id)
  do update set
    is_online = excluded.is_online,
    last_seen = excluded.last_seen,
    last_seen_at = excluded.last_seen_at,
    presence_status = excluded.presence_status;
end;
$$;

grant execute on function public.set_presence(boolean) to authenticated;
