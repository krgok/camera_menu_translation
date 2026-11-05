-- 006: travel album for saved items — trip name, rating, note (+ the first UPDATE the app needs).
--
-- !! NOT RUN AUTOMATICALLY. Run once in the Supabase SQL editor, by a human. !!
-- Additive: three nullable columns; existing rows are unchanged. Touches ONLY
-- public.saved_items (this project is shared with other apps). The app keeps
-- working if this is not run yet: saving falls back to the old columns and the
-- album controls show a hint instead of failing silently.
--
-- UPDATE security: the app only ever edits trip / rating / note. So UPDATE is
-- granted on those three COLUMNS only (not on the whole table), and an UPDATE
-- policy restricts it to the owner's rows. Nobody can rewrite dish_name,
-- explanation, user_id, etc. after saving.

alter table public.saved_items
  add column if not exists trip   text,
  add column if not exists rating smallint,
  add column if not exists note   text;

alter table public.saved_items
  drop constraint if exists saved_items_trip_len,
  drop constraint if exists saved_items_note_len,
  drop constraint if exists saved_items_rating_values;

alter table public.saved_items
  add constraint saved_items_trip_len      check (trip is null or char_length(trip) <= 60) not valid,
  add constraint saved_items_note_len      check (note is null or char_length(note) <= 500) not valid,
  -- 1 = want to eat again, -1 = never again, null/0 = no rating
  add constraint saved_items_rating_values check (rating is null or rating between -1 and 1) not valid;

drop policy if exists "update own saved_items" on public.saved_items;
create policy "update own saved_items" on public.saved_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke update on public.saved_items from authenticated;
grant update (trip, rating, note) on public.saved_items to authenticated;

create index if not exists saved_items_user_trip_idx
  on public.saved_items (user_id, trip);
