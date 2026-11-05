-- Run this in the Supabase SQL editor for the project you're adding this app to.
-- (NEW setups only. Existing projects apply supabase/migrations/*.sql in order instead:
--  001-003 add columns, 004 adds the API quota, 005 hardens saved_items.)
-- This project is shared with other apps: this file only touches `saved_items`.

create table if not exists saved_items (
  id             uuid primary key default gen_random_uuid(),
  -- defaults to the caller; the insert policy below rejects any other user id
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dish_name      text not null,
  original_text  text,
  pronunciation  text,
  explanation    text not null,
  source_language text,
  thumbnail_url  text,
  -- "menu" or "museum" — which app mode saved this item.
  mode           text not null default 'menu',
  -- Museum mode: array of {title, url} reference links.
  reference_links jsonb,
  -- Travel album (see migrations/006): trip name, rating (1 / -1), memo.
  trip           text,
  rating         smallint,
  note           text,
  -- Romanization for non-Latin scripts (see migrations/007).
  romanization   text,
  created_at     timestamptz not null default now()
);

alter table saved_items enable row level security;

drop policy if exists "select own saved_items" on saved_items;
create policy "select own saved_items" on saved_items
  for select using (auth.uid() = user_id);

drop policy if exists "insert own saved_items" on saved_items;
create policy "insert own saved_items" on saved_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own saved_items" on saved_items;
create policy "delete own saved_items" on saved_items
  for delete using (auth.uid() = user_id);

-- UPDATE is only for the album fields (trip / rating / note), owner only, and only
-- on those columns: see migrations/006_saved_items_album.sql (run it after this file).
-- Remaining hardening (size limits, per-user row cap, index, revokes): see
-- supabase/migrations/005_saved_items_hardening.sql — run it after this file.
