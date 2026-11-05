-- 004: per-user and global DAILY quota for the paid API routes (Vision / Gemini).
--
-- !! NOT RUN AUTOMATICALLY. Run once in the Supabase SQL editor, in order, by a human. !!
-- Everything here is namespaced `menu_camera_*` because this Supabase project is
-- SHARED with other apps: nothing below touches any other app's table or function.
--
-- How it works
--   * The Vercel API route calls menu_camera_consume_quota() with the caller's own
--     access token (no service_role key is needed or used anywhere).
--   * The counter increment is a single atomic INSERT .. ON CONFLICT DO UPDATE ..
--     WHERE count < limit, so concurrent requests/instances cannot overshoot.
--   * Because any logged-in user could call this RPC directly via PostgREST, the
--     function also requires a shared secret (kept only in this table and in the
--     Vercel env var QUOTA_SECRET). Without it, a malicious user could burn the
--     global counter and lock everyone else out.
--   * The usage table has RLS enabled with NO policies and no grants for
--     anon/authenticated: clients can never read or write it directly.
--   * The "day" is the UTC date (resets 09:00 JST / 07:00 Bangkok).

create table if not exists public.menu_camera_api_usage (
  -- the all-zero uuid is the global (all users) counter row
  user_id uuid    not null,
  day     date    not null,
  kind    text    not null check (kind in ('analyze', 'explain', 'explain_batch')),
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

alter table public.menu_camera_api_usage enable row level security;
revoke all on public.menu_camera_api_usage from anon, authenticated;

create table if not exists public.menu_camera_quota_config (
  key   text primary key,
  value text not null
);
alter table public.menu_camera_quota_config enable row level security;
revoke all on public.menu_camera_quota_config from anon, authenticated;

-- After running this file, set the secret ONCE (pick a long random string, e.g.
-- from `openssl rand -hex 32`), and put the SAME value in Vercel as QUOTA_SECRET:
--
--   insert into public.menu_camera_quota_config (key, value)
--   values ('quota_secret', '<paste-random-string-here>')
--   on conflict (key) do update set value = excluded.value;
--
-- Never commit the real value.

create or replace function public.menu_camera_consume_quota(
  p_kind         text,
  p_user_limit   integer,
  p_global_limit integer,
  p_secret       text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_day    date := (now() at time zone 'utc')::date;
  v_nil    constant uuid := '00000000-0000-0000-0000-000000000000';
  v_secret text;
  v_user   integer;
  v_global integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select value into v_secret from public.menu_camera_quota_config where key = 'quota_secret';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_kind not in ('analyze', 'explain', 'explain_batch')
     or p_user_limit < 1 or p_global_limit < 1 then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;

  -- 1) the user's own counter (atomic; no row returned when the limit is hit)
  insert into public.menu_camera_api_usage as u (user_id, day, kind, count)
  values (v_uid, v_day, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1 where u.count < p_user_limit
  returning u.count into v_user;

  if v_user is null then
    return jsonb_build_object('allowed', false, 'scope', 'user');
  end if;

  -- 2) the global counter; roll the user's increment back if it is exhausted
  insert into public.menu_camera_api_usage as u (user_id, day, kind, count)
  values (v_nil, v_day, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = u.count + 1 where u.count < p_global_limit
  returning u.count into v_global;

  if v_global is null then
    update public.menu_camera_api_usage
       set count = count - 1
     where user_id = v_uid and day = v_day and kind = p_kind and count > 0;
    return jsonb_build_object('allowed', false, 'scope', 'global');
  end if;

  -- housekeeping: drop rows older than 14 days (cheap, ~1% of calls)
  if random() < 0.01 then
    delete from public.menu_camera_api_usage where day < v_day - 14;
  end if;

  return jsonb_build_object('allowed', true, 'used', v_user, 'global_used', v_global);
end;
$$;

revoke all on function public.menu_camera_consume_quota(text, integer, integer, text) from public, anon;
grant execute on function public.menu_camera_consume_quota(text, integer, integer, text) to authenticated;
