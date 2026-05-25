-- ============================================================================
-- MenuLink · 0041_driver_workflow
--
-- Phase 7 of Global Operations Core:
--   1. drivers — per-branch driver roster
--   2. order_driver_assignments — full delivery accountability chain
--   3. orders: driver-related columns
--   4. RLS policies
--
-- The driver workflow tracks: assign → hand off → out for delivery →
-- delivered/returned → cash settlement.
-- ============================================================================

-- --- 1. drivers -------------------------------------------------------------

create table if not exists public.drivers (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  branch_id       uuid references public.restaurant_branches(id) on delete set null,
  name            text not null,
  phone           text,
  driver_type     text not null check (driver_type in ('internal','external','aggregator')) default 'internal',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_drivers_restaurant
  on public.drivers(restaurant_id);

create index if not exists idx_drivers_branch
  on public.drivers(branch_id)
  where branch_id is not null;

-- --- 2. order_driver_assignments --------------------------------------------

create table if not exists public.order_driver_assignments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders(id) on delete cascade,
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade,
  branch_id             uuid references public.restaurant_branches(id),
  driver_id             uuid not null references public.drivers(id),
  assigned_by_admin_id  text,
  assigned_at           timestamptz not null default now(),
  handed_to_driver_at   timestamptz,
  out_for_delivery_at   timestamptz,
  delivered_at          timestamptz,
  returned_at           timestamptz,
  delivery_result       text check (delivery_result in ('delivered','returned','partial','failed')),
  failure_reason_id     uuid references public.order_reasons(id),
  driver_note           text,
  cash_expected         numeric(10,2) default 0,
  cash_collected        numeric(10,2) default 0,
  cash_settled          boolean default false,
  settlement_status     text check (settlement_status in ('pending','settled','disputed')) default 'pending',
  created_at            timestamptz not null default now()
);

create index if not exists idx_assignments_order
  on public.order_driver_assignments(order_id);

create index if not exists idx_assignments_driver
  on public.order_driver_assignments(driver_id, assigned_at desc);

create index if not exists idx_assignments_branch
  on public.order_driver_assignments(branch_id, assigned_at desc)
  where branch_id is not null;

-- --- 3. orders: driver columns ----------------------------------------------

alter table public.orders
  add column if not exists driver_id uuid references public.drivers(id),
  add column if not exists assigned_driver_at timestamptz;

-- --- 4. RLS on drivers ------------------------------------------------------

alter table public.drivers enable row level security;

drop policy if exists "owner_manage_drivers" on public.drivers;
create policy "owner_manage_drivers" on public.drivers
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "admin_read_drivers" on public.drivers;
create policy "admin_read_drivers" on public.drivers
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "ops_manage_drivers" on public.drivers;
create policy "ops_manage_drivers" on public.drivers
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- 5. RLS on order_driver_assignments -------------------------------------

alter table public.order_driver_assignments enable row level security;

drop policy if exists "owner_manage_assignments" on public.order_driver_assignments;
create policy "owner_manage_assignments" on public.order_driver_assignments
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "admin_read_assignments" on public.order_driver_assignments;
create policy "admin_read_assignments" on public.order_driver_assignments
  for select to authenticated
  using (public.has_restaurant_access(restaurant_id));

drop policy if exists "ops_manage_assignments" on public.order_driver_assignments;
create policy "ops_manage_assignments" on public.order_driver_assignments
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
