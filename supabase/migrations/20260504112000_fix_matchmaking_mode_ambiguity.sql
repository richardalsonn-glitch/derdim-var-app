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
  v_self public.matchmaking_queue%rowtype;
  v_candidate public.matchmaking_queue%rowtype;
begin
  select mq.*
  into v_self
  from public.matchmaking_queue as mq
  where mq.id = p_queue_id
  for update;

  if not found then
    return;
  end if;

  if v_self.status <> 'waiting' then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  select mq.*
  into v_candidate
  from public.matchmaking_queue as mq
  where mq.mode = case when v_self.mode = 'derdim' then 'derman' else 'derdim' end
    and mq.status = 'waiting'
    and mq.user_id <> v_self.user_id
  order by mq.created_at asc
  for update skip locked
  limit 1;

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  update public.matchmaking_queue as mq
  set status = 'matched',
      matched_with = v_self.user_id
  where mq.id = v_candidate.id
    and mq.status = 'waiting';

  if not found then
    return query
    select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
    return;
  end if;

  update public.matchmaking_queue as mq
  set status = 'matched',
      matched_with = v_candidate.user_id
  where mq.id = v_self.id
    and mq.status = 'waiting'
  returning mq.*
  into v_self;

  if not found then
    update public.matchmaking_queue as mq
    set status = 'waiting',
        matched_with = null
    where mq.id = v_candidate.id
      and mq.status = 'matched'
      and mq.matched_with = v_self.user_id;

    select mq.*
    into v_self
    from public.matchmaking_queue as mq
    where mq.id = p_queue_id;
  end if;

  return query
  select v_self.id, v_self.user_id, v_self.mode, v_self.status, v_self.matched_with, v_self.created_at;
exception
  when others then
    raise log '[matchmaking] claim_matchmaking_pair failed for queue %: %', p_queue_id, sqlerrm;
    raise;
end;
$$;

grant execute on function public.claim_matchmaking_pair(uuid) to anon, authenticated, service_role;
