-- =====================================================================
-- Email notifications, sent through Resend from hello@outandaboutsocial.net
--
--   1. Plans changed   -> guests, when a host moves / postpones / cancels /
--                         un-cancels, changes the time or place, updates the
--                         private address, or deletes the gathering
--   2. Day-before      -> guests and the host, about 24 hours ahead
--   3. New RSVP        -> the host, each time someone new says they're going
--
-- How it works: database triggers write each email into public.email_queue.
-- A scheduled job (pg_cron) sends whatever is waiting once a minute using
-- Resend's batch API (via pg_net), then checks the replies and retries
-- failures up to 3 times. Another job queues day-before reminders every
-- 15 minutes.
--
-- Needs ONE secret in Supabase Vault named  resend_api_key  (a Resend API key
-- with "Sending access"). Until it exists, emails wait in the queue.
-- Safe to run more than once.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------- Who wants which emails (on by default) ----------
alter table public.profile_private
  add column if not exists email_plan_changes boolean not null default true,
  add column if not exists email_reminders    boolean not null default true,
  add column if not exists email_new_rsvps    boolean not null default true;

-- ---------- Remember which gatherings already got their reminder ----------
alter table public.events add column if not exists reminder_sent_at timestamptz;

-- ---------- The outbox ----------
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                -- status | details | deleted | reminder | reminder_host | new_rsvp
  user_id uuid,
  event_id uuid,
  to_email text not null,
  subject text not null,
  html text not null,
  text_body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  request_id bigint,
  attempts int not null default 0,
  checked boolean not null default false,   -- have we read Resend's reply for the latest send?
  last_error text
);
alter table public.email_queue add column if not exists checked boolean not null default false;
create index if not exists email_queue_unsent_idx on public.email_queue (created_at) where sent_at is null;
alter table public.email_queue enable row level security;   -- no policies: the app can't read or write it
revoke all on public.email_queue from anon, authenticated;

-- ---------- Small helpers ----------
create or replace function public.oa_esc(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

create or replace function public.oa_when(ts timestamptz) returns text
language sql stable as $$
  select trim(to_char(ts at time zone 'America/Chicago', 'FMDay, FMMonth FMDD "at" FMHH12:MI AM'));
$$;

create or replace function public.oa_event_url(eid uuid) returns text
language sql immutable as $$ select 'https://outandaboutsocial.net/#/events/' || eid::text; $$;

-- Wrap a message in the Out & About email look
create or replace function public.oa_email_html(heading text, body_html text, button_text text, button_url text, why text)
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
  || '<tr><td style="padding:18px 24px 22px;font-size:13px;line-height:1.5;color:#4A5B50">' || public.oa_esc(why)
  || ' <a href="https://outandaboutsocial.net/#/me" style="color:#4A5B50">Change email settings</a>.</td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

-- Put one email in the outbox for a member, if they have that kind turned on
create or replace function public.oa_queue(p_user uuid, p_event uuid, p_kind text, p_pref text,
                                           p_subject text, p_heading text, p_body_html text, p_body_text text,
                                           p_button text, p_url text, p_why text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_ok boolean;
begin
  select u.email into v_email from auth.users u where u.id = p_user;
  if v_email is null then return; end if;
  execute format('select coalesce((select %I from public.profile_private where user_id = $1), true)', p_pref)
    into v_ok using p_user;
  if not v_ok then return; end if;
  insert into email_queue (kind, user_id, event_id, to_email, subject, html, text_body)
  values (p_kind, p_user, p_event, v_email, left(p_subject, 200),
          public.oa_email_html(p_heading, p_body_html, p_button, p_url, p_why),
          p_body_text || E'\n\n' || coalesce(p_url, '') || E'\n\n' || p_why || ' Change email settings: https://outandaboutsocial.net/#/me');
end $$;

-- Email every guest (not the host) of a gathering
create or replace function public.oa_queue_guests(p_event uuid, p_host uuid, p_kind text,
                                                  p_subject text, p_heading text, p_body_html text, p_body_text text,
                                                  p_button text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select user_id from rsvps where event_id = p_event and user_id <> p_host loop
    perform public.oa_queue(r.user_id, p_event, p_kind, 'email_plan_changes', p_subject, p_heading, p_body_html, p_body_text,
                            p_button, p_url, 'You''re getting this because you RSVP''d to this gathering on Out & About.');
  end loop;
end $$;

-- =====================================================================
-- 1. Plans changed
-- =====================================================================
create or replace function public.oa_events_before_update() returns trigger
language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at then new.reminder_sent_at := null; end if;
  return new;
end $$;
drop trigger if exists oa_events_before_update on public.events;
create trigger oa_events_before_update before update on public.events
  for each row execute function public.oa_events_before_update();

create or replace function public.oa_events_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  host_name text := coalesce((select display_name from profiles where id = new.host_id), 'The host');
  url text := public.oa_event_url(new.id);
  note_html text := case when coalesce(trim(new.status_note), '') = '' then ''
                    else '<p style="margin:12px 0;padding:12px 14px;background:#FDE7C8;border-radius:12px"><strong>Note from ' || public.oa_esc(host_name) || ':</strong> ' || public.oa_esc(left(new.status_note, 300)) || '</p>' end;
  note_text text := case when coalesce(trim(new.status_note), '') = '' then '' else E'\nNote from ' || host_name || ': ' || left(new.status_note, 300) end;
  changes_html text := '';
  changes_text text := '';
  subj text; head text; lead text;
begin
  -- Status changed (moved / postponed / cancelled / back on)
  if new.status is distinct from old.status
     or (new.status <> 'scheduled' and new.status_note is distinct from old.status_note) then
    if new.status = 'cancelled' then
      subj := 'Cancelled: ' || new.title; head := 'This gathering is cancelled';
      lead := host_name || ' cancelled ' || new.title || ', which was set for ' || public.oa_when(new.starts_at) || '.';
    elsif new.status = 'postponed' then
      subj := 'Postponed: ' || new.title; head := 'This gathering is postponed';
      lead := host_name || ' postponed ' || new.title || ' (it was set for ' || public.oa_when(new.starts_at) || ').';
    elsif new.status = 'moved' then
      subj := 'Moved: ' || new.title; head := 'This gathering moved';
      lead := host_name || ' moved ' || new.title || ' on ' || public.oa_when(new.starts_at) || ' to a backup spot.';
    else
      subj := 'Back on: ' || new.title; head := 'Good news: it''s back on';
      lead := new.title || ' is happening as planned on ' || public.oa_when(new.starts_at) || '.';
    end if;
    perform public.oa_queue_guests(new.id, new.host_id, 'status', subj, head,
      '<p style="margin:0">' || public.oa_esc(lead) || '</p>' || note_html,
      lead || note_text, 'See the latest', url);
    return new;
  end if;

  -- Time or place changed
  if new.starts_at is distinct from old.starts_at then
    changes_html := changes_html || '<li><strong>New time:</strong> ' || public.oa_esc(public.oa_when(new.starts_at)) || '</li>';
    changes_text := changes_text || E'\nNew time: ' || public.oa_when(new.starts_at);
  end if;
  if new.area_label is distinct from old.area_label or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    changes_html := changes_html || '<li><strong>New place:</strong> ' || public.oa_esc(new.area_label) || '</li>';
    changes_text := changes_text || E'\nNew place: ' || new.area_label;
  end if;
  if changes_html <> '' and new.status <> 'cancelled' then
    perform public.oa_queue_guests(new.id, new.host_id, 'details', 'Plans changed: ' || new.title, 'Plans changed',
      '<p style="margin:0">' || public.oa_esc(host_name) || ' updated <strong>' || public.oa_esc(new.title) || '</strong>:</p><ul>' || changes_html || '</ul>',
      host_name || ' updated ' || new.title || ':' || changes_text, 'See the details', url);
  end if;
  return new;
end $$;
drop trigger if exists oa_events_after_update on public.events;
create trigger oa_events_after_update after update on public.events
  for each row execute function public.oa_events_after_update();

-- Private address changed
create or replace function public.oa_address_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  if new.address is not distinct from old.address then return new; end if;
  select id, title, host_id, status into e from events where id = new.event_id;
  if e.id is null or e.status = 'cancelled' then return new; end if;
  perform public.oa_queue_guests(e.id, e.host_id, 'details', 'New address: ' || e.title, 'The address changed',
    '<p style="margin:0">The host updated the address for <strong>' || public.oa_esc(e.title) || '</strong>. Open the gathering to see it (it''s only shown to people who RSVP''d).</p>',
    'The host updated the address for ' || e.title || '. Open the gathering to see it.', 'See the new address', public.oa_event_url(e.id));
  return new;
end $$;
drop trigger if exists oa_address_after_update on public.event_locations;
create trigger oa_address_after_update after update on public.event_locations
  for each row execute function public.oa_address_after_update();

-- Gathering deleted (runs before the RSVPs disappear)
create or replace function public.oa_events_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare host_name text := coalesce((select display_name from profiles where id = old.host_id), 'The host');
begin
  if old.starts_at > now() and old.status <> 'cancelled' then
    perform public.oa_queue_guests(old.id, old.host_id, 'deleted', 'Cancelled: ' || old.title, 'This gathering is cancelled',
      '<p style="margin:0">' || public.oa_esc(host_name) || ' removed <strong>' || public.oa_esc(old.title) || '</strong>, which was set for '
        || public.oa_esc(public.oa_when(old.starts_at)) || '. Sorry about that! There''s plenty more happening outside.</p>',
      host_name || ' removed ' || old.title || ', which was set for ' || public.oa_when(old.starts_at) || '.',
      'Find something else', 'https://outandaboutsocial.net/');
  end if;
  return old;
end $$;
drop trigger if exists oa_events_before_delete on public.events;
create trigger oa_events_before_delete before delete on public.events
  for each row execute function public.oa_events_before_delete();

-- =====================================================================
-- 3. New RSVP -> host
-- =====================================================================
create or replace function public.oa_rsvps_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e record; who text; going bigint; url text;
begin
  select id, title, host_id, starts_at into e from events where id = new.event_id;
  if e.id is null or new.user_id = e.host_id then return new; end if;
  select case when hide_from_guest_lists then 'Someone new' else display_name end into who from profiles where id = new.user_id;
  who := coalesce(who, 'Someone new');
  select count(*) into going from rsvps where event_id = e.id and user_id <> e.host_id;
  url := public.oa_event_url(e.id);
  perform public.oa_queue(e.host_id, e.id, 'new_rsvp', 'email_new_rsvps',
    who || ' is going to ' || e.title, who || ' is coming!',
    '<p style="margin:0"><strong>' || public.oa_esc(who) || '</strong> just RSVP''d to <strong>' || public.oa_esc(e.title) || '</strong> on '
      || public.oa_esc(public.oa_when(e.starts_at)) || '.</p><p style="font-size:20px;font-weight:700;margin:14px 0 4px">' || going || ' guest' || case when going = 1 then '' else 's' end || ' going so far</p>'
      || '<p style="margin:0">People are showing up because you hosted. Thank you for getting Austin outside!</p>',
    who || ' just RSVP''d to ' || e.title || ' on ' || public.oa_when(e.starts_at) || '. ' || going || ' guest(s) going so far.',
    'See who''s coming', url, 'You''re getting this because you''re hosting this gathering on Out & About.');
  return new;
end $$;
drop trigger if exists oa_rsvps_after_insert on public.rsvps;
create trigger oa_rsvps_after_insert after insert on public.rsvps
  for each row execute function public.oa_rsvps_after_insert();

-- =====================================================================
-- 2. Day-before reminders (guests + host)
-- =====================================================================
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
    select count(*) into going from rsvps where event_id = e.id;
    url := public.oa_event_url(e.id);
    for r in select user_id from rsvps where event_id = e.id and user_id <> e.host_id loop
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

-- =====================================================================
-- Sending (Resend batch API, up to 100 emails per minute)
-- =====================================================================
create or replace function public.oa_send_emails() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text; v_batch jsonb; v_ids uuid[]; v_req bigint; r record;
begin
  -- 1) Read Resend's replies to earlier sends. Success: done. Failure: try
  --    again next minute (up to 3 tries in total).
  for r in
    select q.id, q.attempts, resp.status_code, resp.timed_out,
           coalesce(resp.error_msg, left(resp.content::text, 300)) as err
    from email_queue q join net._http_response resp on resp.id = q.request_id
    where q.sent_at is not null and not q.checked
  loop
    if r.status_code between 200 and 299 and not coalesce(r.timed_out, false) then
      update email_queue set checked = true, last_error = null where id = r.id;
    else
      update email_queue
         set checked = true,
             last_error = coalesce(r.err, 'HTTP ' || coalesce(r.status_code::text, 'no reply')),
             sent_at = case when r.attempts < 3 then null else sent_at end
       where id = r.id;
    end if;
  end loop;

  -- 2) Send what's waiting
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_key is null or v_key = '' then return 0; end if;

  with picked as (
    select id, to_email, subject, html, text_body from email_queue
    where sent_at is null and attempts < 3
    order by created_at limit 100
    for update skip locked
  )
  select jsonb_agg(jsonb_build_object(
           'from', 'Out & About <hello@outandaboutsocial.net>',
           'to', jsonb_build_array(to_email),
           'subject', subject, 'html', html, 'text', text_body)),
         array_agg(id)
    into v_batch, v_ids
  from picked;
  if v_ids is null then return 0; end if;

  select net.http_post(
           url := 'https://api.resend.com/emails/batch',
           body := v_batch,
           headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
           timeout_milliseconds := 15000)
    into v_req;

  update email_queue set sent_at = now(), request_id = v_req, attempts = attempts + 1, checked = false where id = any(v_ids);
  return array_length(v_ids, 1);
end $$;

-- Only the scheduler (database owner) runs these
revoke all on function public.oa_send_emails(), public.oa_queue_reminders() from public, anon, authenticated;
revoke all on function public.oa_queue(uuid, uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.oa_queue_guests(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

-- Keep the outbox tidy: delete sent emails after 30 days
create or replace function public.oa_cleanup_emails() returns void
language sql security definer set search_path = public as $$
  delete from email_queue where sent_at < now() - interval '30 days';
$$;
revoke all on function public.oa_cleanup_emails() from public, anon, authenticated;

-- ---------- Schedules ----------
select cron.unschedule(jobname) from cron.job where jobname in ('oa-send-emails', 'oa-day-before', 'oa-email-cleanup');
select cron.schedule('oa-send-emails',   '* * * * *',    $$select public.oa_send_emails()$$);
select cron.schedule('oa-day-before',    '*/15 * * * *', $$select public.oa_queue_reminders()$$);
select cron.schedule('oa-email-cleanup', '17 4 * * *',   $$select public.oa_cleanup_emails()$$);
