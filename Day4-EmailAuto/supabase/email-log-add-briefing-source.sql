-- Run once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/ejdarjipxnruwxoaimgs/sql/new
--
-- Extends the email_log.source check constraint so morning-briefing.mjs can
-- log its sends. Re-run safe.

alter table public.email_log drop constraint if exists email_log_source_check;
alter table public.email_log
  add constraint email_log_source_check
  check (source in ('submit_welcome','reply','newsletter','manual','briefing','other'));
