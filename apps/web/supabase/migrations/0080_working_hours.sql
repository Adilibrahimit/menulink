-- 0080_working_hours.sql
--
-- Working hours, per restaurant AND per branch, enforced on the server.
--
-- What existed before this migration:
--   * restaurants.hours_json only — branches could not differ, even though
--     رزرز has two (العزيزية / الملز) that can keep different hours.
--   * The only check was client-side, in closed-popup.tsx, and it only guarded
--     add-to-cart. A cart filled at 23:50 and confirmed at 00:05 went straight
--     through; so did any direct submit_order call.
--   * That helper hardcoded Asia/Riyadh and accepted exactly one window per day
--     ("HH:MM-HH:MM"), so a restaurant that closes around prayer or runs
--     12:00-15:00 + 18:00-02:00 could not be described at all.
--
-- NOTE: restaurant_branches.business_day_start / business_day_end are NOT
-- opening hours — they define the business *day* for order numbering (0038).
-- Deliberately not reused here.
--
-- Format (backward compatible with every value the old helper accepted):
--   {"sun": "12:00-23:00",                     -- single window
--    "mon": ["12:00-15:00", "18:00-02:00"],    -- split shift
--    "fri": "closed",
--    "sat": "24/7"}
-- A missing day, or hours_json = null, means OPEN. Fails open on purpose: an
-- owner who has never touched this must never silently stop taking orders.
-- All 10 tenants have hours_json = null today, so this ships as a no-op until
-- someone fills it in.

-- --- 1. per-branch override -------------------------------------------------
alter table public.restaurant_branches
  add column if not exists hours_json jsonb;

comment on column public.restaurant_branches.hours_json is
  'Opening hours for this branch. NULL = inherit restaurants.hours_json. Same '
  'shape: {"sun":"12:00-23:00"} or {"sun":["12:00-15:00","18:00-02:00"]}, plus '
  '"closed" and "24/7". Not to be confused with business_day_start/end (0038), '
  'which drive order numbering, not opening times.';

-- --- 2. is a single "HH:MM-HH:MM" window open right now? --------------------
create or replace function public.hours_window_contains(p_window text, p_now time)
returns boolean
language plpgsql
immutable
as $$
declare
  v_open  time;
  v_close time;
  v_parts text[];
begin
  if p_window is null then return false; end if;
  p_window := lower(btrim(p_window));

  if p_window in ('closed', 'مغلق') then return false; end if;
  if p_window in ('24/7', '24-7', 'open', 'مفتوح') then return true; end if;

  v_parts := regexp_match(p_window, '^([0-9]{1,2}:[0-9]{2})\s*-\s*([0-9]{1,2}:[0-9]{2})$');
  -- Unparseable text is treated as open, matching the old client helper: a typo
  -- in the hours field must not take a restaurant offline.
  if v_parts is null then return true; end if;

  v_open  := v_parts[1]::time;
  v_close := v_parts[2]::time;

  if v_close > v_open then
    return p_now >= v_open and p_now < v_close;
  else
    -- wraps past midnight, e.g. 18:00-02:00
    return p_now >= v_open or p_now < v_close;
  end if;
end;
$$;

-- --- 3. is this restaurant/branch open right now? ---------------------------
create or replace function public.is_within_hours(
  p_restaurant_id uuid,
  p_branch_id     uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours    jsonb;
  v_tz       text;
  v_local    timestamp;
  v_day      text;
  v_entry    jsonb;
  v_window   text;
begin
  -- branch overrides restaurant, for both hours and timezone
  select b.hours_json, b.timezone
    into v_hours, v_tz
    from public.restaurant_branches b
   where b.id = p_branch_id;

  if v_hours is null then
    select r.hours_json, coalesce(v_tz, r.timezone)
      into v_hours, v_tz
      from public.restaurants r
     where r.id = p_restaurant_id;
  end if;

  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return true;                              -- not configured -> open
  end if;

  v_tz := coalesce(v_tz, 'Asia/Riyadh');
  v_local := now() at time zone v_tz;
  v_day := lower(to_char(v_local, 'dy'));     -- sun / mon / tue / ...

  v_entry := v_hours -> v_day;
  if v_entry is null or jsonb_typeof(v_entry) = 'null' then
    return true;                              -- day not listed -> open
  end if;

  -- One window, or several. Open if ANY window contains the current time.
  -- Known simplification (same as the client helper it replaces): a window that
  -- wraps past midnight is evaluated against TODAY's entry, not yesterday's.
  -- Correct whenever consecutive days share hours, which is the normal case.
  if jsonb_typeof(v_entry) = 'array' then
    for v_window in select jsonb_array_elements_text(v_entry) loop
      if public.hours_window_contains(v_window, v_local::time) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  return public.hours_window_contains(v_entry #>> '{}', v_local::time);
end;
$$;

grant execute on function public.hours_window_contains(text, time) to anon, authenticated, service_role;
grant execute on function public.is_within_hours(uuid, uuid)       to anon, authenticated, service_role;

-- --- 4. the actual gate -----------------------------------------------------
-- A BEFORE INSERT trigger rather than an edit to submit_order: submit_order has
-- been redefined nine times (0003 -> 0057) and re-pasting 7 KB of it to add four
-- lines is how subtle regressions get introduced. A trigger also covers every
-- insert path, not just the one RPC.
--
-- Unlike the loyalty trigger (0017) this one is deliberately NOT exception
-- wrapped: refusing the order IS the feature.
create or replace function public.orders_reject_when_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_within_hours(new.restaurant_id, new.branch_id) then
    raise exception 'restaurant_closed'
      using hint    = 'The restaurant is outside its configured working hours.',
            errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_check_open_hours on public.orders;
create trigger orders_check_open_hours
  before insert on public.orders
  for each row execute function public.orders_reject_when_closed();

comment on function public.orders_reject_when_closed() is
  'Blocks new orders outside working hours. Fails OPEN when hours_json is not '
  'configured. The customer PWA shows the same state client-side via '
  'lib/hours.ts — keep the two in sync; this one is the boundary.';
