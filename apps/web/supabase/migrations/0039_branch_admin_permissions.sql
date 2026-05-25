-- ============================================================================
-- MenuLink · 0039_branch_admin_permissions
--
-- Phase 5 of Global Operations Core:
--   1. restaurant_admins — role-based admin users per restaurant
--   2. restaurant_admin_branch_access — branch-scoped permissions
--   3. has_restaurant_access() — unified permission check function
--   4. has_branch_access() — branch-level permission check
--   5. Seed existing restaurant_owners as 'owner' role admins
--   6. RLS policies
--
-- Roles: owner, branch_manager, cashier, accountant, viewer
-- Owner: sees all branches. Others: scoped to assigned branches.
-- ============================================================================

-- --- 1. restaurant_admins ---------------------------------------------------

create table if not exists public.restaurant_admins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  role            text not null check (role in ('owner','branch_manager','cashier','accountant','viewer')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index if not exists idx_admins_restaurant
  on public.restaurant_admins(restaurant_id);

create index if not exists idx_admins_user
  on public.restaurant_admins(user_id);

-- --- 2. restaurant_admin_branch_access --------------------------------------

create table if not exists public.restaurant_admin_branch_access (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.restaurant_admins(id) on delete cascade,
  branch_id   uuid not null references public.restaurant_branches(id) on delete cascade,
  unique (admin_id, branch_id)
);

create index if not exists idx_branch_access_admin
  on public.restaurant_admin_branch_access(admin_id);

-- --- 3. has_restaurant_access — unified permission check --------------------
-- Returns true if the current user has any active role at this restaurant.
-- Owners always have access. This supplements (doesn't replace) owns_restaurant.

create or replace function public.has_restaurant_access(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_admins
    where user_id = auth.uid()
      and restaurant_id = p_restaurant_id
      and is_active = true
  )
  or exists (
    select 1 from public.restaurant_owners
    where user_id = auth.uid()
      and restaurant_id = p_restaurant_id
  );
$$;

-- --- 4. has_branch_access — branch-level permission check -------------------
-- Owners see all branches. Others need explicit branch_access rows.

create or replace function public.has_branch_access(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_branches b
    join public.restaurant_owners ro on ro.restaurant_id = b.restaurant_id
    where b.id = p_branch_id
      and ro.user_id = auth.uid()
  )
  or exists (
    select 1 from public.restaurant_admin_branch_access ba
    join public.restaurant_admins ra on ra.id = ba.admin_id
    where ba.branch_id = p_branch_id
      and ra.user_id = auth.uid()
      and ra.is_active = true
  );
$$;

-- --- 5. get_admin_role — returns the user's role at a restaurant ------------

create or replace function public.get_admin_role(p_restaurant_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'owner' from public.restaurant_owners
     where user_id = auth.uid() and restaurant_id = p_restaurant_id),
    (select role from public.restaurant_admins
     where user_id = auth.uid() and restaurant_id = p_restaurant_id and is_active = true)
  );
$$;

-- --- 6. Seed existing owners into restaurant_admins -------------------------

insert into public.restaurant_admins (user_id, restaurant_id, role)
select ro.user_id, ro.restaurant_id, 'owner'
from public.restaurant_owners ro
where ro.user_id is not null
on conflict (user_id, restaurant_id) do nothing;

-- --- 7. RLS on restaurant_admins --------------------------------------------

alter table public.restaurant_admins enable row level security;

drop policy if exists "owner_manage_admins" on public.restaurant_admins;
create policy "owner_manage_admins" on public.restaurant_admins
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists "self_read_admin" on public.restaurant_admins;
create policy "self_read_admin" on public.restaurant_admins
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "ops_manage_admins" on public.restaurant_admins;
create policy "ops_manage_admins" on public.restaurant_admins
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- 8. RLS on restaurant_admin_branch_access -------------------------------

alter table public.restaurant_admin_branch_access enable row level security;

drop policy if exists "owner_manage_branch_access" on public.restaurant_admin_branch_access;
create policy "owner_manage_branch_access" on public.restaurant_admin_branch_access
  for all to authenticated
  using (
    exists (
      select 1 from public.restaurant_admins ra
      where ra.id = restaurant_admin_branch_access.admin_id
        and public.owns_restaurant(ra.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.restaurant_admins ra
      where ra.id = restaurant_admin_branch_access.admin_id
        and public.owns_restaurant(ra.restaurant_id)
    )
  );

drop policy if exists "self_read_branch_access" on public.restaurant_admin_branch_access;
create policy "self_read_branch_access" on public.restaurant_admin_branch_access
  for select to authenticated
  using (
    exists (
      select 1 from public.restaurant_admins ra
      where ra.id = restaurant_admin_branch_access.admin_id
        and ra.user_id = auth.uid()
    )
  );

drop policy if exists "ops_manage_branch_access" on public.restaurant_admin_branch_access;
create policy "ops_manage_branch_access" on public.restaurant_admin_branch_access
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- --- 9. Grant execute on new functions --------------------------------------

grant execute on function public.has_restaurant_access(uuid) to authenticated;
grant execute on function public.has_branch_access(uuid)     to authenticated;
grant execute on function public.get_admin_role(uuid)        to authenticated;
