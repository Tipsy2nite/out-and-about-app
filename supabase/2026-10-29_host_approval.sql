-- =====================================================================
-- Host approval for gatherings. Safe to run more than once.
-- Run after supabase/2026-10-29_security_hardening.sql.
--
-- "Open invite" off = the host approves each guest:
--   * Members tap "Ask to join". That's a request, not an RSVP.
--   * The host gets an email, looks at the person's profile, and approves
--     or declines from the gathering page.
--   * Only approved guests count as going, see the guest list, get the
--     day-before reminder, and (for home gatherings) see the exact address.
--   * Guests without an account can't request: the host needs a profile to look at.
--   * Switching a gathering back to open invite approves everyone waiting.
-- =====================================================================

-- ---------- RSVP status ----------
alter table public.rsvps add column if not exists status text not null default 'going';
alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check check (status in ('going', 'requested'));
alter table public.rsvps add column if not exists decided_at timestamptz;
create index if not exists rsvps_event_status_idx on public.rsvps (event_id, status);

-- The server decides the status; only the host can turn a request into "going".
create or replace function public.oa_rsvps_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then return new; end if;

  if tg_op = 'INSERT' then
    select host_id, open_invite into e from events where id = new.event_id;
    new.created_at := now();
    new.decided_at := null;
    new.status := case when e.host_id is null or new.user_id = e.host_id or e.open_invite then 'going' else 'requested' end;
    return new;
  end if;

  new.event_id := old.event_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    if not (old.status = 'requested' and new.status = 'going' and public.is_host(old.event_id)) then
      raise exception 'Only the host can approve guests.';
    end if;
    new.decided_at := now();
  else
    new.decided_at := old.decided_at;
  end if;
  return new;
end $$;
revoke all on function public.oa_rsvps_guard() from public, anon, authenticated;
drop trigger if exists oa_rsvps_guard on public.rsvps;
create trigger oa_rsvps_guard before insert or update on public.rsvps
  for each row execute function public.oa_rsvps_guard();

drop policy if exists "host approves guest" on public.rsvps;
create policy "host approves guest" on public.rsvps for update to authenticated
  using (public.is_host(event_id)) with check (public.is_host(event_id));

-- ---------- "Going" now means approved ----------
create or replace function public.is_going(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rsvps where event_id = eid and user_id = auth.uid() and status = 'going');
$$;

create or replace function public.event_guests(eid uuid)
returns table (user_id uuid, display_name text, verified boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.verified
  from rsvps r join profiles p on p.id = r.user_id
  where r.event_id = eid and r.status = 'going'
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
  where r.event_id = eid and r.status = 'going' and r.user_id <> auth.uid();
$$;

create or replace function public.event_stats(eid uuid)
returns table (going bigint, first_timers bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) + (select count(*) from guest_rsvps where event_id = eid),
    count(*) filter (where not exists (
      select 1 from rsvps r2 join events e2 on e2.id = r2.event_id
      where r2.user_id = r.user_id and r2.status = 'going'
        and e2.starts_at < (select starts_at from events where id = eid)))
      + (select count(*) from guest_rsvps where event_id = eid)
  from rsvps r where r.event_id = eid and r.status = 'going';
$$;

create or replace function public.can_review(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e join rsvps r on r.event_id = e.id and r.user_id = auth.uid() and r.status = 'going'
    where e.id = eid
      and e.host_id <> auth.uid()
      and e.status <> 'cancelled'
      and e.starts_at <= now() - interval '1 hour'
      and e.starts_at >= now() - interval '30 days');
$$;

-- Host only: people waiting for approval
create or replace function public.event_requests(eid uuid)
returns table (user_id uuid, display_name text, verified boolean, avatar_url text, area text, requested_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.verified, p.avatar_url, public.oa_area_label(p), r.created_at
  from rsvps r join profiles p on p.id = r.user_id
  where r.event_id = eid and r.status = 'requested' and public.is_host(eid)
  order by r.created_at;
$$;
revoke all on function public.event_requests(uuid) from public, anon;
grant execute on function public.event_requests(uuid) to authenticated;

-- ---------- Emails ----------
-- New RSVP or new request -> host
create or replace function public.oa_rsvps_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e record; who text; going bigint; url text;
begin
  select id, title, host_id, starts_at into e from events where id = new.event_id;
  if e.id is null or new.user_id = e.host_id then return new; end if;
  url := public.oa_event_url(e.id);

  if new.status = 'requested' then
    select display_name into who from profiles where id = new.user_id;
    who := coalesce(who, 'Someone');
    perform public.oa_queue(e.host_id, e.id, 'new_request', 'email_new_rsvps',
      who || ' wants to join ' || e.title, who || ' asked to join',
      '<p style="margin:0"><strong>' || public.oa_esc(who) || '</strong> asked to join <strong>' || public.oa_esc(e.title) || '</strong> on '
        || public.oa_esc(public.oa_when(e.starts_at)) || '.</p>'
        || '<p style="margin:12px 0 0">Look at their profile, then approve or decline on the gathering page. They won''t see the address or guest list until you approve.</p>',
      who || ' asked to join ' || e.title || ' on ' || public.oa_when(e.starts_at) || '. Approve or decline on the gathering page.',
      'Review the request', url, 'You''re getting this because you''re hosting this gathering on Out & About.');
    return new;
  end if;

  select case when hide_from_guest_lists then 'Someone new' else display_name end into who from profiles where id = new.user_id;
  who := coalesce(who, 'Someone new');
  select count(*) into going from rsvps where event_id = e.id and user_id <> e.host_id and status = 'going';
  perform public.oa_queue(e.host_id, e.id, 'new_rsvp', 'email_new_rsvps',
    who || ' is going to ' || e.title, who || ' is coming!',
    '<p style="margin:0"><strong>' || public.oa_esc(who) || '</strong> just RSVP''d to <strong>' || public.oa_esc(e.title) || '</strong> on '
      || public.oa_esc(public.oa_when(e.starts_at)) || '.</p><p style="font-size:20px;font-weight:700;margin:14px 0 4px">' || going || ' guest' || case when going = 1 then '' else 's' end || ' going so far</p>'
      || '<p style="margin:0">People are showing up because you hosted. Thank you for getting Austin outside!</p>',
    who || ' just RSVP''d to ' || e.title || ' on ' || public.oa_when(e.starts_at) || '. ' || going || ' guest(s) going so far.',
    'See who''s coming', url, 'You''re getting this because you''re hosting this gathering on Out & About.');
  return new;
end $$;

-- Approved -> guest
create or replace function public.oa_rsvps_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record; host_name text;
begin
  if not (old.status = 'requested' and new.status = 'going') then return new; end if;
  select id, title, host_id, starts_at, area_label, is_private_location into e from events where id = new.event_id;
  if e.id is null then return new; end if;
  host_name := coalesce((select display_name from profiles where id = e.host_id), 'The host');
  perform public.oa_queue(new.user_id, e.id, 'approved', 'email_plan_changes',
    'You''re in: ' || e.title, 'You''re in!',
    '<p style="margin:0">' || public.oa_esc(host_name) || ' approved you for <strong>' || public.oa_esc(e.title) || '</strong> on '
      || public.oa_esc(public.oa_when(e.starts_at)) || '.</p>'
      || '<p style="margin:12px 0 0">' || case when e.is_private_location
           then 'The exact address is on the gathering page now. Please keep it to yourself.'
           else 'See who else is coming on the gathering page.' end || '</p>',
    host_name || ' approved you for ' || e.title || ' on ' || public.oa_when(e.starts_at) || '.',
    'Open the gathering', public.oa_event_url(e.id), 'You''re getting this because you asked to join this gathering on Out & About.');
  return new;
end $$;
drop trigger if exists oa_rsvps_after_update on public.rsvps;
create trigger oa_rsvps_after_update after update on public.rsvps
  for each row execute function public.oa_rsvps_after_update();

-- Declined -> guest (only when the host removes a waiting request, not when the gathering is deleted)
create or replace function public.oa_rsvps_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if old.status <> 'requested' then return old; end if;
  select id, title, host_id, starts_at into e from events where id = old.event_id;
  if e.id is null or auth.uid() is distinct from e.host_id then return old; end if;
  perform public.oa_queue(old.user_id, e.id, 'declined', 'email_plan_changes',
    'About ' || e.title, 'This one didn''t work out',
    '<p style="margin:0">The host couldn''t fit you in for <strong>' || public.oa_esc(e.title) || '</strong> this time. Hosts keep some gatherings small, so don''t take it personally.</p>'
      || '<p style="margin:12px 0 0">There''s plenty more happening outside.</p>',
    'The host couldn''t fit you in for ' || e.title || ' this time. There''s plenty more happening outside.',
    'Find something else', 'https://outandaboutsocial.net/', 'You''re getting this because you asked to join a gathering on Out & About.');
  return old;
end $$;
drop trigger if exists oa_rsvps_after_delete on public.rsvps;
create trigger oa_rsvps_after_delete after delete on public.rsvps
  for each row execute function public.oa_rsvps_after_delete();

-- Plan changes: approved guests always; people waiting hear about cancellations
-- and time/place changes too, but not "the address changed".
create or replace function public.oa_queue_guests(p_event uuid, p_host uuid, p_kind text,
                                                  p_subject text, p_heading text, p_body_html text, p_body_text text,
                                                  p_button text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; g public.guest_rsvps; addr boolean := p_subject like 'New address:%';
begin
  for r in select user_id from rsvps where event_id = p_event and user_id <> p_host and (status = 'going' or not addr) loop
    perform public.oa_queue(r.user_id, p_event, p_kind, 'email_plan_changes', p_subject, p_heading, p_body_html, p_body_text,
                            p_button, p_url, 'You''re getting this because you RSVP''d to this gathering on Out & About.');
  end loop;
  if addr then return; end if;
  for g in select * from guest_rsvps where event_id = p_event loop
    perform public.oa_queue_guest(g, p_kind, p_subject, p_heading, p_body_html, p_body_text, p_button, p_url);
  end loop;
end $$;
revoke all on function public.oa_queue_guests(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

-- Day-before reminders: approved guests only
create or replace function public.oa_queue_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare e record; r record; host_name text; going bigint; url text; n int := 0;
begin
  for e in
    select * from events
    where status in ('scheduled', 'moved')
      and reminder_sent_at is null
      and starts_at between now() + interval '3 hours' and now() + interval '25 hours'
      and created_at < now() - interval '1 hour'
    for update skip locked
  loop
    host_name := coalesce((select display_name from profiles where id = e.host_id), 'your host');
    select count(*) into going from rsvps where event_id = e.id and status = 'going';
    url := public.oa_event_url(e.id);
    for r in select user_id from rsvps where event_id = e.id and user_id <> e.host_id and status = 'going' loop
      perform public.oa_queue(r.user_id, e.id, 'reminder', 'email_reminders',
        'Tomorrow: ' || e.title, 'See you tomorrow!',
        '<p style="margin:0"><strong>' || public.oa_esc(e.title) || '</strong> with ' || public.oa_esc(host_name) || '</p>'
          || '<p style="margin:8px 0 0">' || public.oa_esc(public.oa_when(e.starts_at)) || '<br>' || public.oa_esc(e.area_label)
          || case when e.is_private_location then ' (exact address on the gathering page)' else '' end || '</p>'
          || '<p style="margin:12px 0 0">' || going || ' going. Check the weather and rain plan before you head out, and if you can''t make it, cancel your RSVP so the host knows.</p>',
        e.title || ' with ' || host_name || E'\n' || public.oa_when(e.starts_at) || E'\n' || e.area_label
          || E'\n' || going || ' going. If you can''t make it, cancel your RSVP so the host knows.',
        'Open the gathering', url, 'You''re getting this because you RSVP''d to this gathering on Out & About.');
      n := n + 1;
    end loop;
    perform public.oa_queue(e.host_id, e.id, 'reminder_host', 'email_reminders',
      'You''re hosting tomorrow: ' || e.title, 'You''re hosting tomorrow',
      '<p style="margin:0"><strong>' || public.oa_esc(e.title) || '</strong>, ' || public.oa_esc(public.oa_when(e.starts_at)) || ' at ' || public.oa_esc(e.area_label) || '.</p>'
        || '<p style="font-size:20px;font-weight:700;margin:14px 0 4px">' || going - 1 || ' guest' || case when going - 1 = 1 then '' else 's' end || ' going</p>'
        || '<p style="margin:0">If plans change, update the gathering page and every guest gets an email.</p>',
      e.title || ', ' || public.oa_when(e.starts_at) || ' at ' || e.area_label || '. ' || (going - 1) || ' guests going.',
      'Open your gathering', url, 'You''re getting this because you''re hosting this gathering on Out & About.');
    update events set reminder_sent_at = now() where id = e.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.oa_queue_reminders() from public, anon, authenticated;

-- Switching back to open invite approves everyone waiting (they get the "you're in" email)
create or replace function public.oa_events_open_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.open_invite = false and new.open_invite = true then
    update rsvps set status = 'going' where event_id = new.id and status = 'requested';
  end if;
  return new;
end $$;
revoke all on function public.oa_events_open_invite() from public, anon, authenticated;
drop trigger if exists oa_events_open_invite on public.events;
create trigger oa_events_open_invite after update of open_invite on public.events
  for each row execute function public.oa_events_open_invite();

-- ---------- Guests without an account: open-invite gatherings only ----------
create or replace function public.guest_rsvp(eid uuid, p_name text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; g public.guest_rsvps; v_email text := lower(trim(p_email)); v_name text := trim(p_name);
        going bigint; host_name text; url text; v_ip text := public.oa_request_ip_hash();
begin
  select * into e from events where id = eid;
  if e.id is null then raise exception 'This gathering isn''t here anymore.'; end if;
  if e.status = 'cancelled' then raise exception 'This gathering is cancelled.'; end if;
  if e.starts_at < now() - interval '3 hours' then raise exception 'This gathering has wrapped up.'; end if;
  if not e.open_invite then raise exception 'This host approves each guest. Make a free account to ask to join.'; end if;
  if v_name = '' or char_length(v_name) > 60 then raise exception 'Enter your name (60 characters max).'; end if;
  if v_name ~ '(https?://|www\.|<|>)' then raise exception 'Enter just your name.'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'Enter a valid email address.'; end if;

  select * into g from guest_rsvps where event_id = eid and lower(email) = v_email;
  if g.id is not null then return g.token; end if;

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

  perform public.oa_queue_guest(g, 'confirm', 'You''re going: ' || e.title, 'You''re in, ' || v_name || '!',
    '<p style="margin:0"><strong>' || public.oa_esc(e.title) || '</strong> with ' || public.oa_esc(host_name) || '</p>'
      || '<p style="margin:8px 0 0">' || public.oa_esc(public.oa_when(e.starts_at)) || '<br>' || public.oa_esc(e.area_label)
      || coalesce('<br>' || public.oa_esc(e.address), '') || '</p>'
      || case when e.is_private_location
           then '<p style="margin:12px 0 0">This one is at a private home. <strong>Make a free account</strong> with this email to see the exact address and who else is coming.</p>'
           else '<p style="margin:12px 0 0">We''ll email you if plans change. Want to see who else is coming? Make a free account with this email.</p>' end,
    e.title || ' with ' || host_name || E'\n' || public.oa_when(e.starts_at) || E'\n' || e.area_label,
    'Open the gathering', url);

  going := (select count(*) from rsvps where event_id = e.id and user_id <> e.host_id and status = 'going') + (select count(*) from guest_rsvps where event_id = e.id);
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

-- Guest reminders: count approved members only
create or replace function public.oa_events_guest_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.guest_rsvps; going bigint; host_name text; url text;
begin
  if old.reminder_sent_at is not null or new.reminder_sent_at is null then return new; end if;
  host_name := coalesce((select display_name from profiles where id = new.host_id), 'your host');
  going := (select count(*) from rsvps where event_id = new.id and status = 'going') + (select count(*) from guest_rsvps where event_id = new.id);
  url := public.oa_event_url(new.id);
  for g in select * from guest_rsvps where event_id = new.id loop
    perform public.oa_queue_guest(g, 'reminder', 'Tomorrow: ' || new.title, 'See you tomorrow, ' || g.name || '!',
      '<p style="margin:0"><strong>' || public.oa_esc(new.title) || '</strong> with ' || public.oa_esc(host_name) || '</p>'
        || '<p style="margin:8px 0 0">' || public.oa_esc(public.oa_when(new.starts_at)) || '<br>' || public.oa_esc(new.area_label)
        || case when new.is_private_location then ' (make a free account to see the exact address)' else '' end || '</p>'
        || '<p style="margin:12px 0 0">' || going || ' going. Check the weather before you head out, and if you can''t make it, cancel your RSVP so the host knows.</p>',
      new.title || ' with ' || host_name || E'\n' || public.oa_when(new.starts_at) || E'\n' || new.area_label
        || E'\n' || going || ' going.',
      'Open the gathering', url);
  end loop;
  return new;
end $$;
