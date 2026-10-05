-- =====================================================================
-- Admin tools + "Delete my account". Safe to run more than once.
--
--  * public.admins           who can use the /admin page
--  * public.banned_emails    emails that can't sign up again after a ban
--  * admin_* functions        everything the admin page does (each one checks
--                             that the caller is an admin first)
--  * delete_my_account()      lets a member erase their own account
--  * new reports email every admin right away
-- =====================================================================

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins see admins" on public.admins;
create policy "admins see admins" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Make Khori the first admin
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'khotic09@gmail.com'
on conflict do nothing;

-- ---------- Banned emails (checked at sign-up) ----------
create table if not exists public.banned_emails (
  email text primary key,
  reason text,
  banned_at timestamptz not null default now()
);
alter table public.banned_emails enable row level security;   -- no policies: app can't read it
revoke all on public.banned_emails from anon, authenticated;

create or replace function public.oa_block_banned_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from banned_emails where email = lower(new.email)) then
    raise exception 'This email can''t be used on Out & About.';
  end if;
  return new;
end $$;
drop trigger if exists oa_block_banned_signup on auth.users;
create trigger oa_block_banned_signup before insert on auth.users
  for each row execute function public.oa_block_banned_signup();

-- ---------- Admins can remove any profile photo file ----------
drop policy if exists "admins delete any avatar" on storage.objects;
create policy "admins delete any avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- ---------- Reports list for the admin page ----------
create or replace function public.admin_reports(p_status text default 'open')
returns table (
  id uuid, created_at timestamptz, status text, reason text, details text,
  target_type text, target_id uuid,
  reporter_id uuid, reporter_name text,
  target_label text,        -- gathering title, person's name, post/review text…
  target_person_id uuid,    -- the person responsible for the reported thing
  target_person_name text,
  target_avatar_url text,
  target_event_id uuid,
  open_reports_on_person bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  with base as (
    select r.*,
      case r.target_type
        when 'event'  then (select e.host_id from events e where e.id = r.target_id)
        when 'user'   then r.target_id
        when 'post'   then (select cp.author_id from circle_posts cp where cp.id = r.target_id)
        when 'circle' then (select c.organizer_id from circles c where c.id = r.target_id)
        when 'review' then (select hr.reviewer_id from host_reviews hr where hr.id = r.target_id)
      end as person_id
    from reports r
    where p_status = 'all' or r.status = p_status
  )
  select b.id, b.created_at, b.status, b.reason, b.details, b.target_type, b.target_id,
         b.reporter_id, rp.display_name,
         case b.target_type
           when 'event'  then (select e.title from events e where e.id = b.target_id)
           when 'user'   then (select p.display_name from profiles p where p.id = b.target_id)
           when 'post'   then (select left(cp.body, 280) from circle_posts cp where cp.id = b.target_id)
           when 'circle' then (select c.name from circles c where c.id = b.target_id)
           when 'review' then (select coalesce(hr.rating || '★ ', '') || coalesce(left(hr.comment, 280), '') from host_reviews hr where hr.id = b.target_id)
         end,
         b.person_id, tp.display_name, tp.avatar_url,
         case b.target_type
           when 'event'  then b.target_id
           when 'review' then (select hr.event_id from host_reviews hr where hr.id = b.target_id)
         end,
         (select count(*) from reports r2 where r2.status <> 'closed' and (
            (r2.target_type = 'user' and r2.target_id = b.person_id)
            or (r2.target_type = 'event' and r2.target_id in (select e2.id from events e2 where e2.host_id = b.person_id))))
  from base b
  left join profiles rp on rp.id = b.reporter_id
  left join profiles tp on tp.id = b.person_id
  order by (b.status = 'open') desc, b.created_at desc
  limit 300;
end $$;
grant execute on function public.admin_reports(text) to authenticated;

create or replace function public.admin_set_report_status(p_report uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('open', 'reviewing', 'closed') then raise exception 'Bad status'; end if;
  update reports set status = p_status where id = p_report;
end $$;
grant execute on function public.admin_set_report_status(uuid, text) to authenticated;

-- Close every open report about the same thing, after an action is taken
create or replace function public.oa_close_reports(p_type text, p_target uuid)
returns void language sql security definer set search_path = public as $$
  update reports set status = 'closed' where target_type = p_type and target_id = p_target and status <> 'closed';
$$;
revoke all on function public.oa_close_reports(text, uuid) from public, anon, authenticated;

-- ---------- Remove things ----------
create or replace function public.admin_remove_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  delete from events where id = p_event;            -- guests get the "cancelled" email
  perform public.oa_close_reports('event', p_event);
end $$;

create or replace function public.admin_remove_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  delete from circle_posts where id = p_post;
  perform public.oa_close_reports('post', p_post);
end $$;

create or replace function public.admin_remove_review(p_review uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  delete from host_reviews where id = p_review;
  perform public.oa_close_reports('review', p_review);
end $$;

-- Clears the photo on the profile; the admin page also deletes the file
create or replace function public.admin_clear_photo(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare old_url text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select avatar_url into old_url from profiles where id = p_user;
  update profiles set avatar_url = null where id = p_user;
  return old_url;
end $$;

create or replace function public.admin_set_verified(p_user uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update profiles set verified = p_verified where id = p_user;
end $$;

-- Remove a person completely (and optionally stop their email from signing up again)
create or replace function public.admin_remove_person(p_user uuid, p_ban boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You can''t remove yourself here'; end if;
  if exists (select 1 from admins where user_id = p_user) then raise exception 'Remove their admin access first'; end if;
  select email into v_email from auth.users where id = p_user;
  if p_ban and v_email is not null then
    insert into banned_emails (email, reason) values (lower(v_email), left(p_reason, 500))
    on conflict (email) do update set reason = excluded.reason, banned_at = now();
  end if;
  perform public.oa_close_reports('user', p_user);
  delete from email_queue where user_id = p_user and sent_at is null;
  delete from auth.users where id = p_user;          -- removes profile, gatherings, RSVPs, posts, reviews…
end $$;

grant execute on function public.admin_remove_event(uuid), public.admin_remove_post(uuid), public.admin_remove_review(uuid),
  public.admin_clear_photo(uuid), public.admin_set_verified(uuid, boolean), public.admin_remove_person(uuid, boolean, text)
  to authenticated;

-- ---------- Delete my account ----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from admins where user_id = me) and (select count(*) from admins) = 1 then
    raise exception 'You''re the only admin. Add another admin before deleting your account.';
  end if;
  delete from email_queue where user_id = me and sent_at is null;
  delete from auth.users where id = me;              -- removes everything tied to the account
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Email admins about every new report ----------
create or replace function public.oa_reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; urgent boolean := new.reason in ('Feels unsafe', 'Harassment or hate');
begin
  for a in select u.email from admins ad join auth.users u on u.id = ad.user_id loop
    insert into email_queue (kind, user_id, to_email, subject, html, text_body)
    values ('admin_report', null, a.email,
      case when urgent then 'URGENT report: ' else 'New report: ' end || new.reason || ' (' || new.target_type || ')',
      public.oa_email_html(case when urgent then 'Urgent safety report' else 'New report' end,
        '<p style="margin:0"><strong>' || public.oa_esc(new.reason) || '</strong> about a ' || public.oa_esc(new.target_type) || '.</p>'
          || case when coalesce(new.details, '') = '' then '' else '<p style="margin:12px 0 0">' || public.oa_esc(left(new.details, 500)) || '</p>' end,
        'Open the admin page', 'https://outandaboutsocial.net/#/admin', 'You''re getting this because you''re an Out & About admin.'),
      new.reason || ' about a ' || new.target_type || '. ' || coalesce(left(new.details, 500), '') || E'\nhttps://outandaboutsocial.net/#/admin');
  end loop;
  return new;
end $$;
drop trigger if exists oa_reports_after_insert on public.reports;
create trigger oa_reports_after_insert after insert on public.reports
  for each row execute function public.oa_reports_after_insert();

-- ---------- Hosts can remove a private address (when switching to a public spot) ----------
drop policy if exists "host deletes address" on public.event_locations;
create policy "host deletes address" on public.event_locations for delete to authenticated using (public.is_host(event_id));
