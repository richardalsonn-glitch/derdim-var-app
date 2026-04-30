create or replace function public.claim_matchmaking_pair(p_queue_id uuid)
returns table (
  id uuid,
  user_id text,
  mode text,
  status text,
  matched_with text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self matchmaking_queue%rowtype;
  v_candidate matchmaking_queue%rowtype;
begin
  select *
  into v_self
  from matchmaking_queue
  where matchmaking_queue.id = p_queue_id
  for update;

  if not found then
    return;
  end if;

  if v_self.status <> 'waiting' then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  select *
  into v_candidate
  from matchmaking_queue
  where mode = case when v_self.mode = 'derdim' then 'derman' else 'derdim' end
    and status = 'waiting'
    and user_id <> v_self.user_id
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_self.user_id
  where matchmaking_queue.id = v_candidate.id
    and matchmaking_queue.status = 'waiting';

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  update matchmaking_queue
  set status = 'matched',
      matched_with = v_candidate.user_id
  where matchmaking_queue.id = v_self.id
    and matchmaking_queue.status = 'waiting'
  returning *
  into v_self;

  if not found then
    update matchmaking_queue
    set status = 'waiting',
        matched_with = null
    where matchmaking_queue.id = v_candidate.id
      and matchmaking_queue.status = 'matched'
      and matchmaking_queue.matched_with = v_self.user_id;

    select *
    into v_self
    from matchmaking_queue
    where matchmaking_queue.id = p_queue_id;
  end if;

  return query
  select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
end;
$$;

grant execute on function public.claim_matchmaking_pair(uuid) to anon, authenticated, service_role;
