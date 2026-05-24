-- ============================================================================
-- MenuLink · 0026_customer_addresses
--
-- Saved delivery addresses for signed-in customers. Each customer can have
-- multiple addresses labeled home/office/custom. Used by the cart drawer to
-- pre-fill delivery location instead of picking every time.
-- ============================================================================

begin;

create table if not exists public.customer_addresses (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  label           text not null default 'home',
  address         text not null,
  lat             numeric,
  lng             numeric,
  details         text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint customer_addresses_label_check
    check (label in ('home', 'office', 'custom'))
);

create index customer_addresses_customer_idx
  on public.customer_addresses(customer_id);

alter table public.customer_addresses enable row level security;

-- Signed-in customer can read/write their own addresses
create policy rls_customer_addresses_customer_select on public.customer_addresses
  for select to authenticated
  using (
    exists (
      select 1 from public.customers c
       where c.id = customer_addresses.customer_id
         and c.auth_user_id = auth.uid()
    )
  );

create policy rls_customer_addresses_customer_insert on public.customer_addresses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.customers c
       where c.id = customer_addresses.customer_id
         and c.auth_user_id = auth.uid()
    )
  );

create policy rls_customer_addresses_customer_update on public.customer_addresses
  for update to authenticated
  using (
    exists (
      select 1 from public.customers c
       where c.id = customer_addresses.customer_id
         and c.auth_user_id = auth.uid()
    )
  );

create policy rls_customer_addresses_customer_delete on public.customer_addresses
  for delete to authenticated
  using (
    exists (
      select 1 from public.customers c
       where c.id = customer_addresses.customer_id
         and c.auth_user_id = auth.uid()
    )
  );

-- Owner can read addresses for their restaurant's customers
create policy rls_customer_addresses_owner_select on public.customer_addresses
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- Ops full access
create policy rls_customer_addresses_ops_all on public.customer_addresses
  for all to authenticated
  using (public.is_platform_admin());

commit;
