-- 0052_multitier_zone_order.sql
-- Fix find_nearest_branch to support multiple delivery tiers per branch.
-- Order by radius_km ASC so the tightest matching zone wins (cheapest fee).
-- Example: 5km=6SAR, 8km=12SAR, 12km=20SAR — customer at 3km gets 6SAR.

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
    sa.radius_km as zone_radius,
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
    and sa.area_type = 'radius'
    and b.lat is not null and b.lng is not null
    and (6371 * acos(
      cos(radians(p_lat)) * cos(radians(b.lat)) *
      cos(radians(b.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(b.lat))
    )) <= sa.radius_km
  order by sa.radius_km asc
  limit 1;

  if v_result is not null then
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
  end if;

  select
    b.id as branch_id,
    b.name_ar,
    b.name_en,
    sa.delivery_fee,
    sa.min_order,
    sa.estimated_minutes
  into v_result
  from public.restaurant_branches b
  join public.branch_service_areas sa on sa.branch_id = b.id and sa.is_active = true
  where b.restaurant_id = p_restaurant_id
    and b.is_active = true
    and b.supports_delivery = true
    and sa.area_type = 'polygon'
    and sa.polygon_geojson is not null
    and public.point_in_polygon(p_lat, p_lng, sa.polygon_geojson)
  limit 1;

  if v_result is not null then
    return jsonb_build_object(
      'found',             true,
      'branch_id',         v_result.branch_id,
      'branch_name_ar',    v_result.name_ar,
      'branch_name_en',    v_result.name_en,
      'delivery_fee',      v_result.delivery_fee,
      'min_order',         v_result.min_order,
      'estimated_minutes', v_result.estimated_minutes,
      'distance_km',       0
    );
  end if;

  return jsonb_build_object('found', false, 'message', 'No branch covers this location');
end;
$$;
