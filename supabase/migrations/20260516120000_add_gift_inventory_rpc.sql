-- Gift inventory is a mock entitlement ledger until App Store / Google Play IAP receipt
-- validation is wired. Do not enable real paid sales without server-side IAP validation.

create table if not exists public.user_gift_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  gift_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gift_id)
);

alter table public.gift_transactions
  add column if not exists user_id uuid,
  add column if not exists gift_id text,
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists type text not null default 'send' check (type in ('purchase', 'send', 'refund', 'admin_grant')),
  add column if not exists price_try numeric(10, 2),
  add column if not exists bonus_seconds integer,
  add column if not exists related_call_room_id text,
  add column if not exists recipient_user_id uuid;

update public.gift_transactions
set user_id = coalesce(user_id, sender_id),
    gift_id = coalesce(gift_id, gift_type),
    recipient_user_id = coalesce(recipient_user_id, receiver_id)
where user_id is null
   or gift_id is null
   or recipient_user_id is null;

create index if not exists user_gift_balances_user_idx
  on public.user_gift_balances (user_id);

create index if not exists gift_transactions_user_created_idx
  on public.gift_transactions (user_id, created_at desc);

create index if not exists gift_transactions_gift_id_idx
  on public.gift_transactions (gift_id);

alter table public.user_gift_balances enable row level security;
alter table public.gift_transactions enable row level security;

drop policy if exists "user_gift_balances owner read" on public.user_gift_balances;
create policy "user_gift_balances owner read"
on public.user_gift_balances
for select
using (auth.uid() = user_id);

drop policy if exists "gift_transactions owner read" on public.gift_transactions;
create policy "gift_transactions owner read"
on public.gift_transactions
for select
using (
  auth.uid() = user_id
  or auth.uid() = sender_id
  or auth.uid() = receiver_id
  or auth.uid() = recipient_user_id
);

create or replace function public.purchase_gift_credit(
  p_gift_id text,
  p_quantity integer default 1,
  p_price_try numeric default null,
  p_bonus_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer := greatest(coalesce(p_quantity, 1), 1);
begin
  if v_user_id is null or p_gift_id is null or btrim(p_gift_id) = '' then
    raise exception 'gift_purchase_not_allowed';
  end if;

  insert into public.user_gift_balances (user_id, gift_id, quantity)
  values (v_user_id, btrim(p_gift_id), v_quantity)
  on conflict (user_id, gift_id)
  do update
    set quantity = public.user_gift_balances.quantity + excluded.quantity,
        updated_at = now();

  insert into public.gift_transactions (
    user_id,
    sender_id,
    receiver_id,
    gift_id,
    gift_type,
    quantity,
    type,
    price_try,
    bonus_seconds
  )
  values (
    v_user_id,
    v_user_id,
    v_user_id,
    btrim(p_gift_id),
    btrim(p_gift_id),
    v_quantity,
    'purchase',
    p_price_try,
    p_bonus_seconds
  );
end;
$$;

create or replace function public.consume_gift_credit(
  p_gift_id text,
  p_related_call_room_id text default null,
  p_recipient_user_id uuid default null,
  p_price_try numeric default null,
  p_bonus_seconds integer default null
)
returns table(remaining_quantity integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_remaining integer;
begin
  if v_user_id is null or p_gift_id is null or btrim(p_gift_id) = '' then
    raise exception 'gift_consume_not_allowed';
  end if;

  update public.user_gift_balances
  set quantity = quantity - 1,
      updated_at = now()
  where user_id = v_user_id
    and gift_id = btrim(p_gift_id)
    and quantity > 0
  returning quantity into v_remaining;

  if v_remaining is null then
    raise exception 'gift_balance_empty';
  end if;

  insert into public.gift_transactions (
    user_id,
    sender_id,
    receiver_id,
    gift_id,
    gift_type,
    quantity,
    type,
    price_try,
    bonus_seconds,
    related_call_room_id,
    recipient_user_id
  )
  values (
    v_user_id,
    v_user_id,
    coalesce(p_recipient_user_id, v_user_id),
    btrim(p_gift_id),
    btrim(p_gift_id),
    1,
    'send',
    p_price_try,
    p_bonus_seconds,
    p_related_call_room_id,
    p_recipient_user_id
  );

  remaining_quantity := v_remaining;
  return next;
end;
$$;

grant execute on function public.purchase_gift_credit(text, integer, numeric, integer) to authenticated;
grant execute on function public.consume_gift_credit(text, text, uuid, numeric, integer) to authenticated;
