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
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_match_room_id is null or btrim(p_match_room_id) = '' then
    return;
  end if;

  update public.matchmaking_queue as mq
  set status = 'ended',
      matched_with = null,
      updated_at = now()
  where mq.status in ('waiting', 'matched')
    and (mq.match_room_id = p_match_room_id or mq.room_id = p_match_room_id)
    and exists (
      select 1
      from public.matchmaking_queue as participant
      where (participant.match_room_id = p_match_room_id or participant.room_id = p_match_room_id)
        and participant.user_id = v_user_id
    );
end;
$$;

grant execute on function public.end_match_session(text) to authenticated;
