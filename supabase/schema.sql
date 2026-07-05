-- Run this in the Supabase SQL editor for the project you're adding this app to.

create table if not exists saved_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  dish_name      text not null,
  original_text  text,
  explanation    text not null,
  source_language text,
  created_at     timestamptz not null default now()
);

alter table saved_items enable row level security;

create policy "select own saved_items" on saved_items
  for select using (auth.uid() = user_id);

create policy "insert own saved_items" on saved_items
  for insert with check (auth.uid() = user_id);

create policy "delete own saved_items" on saved_items
  for delete using (auth.uid() = user_id);
