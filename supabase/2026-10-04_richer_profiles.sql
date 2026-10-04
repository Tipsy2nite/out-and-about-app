-- =====================================================================
-- Richer profiles: an "Intro" (pronouns, hometown, work, years in Austin,
-- languages), likes, not-my-thing, favorite spots, a "perfect weekend"
-- prompt, and a cover color. Everything is optional. Safe to run twice.
-- Profiles are only visible to signed-in members (existing rule).
-- =====================================================================

alter table public.profiles
  add column if not exists pronouns text,
  add column if not exists hometown text,
  add column if not exists work text,
  add column if not exists austin_since smallint,
  add column if not exists languages text[] not null default '{}',
  add column if not exists likes text[] not null default '{}',
  add column if not exists dislikes text[] not null default '{}',
  add column if not exists favorite_spots text[] not null default '{}',
  add column if not exists perfect_weekend text,
  add column if not exists ask_me_about text,
  add column if not exists cover_color text;

-- Keep entries short and lists reasonable
alter table public.profiles drop constraint if exists profiles_rich_limits;
alter table public.profiles add constraint profiles_rich_limits check (
  coalesce(char_length(pronouns), 0) <= 30
  and coalesce(char_length(hometown), 0) <= 60
  and coalesce(char_length(work), 0) <= 80
  and (austin_since is null or austin_since between 1930 and 2100)
  and coalesce(char_length(perfect_weekend), 0) <= 280
  and coalesce(char_length(ask_me_about), 0) <= 140
  and (cover_color is null or cover_color ~ '^#[0-9A-Fa-f]{6}$')
  and cardinality(languages) <= 8      and char_length(array_to_string(languages, ''))      <= 200
  and cardinality(likes) <= 20         and char_length(array_to_string(likes, ''))          <= 800
  and cardinality(dislikes) <= 20      and char_length(array_to_string(dislikes, ''))       <= 800
  and cardinality(favorite_spots) <= 15 and char_length(array_to_string(favorite_spots, '')) <= 900
);
