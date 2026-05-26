-- 0055_bridge_heartbeats.sql
-- Bridge App heartbeat table. The Bridge App writes a row every 60s
-- with its version, machine name, and local DB name. The POS dashboard
-- reads the latest row to show Bridge status (online/offline).

create table if not exists public.bridge_heartbeats (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  instance_id     text not null,
  version         text,
  machine_name    text,
  local_db_name   text,
  pos_kind        text,
  uptime_seconds  int,
  pending_count   int,
  last_sync_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_bridge_heartbeats_restaurant
  on public.bridge_heartbeats(restaurant_id, created_at desc);

-- Keep only last 1000 rows per restaurant (auto-cleanup via trigger)
create or replace function public.cleanup_old_heartbeats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bridge_heartbeats
  where restaurant_id = NEW.restaurant_id
    and id not in (
      select id from public.bridge_heartbeats
      where restaurant_id = NEW.restaurant_id
      order by created_at desc
      limit 500
    );
  return NEW;
end;
$$;

create trigger bridge_heartbeats_cleanup
  after insert on public.bridge_heartbeats
  for each row execute function public.cleanup_old_heartbeats();

alter table public.bridge_heartbeats enable row level security;

create policy "owner_read_heartbeats" on public.bridge_heartbeats
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "ops_all_heartbeats" on public.bridge_heartbeats
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Bridge App uses authenticated role to insert heartbeats
create policy "bridge_insert_heartbeats" on public.bridge_heartbeats
  for insert to authenticated
  with check (true);
