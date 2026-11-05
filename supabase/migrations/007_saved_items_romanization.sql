-- 007: romanization (Thai tone-marked Latin, pinyin, Korean RR) for saved items.
--
-- !! NOT RUN AUTOMATICALLY. Run once in the Supabase SQL editor, by a human. !!
-- Additive: one nullable column on public.saved_items only (this project is
-- shared with other apps). Safe to re-run. The app keeps working without it:
-- saving silently omits the romanization if the column does not exist yet.

alter table public.saved_items add column if not exists romanization text;

alter table public.saved_items drop constraint if exists saved_items_romanization_len;
alter table public.saved_items
  add constraint saved_items_romanization_len
  check (romanization is null or char_length(romanization) <= 300) not valid;
