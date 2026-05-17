create or replace function public.end_match_session(p_match_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id text := nullif(btrim(coalesce(p_match_room_id, '')), '');
begin
  if v_user_id is null or v_room_id is null then
    return;
  end if;

  update public.matchmaking_queue as mq
  set status = 'ended',
      ended_at = coalesce(mq.ended_at, now()),
      ended_by = coalesce(mq.ended_by, v_user_id),
      updated_at = now()
  where mq.status in ('waiting', 'matched')
    and (mq.match_room_id = v_room_id or mq.room_id = v_room_id)
    and exists (
      select 1
      from public.matchmaking_queue as participant
      where participant.user_id = v_user_id
        and participant.status in ('waiting', 'matched', 'ended', 'cancelled', 'expired')
        and (participant.match_room_id = v_room_id or participant.room_id = v_room_id)
    );
end;
$$;

grant execute on function public.end_match_session(text) to authenticated;
