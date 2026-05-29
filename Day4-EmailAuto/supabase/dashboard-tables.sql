-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/ejdarjipxnruwxoaimgs/sql/new
--
-- Creates the email_log and newsletters tables that the dashboard reads/writes,
-- plus RLS policies so the anon (publishable) key can use them.
--
-- SECURITY NOTE: the dashboard is gated by a client-side password only, and it
-- uses the anon key for writes. That means anyone with the anon key (which is
-- in dashboard.html) could insert/update/delete newsletters and email_log rows
-- if they crafted the right request. This is acceptable for a learning/admin
-- project but DO NOT use this pattern for production data without proper auth.

-- ============================================================
-- email_log: every email the system attempts to send
-- ============================================================
create table if not exists public.email_log (
  id              uuid primary key default gen_random_uuid(),
  to_email        text not null,
  subject         text not null,
  body_html       text,
  source          text not null check (source in ('submit_welcome','reply','newsletter','manual','other')),
  status          text not null default 'sent' check (status in ('sent','failed','queued')),
  error           text,
  related_id     uuid,
  created_at      timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_to_idx on public.email_log (to_email);

alter table public.email_log enable row level security;

drop policy if exists "anon read email_log"   on public.email_log;
drop policy if exists "anon insert email_log" on public.email_log;
create policy "anon read email_log"   on public.email_log for select to anon using (true);
create policy "anon insert email_log" on public.email_log for insert to anon with check (true);

-- ============================================================
-- newsletters: drafts you compose in the dashboard
-- ============================================================
create table if not exists public.newsletters (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body_html   text not null default '',
  status      text not null default 'draft' check (status in ('draft','sent')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists newsletters_updated_idx on public.newsletters (updated_at desc);

alter table public.newsletters enable row level security;

drop policy if exists "anon read newsletters"   on public.newsletters;
drop policy if exists "anon insert newsletters" on public.newsletters;
drop policy if exists "anon update newsletters" on public.newsletters;
drop policy if exists "anon delete newsletters" on public.newsletters;
create policy "anon read newsletters"   on public.newsletters for select to anon using (true);
create policy "anon insert newsletters" on public.newsletters for insert to anon with check (true);
create policy "anon update newsletters" on public.newsletters for update to anon using (true) with check (true);
create policy "anon delete newsletters" on public.newsletters for delete to anon using (true);

-- ============================================================
-- updated_at trigger for newsletters
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists newsletters_touch_updated on public.newsletters;
create trigger newsletters_touch_updated
  before update on public.newsletters
  for each row execute function public.touch_updated_at();
