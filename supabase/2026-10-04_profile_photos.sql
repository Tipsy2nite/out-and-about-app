-- =====================================================================
-- Profile photos. Each member can upload one photo of themselves.
-- Photos live in a Supabase Storage bucket called "avatars".
-- The app shrinks every photo to 512x512 before upload, which also strips
-- hidden location data (GPS) that phones put inside pictures.
-- Safe to run more than once.
-- =====================================================================

-- Where the photo's web address is saved on the profile
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://'));

-- The storage bucket: images only, 5 MB max. "public" means a photo can be
-- shown by its web address; file names are random, and there is no rule that
-- lets anyone browse or list the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- People can only add, replace, or delete files inside their own folder
-- (avatars/<their user id>/...).
drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Owners can see their own files (needed to replace or remove an old photo)
drop policy if exists "avatar read own folder" on storage.objects;
create policy "avatar read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Let people report a photo as part of reporting a person (already supported:
-- target_type 'user'). Removing a photo as staff: Storage > avatars > delete,
-- and clear avatar_url on that person's row in profiles.
