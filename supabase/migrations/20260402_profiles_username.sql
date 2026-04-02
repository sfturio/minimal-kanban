-- Fluxo Essencial - profiles.username for user handle
-- Date: 2026-04-02
-- Safe/idempotent migration

begin;

alter table public.profiles
  add column if not exists username text;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

commit;

