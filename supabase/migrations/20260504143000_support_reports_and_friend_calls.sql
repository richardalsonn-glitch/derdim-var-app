alter table if exists public.profiles
  add column if not exists call_status text not null default 'available'
  check (call_status in ('available', 'busy', 'offline'));

create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reported_user_id uuid,
  type text not null check (type in ('report', 'support', 'safety')),
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists support_reports_reporter_idx
  on public.support_reports (reporter_id, created_at desc);

alter table public.support_reports enable row level security;

drop policy if exists "support_reports owner read" on public.support_reports;
create policy "support_reports owner read"
on public.support_reports for select
using (auth.uid() = reporter_id);

drop policy if exists "support_reports owner insert" on public.support_reports;
create policy "support_reports owner insert"
on public.support_reports for insert
with check (auth.uid() = reporter_id);
