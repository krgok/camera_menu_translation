-- Museum mode: records which app mode saved the item, plus reference links
-- (array of {title, url}) shown alongside museum explanations.
alter table saved_items
  add column if not exists mode text not null default 'menu',
  add column if not exists reference_links jsonb;
