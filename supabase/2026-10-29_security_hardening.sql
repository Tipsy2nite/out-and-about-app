-- =====================================================================
-- Security hardening (Oct 29, 2026). Safe to run more than once.
-- Run after supabase/2026-10-23_guest_rsvps.sql.
--
--  1. Signed-out visitors can no longer call admin-only functions at all
--     (they already got "Admins only"; now they can't even reach them).
--  2. New functions you add later are NOT callable by signed-out visitors
--     unless you grant it on purpose (like the guest RSVP functions do).
--  3. Helper functions get a fixed search_path (Supabase Security Advisor).
--  4. Hosts can't touch server-managed columns on their gathering
--     (stops anyone from re-sending the day-before reminder email over and over).
--  5. A gathering can send at most 10 "plans changed" email blasts per 24 hours.
--  6. Guest RSVPs (no account) get spam limits per device/network, per
--     gathering, and site-wide, so nobody can use the site to email-bomb people.
--  7. Profile photos must be a photo in that person's own folder in our
--     storage (no pointing your photo at an outside tracking server).
-- =====================================================================


-- ---------- 1. Admin functions: signed-in only ----------
revoke execute on function
  public.admin_clear_photo(uuid), public.admin_remove_event(uuid), public.admin_remove_person(uuid, boolean, text),
  public.admin_remove_post(uuid), public.admin_remove_review(uuid), public.admin_reports(text),
  public.admin_set_report_status(uuid, text), public.admin_set_verified(uuid, boolean),
  public.is_admin(), public.is_21(), public.can_review(uuid)
from public, anon;
grant execute on function
  public.admin_clear_photo(uuid), public.admin_remove_event(uuid), public.admin_remove_person(uuid, boolean, text),
  public.admin_remove_post(uuid), public.admin_remove_review(uuid), public.admin_reports(text),
  public.admin_set_report_status(uuid, text), public.admin_set_verified(uuid, boolean),
  public.is_admin(), public.is_21(), public.can_review(uuid)
to authenticated;


-- ---------- 2. Future functions: not public by default ----------
-- Every migration in this project already grants on purpose, so nothing changes today.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;


-- ---------- 3. Fixed search_path on helper functions ----------
alter function public.oa_esc(text)                                       set search_path = public;
alter function public.oa_when(timestamptz)                               set search_path = public;
alter function public.oa_event_url(uuid)                                 set search_path = public;
alter function public.oa_email_html(text, text, text, text, text)        set search_path = public;
alter function public.oa_guest_email_html(text, text, text, text, text)  set search_path = public;
alter function public.oa_guest_cancel_url(uuid)                          set search_path = public;
alter function public.oa_area_label(public.profiles)                     set search_path = public;
alter function public.oa_events_before_update()                          set search_path = public;


-- ---------- 4 + 5. Gatherings: lock server columns, limit email blasts ----------
create or replace function public.oa_events_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare blasts int;
begin
  -- Only limit people using the app (requests that carry a signed-in or
  -- visitor token). The scheduler and the SQL editor have no token.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    new.reminder_sent_at := null;
    new.created_at := now();
    return new;
  end if;

  -- Server-managed columns. (oa_events_before_update already clears
  -- reminder_sent_at when the time changes; keep that, block everything else.)
  new.id := old.id;
  new.host_id := old.host_id;
  new.created_at := old.created_at;
  if new.starts_at is not distinct from old.starts_at then
    new.reminder_sent_at := old.reminder_sent_at;
  else
    new.reminder_sent_at := null;
  end if;

  -- Would this update email the guests? Then check how many blasts went out today.
  if new.status is distinct from old.status
     or (new.status <> 'scheduled' and new.status_note is distinct from old.status_note)
     or new.starts_at is distinct from old.starts_at
     or new.area_label is distinct from old.area_label
     or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    select count(distinct created_at) into blasts
    from email_queue
    where event_id = new.id
      and kind in ('status', 'details', 'guest_status', 'guest_details')
      and created_at > now() - interval '24 hours';
    if blasts >= 10 then
      raise exception 'You''ve updated this gathering a lot today, and every change emails your guests. Try again tomorrow, or email outandaboutsocialnet@gmail.com if it''s urgent.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.oa_events_guard() from public, anon, authenticated;

drop trigger if exists oa_events_guard on public.events;
-- Name sorts after oa_events_before_update, so it runs second.
create trigger oa_events_guard before insert or update on public.events
  for each row execute function public.oa_events_guard();


-- ---------- 6. Guest RSVP spam limits ----------
alter table public.guest_rsvps add column if not exists ip_hash text;
create index if not exists guest_rsvps_ip_created_idx on public.guest_rsvps (ip_hash, created_at);
create index if not exists guest_rsvps_created_idx on public.guest_rsvps (created_at);

-- Who's asking (hashed; we never keep the raw IP address)
create or replace function public.oa_request_ip_hash() returns text
language plpgsql stable set search_path = public as $$
declare h json; ip text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  ip := trim(split_part(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1));
  if ip = '' then return null; end if;
  return md5('oa-guest:' || ip);
end $$;
revoke all on function public.oa_request_ip_hash() from public, anon, authenticated;

create or replace function public.guest_rsvp(eid uuid, p_name text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; g public.guest_rsvps; v_email text := lower(trim(p_email)); v_name text := trim(p_name);
        going bigint; host_name text; url text; v_ip text := public.oa_request_ip_hash();
begin
  select * into e from events where id = eid;
  if e.id is null then raise exception 'This gathering isn''t here anymore.'; end if;
  if e.status = 'cancelled' then raise exception 'This gathering is cancelled.'; end if;
  if e.starts_at < now() - interval '3 hours' then raise exception 'This gathering has wrapped up.'; end if;
  if v_name = '' or char_length(v_name) > 60 then raise exception 'Enter your name (60 characters max).'; end if;
  if v_name ~ '(https?://|www\.|<|>)' then raise exception 'Enter just your name.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address.'; end if;

  -- Already on the list? Just hand back their token (no duplicate emails).
  select * into g from guest_rsvps where event_id = eid and lower(email) = v_email;
  if g.id is not null then return g.token; end if;

  -- Spam limits
  if (select count(*) from guest_rsvps where lower(email) = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many RSVPs from this email today. Make a free account to keep going.';
  end if;
  if v_ip is not null and (select count(*) from guest_rsvps where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'Lots of guest RSVPs from here in the last hour. Make a free account, or try again later.';
  end if;
  if v_ip is not null and (select count(*) from guest_rsvps where ip_hash = v_ip and created_at > now() - interval '1 day') >= 25 then
    raise exception 'Lots of guest RSVPs from here today. Make a free account to keep going.';
  end if;
  if (select count(*) from guest_rsvps where event_id = eid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'This gathering is getting a rush of guest RSVPs. Make a free account, or try again in a bit.';
  end if;
  if (select count(*) from guest_rsvps where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Guest RSVPs are busy right now. Make a free account, or try again in a bit.';
  end if;
  if (select count(*) from guest_rsvps where event_id = eid) >= 300 then
    raise exception 'Guest spots are full. Make a free account to RSVP.';
  end if;

  insert into guest_rsvps (event_id, name, email, ip_hash) values (eid, v_name, v_email, v_ip) returning * into g;

  host_name := coalesce((select display_name from profiles where id = e.host_id), 'your host');
  url := public.oa_event_url(e.id);

  -- Confirmation to the guest
  perform public.oa_queue_guest(g, 'confirm', 'You''re going: ' || e.title, 'You''re in, ' || v_name || '!',
    '<p style="margin:0"><strong>' || public.oa_esc(e.title) || '</strong> with ' || public.oa_esc(host_name) || '</p>'
      || '<p style="margin:8px 0 0">' || public.oa_esc(public.oa_when(e.starts_at)) || '<br>' || public.oa_esc(e.area_label)
      || coalesce('<br>' || public.oa_esc(e.address), '') || '</p>'
      || case when e.is_private_location
           then '<p style="margin:12px 0 0">This one is at a private home. <strong>Make a free account</strong> with this email to see the exact address and who else is coming.</p>'
           else '<p style="margin:12px 0 0">We''ll email you if plans change. Want to see who else is coming? Make a free account with this email.</p>' end,
    e.title || ' with ' || host_name || E'\n' || public.oa_when(e.starts_at) || E'\n' || e.area_label,
    'Open the gathering', url);

  -- Let the host know
  going := (select count(*) from rsvps where event_id = e.id and user_id <> e.host_id) + (select count(*) from guest_rsvps where event_id = e.id);
  perform public.oa_queue(e.host_id, e.id, 'new_rsvp', 'email_new_rsvps',
    v_name || ' (guest) is going to ' || e.title, v_name || ' is coming!',
    '<p style="margin:0"><strong>' || public.oa_esc(v_name) || '</strong> just RSVP''d as a guest to <strong>' || public.oa_esc(e.title) || '</strong> on '
      || public.oa_esc(public.oa_when(e.starts_at)) || '.</p><p style="font-size:20px;font-weight:700;margin:14px 0 4px">' || going || ' guest' || case when going = 1 then '' else 's' end || ' going so far</p>'
      || '<p style="margin:0">Guests don''t have an account yet, so they can''t see private addresses.</p>',
    v_name || ' just RSVP''d as a guest to ' || e.title || '. ' || going || ' guest(s) going so far.',
    'See who''s coming', url, 'You''re getting this because you''re hosting this gathering on Out & About.');

  return g.token;
end $$;
revoke all on function public.guest_rsvp(uuid, text, text) from public;
grant execute on function public.guest_rsvp(uuid, text, text) to anon, authenticated;


-- ---------- 7. Profile photos: only from our own storage, own folder ----------
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null or (
    char_length(avatar_url) <= 500
    and avatar_url like 'https://gwgibtsdczrbqkjhrhbm.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
  )
) not valid;   -- checks every new save; older rows are checked just below
do $$ begin
  alter table public.profiles validate constraint profiles_avatar_url_check;
exception when check_violation then
  raise notice 'Some existing profile photos point somewhere else. New saves are still checked.';
end $$;
