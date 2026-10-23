-- =====================================================================
-- Invite links + guest RSVPs
--
-- Anyone with a gathering's link can RSVP without an account by giving a
-- name and email. Guests:
--   * count toward "going" and show (by first name) on the host's guest list
--   * get a confirmation email with a link to cancel, plus the same
--     plan-change and day-before emails members get
--   * never see a private-home address. Making an account unlocks it.
--
-- Run after supabase/2026-10-09_event_address.sql. Safe to run more than once.
-- =====================================================================

create table if not exists public.guest_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  token uuid not null unique default gen_random_uuid(),   -- secret; lets the guest cancel
  created_at timestamptz not null default now()
);
create unique index if not exists guest_rsvps_event_email_idx on public.guest_rsvps (event_id, lower(email));
create index if not exists guest_rsvps_email_created_idx on public.guest_rsvps (lower(email), created_at);
alter table public.guest_rsvps enable row level security;   -- no policies: only the functions below touch it
revoke all on public.guest_rsvps from anon, authenticated;

-- ---------- Guest email look (cancel link instead of "email settings") ----------
create or replace function public.oa_guest_email_html(heading text, body_html text, button_text text, button_url text, cancel_url text)
returns text language sql immutable as $$
  select
  '<!doctype html><html><body style="margin:0;background:#FBF5E9;font-family:Helvetica,Arial,sans-serif;color:#1F3A2C">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF5E9;padding:24px 12px"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:2px solid #1F3A2C;border-radius:18px">'
  || '<tr><td style="padding:22px 24px 6px;font:700 18px Georgia,serif">&#9728; Out &amp; About</td></tr>'
  || '<tr><td style="padding:6px 24px 0"><h1 style="margin:0 0 12px;font:800 24px/1.2 Georgia,serif">' || public.oa_esc(heading) || '</h1>'
  || '<div style="font-size:16px;line-height:1.55">' || body_html || '</div></td></tr>'
  || case when button_url is null then '' else
     '<tr><td style="padding:18px 24px 6px"><a href="' || public.oa_esc(button_url) || '" style="display:inline-block;background:#F2A541;color:#1F3A2C;border:2px solid #1F3A2C;border-radius:12px;padding:12px 20px;font-weight:700;text-decoration:none">'
     || public.oa_esc(button_text) || '</a></td></tr>' end
  || '<tr><td style="padding:18px 24px 22px;font-size:13px;line-height:1.5;color:#4A5B50">You''re getting this because you RSVP''d as a guest on Out &amp; About. '
  || '<a href="' || public.oa_esc(cancel_url) || '" style="color:#4A5B50">Cancel your RSVP</a> to stop these emails.</td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

create or replace function public.oa_guest_cancel_url(tok uuid) returns text
language sql immutable as $$ select 'https://outandaboutsocial.net/#/rsvp/cancel/' || tok::text; $$;

create or replace function public.oa_queue_guest(g public.guest_rsvps, p_kind text, p_subject text, p_heading text,
                                                 p_body_html text, p_body_text text, p_button text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into email_queue (kind, user_id, event_id, to_email, subject, html, text_body)
  values ('guest_' || p_kind, null, g.event_id, g.email, left(p_subject, 200),
          public.oa_guest_email_html(p_heading, p_body_html, p_button, p_url, public.oa_guest_cancel_url(g.token)),
          p_body_text || E'\n\n' || coalesce(p_url, '') || E'\n\nYou RSVP''d as a guest on Out & About. Cancel your RSVP: '
          || public.oa_guest_cancel_url(g.token));
end $$;

-- ---------- Plan-change emails now reach guests too ----------
create or replace function public.oa_queue_guests(p_event uuid, p_host uuid, p_kind text,
                                                  p_subject text, p_heading text, p_body_html text, p_body_text text,
                                                  p_button text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; g public.guest_rsvps;
begin
  for r in select user_id from rsvps where event_id = p_event and user_id <> p_host loop
    perform public.oa_queue(r.user_id, p_event, p_kind, 'email_plan_changes', p_subject, p_heading, p_body_html, p_body_text,
                            p_button, p_url, 'You''re getting this because you RSVP''d to this gathering on Out & About.');
  end loop;
  -- Guests can't see private addresses, so they skip "the address changed" emails
  if p_subject like 'New address:%' then return; end if;
  for g in select * from guest_rsvps where event_id = p_event loop
    perform public.oa_queue_guest(g, p_kind, p_subject, p_heading, p_body_html, p_body_text, p_button, p_url);
  end loop;
end $$;

-- ---------- Day-before reminders for guests ----------
-- The member reminder job stamps events.reminder_sent_at; guests get theirs at the same moment.
create or replace function public.oa_events_guest_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.guest_rsvps; going bigint; host_name text; url text;
begin
  if old.reminder_sent_at is not null or new.reminder_sent_at is null then return new; end if;
  host_name := coalesce((select display_name from profiles where id = new.host_id), 'your host');
  going := (select count(*) from rsvps where event_id = new.id) + (select count(*) from guest_rsvps where event_id = new.id);
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
drop trigger if exists oa_events_guest_reminders on public.events;
create trigger oa_events_guest_reminders after update of reminder_sent_at on public.events
  for each row execute function public.oa_events_guest_reminders();

-- =====================================================================
-- What the app calls
-- =====================================================================

-- RSVP as a guest. Returns the secret token (the browser keeps it so the
-- guest can see "you're in" and cancel).
create or replace function public.guest_rsvp(eid uuid, p_name text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare e record; g public.guest_rsvps; v_email text := lower(trim(p_email)); v_name text := trim(p_name);
        going bigint; host_name text; url text;
begin
  select * into e from events where id = eid;
  if e.id is null then raise exception 'This gathering isn''t here anymore.'; end if;
  if e.status = 'cancelled' then raise exception 'This gathering is cancelled.'; end if;
  if e.starts_at < now() - interval '3 hours' then raise exception 'This gathering has wrapped up.'; end if;
  if v_name = '' or char_length(v_name) > 60 then raise exception 'Enter your name (60 characters max).'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;

  -- Already on the list? Just hand back their token (no duplicate emails).
  select * into g from guest_rsvps where event_id = eid and lower(email) = v_email;
  if g.id is not null then return g.token; end if;

  -- Light anti-spam limits
  if (select count(*) from guest_rsvps where lower(email) = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many RSVPs from this email today. Make a free account to keep going.';
  end if;
  if (select count(*) from guest_rsvps where event_id = eid) >= 300 then
    raise exception 'Guest spots are full. Make a free account to RSVP.';
  end if;

  insert into guest_rsvps (event_id, name, email) values (eid, v_name, v_email) returning * into g;

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

-- Look up a guest RSVP by its token (for "you're in" and the cancel page)
create or replace function public.guest_rsvp_lookup(tok uuid)
returns table (event_id uuid, name text, title text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.event_id, g.name, e.title, e.starts_at from guest_rsvps g join events e on e.id = g.event_id where g.token = tok;
$$;

-- Cancel a guest RSVP by its token
create or replace function public.guest_rsvp_cancel(tok uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from guest_rsvps where token = tok;
  return found;
end $$;

-- Host only: guest names for their gathering
create or replace function public.event_guest_rsvps(eid uuid)
returns table (name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.name, g.created_at from guest_rsvps g
  where g.event_id = eid and public.is_host(eid)
  order by g.created_at;
$$;

-- "Going" counts now include guests (guests count as first-timers)
create or replace function public.event_stats(eid uuid)
returns table (going bigint, first_timers bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) + (select count(*) from guest_rsvps where event_id = eid),
    count(*) filter (where not exists (
      select 1 from rsvps r2 join events e2 on e2.id = r2.event_id
      where r2.user_id = r.user_id
        and e2.starts_at < (select starts_at from events where id = eid)))
      + (select count(*) from guest_rsvps where event_id = eid)
  from rsvps r where r.event_id = eid;
$$;

revoke all on function public.oa_queue_guest(public.guest_rsvps, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.guest_rsvp(uuid, text, text), public.guest_rsvp_lookup(uuid),
  public.guest_rsvp_cancel(uuid), public.event_guest_rsvps(uuid), public.event_stats(uuid) to anon, authenticated;
