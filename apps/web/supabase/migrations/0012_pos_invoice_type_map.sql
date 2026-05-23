-- ============================================================================
-- MenuLink · 0012_pos_invoice_type_map
--
-- Per-tenant mapping from MenuLink `orders.order_type` to POS `InvoiceType`.
-- Until now every MenuLink order was hardcoded to RzRz InvoiceType=11 (the
-- "Online" section, same bucket as HungerStation / Jahez / Keeta). The
-- restaurant wants MenuLink to OWN its own channel reporting (in /admin),
-- and the cashier UI's "Online" section should stay reserved for the actual
-- third-party online partners. Different InvoiceType also gives the kitchen
-- ticket a different icon — staff visually recognise the order type.
--
-- Discovery on RzRz Bukhari (session 2026-05-23, by placing one test invoice
-- per type and reading back Invoice.InvoiceType):
--   InvoiceType = 0  → Take Away   (سفري)         → shopping-bag icon
--   InvoiceType = 1  → Dine In     (محلي)          → plate-and-utensils icon
--   InvoiceType = 3  → Delivery    (توصيل)         → house icon
--   InvoiceType = 4  → Telephone   (هاتف)          → phone icon
--   InvoiceType = 10 → Car         (سيارة)         → car icon
--   InvoiceType = 11 → Online      (موقع الكتروني) → "Online" icon
--
-- The chosen MenuLink → RzRz mapping:
--   delivery → 3    dine_in → 1    pickup → 0    car → 10
--
-- OnlineCustomerID = 999 is kept so POS reports still attribute MenuLink
-- as a channel (the cashier-UI "Online" tab keys off InvoiceType=11, not
-- OnlineCustomerID, so we're out of the tab while keeping the report tag).
-- ============================================================================

-- 1. Schema: per-tenant map column
alter table public.pos_settings
  add column if not exists invoice_type_map jsonb not null default '{}'::jsonb;

comment on column public.pos_settings.invoice_type_map is
  'Per-tenant mapping from MenuLink orders.order_type to POS InvoiceType integer. '
  'Keys are MenuLink order_type values (delivery, dine_in, pickup, car). '
  'Values are POS-side integers (POS-specific). Empty map falls back to pos_settings.invoice_type.';

-- 2. Wire RzRz Bukhari with the discovered mapping
update public.pos_settings
   set invoice_type_map = jsonb_build_object(
         'delivery', 3,
         'dine_in',  1,
         'pickup',   0,
         'car',     10
       )
 where restaurant_id = 'ef60381c-50db-4379-a9b7-97f5902aa54b';

-- 3. Extend build_pos_outbox_payload to snapshot the resolved POS settings
--    onto each outbox row's payload. The bridge then reads payload.pos.*
--    instead of hardcoded PosOptions defaults — one bridge, many tenants.
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

-- 4. Repopulate existing pending/failed outbox payloads so they pick up
--    the new pos.* snapshot on next claim. (Synced rows are historical;
--    leave them as-is.)
update public.pos_outbox
   set payload = public.build_pos_outbox_payload(order_id)
 where status in ('pending','failed');
