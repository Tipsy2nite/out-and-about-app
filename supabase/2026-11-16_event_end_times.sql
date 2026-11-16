-- =====================================================================
-- Event end times
-- Hosts can say when their gathering wraps up. Optional: gatherings
-- without an end time keep working exactly like before.
-- Safe to run more than once. Run after supabase/2026-10-29_free_events.sql.
--
--  * events.ends_at   when it ends (null = host didn't say)
--  * must be after the start, and no more than 3 days later
-- =====================================================================

alter table public.events add column if not exists ends_at timestamptz;

alter table public.events drop constraint if exists events_ends_after_start_check;
alter table public.events add constraint events_ends_after_start_check
  check (ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '3 days'));

create index if not exists events_ends_at_idx on public.events (ends_at);
