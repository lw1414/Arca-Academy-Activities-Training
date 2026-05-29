-- Run this once in the Supabase SQL editor to allow the dashboard (using the
-- anon/publishable key) to SELECT rows from form_submissions.
--
-- SQL editor: https://supabase.com/dashboard/project/<your-project>/sql/new
--
-- Without this, dashboard.html will show "Supabase 401" because Row Level
-- Security blocks anonymous reads by default.

create policy "anon read form_submissions"
  on public.form_submissions
  for select
  to anon
  using (true);

-- Allow the dashboard's Unsubscribe button (which PATCHes newsletter=false)
-- to actually update rows. Without this, RLS silently blocks the update.
drop policy if exists "anon update form_submissions" on public.form_submissions;
create policy "anon update form_submissions"
  on public.form_submissions
  for update
  to anon
  using (true)
  with check (true);

-- OPTIONAL: if you also want the seed script's --no-email mode (direct REST
-- insert with anon key) to work, uncomment the policy below. Otherwise the
-- seed script defaults to going through the edge function, which already
-- works with the anon key.
--
-- create policy "anon insert form_submissions"
--   on public.form_submissions
--   for insert
--   to anon
--   with check (true);
