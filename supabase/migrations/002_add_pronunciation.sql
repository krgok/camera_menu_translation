-- Run this if saved_items already exists (created before IPA pronunciation support was added).
alter table saved_items add column if not exists pronunciation text;
