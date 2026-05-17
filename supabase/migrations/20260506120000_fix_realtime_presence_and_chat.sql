alter table if exists public.profiles
  add column if not exists is_online boolean not null default false,
  add column if not exists last_seen timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists presence_status text not null default 'offline',
  add column if not exists call_status text not null default 'available';

alter table if exists public.chat_threads
  add column if not exists updated_at timestamptz not null default now();

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
    presence_status,
    call_status
  )
  values (
    v_user_id,
    p_is_online,
    now(),
    now(),
    v_status,
    case when p_is_online then 'available' else 'offline' end
  )
  on conflict (user_id)
  do update set
    is_online = excluded.is_online,
    last_seen = excluded.last_seen,
    last_seen_at = excluded.last_seen_at,
    presence_status = excluded.presence_status,
    call_status = excluded.call_status;
end;
$$;

grant execute on function public.set_presence(boolean) to authenticated;

create or replace function public.touch_chat_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set last_message = new.message,
      last_message_at = new.created_at,
      updated_at = coalesce(new.created_at, now())
  where id = new.thread_id;

  return new;
end;
$$;

drop trigger if exists chat_messages_touch_thread on public.chat_messages;
create trigger chat_messages_touch_thread
after insert on public.chat_messages
for each row execute function public.touch_chat_thread_from_message();

do $$
begin
  begin
    alter publication supabase_realtime add table public.matchmaking_queue;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.friendships;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_threads;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.profiles;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;
