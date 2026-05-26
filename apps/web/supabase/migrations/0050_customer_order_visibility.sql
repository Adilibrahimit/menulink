-- 0050_customer_order_visibility.sql
-- Allow signed-in customers to read their own orders, order_items,
-- and order_events. Previously only owners/ops had SELECT on these.
-- Customers link via: customers.auth_user_id = auth.uid()

-- 1. Customer can read their own orders
create policy "customer_read_own_orders"
  on public.orders for select to authenticated
  using (
    exists (
      select 1 from public.customers c
      where c.id = orders.customer_id
        and c.auth_user_id = auth.uid()
    )
  );

-- 2. Customer can read their own order items
create policy "customer_read_own_order_items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_items.order_id
        and c.auth_user_id = auth.uid()
    )
  );

-- 3. Customer can read their own order events (for status timeline)
create policy "customer_read_own_events"
  on public.order_events for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.customers c on c.id = o.customer_id
      where o.id = order_events.order_id
        and c.auth_user_id = auth.uid()
    )
  );
