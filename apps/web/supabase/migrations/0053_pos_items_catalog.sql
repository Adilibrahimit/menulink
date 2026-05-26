-- 0053_pos_items_catalog.sql
-- POS items catalog for enhanced mapping view.
-- Populated by Bridge App sync or manual entry (future).
-- Also adds display_name_override to pos_item_map so admin can
-- override POS item descriptions for customer-facing display.

create table if not exists public.pos_items_catalog (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  pos_item_id     int not null,
  pos_item_name   text,
  pos_category    text,
  price           numeric(10,2),
  is_active       boolean not null default true,
  last_synced_at  timestamptz not null default now(),
  unique(restaurant_id, pos_item_id)
);

create index if not exists idx_pos_catalog_restaurant
  on public.pos_items_catalog(restaurant_id);

alter table public.pos_items_catalog enable row level security;

create policy "rls_pos_catalog_owner_read" on public.pos_items_catalog
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "rls_pos_catalog_ops_all" on public.pos_items_catalog
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.pos_item_map
  add column if not exists pos_item_name text,
  add column if not exists display_name_override text;
