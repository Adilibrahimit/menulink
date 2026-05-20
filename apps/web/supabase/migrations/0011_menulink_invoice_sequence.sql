-- ============================================================================
-- MenuLink · 0011_menulink_invoice_sequence
--
-- 1. Add a per-tenant MenuLink invoice number counter on pos_settings.
-- 2. Stamp every new pos_outbox row with the next number from that counter
--    (atomic increment under row lock). The Bridge App will use this as
--    the `OnlineBillNo` in the POS payment record so the restaurant has
--    a stable cross-reference between MenuLink orders and POS invoices.
-- 3. Update build_pos_outbox_payload to include this number in the payload.
-- ============================================================================

-- 1. Per-tenant counter
alter table public.pos_settings
  add column if not exists next_invoice_no bigint not null default 1;

-- 2. Column on pos_outbox to hold the assigned number
alter table public.pos_outbox
  add column if not exists menulink_invoice_no bigint;

-- 3. Atomic-claim function
create or replace function public.claim_menulink_invoice_no(p_restaurant_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no bigint;
begin
  update public.pos_settings
     set next_invoice_no = next_invoice_no + 1
   where restaurant_id = p_restaurant_id
  returning next_invoice_no - 1 into v_no;
  return v_no;
end;
$$;

grant execute on function public.claim_menulink_invoice_no(uuid) to authenticated;

-- 4. Before-insert trigger on pos_outbox that stamps menulink_invoice_no
create or replace function public.stamp_menulink_invoice_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.menulink_invoice_no is null then
    new.menulink_invoice_no := public.claim_menulink_invoice_no(new.restaurant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists pos_outbox_stamp_invoice_no on public.pos_outbox;
create trigger pos_outbox_stamp_invoice_no
  before insert on public.pos_outbox
  for each row execute function public.stamp_menulink_invoice_no();

-- 5. Update the payload builder so the Bridge App receives the number
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

-- Backfill menulink_invoice_no for any existing outbox rows that don't have one yet
update public.pos_outbox o
   set menulink_invoice_no = public.claim_menulink_invoice_no(o.restaurant_id)
 where menulink_invoice_no is null;
