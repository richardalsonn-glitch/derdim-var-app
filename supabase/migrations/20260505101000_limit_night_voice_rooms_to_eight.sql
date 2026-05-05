-- Keep the Night Mode lobby aligned with the 4 free + 4 paid room design.
-- Existing occupied rooms are left untouched; only extra empty rooms are closed.

with ranked_night_rooms as (
  select
    vr.id,
    row_number() over (
      partition by vr.pricing_type
      order by vr.created_at asc, vr.id asc
    ) as room_rank
  from public.voice_rooms vr
  where vr.room_type = 'night'
    and vr.pricing_type in ('free', 'paid')
    and vr.status in ('open', 'full', 'active')
)
update public.voice_rooms vr
set
  status = 'closed',
  updated_at = now()
from ranked_night_rooms ranked
where vr.id = ranked.id
  and ranked.room_rank > 4
  and not exists (
    select 1
    from public.voice_room_members member
    where member.room_id = vr.id
      and member.status = 'joined'
  );
