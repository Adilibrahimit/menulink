-- 0051_polygon_zone_check.sql
-- Extend find_nearest_branch to also check polygon zones using
-- ray-casting point-in-polygon algorithm (pure SQL, no PostGIS needed).

-- Helper: point-in-polygon check for GeoJSON Polygon geometry
create or replace function public.point_in_polygon(
  p_lat numeric,
  p_lng numeric,
  p_geojson jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_coords jsonb;
  v_n int;
  v_inside boolean := false;
  v_j int;
  v_xi numeric; v_yi numeric;
  v_xj numeric; v_yj numeric;
begin
  v_coords := p_geojson -> 'coordinates' -> 0;
  if v_coords is null then return false; end if;
  v_n := jsonb_array_length(v_coords);
  if v_n < 3 then return false; end if;

  v_j := v_n - 1;
  for i in 0 .. v_n - 1 loop
    v_xi := (v_coords -> i -> 0)::numeric;
    v_yi := (v_coords -> i -> 1)::numeric;
    v_xj := (v_coords -> v_j -> 0)::numeric;
    v_yj := (v_coords -> v_j -> 1)::numeric;

    if ((v_yi > p_lat) <> (v_yj > p_lat))
       and (p_lng < (v_xj - v_xi) * (p_lat - v_yi) / (v_yj - v_yi) + v_xi)
    then
      v_inside := not v_inside;
    end if;
    v_j := i;
  end loop;

  return v_inside;
end;
$$;

-- Rewrite find_nearest_branch to check BOTH radius and polygon zones
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
  -- Check radius zones first (with distance)
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
    and sa.area_type = 'radius'
    and b.lat is not null and b.lng is not null
    and (6371 * acos(
      cos(radians(p_lat)) * cos(radians(b.lat)) *
      cos(radians(b.lng) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(b.lat))
    )) <= sa.radius_km
  order by distance_km
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

  -- Check polygon zones (point-in-polygon)
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
