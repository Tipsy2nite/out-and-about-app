-- =====================================================================
-- Out & About: database schema, security rules, and helper functions
-- Run this whole file once in Supabase: SQL Editor > New query > Run.
-- =====================================================================


-- ---------- Profiles (public info) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  neighborhood text,
  bio text check (char_length(bio) <= 500),
  vibes text[] not null default '{}',
  verified boolean not null default false,          -- set by admins only
  hide_from_guest_lists boolean not null default false,
  parent_role text check (parent_role in ('mom','dad')),
  kids_stages text[] not null default '{}',          -- age ranges only, never kids' names
  show_in_parent_finder boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Private profile info (only the owner can read) ----------
create table public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  trusted_contact_email text,
  created_at timestamptz not null default now()
);

-- ---------- Events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  description text check (char_length(description) <= 2000),
  category text not null check (category in ('Parks','Music','Parties','Community','Niche','Families')),
  audience text not null default 'everyone' check (audience in ('everyone','moms','dads')),
  starts_at timestamptz not null,
  area_label text not null,                 -- public, general area ("Zilker Park", "Travis Heights")
  lat double precision not null,            -- public pin; for private homes this is approximate
  lng double precision not null,
  is_private_location boolean not null default false,
  size text not null default 'Cozy' check (size in ('Cozy','Medium','Crowd')),
  open_invite boolean not null default true,
  tags text[] not null default '{}',
  rain_plan text not null default 'Rain or shine' check (rain_plan in ('Move to backup spot','Postpone','Cancel','Rain or shine')),
  rain_plan_note text,
  access_entry text not null default 'Step-free' check (access_entry in ('Step-free','Some steps','Trail or uneven')),
  access_shade text not null default 'Some' check (access_shade in ('Lots','Some','None')),
  access_restrooms text not null default 'Nearby' check (access_restrooms in ('On site','Nearby','None')),
  access_noise text not null default 'Chatty' check (access_noise in ('Quiet','Chatty','Loud')),
  access_notes text,
  status text not null default 'scheduled' check (status in ('scheduled','moved','postponed','cancelled')),
  status_note text,
  created_at timestamptz not null default now()
);
create index events_starts_at_idx on public.events (starts_at);

-- Exact address: only the host and people who RSVP'd can read it
create table public.event_locations (
  event_id uuid primary key references public.events(id) on delete cascade,
  address text not null
);

create table public.rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- Circles ----------
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 500),
  rhythm text,
  audience text not null default 'everyone' check (audience in ('everyone','moms','dads')),
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','organizer')),
  created_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- Safety ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('event','user','post','circle')),
  target_id uuid not null,
  reason text not null,
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.waves (
  from_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

-- =====================================================================
-- Row-level security: every table is locked down, then opened on purpose
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.events enable row level security;
alter table public.event_locations enable row level security;
alter table public.rsvps enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_posts enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.waves enable row level security;

-- helpers
create or replace function public.is_going(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rsvps where event_id = eid and user_id = auth.uid());
$$;
create or replace function public.is_host(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = eid and host_id = auth.uid());
$$;
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from circle_members where circle_id = cid and user_id = auth.uid());
$$;
create or replace function public.is_verified() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select verified from profiles where id = auth.uid()), false);
$$;

-- profiles: signed-in people can read; you can only create/edit your own,
-- and nobody can mark themselves verified from the app
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and verified = false);
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and verified = (select p.verified from public.profiles p where p.id = auth.uid()));

-- private profile: owner only
create policy "own private row" on public.profile_private for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events: anyone can browse; home gatherings require a verified host; only the host edits
create policy "events readable" on public.events for select using (true);
create policy "create event" on public.events for insert to authenticated
  with check (host_id = auth.uid() and (is_private_location = false or public.is_verified()));
create policy "host edits event" on public.events for update to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid() and (is_private_location = false or public.is_verified()));
create policy "host deletes event" on public.events for delete to authenticated using (host_id = auth.uid());

-- exact addresses: host and RSVP'd guests only
create policy "address for host or guests" on public.event_locations for select to authenticated
  using (public.is_host(event_id) or public.is_going(event_id));
create policy "host sets address" on public.event_locations for insert to authenticated with check (public.is_host(event_id));
create policy "host edits address" on public.event_locations for update to authenticated using (public.is_host(event_id));

-- rsvps: you manage your own; hosts can see and remove their guests
create policy "see own or hosted rsvps" on public.rsvps for select to authenticated
  using (user_id = auth.uid() or public.is_host(event_id));
create policy "rsvp yourself" on public.rsvps for insert to authenticated with check (user_id = auth.uid());
create policy "cancel own rsvp" on public.rsvps for delete to authenticated using (user_id = auth.uid());
create policy "host removes guest" on public.rsvps for delete to authenticated using (public.is_host(event_id));

-- circles
create policy "circles readable" on public.circles for select using (true);
create policy "create circle" on public.circles for insert to authenticated with check (organizer_id = auth.uid());
create policy "organizer edits circle" on public.circles for update to authenticated using (organizer_id = auth.uid());
create policy "members readable" on public.circle_members for select to authenticated using (true);
create policy "join circle" on public.circle_members for insert to authenticated with check (user_id = auth.uid() and role = 'member');
create policy "leave circle" on public.circle_members for delete to authenticated using (user_id = auth.uid());

-- circle board: members only
create policy "members read posts" on public.circle_posts for select to authenticated using (public.is_member(circle_id));
create policy "members post" on public.circle_posts for insert to authenticated with check (author_id = auth.uid() and public.is_member(circle_id));
create policy "delete own post" on public.circle_posts for delete to authenticated using (author_id = auth.uid());

-- reports: file and see your own (staff review them in the Supabase dashboard)
create policy "file report" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "see own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- blocks and waves
create policy "own blocks" on public.blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "send wave" on public.waves for insert to authenticated with check (from_id = auth.uid());
create policy "see your waves" on public.waves for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- =====================================================================
-- Automatic behavior
-- =====================================================================
create or replace function public.add_organizer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into circle_members (circle_id, user_id, role) values (new.id, new.organizer_id, 'organizer');
  return new;
end $$;
create trigger circles_add_organizer after insert on public.circles
  for each row execute function public.add_organizer();

create or replace function public.add_host_rsvp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into rsvps (event_id, user_id) values (new.id, new.host_id) on conflict do nothing;
  return new;
end $$;
create trigger events_add_host after insert on public.events
  for each row execute function public.add_host_rsvp();

-- =====================================================================
-- Safe summaries (no private data leaves the database)
-- =====================================================================
create or replace function public.event_stats(eid uuid)
returns table (going bigint, first_timers bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*),
    count(*) filter (where not exists (
      select 1 from rsvps r2 join events e2 on e2.id = r2.event_id
      where r2.user_id = r.user_id
        and e2.starts_at < (select starts_at from events where id = eid)))
  from rsvps r where r.event_id = eid;
$$;

create or replace function public.event_guests(eid uuid)
returns table (user_id uuid, display_name text, verified boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.verified
  from rsvps r join profiles p on p.id = r.user_id
  where r.event_id = eid
    and (public.is_host(eid) or public.is_going(eid))
    and (p.hide_from_guest_lists = false or p.id = auth.uid())
  order by r.created_at;
$$;

create or replace function public.familiar_faces(eid uuid)
returns table (display_name text, circle_name text)
language sql stable security definer set search_path = public as $$
  select distinct on (p.id) p.display_name, c.name
  from rsvps r
  join profiles p on p.id = r.user_id and p.hide_from_guest_lists = false
  join circle_members theirs on theirs.user_id = r.user_id
  join circle_members mine on mine.circle_id = theirs.circle_id and mine.user_id = auth.uid()
  join circles c on c.id = theirs.circle_id
  where r.event_id = eid and r.user_id <> auth.uid();
$$;

create or replace function public.circle_counts()
returns table (circle_id uuid, members bigint)
language sql stable security definer set search_path = public as $$
  select circle_id, count(*) from circle_members group by circle_id;
$$;

grant execute on function public.event_stats(uuid), public.event_guests(uuid),
  public.familiar_faces(uuid), public.circle_counts(), public.is_going(uuid),
  public.is_host(uuid), public.is_member(uuid), public.is_verified() to anon, authenticated;


-- Later changes: run supabase/2026-10-04_hosting_21_plus.sql, then
-- supabase/2026-10-04_host_reviews.sql, then
-- supabase/2026-10-04_richer_profiles.sql, then
-- supabase/2026-10-04_profile_photos.sql, then
-- supabase/2026-10-04_email_notifications.sql, then
-- supabase/2026-10-05_admin_and_account_deletion.sql, then
-- supabase/2026-10-05_new_member_alerts.sql, after this file.
