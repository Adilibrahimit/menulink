-- 0082_guest_order_status.sql
--
-- Let a GUEST watch their own order.
--
-- Today `orders` grants SELECT to `authenticated` only, gated on
-- customers.auth_user_id = auth.uid() (0050). So order status is visible only
-- to a signed-in, phone-linked customer on /m/<slug>/orders. A guest — the
-- majority of orders — can see nothing at all after checkout, and the existing
-- post-order bar is car-curbside only and purely local: it never reads the DB,
-- so it shows the same text forever no matter what the kitchen does.
--
-- Pattern copied from get_table_session (0032): a SECURITY DEFINER function
-- keyed on an unguessable uuid, granted to anon. Per LRN-2026-05-23 the UUID is
-- the security boundary; that is acceptable here because the payload is
-- read-only and deliberately carries NO personal data — no phone, no address,
-- no customer name. Someone holding the id already placed the order.

create or replace function public.get_order_status(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order  record;
  v_events jsonb;
begin
  select o.id, o.status, o.order_type, o.total, o.created_at,
         o.daily_order_number, o.table_label, o.car_arrived_at,
         o.restaurant_id,
         r.slug   as restaurant_slug,
         r.name   as restaurant_name,
         b.name_ar as branch_name_ar
    into v_order
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    left join public.restaurant_branches b on b.id = o.branch_id
   where o.id = p_order_id;

  if not found then
    return null;                       -- unknown id: reveal nothing
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'new_status', e.new_status,
           'created_at', e.created_at
         ) order by e.created_at), '[]'::jsonb)
    into v_events
    from public.order_events e
   where e.order_id = p_order_id
     and e.new_status is not null;

  -- Deliberately excludes phone / address / customer name.
  return jsonb_build_object(
    'order_id',           v_order.id,
    'status',             v_order.status,
    'order_type',         v_order.order_type,
    'total',              v_order.total,
    'created_at',         v_order.created_at,
    'daily_order_number', v_order.daily_order_number,
    'table_label',        v_order.table_label,
    'car_arrived_at',     v_order.car_arrived_at,
    -- needed so the tracking page can register the order on a second device
    -- (localStorage is keyed by restaurant id)
    'restaurant_id',      v_order.restaurant_id,
    'restaurant_slug',    v_order.restaurant_slug,
    'restaurant_name',    v_order.restaurant_name,
    'branch_name_ar',     v_order.branch_name_ar,
    'events',             v_events
  );
end;
$$;

revoke all on function public.get_order_status(uuid) from public;
grant execute on function public.get_order_status(uuid) to anon, authenticated, service_role;

comment on function public.get_order_status(uuid) is
  'Anon-callable read of ONE order, keyed by its unguessable id. Powers the '
  'guest tracking bar and /m/<slug>/track/<orderId>. Returns no PII by design.';
