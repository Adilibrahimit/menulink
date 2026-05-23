-- ============================================================================
-- MenuLink · 0010_pos_outbox_deferred_trigger
--
-- Bug: 0009's trigger fired AFTER INSERT on orders. The submit_order RPC
-- inserts the order row first, then order_items in a subsequent INSERT.
-- At trigger time, order_items had no rows for the new order → payload
-- ended up with items=[] → the Bridge App correctly refused to write
-- "an order with zero items" and marked the row failed after MaxAttempts.
--
-- Fix: convert the trigger to a DEFERRABLE INITIALLY DEFERRED constraint
-- trigger so it fires at COMMIT — after submit_order has fully finished
-- including the order_items INSERT. Same function body, just different
-- firing time.
--
-- Also repopulate any existing failed rows so they can be retried.
-- ============================================================================

-- Extract payload-building into a reusable helper so the reset can call it
create or replace function public.build_pos_outbox_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',            o.id,
      'restaurant_id', o.restaurant_id,
      'order_type',    o.order_type,
      'channel',       o.channel,
      'status',        o.status,
      'subtotal',      o.subtotal,
      'delivery_fee',  o.delivery_fee,
      'total',         o.total,
      'address',       o.address,
      'lat',           o.lat,
      'lng',           o.lng,
      'notes',         o.notes,
      'created_at',    o.created_at
    ),
    'customer', (
      select jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone)
      from public.customers c where c.id = o.customer_id
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'item_name',   oi.item_name,
            'variant',     oi.variant,
            'qty',         oi.qty,
            'unit_price',  oi.unit_price,
            'line_total',  oi.line_total,
            'pos_item_id', (
              select pim.pos_item_id
              from public.pos_item_map pim
              join public.menu_items mi on mi.id = pim.menu_item_id
              where pim.restaurant_id = o.restaurant_id
                and mi.name_ar = oi.item_name
                and (oi.variant is null or pim.pos_variant_key = oi.variant)
              limit 1
            )
          )
          order by oi.id
        )
        from public.order_items oi
        where oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- Rewrite the trigger function to use the helper
create or replace function public.enqueue_pos_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pos_enabled boolean;
begin
  select coalesce(enabled, false) into v_pos_enabled
  from public.pos_settings
  where restaurant_id = new.restaurant_id;

  if not coalesce(v_pos_enabled, false) then
    return new;
  end if;

  insert into public.pos_outbox (restaurant_id, order_id, payload)
  values (new.restaurant_id, new.id, public.build_pos_outbox_payload(new.id))
  on conflict (restaurant_id, order_id) do nothing;

  return new;
end;
$$;

-- Drop the old AFTER INSERT trigger and recreate as DEFERRED constraint trigger
drop trigger if exists orders_enqueue_pos_outbox on public.orders;

create constraint trigger orders_enqueue_pos_outbox
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.enqueue_pos_outbox();

-- Repopulate + reset failed rows from earlier testing so they can be retried
update public.pos_outbox
   set payload    = public.build_pos_outbox_payload(order_id),
       status     = 'pending',
       attempts   = 0,
       last_error = null,
       claimed_by = null,
       claimed_at = null,
       synced_at  = null
 where status = 'failed';
