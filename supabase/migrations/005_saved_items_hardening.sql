-- 005: defense-in-depth hardening of public.saved_items (additive, non-destructive).
--
-- !! NOT RUN AUTOMATICALLY. Run once in the Supabase SQL editor, by a human. !!
-- Touches ONLY public.saved_items (this project is shared with other apps).
-- Existing rows and the existing select/insert/delete policies are unchanged.
--
-- What it does
--  1. user_id defaults to auth.uid(): the client no longer needs to send it, and
--     the existing `with check (auth.uid() = user_id)` still rejects any attempt
--     to write another user's id.
--  2. Size limits (CHECK ... NOT VALID: apply to new/updated rows only, so any
--     old row can never make this migration fail). Stops a signed-up user from
--     stuffing megabytes into a row.
--  3. A per-user row cap (1000) via a BEFORE INSERT trigger, so a script cannot
--     fill the free-tier database.
--  4. An index for the "my items, newest first" query.
--  5. Removes privileges the app never uses (UPDATE has no policy anyway;
--     TRUNCATE is not subject to RLS) and anon access (login is required).

alter table public.saved_items
  alter column user_id set default auth.uid();

alter table public.saved_items
  drop constraint if exists saved_items_dish_name_len,
  drop constraint if exists saved_items_original_text_len,
  drop constraint if exists saved_items_pronunciation_len,
  drop constraint if exists saved_items_explanation_len,
  drop constraint if exists saved_items_language_len,
  drop constraint if exists saved_items_mode_values,
  drop constraint if exists saved_items_thumbnail_len,
  drop constraint if exists saved_items_refs_len;

alter table public.saved_items
  add constraint saved_items_dish_name_len     check (char_length(dish_name) <= 300) not valid,
  add constraint saved_items_original_text_len check (original_text is null or char_length(original_text) <= 1000) not valid,
  add constraint saved_items_pronunciation_len check (pronunciation is null or char_length(pronunciation) <= 500) not valid,
  add constraint saved_items_explanation_len   check (char_length(explanation) <= 4000) not valid,
  add constraint saved_items_language_len      check (source_language is null or char_length(source_language) <= 16) not valid,
  add constraint saved_items_mode_values       check (mode in ('menu', 'museum')) not valid,
  -- thumbnails are ~120px JPEG data URLs (a few KB); 60,000 chars is generous
  add constraint saved_items_thumbnail_len     check (thumbnail_url is null or char_length(thumbnail_url) <= 60000) not valid,
  add constraint saved_items_refs_len          check (reference_links is null or pg_column_size(reference_links) <= 4000) not valid;

create or replace function public.saved_items_enforce_cap()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.saved_items where user_id = new.user_id) >= 1000 then
    raise exception 'saved_items limit reached (1000 per user)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_items_cap on public.saved_items;
create trigger saved_items_cap
  before insert on public.saved_items
  for each row execute function public.saved_items_enforce_cap();

create index if not exists saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);

revoke all on public.saved_items from anon;
revoke update, truncate, references, trigger on public.saved_items from authenticated;
