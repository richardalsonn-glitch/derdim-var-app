alter table if exists public.profiles enable row level security;
alter table if exists public.friendships enable row level security;
alter table if exists public.chat_threads enable row level security;
alter table if exists public.chat_messages enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.matchmaking_queue enable row level security;
alter table if exists public.voice_rooms enable row level security;
alter table if exists public.voice_room_members enable row level security;
alter table if exists public.voice_room_join_requests enable row level security;
alter table if exists public.voice_room_events enable row level security;
alter table if exists public.voice_room_paid_allowances enable row level security;
alter table if exists public.support_reports enable row level security;
alter table if exists public.gift_transactions enable row level security;
alter table if exists public.livekit_request_logs enable row level security;
alter table if exists public.livekit_room_sessions enable row level security;
alter table if exists public.livekit_abuse_events enable row level security;

drop policy if exists "notifications authenticated insert" on public.notifications;
drop policy if exists "notifications owner insert" on public.notifications;
create policy "notifications owner insert"
on public.notifications
for insert
with check (auth.uid() = user_id);

drop policy if exists "support_reports owner read" on public.support_reports;
drop policy if exists "support_reports owner insert" on public.support_reports;
create policy "support_reports owner insert"
on public.support_reports
for insert
with check (auth.uid() = reporter_id);

drop policy if exists "friendships participants read" on public.friendships;
create policy "friendships participants read"
on public.friendships
for select
using (auth.uid() = requester_id or auth.uid() = receiver_id);

drop policy if exists "friendships requester insert" on public.friendships;
create policy "friendships requester insert"
on public.friendships
for insert
with check (auth.uid() = requester_id and requester_id <> receiver_id);

drop policy if exists "friendships receiver decision update" on public.friendships;
drop policy if exists "friendships participants update" on public.friendships;
create policy "friendships receiver decision update"
on public.friendships
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id and status in ('accepted', 'rejected', 'blocked'));

drop policy if exists "friendships participants delete" on public.friendships;
create policy "friendships participants delete"
on public.friendships
for delete
using (auth.uid() = requester_id or auth.uid() = receiver_id);

drop policy if exists "chat_threads participants read" on public.chat_threads;
create policy "chat_threads participants read"
on public.chat_threads
for select
using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_threads participants insert" on public.chat_threads;
create policy "chat_threads participants insert"
on public.chat_threads
for insert
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_threads participants update" on public.chat_threads;
create policy "chat_threads participants update"
on public.chat_threads
for update
using (auth.uid() = user1_id or auth.uid() = user2_id)
with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_threads participants delete" on public.chat_threads;
create policy "chat_threads participants delete"
on public.chat_threads
for delete
using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "chat_messages participants read" on public.chat_messages;
create policy "chat_messages participants read"
on public.chat_messages
for select
using (
  exists (
    select 1
    from public.chat_threads t
    where t.id = chat_messages.thread_id
      and (t.user1_id = auth.uid() or t.user2_id = auth.uid())
  )
);

drop policy if exists "chat_messages sender insert" on public.chat_messages;
create policy "chat_messages sender insert"
on public.chat_messages
for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1
    from public.chat_threads t
    where t.id = chat_messages.thread_id
      and (
        (t.user1_id = auth.uid() and t.user2_id = chat_messages.receiver_id)
        or (t.user2_id = auth.uid() and t.user1_id = chat_messages.receiver_id)
      )
  )
);

drop policy if exists "chat_messages receiver update" on public.chat_messages;
drop policy if exists "chat_messages participants update" on public.chat_messages;
create policy "chat_messages receiver update"
on public.chat_messages
for update
using (auth.uid() = receiver_id)
with check (auth.uid() = receiver_id);

drop policy if exists "matchmaking_queue own read" on public.matchmaking_queue;
create policy "matchmaking_queue own read"
on public.matchmaking_queue
for select
using (auth.uid() = user_id);

drop policy if exists "matchmaking_queue own insert" on public.matchmaking_queue;
create policy "matchmaking_queue own insert"
on public.matchmaking_queue
for insert
with check (auth.uid() = user_id);

drop policy if exists "matchmaking_queue own update" on public.matchmaking_queue;
create policy "matchmaking_queue own update"
on public.matchmaking_queue
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "matchmaking_queue own delete" on public.matchmaking_queue;
create policy "matchmaking_queue own delete"
on public.matchmaking_queue
for delete
using (auth.uid() = user_id);

drop policy if exists "No public access" on public.livekit_request_logs;