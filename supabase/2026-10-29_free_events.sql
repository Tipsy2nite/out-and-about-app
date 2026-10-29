-- =====================================================================
-- "Free in Austin": community events (tree lightings, markets, park shows)
-- that Out & About lists for people, separate from member-hosted gatherings.
-- Safe to run more than once. Run after supabase/2026-10-29_host_approval.sql.
--
--  * events.listing_type   'gathering' (a member hosts it) or 'free_event' (a listing)
--  * events.source_url     link to the official page for a free event
--  * Only admins can post or convert free-event listings
--  * Free events are always at public places, and nobody "reviews the host"
-- =====================================================================

alter table public.events add column if not exists listing_type text not null default 'gathering';
alter table public.events drop constraint if exists events_listing_type_check;
alter table public.events add constraint events_listing_type_check check (listing_type in ('gathering', 'free_event'));
alter table public.events add column if not exists source_url text;
alter table public.events drop constraint if exists events_source_url_check;
alter table public.events add constraint events_source_url_check
  check (source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https://[^\s<>"]+$'));
alter table public.events drop constraint if exists events_free_event_public_check;
alter table public.events add constraint events_free_event_public_check
  check (listing_type = 'gathering' or is_private_location = false);
create index if not exists events_listing_starts_idx on public.events (listing_type, starts_at);

-- Only admins can post free-event listings (or turn a gathering into one)
create or replace function public.oa_events_listing_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;
  if (tg_op = 'INSERT' and new.listing_type <> 'gathering')
     or (tg_op = 'UPDATE' and new.listing_type is distinct from old.listing_type) then
    if not public.is_admin() then
      raise exception 'Only the Out & About team can post free Austin events.';
    end if;
  end if;
  if new.listing_type = 'gathering' then new.source_url := null; end if;
  return new;
end $$;
revoke all on function public.oa_events_listing_guard() from public, anon, authenticated;
drop trigger if exists oa_events_listing_guard on public.events;
create trigger oa_events_listing_guard before insert or update on public.events
  for each row execute function public.oa_events_listing_guard();

-- No host reviews for free-event listings (the lister isn't running the event)
create or replace function public.can_review(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join rsvps r on r.event_id = e.id and r.user_id = auth.uid() and r.status = 'going'
    where e.id = eid
      and e.listing_type = 'gathering'
      and e.host_id <> auth.uid()
      and e.status <> 'cancelled'
      and e.starts_at <= now() - interval '1 hour'
      and e.starts_at >= now() - interval '30 days');
$$;

-- ---------- Move the events from the Austin Free Events Guide ----------
-- (Everything Khori posted except the Family Fun Picnic.)
update public.events e set listing_type = 'free_event', source_url = v.url
from (values
  ('Art & Beer Night Market',                'https://www.eventbrite.com/e/art-and-beer-night-market-austin-tickets-1997481239157'),
  ('Pease Park Puppet Show (Small Wonders)',  'https://peasepark.org/upcoming-events'),
  ('Zilker Holiday Tree Lighting',           'https://www.austintexas.gov/parks/programs/zilker-holiday-tree'),
  ('Downtown Holiday Stroll & Sing-Along',   'https://downtownaustin.com/holidaystroll/'),
  ('Austin Trail of Lights (Free Night)',    'https://www.austintexas.gov/ace/events/trail-lights')
) as v(title, url)
where e.title = v.title
  and e.host_id = (select id from auth.users where lower(email) = 'khotic09@gmail.com');
