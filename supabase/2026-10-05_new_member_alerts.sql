-- =====================================================================
-- New-member alerts for admins. Safe to run more than once.
--
--  * Each admin gets an email when someone finishes signing up (creates
--    their profile), with their name, neighborhood, email, and member count.
--  * admins.notify_new_members turns those emails on/off per admin
--    (toggle on the /admin page).
--  * admin_recent_members() powers the "New members" list on /admin.
-- Needs 2026-10-04_email_notifications.sql and
-- 2026-10-05_admin_and_account_deletion.sql first.
-- =====================================================================

alter table public.admins add column if not exists notify_new_members boolean not null default true;

-- ---------- Email admins when a new member joins ----------
create or replace function public.oa_profiles_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; v_email text; v_total bigint;
begin
  select u.email into v_email from auth.users u where u.id = new.id;
  select count(*) into v_total from profiles;
  for a in
    select u.email from admins ad join auth.users u on u.id = ad.user_id
    where ad.notify_new_members and ad.user_id <> new.id
  loop
    insert into email_queue (kind, user_id, to_email, subject, html, text_body)
    values ('admin_new_member', null, a.email,
      left('New member: ' || new.display_name || coalesce(' (' || nullif(new.neighborhood, '') || ')', ''), 200),
      public.oa_email_html('Someone new joined',
        '<p style="margin:0"><strong>' || public.oa_esc(new.display_name) || '</strong>'
          || case when coalesce(new.neighborhood, '') = '' then '' else ' from ' || public.oa_esc(new.neighborhood) end || ' just joined Out &amp; About.</p>'
          || '<p style="margin:12px 0 0;color:#4A5B50">Email: ' || public.oa_esc(coalesce(v_email, 'unknown')) || '<br>'
          || 'That makes <strong>' || v_total || '</strong> members.</p>',
        'See their profile', 'https://outandaboutsocial.net/#/people/' || new.id,
        'You''re getting this because you''re an Out & About admin. Turn these off on the admin page.'),
      new.display_name || coalesce(' from ' || nullif(new.neighborhood, ''), '') || ' just joined Out & About.'
        || E'\nEmail: ' || coalesce(v_email, 'unknown') || E'\nThat makes ' || v_total || ' members.'
        || E'\nhttps://outandaboutsocial.net/#/people/' || new.id
        || E'\n\nTurn these off on the admin page: https://outandaboutsocial.net/#/admin');
  end loop;
  return new;
end $$;
drop trigger if exists oa_profiles_after_insert on public.profiles;
create trigger oa_profiles_after_insert after insert on public.profiles
  for each row execute function public.oa_profiles_after_insert();

-- ---------- Admin page: recent sign-ups ----------
create or replace function public.admin_recent_members(p_limit int default 25)
returns table (id uuid, display_name text, neighborhood text, avatar_url text, email text,
               joined_at timestamptz, confirmed boolean, total bigint, last_7_days bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.display_name, p.neighborhood, p.avatar_url, u.email::text, p.created_at,
         u.email_confirmed_at is not null,
         (select count(*) from profiles),
         (select count(*) from profiles where created_at > now() - interval '7 days')
  from profiles p join auth.users u on u.id = p.id
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end $$;
revoke all on function public.admin_recent_members(int) from public, anon;
grant execute on function public.admin_recent_members(int) to authenticated;

create or replace function public.admin_new_member_emails() returns boolean
language sql stable security definer set search_path = public as $$
  select notify_new_members from admins where user_id = auth.uid();
$$;
revoke all on function public.admin_new_member_emails() from public, anon;
grant execute on function public.admin_new_member_emails() to authenticated;

create or replace function public.admin_set_new_member_emails(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update admins set notify_new_members = coalesce(p_on, true) where user_id = auth.uid();
end $$;
revoke all on function public.admin_set_new_member_emails(boolean) from public, anon;
grant execute on function public.admin_set_new_member_emails(boolean) to authenticated;
