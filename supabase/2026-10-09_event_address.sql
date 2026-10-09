-- Out & About: street address for public gatherings
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Public spots (parks, venues) can now show a street address to everyone.
-- Home gatherings still keep their exact address in event_locations,
-- which only the host and RSVP'd guests can read. For those, this column stays empty.

alter table public.events
  add column if not exists address text check (char_length(address) <= 300);
