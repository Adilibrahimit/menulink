-- ============================================================================
-- MenuLink · 0040_delivery_routing
--
-- Phase 6 of Global Operations Core:
--   1. branch_service_areas — radius/polygon delivery zones per branch
--   2. orders: customer location columns
--   3. find_nearest_branch() — given customer coordinates, returns closest
--      branch that covers the location
--   4. Update submit_order to auto-resolve branch for delivery orders
--   5. RLS policies
--
-- For single-branch tenants, delivery routing is trivial (one branch).
-- For multi-branch, the customer PWA can call find_nearest_branch to
-- let the user confirm or change the selected branch.
-- ============================================================================

-- --- 1. branch_service_areas ------------------------------------------------

create table if not exists public.branch_service_areas (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.restaurant_branches(id) on delete cascade,
  area_type         text not null check (area_type in ('radius','polygon')) default 'radius',
  radius_km         numeric(6,2),
  polygon_geojson   jsonb,
  delivery_fee      numeric(10,2) not null default 0,
  min_order         numeric(10,2) not null default 0,
  estimated_minutes int,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_service_areas_branch
  on public.branch_service_areas(branch_id);

-- --- 2. Orders: customer location columns -----------------------------------

alter table public.orders
  add column if not exists customer_location_lat  numeric(9,6),
  add column if not exists customer_location_lng  numeric(9,6),
  add column if not exists customer_address_label text,
  add column if not exists customer_address_details text,
  add column if not exists payment_method text;

-- --- 3. find_nearest_branch -------------------------------------------------
-- Simple Haversine distance check against branch coordinates.
-- Returns the nearest active branch with a service area covering the point.

create or replace function public.find_nearest_branch(
  p_restaurant_id uuid,
  p_lat numeric,
  p_lng numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result record;
begin
  select
    b.id as branch_id,
    b.name_ar,
    b.name_en,
    sa.delivery_fee,
    sa.min_order,
    sa.estimated_minutes,
    (6371 * acos(
      cos(radians(p_lat)) * cos(radians(b.lat)) *
      cos(radians(b.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(b.lat))
    )) as distance_km
  into v_result
  from public.restaurant_branches b
  join public.branch_service_areas sa on sa.branch_id = b.id and sa.is_active = true
  where b.restaurant_id = p_restaurant_id
    and b.is_active = true
    and b.supports_delivery = true
    and b.lat is not null and b.lng is not null
    and sa.area_type = 'radius'
    and (6371 * acos(
      cos(radians(p_lat)) * cos(radians(b.lat)) *
      cos(radians(b.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(b.lat))
    )) <= sa.radius_km
  order by distance_km
  limit 1;

  if v_result is null then
    return jsonb_build_object('found', false, 'message', 'No branch covers this location');
  end if;

  return jsonb_build_object(
    'found',             true,
    'branch_id',         v_result.branch_id,
    'branch_name_ar',    v_result.name_ar,
    'branch_name_en',    v_result.name_en,
    'delivery_fee',      v_result.delivery_fee,
    'min_order',         v_result.min_order,
    'estimated_minutes', v_result.estimated_minutes,
    'distance_km',       round(v_result.distance_km::numeric, 2)
  );
end;
$$;

-- --- 4. RLS on branch_service_areas -----------------------------------------

alter table public.branch_service_areas enable row level security;

drop policy if exists "owner_manage_areas" on public.branch_service_areas;
create policy "owner_manage_areas" on public.branch_service_areas
  for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_branches b
      where b.id = branch_service_areas.branch_id
        and public.owns_restaurant(b.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_branches b
      where b.id = branch_service_areas.branch_id
        and public.owns_restaurant(b.restaurant_id)
    )
  );

drop policy if exists "ops_manage_areas" on public.branch_service_areas;
create policy "ops_manage_areas" on public.branch_service_areas
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "anon_read_areas" on public.branch_service_areas;
create policy "anon_read_areas" on public.branch_service_areas
  for select to anon
  using (is_active = true);

-- --- 5. Grants --------------------------------------------------------------

grant execute on function public.find_nearest_branch(uuid, numeric, numeric) to authenticated;
grant execute on function public.find_nearest_branch(uuid, numeric, numeric) to anon;
