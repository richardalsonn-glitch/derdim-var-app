alter table if exists public.profiles
  add column if not exists username text;

update public.profiles as p
set username = coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
  'user_' || substr(replace(p.user_id::text, '-', ''), 1, 8)
)
from auth.users as u
where u.id = p.user_id
  and (p.username is null or btrim(p.username) = '');

update public.profiles as p
set username = 'user_' || substr(replace(p.user_id::text, '-', ''), 1, 8)
where p.user_id is not null
  and (p.username is null or btrim(p.username) = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

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
    status = coalesce(public.profiles.status, 'active'),
    is_frozen = coalesce(public.profiles.is_frozen, false);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop policy if exists "profiles owner read" on public.profiles;
drop policy if exists "profiles social visible read" on public.profiles;
drop policy if exists "profiles visible read" on public.profiles;
create policy "profiles visible read"
on public.profiles
for select
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
    where q.user_id = auth.uid()
      and q.status = 'matched'
      and q.matched_with = profiles.user_id
  )
);

create or replace function public.get_visible_profile_summaries(p_user_ids uuid[])
returns table (
  user_id uuid,
  username text,
  avatar_id text,
  plan text,
  is_online boolean,
  last_seen timestamptz,
  last_seen_at timestamptz,
  presence_status text,
  call_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return;
  end if;

  return query
  select
    p.user_id,
    p.username,
    p.avatar_id,
    p.plan,
    p.is_online,
    p.last_seen,
    p.last_seen_at,
    p.presence_status,
    p.call_status
  from public.profiles p
  where p.user_id = any(p_user_ids)
    and (
      p.user_id = v_user_id
      or exists (
        select 1
        from public.friendships f
        where f.status in ('pending', 'accepted')
          and (
            (f.requester_id = v_user_id and f.receiver_id = p.user_id)
            or (f.receiver_id = v_user_id and f.requester_id = p.user_id)
          )
      )
      or exists (
        select 1
        from public.matchmaking_queue q
        where q.status = 'matched'
          and (
            (q.user_id = v_user_id and q.matched_with = p.user_id)
            or (q.user_id = p.user_id and q.matched_with = v_user_id)
          )
      )
    );
end;
$$;

grant execute on function public.get_visible_profile_summaries(uuid[]) to authenticated;
