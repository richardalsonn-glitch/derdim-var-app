alter table public.matchmaking_queue
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid;

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
      ended_at = now(),
      ended_by = v_user_id,
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