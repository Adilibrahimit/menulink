-- ============================================================================
-- MenuLink · 0044_table_pos_workflow
--
-- Phase 11 of Global Operations Core (RzRz Table POS Workflow):
--   1. table_sessions: add branch_id + POS sync columns
--   2. Update open_table_session to use branch_id
--   3. pos_table_map — maps MenuLink tables to POS table IDs
--
-- The Bridge App can now:
--   - Look up the POS table ID from pos_table_map
--   - Open a table in POS when a session starts
--   - Add items when new orders arrive on the session
--   - Sync kitchen print if POS supports it
-- ============================================================================

-- --- 1. table_sessions: add branch + POS columns ----------------------------

alter table public.table_sessions
  add column if not exists branch_id uuid references public.restaurant_branches(id),
  add column if not exists table_id uuid references public.restaurant_tables(id),
  add column if not exists pos_table_opened boolean default false,
  add column if not exists pos_external_id text;

-- Backfill branch_id from restaurant's default branch
update public.table_sessions ts
set branch_id = b.id
from public.restaurant_branches b
where b.restaurant_id = ts.restaurant_id
  and b.is_default = true
  and ts.branch_id is null;

-- --- 2. pos_table_map — MenuLink table ↔ POS table mapping ------------------

create table if not exists public.pos_table_map (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  table_id        uuid not null references public.restaurant_tables(id) on delete cascade,
  pos_table_id    text not null,
  pos_table_name  text,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (restaurant_id, table_id)
);

alter table public.pos_table_map enable row level security;

drop policy if exists "owner_manage_pos_table_map" on public.pos_table_map;
create policy "owner_manage_pos_table_map" on public.pos_table_map
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "ops_manage_pos_table_map" on public.pos_table_map;
create policy "ops_manage_pos_table_map" on public.pos_table_map
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- 3. Update open_table_session to use branch_id --------------------------

create or replace function public.open_table_session(
  p_restaurant_id uuid,
  p_table_label text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_branch_id uuid default null,
  p_table_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_branch_id uuid;
begin
  v_branch_id := coalesce(p_branch_id, public.get_default_branch_id(p_restaurant_id));

  select id into v_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_label = p_table_label
    and status = 'open'
    and opened_at > now() - interval '8 hours'
  order by opened_at desc
  limit 1;

  if v_session_id is not null then
    if p_customer_name is not null or p_customer_phone is not null then
      update public.table_sessions
      set customer_name = coalesce(p_customer_name, customer_name),
          customer_phone = coalesce(p_customer_phone, customer_phone)
      where id = v_session_id;
    end if;
    return v_session_id;
  end if;

  insert into public.table_sessions (
    restaurant_id, branch_id, table_id, table_label,
    customer_name, customer_phone
  )
  values (
    p_restaurant_id, v_branch_id, p_table_id, p_table_label,
    p_customer_name, p_customer_phone
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.open_table_session(uuid, text, text, text, uuid, uuid) to anon, authenticated;
