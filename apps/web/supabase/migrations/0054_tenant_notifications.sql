-- 0054_tenant_notifications.sql
-- In-app notification center for customers.
-- Stores all broadcast notifications per tenant so customers can
-- see notification history even if they missed the push.

create table if not exists public.tenant_notifications (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  title           text not null,
  body            text,
  image_url       text,
  url             text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tenant_notifications_restaurant
  on public.tenant_notifications(restaurant_id, created_at desc);

alter table public.tenant_notifications enable row level security;

create policy "anon_read_notifications" on public.tenant_notifications
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.restaurants r
      where r.id = tenant_notifications.restaurant_id
        and r.is_published and r.is_active
    )
  );

create policy "owner_manage_notifications" on public.tenant_notifications
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "ops_manage_notifications" on public.tenant_notifications
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
