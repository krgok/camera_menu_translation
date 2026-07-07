-- Run this if saved_items already exists (created before thumbnail support was added).
alter table saved_items add column if not exists thumbnail_url text;
