create or replace function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.friendships as f
  where f.status = 'accepted'
    and (
      (f.requester_id = v_user_id and f.receiver_id = p_friend_user_id)
      or (f.requester_id = p_friend_user_id and f.receiver_id = v_user_id)
    );
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;
