alter table public.matchmaking_queue
  drop constraint if exists matchmaking_queue_status_check,
  add constraint matchmaking_queue_status_check
  check (status in ('waiting', 'matched', 'ended', 'cancelled', 'expired'));

create or replace function public.end_match_session(p_match_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null or p_match_room_id is null or length(trim(p_match_room_id)) = 0 then
    return;
  end if;

  update public.matchmaking_queue
  set status = 'ended',
      matched_with = null,
      updated_at = now()
  where match_room_id = p_match_room_id
     or room_id = p_match_room_id;
end;
$$;

grant execute on function public.end_match_session(text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.matchmaking_queue;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end
$$;

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
