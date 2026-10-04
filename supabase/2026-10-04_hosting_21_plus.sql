-- =====================================================================
-- Hosting is 21+ and open to everyone who is 21+ (no manual verification
-- needed for home gatherings). Members can show or hide their age.
-- Safe to run more than once.
--
-- To go back to the original rule (home gatherings need a verified host),
-- see the "REVERT" block at the bottom.
-- =====================================================================

-- Members choose whether their age shows on their profile
alter table public.profiles add column if not exists hide_age boolean not null default false;

-- Is the signed-in person 21 or older? (Only answers for yourself, so it
-- can't be used to probe other people's ages.)
create or replace function public.is_21() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select birthdate <= (current_date - interval '21 years')::date
       from profile_private where user_id = auth.uid()),
    false);
$$;

-- A member's age in years, or null if they've hidden it.
-- Birthdates themselves never leave the database. Signed-in viewers only.
create or replace function public.profile_age(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when p.hide_age and p.id <> auth.uid() then null
              else date_part('year', age(pp.birthdate))::int end
  from profiles p join profile_private pp on pp.user_id = p.id
  where p.id = pid and auth.uid() is not null;
$$;

grant execute on function public.is_21(), public.profile_age(uuid) to authenticated;

-- Hosting rules: you must be 21+ to post or edit a gathering (public or at home)
drop policy if exists "create event" on public.events;
create policy "create event" on public.events for insert to authenticated
  with check (host_id = auth.uid() and public.is_21());

drop policy if exists "host edits event" on public.events;
create policy "host edits event" on public.events for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid() and public.is_21());

-- ---------------------------------------------------------------------
-- REVERT (back to: home gatherings need a hand-verified host, still 21+)
-- ---------------------------------------------------------------------
-- drop policy if exists "create event" on public.events;
-- create policy "create event" on public.events for insert to authenticated
--   with check (host_id = auth.uid() and public.is_21() and (is_private_location = false or public.is_verified()));
-- drop policy if exists "host edits event" on public.events;
-- create policy "host edits event" on public.events for update to authenticated
--   using (host_id = auth.uid())
--   with check (host_id = auth.uid() and public.is_21() and (is_private_location = false or public.is_verified()));
-- …and set REQUIRE_VERIFIED_FOR_HOME_EVENTS = true in src/lib/constants.js
