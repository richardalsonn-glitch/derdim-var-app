alter table public.chat_threads
  add column if not exists deleted_for_user1_at timestamptz,
  add column if not exists deleted_for_user2_at timestamptz;

create index if not exists chat_threads_deleted_for_user1_idx
  on public.chat_threads (user1_id, deleted_for_user1_at);

create index if not exists chat_threads_deleted_for_user2_idx
  on public.chat_threads (user2_id, deleted_for_user2_at);
