-- ============================================================================
-- MenuLink · 0078_restore_pos_outbox_pos_block
--
-- Regression fix. Migration 0012 added a `pos` block to build_pos_outbox_payload
-- (per-tenant InvoiceType resolved from invoice_type_map, plus online_customer_id
-- and counter_id) so the Bridge App reads payload.pos.* instead of hardcoded
-- appsettings.json defaults. Migrations 0014 (car_order_type) and 0015
-- (restaurant_tables) then re-created build_pos_outbox_payload from the PRE-0012
-- base to add car_plate / car_color / car_arrived_at / table_label — and both
-- silently DROPPED the pos block.
--
-- Effect (live since 0014): payload->'pos' is null for every order, so the Bridge
-- falls back to appsettings InvoiceType (=11 Online) and the intended per-type
-- mapping (delivery→3, dine_in→1, pickup→0, car→10 for RzRz Bukhari) never applies.
-- online_customer_id=999 happened to keep working only because the appsettings
-- default matched.
--
-- Verified 2026-07-03 by a live test order on rzrz-bukhari-test: item pos_item_id
-- mapping worked, but payload->'pos' came back null.
--
-- Fix: re-create the function = the CURRENT 0015 body (order + car + table fields
-- + item mapping) WITH the 0012 pos block re-merged. Backward-compatible: adds one
-- key to the payload; the Bridge already reads payload.Pos null-safely and falls
-- back to appsettings when absent. Then repopulate pending/failed rows so queued
-- orders pick up the pos block on their next claim.
-- ============================================================================

create or replace function public.build_pos_outbox_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',              o.id,
      'restaurant_id',   o.restaurant_id,
      'order_type',      o.order_type,
      'channel',         o.channel,
      'status',          o.status,
      'subtotal',        o.subtotal,
      'delivery_fee',    o.delivery_fee,
      'total',           o.total,
      'address',         o.address,
      'lat',             o.lat,
      'lng',             o.lng,
      'notes',           o.notes,
      'car_plate',       o.car_plate,
      'car_color',       o.car_color,
      'car_arrived_at',  o.car_arrived_at,
      'table_label',     o.table_label,
      'created_at',      o.created_at
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
    ),
    'pos', case
      when s.restaurant_id is null then null
      else jsonb_build_object(
        'invoice_type',       coalesce(
                                nullif(s.invoice_type_map ->> o.order_type, '')::int,
                                s.invoice_type
                              ),
        'online_customer_id', s.online_customer_id,
        'counter_id',         s.counter_id,
        'section_id',         0
      )
    end
  )
  from public.orders o
  left join public.pos_settings s on s.restaurant_id = o.restaurant_id
  where o.id = p_order_id;
$$;

-- Repopulate queued rows so they pick up the restored pos block on next claim.
-- (Synced rows are historical; leave them.)
update public.pos_outbox
   set payload = public.build_pos_outbox_payload(order_id)
 where status in ('pending','failed');
