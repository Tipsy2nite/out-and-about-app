-- =====================================================================
-- Host reviews: people who RSVP'd can rate the host (1-5 stars + optional
-- comment) once the gathering has happened. Safe to run more than once.
-- =====================================================================

-- Reviews stay on the host's profile even if they later delete the gathering
-- (event_id becomes empty, but the title and date are kept).
create table if not exists public.host_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  event_title text,                                                        -- filled in automatically
  event_date timestamptz,                                                  -- filled in automatically
  reviewer_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,  -- filled in automatically
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, reviewer_id)
);
create index if not exists host_reviews_host_idx on public.host_reviews (host_id, created_at desc);
alter table public.host_reviews enable row level security;

-- Always take the host from the event itself, so nobody can point a review at someone else
create or replace function public.set_review_host() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select host_id, title, starts_at into new.host_id, new.event_title, new.event_date
    from events where id = new.event_id;
  else
    new.event_id := old.event_id; new.host_id := old.host_id;
    new.event_title := old.event_title; new.event_date := old.event_date;
    new.reviewer_id := old.reviewer_id; new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists host_reviews_set_host on public.host_reviews;
create trigger host_reviews_set_host before insert or update on public.host_reviews
  for each row execute function public.set_review_host();

-- You can review a gathering if you RSVP'd, you aren't the host, it wasn't
-- cancelled, it started at least 1 hour ago, and it was within the last 30 days.
create or replace function public.can_review(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join rsvps r on r.event_id = e.id and r.user_id = auth.uid()
    where e.id = eid
      and e.host_id <> auth.uid()
      and e.status <> 'cancelled'
      and e.starts_at <= now() - interval '1 hour'
      and e.starts_at >= now() - interval '30 days');
$$;

drop policy if exists "write own review" on public.host_reviews;
create policy "write own review" on public.host_reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.can_review(event_id));
drop policy if exists "edit own review" on public.host_reviews;
create policy "edit own review" on public.host_reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid() and public.can_review(event_id));
drop policy if exists "delete own review" on public.host_reviews;
create policy "delete own review" on public.host_reviews for delete to authenticated using (reviewer_id = auth.uid());
-- Read your own rows directly; everyone else reads through the functions below
-- (which hide the names of people who posted anonymously).
drop policy if exists "see own reviews" on public.host_reviews;
create policy "see own reviews" on public.host_reviews for select to authenticated using (reviewer_id = auth.uid());

-- Star average + count for one or many hosts (shown to everyone, signed in or not)
create or replace function public.host_ratings(hids uuid[])
returns table (host_id uuid, avg_rating numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select host_id, round(avg(rating)::numeric, 1), count(*)
  from host_reviews where host_id = any(hids) group by host_id;
$$;

-- Review list for a host's profile (signed-in people only)
create or replace function public.host_review_list(hid uuid)
returns table (review_id uuid, event_id uuid, event_title text, event_date timestamptz, rating smallint, comment text,
               reviewer_id uuid, reviewer_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.event_id, r.event_title, r.event_date, r.rating, r.comment,
         case when r.anonymous then null else p.id end,
         case when r.anonymous then null else p.display_name end,
         r.created_at
  from host_reviews r
  join profiles p on p.id = r.reviewer_id
  where r.host_id = hid and auth.uid() is not null
  order by r.created_at desc
  limit 100;
$$;

grant execute on function public.host_ratings(uuid[]) to anon, authenticated;
grant execute on function public.host_review_list(uuid), public.can_review(uuid) to authenticated;

-- Let people report a review
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('event','user','post','circle','review'));
