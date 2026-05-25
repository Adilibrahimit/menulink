-- ============================================================================
-- MenuLink · 0043_pos_sync_events
--
-- Phase 10 of Global Operations Core (RzRz Delivery POS Workflow):
--   1. pos_sync_events — audit trail for every POS sync attempt
--   2. pos_settings: add branch_id support
--   3. pos_outbox: add branch_id + delivery lifecycle columns
--   4. RLS policies
--
-- This migration does NOT change the Bridge App code. It prepares the
-- schema so the Bridge App can log sync attempts and the admin can see
-- POS sync status per order.
-- ============================================================================

-- --- 1. pos_sync_events — audit trail for POS operations --------------------

create table if not exists public.pos_sync_events (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  branch_id         uuid references public.restaurant_branches(id),
  order_id          uuid references public.orders(id) on delete cascade,
  provider          text not null check (provider in ('rzrz','foodics','marn','loyverse','other')),
  operation_type    text not null check (operation_type in (
    'create_delivery_invoice',
    'update_delivery_status',
    'assign_driver',
    'settle_driver_cash',
    'cancel_delivery_invoice',
    'open_table',
    'add_table_items',
    'close_table_sync',
    'generic'
  )),
  status            text not null check (status in ('success','failed','timeout','skipped')) default 'success',
  request_summary   jsonb,
  response_summary  jsonb,
  external_invoice_id text,
  error_code        text,
  error_message     text,
  duration_ms       int,
  created_at        timestamptz not null default now()
);

create index if not exists idx_sync_events_order
  on public.pos_sync_events(order_id, created_at desc);

create index if not exists idx_sync_events_restaurant
  on public.pos_sync_events(restaurant_id, created_at desc);

create index if not exists idx_sync_events_status
  on public.pos_sync_events(restaurant_id, status, created_at desc)
  where status = 'failed';

-- --- 2. pos_settings: add branch_id -----------------------------------------

alter table public.pos_settings
  add column if not exists branch_id uuid references public.restaurant_branches(id);

-- --- 3. pos_outbox: add branch_id + delivery lifecycle ----------------------

alter table public.pos_outbox
  add column if not exists branch_id uuid references public.restaurant_branches(id),
  add column if not exists operation_type text default 'create_delivery_invoice',
  add column if not exists driver_id uuid references public.drivers(id),
  add column if not exists delivery_status text;

-- Backfill branch_id from order
update public.pos_outbox po
set branch_id = o.branch_id
from public.orders o
where o.id = po.order_id
  and po.branch_id is null
  and o.branch_id is not null;

-- --- 4. RLS on pos_sync_events ----------------------------------------------

alter table public.pos_sync_events enable row level security;

drop policy if exists "owner_read_sync_events" on public.pos_sync_events;
create policy "owner_read_sync_events" on public.pos_sync_events
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

drop policy if exists "ops_manage_sync_events" on public.pos_sync_events;
create policy "ops_manage_sync_events" on public.pos_sync_events
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
