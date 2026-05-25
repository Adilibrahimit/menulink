-- ============================================================================
-- MenuLink · 0038_business_day_numbering
--
-- Phase 4 of Global Operations Core:
--   1. branch_order_counters — per-branch daily counter + invoice sequence
--   2. orders: add business_date, invoice_sequence, daily_order_number columns
--   3. RPC: next_order_number — transactional, race-safe number generation
--   4. Update submit_order to call next_order_number
--   5. RLS for branch_order_counters
--
-- Business day = defined by the branch's business_day_start/business_day_end.
-- If current time is before business_day_end, business_date = yesterday.
-- This means a restaurant open 10AM–4AM treats 2AM as still "yesterday's" day.
-- ============================================================================

-- --- 1. branch_order_counters -----------------------------------------------

create table if not exists public.branch_order_counters (
  id                      uuid primary key default gen_random_uuid(),
  branch_id               uuid not null references public.restaurant_branches(id) on delete cascade,
  business_date           date not null,
  next_daily_order_number int not null default 1,
  daily_order_cycle       int not null default 0,
  next_invoice_sequence   bigint not null default 1,
  updated_at              timestamptz not null default now(),
  unique (branch_id, business_date)
);

create index if not exists idx_counters_branch_date
  on public.branch_order_counters(branch_id, business_date desc);

-- --- 2. Orders: add numbering columns ---------------------------------------

alter table public.orders
  add column if not exists business_date       date,
  add column if not exists invoice_sequence     bigint,
  add column if not exists daily_order_number   int,
  add column if not exists order_number_cycle   int default 0;

-- --- 3. Compute business date for a branch ----------------------------------

create or replace function public.compute_business_date(
  p_branch_id uuid,
  p_now timestamptz default now()
)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz         text;
  v_day_end    time;
  v_local      timestamptz;
  v_local_time time;
begin
  select timezone, coalesce(business_day_end, '04:00'::time)
    into v_tz, v_day_end
    from public.restaurant_branches
   where id = p_branch_id;

  if v_tz is null then
    v_tz := 'Asia/Riyadh';
  end if;

  v_local := p_now at time zone v_tz;
  v_local_time := v_local::time;

  -- If current time is before the day-end cutoff (e.g. 2AM < 4AM),
  -- this order belongs to the previous business day.
  if v_day_end > '00:00'::time and v_local_time < v_day_end then
    return (v_local::date - interval '1 day')::date;
  end if;

  return v_local::date;
end;
$$;

-- --- 4. next_order_number — atomic number generation ------------------------

create or replace function public.next_order_number(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz_date  date;
  v_daily     int;
  v_cycle     int;
  v_invoice   bigint;
begin
  v_biz_date := public.compute_business_date(p_branch_id);

  -- Upsert the counter row and atomically claim the next numbers.
  -- advisory lock prevents concurrent races on the same branch.
  perform pg_advisory_xact_lock(hashtext('order_num_' || p_branch_id::text));

  insert into public.branch_order_counters (branch_id, business_date)
  values (p_branch_id, v_biz_date)
  on conflict (branch_id, business_date) do nothing;

  update public.branch_order_counters
  set
    next_daily_order_number = next_daily_order_number + 1,
    daily_order_cycle = case
      when next_daily_order_number >= 999 then daily_order_cycle + 1
      else daily_order_cycle
    end,
    next_invoice_sequence = next_invoice_sequence + 1,
    updated_at = now()
  where branch_id = p_branch_id and business_date = v_biz_date
  returning
    next_daily_order_number - 1,
    daily_order_cycle,
    next_invoice_sequence - 1
  into v_daily, v_cycle, v_invoice;

  return jsonb_build_object(
    'business_date',      v_biz_date,
    'daily_order_number', v_daily,
    'order_number_cycle',  v_cycle,
    'invoice_sequence',   v_invoice
  );
end;
$$;

-- --- 5. Update submit_order to use numbering --------------------------------

create or replace function public.submit_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid := (p_order ->> 'restaurant_id')::uuid;
  v_phone         text := p_order ->> 'phone';
  v_customer_id   uuid;
  v_order_id      uuid;
  v_branch_id     uuid;
  v_nums          jsonb;
  v_items         jsonb := coalesce(p_order -> 'items', '[]'::jsonb);
  v_item          jsonb;
  v_real_price    numeric;
  v_claimed_price numeric;
  v_max_delta     numeric := 30;
begin
  if v_restaurant_id is null then raise exception 'restaurant_id is required'; end if;
  if v_phone is null or length(trim(v_phone)) = 0 then raise exception 'phone is required'; end if;
  if jsonb_array_length(v_items) = 0 then raise exception 'items must be a non-empty array'; end if;

  if not exists (select 1 from public.restaurants r where r.id = v_restaurant_id and r.is_active) then
    raise exception 'restaurant % is not active', v_restaurant_id;
  end if;

  v_branch_id := coalesce(
    (p_order ->> 'branch_id')::uuid,
    public.get_default_branch_id(v_restaurant_id)
  );

  -- Generate order numbers atomically
  v_nums := public.next_order_number(v_branch_id);

  -- Validate item prices when item_id + variant_key are provided
  for v_item in select * from jsonb_array_elements(v_items) loop
    if v_item ->> 'item_id' is not null and v_item ->> 'variant_key' is not null then
      select miv.price into v_real_price
        from public.menu_item_variants miv
        join public.menu_items mi on mi.id = miv.menu_item_id
       where mi.id = (v_item ->> 'item_id')::uuid
         and mi.restaurant_id = v_restaurant_id
         and miv.variant_key = v_item ->> 'variant_key'
         and miv.is_active;

      if v_real_price is null then
        raise exception 'invalid item/variant: % / %', v_item ->> 'item_id', v_item ->> 'variant_key';
      end if;

      v_claimed_price := coalesce((v_item ->> 'unit_price')::numeric, 0);

      if v_claimed_price < v_real_price then
        raise exception 'unit_price % below menu price % for item %',
          v_claimed_price, v_real_price, v_item ->> 'item_name';
      end if;

      if (v_claimed_price - v_real_price) > v_max_delta then
        raise exception 'modifier delta % exceeds maximum % for item %',
          v_claimed_price - v_real_price, v_max_delta, v_item ->> 'item_name';
      end if;
    end if;
  end loop;

  insert into public.customers (
    restaurant_id, phone, name, default_address, default_lat, default_lng
  ) values (
    v_restaurant_id,
    v_phone,
    nullif(p_order ->> 'name', ''),
    nullif(p_order ->> 'address', ''),
    nullif(p_order ->> 'lat', '')::numeric,
    nullif(p_order ->> 'lng', '')::numeric
  )
  on conflict (restaurant_id, phone) do update set
    name            = coalesce(excluded.name, public.customers.name),
    default_address = coalesce(excluded.default_address, public.customers.default_address),
    default_lat     = coalesce(excluded.default_lat, public.customers.default_lat),
    default_lng     = coalesce(excluded.default_lng, public.customers.default_lng),
    last_seen_at    = now(),
    updated_at      = now()
  returning id into v_customer_id;

  insert into public.orders (
    restaurant_id, customer_id, branch_id, order_type, channel,
    subtotal, delivery_fee, total,
    address, lat, lng, notes,
    car_plate, car_color,
    table_label,
    business_date, invoice_sequence, daily_order_number, order_number_cycle
  ) values (
    v_restaurant_id,
    v_customer_id,
    v_branch_id,
    p_order ->> 'order_type',
    coalesce(nullif(p_order ->> 'channel', ''), 'whatsapp'),
    coalesce((p_order ->> 'subtotal')::numeric, 0),
    coalesce((p_order ->> 'delivery_fee')::numeric, 0),
    coalesce((p_order ->> 'total')::numeric, 0),
    nullif(p_order ->> 'address', ''),
    nullif(p_order ->> 'lat', '')::numeric,
    nullif(p_order ->> 'lng', '')::numeric,
    nullif(p_order ->> 'notes', ''),
    nullif(p_order ->> 'car_plate', ''),
    nullif(p_order ->> 'car_color', ''),
    nullif(p_order ->> 'table_label', ''),
    (v_nums ->> 'business_date')::date,
    (v_nums ->> 'invoice_sequence')::bigint,
    (v_nums ->> 'daily_order_number')::int,
    (v_nums ->> 'order_number_cycle')::int
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, item_name, variant, qty, unit_price, line_total)
  select
    v_order_id,
    i ->> 'item_name',
    nullif(i ->> 'variant', ''),
    coalesce((i ->> 'qty')::int, 1),
    coalesce((i ->> 'unit_price')::numeric, 0),
    coalesce((i ->> 'unit_price')::numeric, 0) * coalesce((i ->> 'qty')::int, 1)
  from jsonb_array_elements(v_items) as i;

  return jsonb_build_object(
    'customer_id',        v_customer_id,
    'order_id',           v_order_id,
    'branch_id',          v_branch_id,
    'business_date',      v_nums ->> 'business_date',
    'daily_order_number', v_nums ->> 'daily_order_number',
    'invoice_sequence',   v_nums ->> 'invoice_sequence'
  );
end;
$$;

-- --- 6. RLS on branch_order_counters ----------------------------------------

alter table public.branch_order_counters enable row level security;

drop policy if exists "owner_read_counters" on public.branch_order_counters;
create policy "owner_read_counters" on public.branch_order_counters
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurant_branches b
      where b.id = branch_order_counters.branch_id
        and public.owns_restaurant(b.restaurant_id)
    )
  );

drop policy if exists "ops_read_counters" on public.branch_order_counters;
create policy "ops_read_counters" on public.branch_order_counters
  for select to authenticated
  using (public.is_platform_admin());
