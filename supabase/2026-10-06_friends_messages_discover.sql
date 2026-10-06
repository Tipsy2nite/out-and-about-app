-- =====================================================================
-- Friends, private messages, and Discover. Safe to run more than once.
--
--  * friendships        friend requests; messaging needs an accepted one
--  * messages           1-to-1 messages between friends only
--  * Discover           opt-in list of people looking for friends or a
--                       group. Location is never exact: each person picks
--                       whether others see their neighborhood, city, or
--                       only their state.
--  * Emails             friend request, request accepted, new message
--                       (one email per unread conversation, not per message)
-- Blocking someone ends the friendship and stops messages both ways.
-- Needs 2026-10-04_email_notifications.sql first.
-- =====================================================================

-- ---------- Profile: Discover + location settings ----------
alter table public.profiles
  add column if not exists discoverable boolean not null default false,
  add column if not exists looking_for text[] not null default '{}',
  add column if not exists city text default 'Austin',
  add column if not exists state text default 'TX',
  add column if not exists area_level text not null default 'neighborhood';

alter table public.profiles drop constraint if exists profiles_discover_limits;
alter table public.profiles add constraint profiles_discover_limits check (
  area_level in ('neighborhood', 'city', 'state')
  and coalesce(char_length(city), 0) <= 60
  and coalesce(char_length(state), 0) <= 30
  and coalesce(char_length(neighborhood), 0) <= 60
  and cardinality(looking_for) <= 6 and char_length(array_to_string(looking_for, '')) <= 200
);

-- What others are allowed to see of someone's location
create or replace function public.oa_area_label(p public.profiles) returns text
language sql immutable as $$
  select nullif(case p.area_level
    when 'neighborhood' then concat_ws(', ', nullif(trim(p.neighborhood), ''), nullif(trim(p.city), ''))
    when 'city'         then concat_ws(', ', nullif(trim(p.city), ''), nullif(trim(p.state), ''))
    else nullif(trim(p.state), '')
  end, '');
$$;

-- ---------- Email preferences ----------
alter table public.profile_private
  add column if not exists email_friend_requests boolean not null default true,
  add column if not exists email_messages boolean not null default true;

-- ---------- Friendships ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
-- No insert/update/delete policies: changes go through the functions below.

create or replace function public.oa_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
revoke all on function public.oa_blocked_between(uuid, uuid) from public, anon, authenticated;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships f where f.status = 'accepted'
    and least(f.requester_id, f.addressee_id) = least(a, b) and greatest(f.requester_id, f.addressee_id) = greatest(a, b));
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;

-- 'none' | 'outgoing' (you asked) | 'incoming' (they asked) | 'friends' | 'blocked'
create or replace function public.friend_status(p_other uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); f record;
begin
  if me is null or p_other is null or p_other = me then return 'none'; end if;
  if public.oa_blocked_between(me, p_other) then return 'blocked'; end if;
  select * into f from friendships x
   where least(x.requester_id, x.addressee_id) = least(me, p_other)
     and greatest(x.requester_id, x.addressee_id) = greatest(me, p_other);
  if not found then return 'none'; end if;
  if f.status = 'accepted' then return 'friends'; end if;
  return case when f.requester_id = me then 'outgoing' else 'incoming' end;
end $$;
revoke all on function public.friend_status(uuid) from public, anon;
grant execute on function public.friend_status(uuid) to authenticated;

create or replace function public.send_friend_request(p_other uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); st text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_other is null or p_other = me then raise exception 'Pick someone else'; end if;
  if not exists (select 1 from profiles where id = me) then raise exception 'Finish setting up your profile first'; end if;
  if not exists (select 1 from profiles where id = p_other) then raise exception 'That profile isn''t available'; end if;
  st := public.friend_status(p_other);
  if st = 'blocked' then raise exception 'You can''t send a request to this person'; end if;
  if st in ('friends', 'outgoing') then return st; end if;
  if st = 'incoming' then                       -- they already asked: just accept
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = p_other and addressee_id = me and status = 'pending';
    return 'friends';
  end if;
  if (select count(*) from friendships where requester_id = me and created_at > now() - interval '1 day') >= 40 then
    raise exception 'That''s a lot of requests for one day. Try again tomorrow.';
  end if;
  insert into friendships (requester_id, addressee_id) values (me, p_other);
  return 'outgoing';
end $$;
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_other uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_accept then
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = p_other and addressee_id = me and status = 'pending';
    if not found then raise exception 'That request is no longer there'; end if;
    return 'friends';
  end if;
  delete from friendships where requester_id = p_other and addressee_id = me and status = 'pending';
  return 'none';
end $$;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Cancel a request you sent, or unfriend
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  delete from friendships
   where least(requester_id, addressee_id) = least(me, p_other)
     and greatest(requester_id, addressee_id) = greatest(me, p_other);
end $$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Friends + pending requests, with what each person lets others see
create or replace function public.my_friends()
returns table (id uuid, display_name text, avatar_url text, area text, status text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, public.oa_area_label(p),
         case when f.status = 'accepted' then 'friends' when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
         coalesce(f.accepted_at, f.created_at)
  from friendships f
  join profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
    and not public.oa_blocked_between(f.requester_id, f.addressee_id)
  order by p.display_name;
$$;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

-- Blocking someone ends the friendship
create or replace function public.oa_blocks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
   where least(requester_id, addressee_id) = least(new.blocker_id, new.blocked_id)
     and greatest(requester_id, addressee_id) = greatest(new.blocker_id, new.blocked_id);
  return new;
end $$;
drop trigger if exists oa_blocks_after_insert on public.blocks;
create trigger oa_blocks_after_insert after insert on public.blocks
  for each row execute function public.oa_blocks_after_insert();

-- ---------- Messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx on public.messages
  (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index if not exists messages_unread_idx on public.messages (recipient_id) where read_at is null;
alter table public.messages enable row level security;
drop policy if exists "see own messages" on public.messages;
create policy "see own messages" on public.messages for select to authenticated
  using (auth.uid() in (sender_id, recipient_id));
-- No insert/update/delete policies: sending goes through send_message().

create or replace function public.send_message(p_to uuid, p_body text) returns public.messages
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.messages;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Write a message first'; end if;
  if char_length(p_body) > 2000 then raise exception 'Messages can be up to 2,000 characters'; end if;
  if public.oa_blocked_between(me, p_to) then raise exception 'You can''t message this person'; end if;
  if not public.are_friends(me, p_to) then raise exception 'You can only message friends. Send a friend request first.'; end if;
  if (select count(*) from messages where sender_id = me and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Slow down a little and try again in a minute.';
  end if;
  insert into messages (sender_id, recipient_id, body) values (me, p_to, trim(p_body)) returning * into m;
  return m;
end $$;
revoke all on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

create or replace function public.mark_read(p_other uuid) returns void
language sql security definer set search_path = public as $$
  update messages set read_at = now() where recipient_id = auth.uid() and sender_id = p_other and read_at is null;
$$;
revoke all on function public.mark_read(uuid) from public, anon;
grant execute on function public.mark_read(uuid) to authenticated;

-- Inbox: one row per person you've talked to
create or replace function public.my_conversations()
returns table (other_id uuid, display_name text, avatar_url text, last_body text, last_at timestamptz,
               last_from_me boolean, unread bigint, can_message boolean)
language sql stable security definer set search_path = public as $$
  with mine as (
    select m.*, case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other
    from messages m where auth.uid() in (m.sender_id, m.recipient_id)
  ), last as (
    select distinct on (other) other, body, created_at, sender_id = auth.uid() as from_me
    from mine order by other, created_at desc
  )
  select l.other, p.display_name, p.avatar_url, left(l.body, 140), l.created_at, l.from_me,
         (select count(*) from mine x where x.other = l.other and x.recipient_id = auth.uid() and x.read_at is null),
         public.are_friends(auth.uid(), l.other) and not public.oa_blocked_between(auth.uid(), l.other)
  from last l join profiles p on p.id = l.other
  where not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = l.other)
  order by l.created_at desc;
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- For the badge in the top bar
create or replace function public.my_inbox_counts() returns table (unread_messages bigint, friend_requests bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from messages m where m.recipient_id = auth.uid() and m.read_at is null
       and not exists (select 1 from blocks b where b.blocker_id = auth.uid() and b.blocked_id = m.sender_id)),
    (select count(*) from friendships f where f.addressee_id = auth.uid() and f.status = 'pending'
       and not public.oa_blocked_between(f.requester_id, f.addressee_id));
$$;
revoke all on function public.my_inbox_counts() from public, anon;
grant execute on function public.my_inbox_counts() to authenticated;

-- ---------- Discover ----------
-- p_scope: 'neighborhood' | 'city' | 'state' | 'anywhere'. People only match
-- a scope at or above the level they chose to share (someone who shares only
-- their city never shows up in a neighborhood search).
create or replace function public.discover_people(p_scope text default 'city', p_looking text default null, p_limit int default 60)
returns table (id uuid, display_name text, avatar_url text, area text, looking_for text[], vibes text[],
               bio text, verified boolean, friend_status text)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into me from profiles where profiles.id = auth.uid();
  return query
  select p.id, p.display_name, p.avatar_url, public.oa_area_label(p), p.looking_for, p.vibes,
         left(p.bio, 160), p.verified, public.friend_status(p.id)
  from profiles p
  where p.discoverable and p.id <> auth.uid()
    and not public.oa_blocked_between(auth.uid(), p.id)
    and (p_looking is null or p_looking = '' or p_looking = any(p.looking_for))
    and case coalesce(p_scope, 'city')
      when 'neighborhood' then p.area_level = 'neighborhood'
        and lower(trim(p.neighborhood)) = lower(trim(me.neighborhood))
        and lower(trim(coalesce(p.city, ''))) = lower(trim(coalesce(me.city, '')))
      when 'city' then p.area_level in ('neighborhood', 'city')
        and lower(trim(p.city)) = lower(trim(me.city))
        and lower(trim(coalesce(p.state, ''))) = lower(trim(coalesce(me.state, '')))
      when 'state' then lower(trim(p.state)) = lower(trim(me.state))
      else true
    end
  order by public.friend_status(p.id) = 'friends', p.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
end $$;
revoke all on function public.discover_people(text, text, int) from public, anon;
grant execute on function public.discover_people(text, text, int) to authenticated;

-- ---------- Emails ----------
create or replace function public.oa_friendships_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select display_name into who from profiles where id = new.requester_id;
    perform public.oa_queue(new.addressee_id, null, 'friend_request', 'email_friend_requests',
      who || ' sent you a friend request', 'New friend request',
      '<p style="margin:0"><strong>' || public.oa_esc(who) || '</strong> would like to be friends on Out &amp; About. Once you accept, you can message each other.</p>',
      who || ' would like to be friends on Out & About. Once you accept, you can message each other.',
      'See the request', 'https://outandaboutsocial.net/#/messages',
      'You''re getting this because you have friend request emails turned on.');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select display_name into who from profiles where id = new.addressee_id;
    perform public.oa_queue(new.requester_id, null, 'friend_accepted', 'email_friend_requests',
      who || ' accepted your friend request', 'You''re friends now',
      '<p style="margin:0"><strong>' || public.oa_esc(who) || '</strong> accepted your friend request. Say hi!</p>',
      who || ' accepted your friend request. Say hi!',
      'Send a message', 'https://outandaboutsocial.net/#/messages/' || new.addressee_id,
      'You''re getting this because you have friend request emails turned on.');
  end if;
  return new;
end $$;
drop trigger if exists oa_friendships_after_change on public.friendships;
create trigger oa_friendships_after_change after insert or update on public.friendships
  for each row execute function public.oa_friendships_after_change();

-- One email when a conversation goes from "all read" to "unread". More
-- messages before they open it don't send more emails.
create or replace function public.oa_messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if exists (select 1 from messages m where m.recipient_id = new.recipient_id and m.sender_id = new.sender_id
               and m.read_at is null and m.id <> new.id) then
    return new;
  end if;
  select display_name into who from profiles where id = new.sender_id;
  perform public.oa_queue(new.recipient_id, null, 'new_message', 'email_messages',
    who || ' sent you a message', 'New message from ' || who,
    '<p style="margin:0">You have a new message from <strong>' || public.oa_esc(who) || '</strong>. Open Out &amp; About to read it and reply.</p>',
    'You have a new message from ' || who || '. Open Out & About to read it and reply.',
    'Read the message', 'https://outandaboutsocial.net/#/messages/' || new.sender_id,
    'You''re getting this because you have message emails turned on.');
  return new;
end $$;
drop trigger if exists oa_messages_after_insert on public.messages;
create trigger oa_messages_after_insert after insert on public.messages
  for each row execute function public.oa_messages_after_insert();
