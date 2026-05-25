-- ============================================================================
-- MenuLink · 0035_cancellation_foundation
--
-- Phase 9A of Global Operations Core:
--   1. order_reasons — bilingual cancellation/failure reason catalog
--   2. order_events  — full order audit trail (status changes, cancellations)
--   3. Trigger on orders.status to auto-log events
--   4. Seed default cancellation reasons for all existing restaurants
-- ============================================================================

-- 1. order_reasons — per-restaurant reason catalog
create table if not exists public.order_reasons (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_type    text not null check (actor_type in ('customer','restaurant','driver','system')),
  reason_ar     text not null,
  reason_en     text,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_order_reasons_restaurant
  on public.order_reasons(restaurant_id);

-- 2. order_events — audit trail for every order state transition
create table if not exists public.order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  event_type  text not null check (event_type in ('status_change','cancellation','payment','note')),
  old_status  text,
  new_status  text,
  actor_type  text not null check (actor_type in ('customer','restaurant','driver','system')),
  actor_id    text,
  reason_id   uuid references public.order_reasons(id),
  reason_text text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_events_order
  on public.order_events(order_id, created_at);

create index if not exists idx_order_events_restaurant
  on public.order_events(order_id);

-- 3. Add cancellation_reason_id to orders for quick lookup
alter table public.orders
  add column if not exists cancellation_reason_id uuid references public.order_reasons(id);

-- 4. Trigger: auto-log status changes to order_events
create or replace function public.fn_log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.order_events (
      order_id, event_type, old_status, new_status, actor_type, actor_id,
      reason_id
    ) values (
      NEW.id,
      case when NEW.status = 'cancelled' then 'cancellation' else 'status_change' end,
      OLD.status,
      NEW.status,
      'restaurant',
      coalesce(auth.uid()::text, 'system'),
      NEW.cancellation_reason_id
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change
  after update of status on public.orders
  for each row
  execute function public.fn_log_order_status_change();

-- 5. RLS on order_reasons
alter table public.order_reasons enable row level security;

drop policy if exists "owner_manage_reasons" on public.order_reasons;
create policy "owner_manage_reasons" on public.order_reasons
  for all to authenticated
  using (owns_restaurant(restaurant_id))
  with check (owns_restaurant(restaurant_id));

drop policy if exists "ops_manage_reasons" on public.order_reasons;
create policy "ops_manage_reasons" on public.order_reasons
  for all to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

-- 6. RLS on order_events
alter table public.order_events enable row level security;

drop policy if exists "owner_read_events" on public.order_events;
create policy "owner_read_events" on public.order_events
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and owns_restaurant(o.restaurant_id)
    )
  );

drop policy if exists "system_insert_events" on public.order_events;
create policy "system_insert_events" on public.order_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and owns_restaurant(o.restaurant_id)
    )
  );

drop policy if exists "ops_read_events" on public.order_events;
create policy "ops_read_events" on public.order_events
  for select to authenticated
  using (is_platform_admin());

-- 7. Seed default cancellation reasons for all existing restaurants
insert into public.order_reasons (restaurant_id, actor_type, reason_ar, reason_en, sort_order)
select r.id, v.actor_type, v.reason_ar, v.reason_en, v.sort_order
from public.restaurants r
cross join (values
  ('customer',   'غيّرت رأيي',                    'Changed my mind',            1),
  ('customer',   'وقت الانتظار طويل',              'Wait time too long',          2),
  ('customer',   'طلبت بالخطأ',                   'Ordered by mistake',          3),
  ('restaurant', 'الصنف غير متوفر',               'Item unavailable',            4),
  ('restaurant', 'المطعم مغلق',                   'Restaurant closed',           5),
  ('restaurant', 'مشكلة في الطلب',                'Problem with order',          6)
) as v(actor_type, reason_ar, reason_en, sort_order)
on conflict do nothing;
