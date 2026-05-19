-- ============================================================================
-- MenuLink · 0008_fix_rls_and_columns
--
-- Two real bugs and one schema gap discovered during the 2026-05-19 manual test:
--
--   BUG 1 (silent, since 0001): every RLS policy reads
--   `auth.jwt() ->> 'restaurant_id'` and `auth.jwt() ->> 'role'`. But Supabase
--   nests claims from raw_app_meta_data under `app_metadata`, so those JSON
--   paths return NULL. Every authenticated query has been falling through:
--     - Owner SELECTs return zero rows (info page .single() throws,
--       /admin/orders shows empty, /admin dashboard "last 5 orders" empty).
--     - Owner INSERTs are rejected (RLS violation on menu_categories).
--     - Ops INSERT into restaurants is rejected (no policy permits it).
--   The customer PWA still works because submit_order is SECURITY DEFINER
--   and get_public_menu is SECURITY DEFINER. The dashboard "revenue" tile
--   shows non-zero only because views bypass RLS (PG default
--   security_invoker=false), which is itself a cross-tenant leak.
--
--   BUG 2: no INSERT policy on `restaurants`, so even with correct JWT
--   the ops onboarding wizard cannot create a tenant via the cookie client.
--
--   GAP 3: `menu_categories.name_en` and `menu_items.name_en` /
--   `description_en` don't exist. The simplified add-item form needs them.
--
-- Fix: rewrite policies using `auth.uid()` + lookup tables
-- (`restaurant_owners`, `platform_admins`). This is the pattern Supabase
-- docs recommend and it works regardless of JWT shape or freshness.
-- Add the missing English columns. Re-run refresh_user_app_metadata as a
-- belt-and-braces fallback for anything else that might be reading claims.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER so policies can call them without
--    triggering RLS recursion on the lookup tables).
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  )
$$;

create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_owners
    where user_id = auth.uid()
      and restaurant_id = p_restaurant_id
  )
$$;

-- Text-input variant: safely parses a UUID from text and returns false for
-- non-UUID inputs. Used by storage RLS where folder names come from a path.
create or replace function public.owns_restaurant_text(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid;
begin
  begin
    v := p_text::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.restaurant_owners
    where user_id = auth.uid() and restaurant_id = v
  );
end;
$$;

grant execute on function public.is_platform_admin()           to authenticated;
grant execute on function public.owns_restaurant(uuid)         to authenticated;
grant execute on function public.owns_restaurant_text(text)    to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Drop all the old JWT-claim-based policies. They were never working.
-- ---------------------------------------------------------------------------

-- restaurants
drop policy if exists owner_read_restaurant       on public.restaurants;
drop policy if exists owner_update_restaurant     on public.restaurants;

-- customers
drop policy if exists owner_read_customers        on public.customers;
drop policy if exists owner_write_customers       on public.customers;
drop policy if exists owner_select_customers      on public.customers;
drop policy if exists owner_update_customers      on public.customers;
drop policy if exists owner_delete_customers      on public.customers;

-- orders
drop policy if exists owner_read_orders           on public.orders;
drop policy if exists owner_write_orders          on public.orders;
drop policy if exists owner_select_orders         on public.orders;
drop policy if exists owner_update_orders         on public.orders;
drop policy if exists owner_delete_orders         on public.orders;

-- order_items
drop policy if exists owner_read_order_items      on public.order_items;
drop policy if exists owner_write_order_items     on public.order_items;
drop policy if exists owner_select_order_items    on public.order_items;
drop policy if exists owner_update_order_items    on public.order_items;
drop policy if exists owner_delete_order_items    on public.order_items;

-- customer_tags
drop policy if exists owner_read_tags             on public.customer_tags;
drop policy if exists owner_write_tags            on public.customer_tags;
drop policy if exists owner_all_tags              on public.customer_tags;

-- push_subscriptions
drop policy if exists owner_read_push             on public.push_subscriptions;
drop policy if exists owner_select_push           on public.push_subscriptions;

-- menu_categories / menu_items / menu_item_variants
drop policy if exists owner_all_menu_categories   on public.menu_categories;
drop policy if exists owner_all_menu_items        on public.menu_items;
drop policy if exists owner_all_menu_item_variants on public.menu_item_variants;

-- restaurant_owners
drop policy if exists owner_select_restaurant_owners on public.restaurant_owners;

-- subscriptions / payments / platform_admins
drop policy if exists ops_all_subscriptions       on public.subscriptions;
drop policy if exists owner_select_subscription   on public.subscriptions;
drop policy if exists ops_all_payments            on public.payments;
drop policy if exists owner_select_own_payments   on public.payments;
drop policy if exists ops_select_platform_admins  on public.platform_admins;

-- ---------------------------------------------------------------------------
-- 3. Re-create policies, using helper functions.
-- ---------------------------------------------------------------------------

-- ---- restaurants -----------------------------------------------------------
create policy "rls_restaurants_owner_select" on public.restaurants
  for select to authenticated using (public.owns_restaurant(id));

create policy "rls_restaurants_owner_update" on public.restaurants
  for update to authenticated
  using (public.owns_restaurant(id))
  with check (public.owns_restaurant(id));

create policy "rls_restaurants_ops_all" on public.restaurants
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- customers -------------------------------------------------------------
create policy "rls_customers_owner_all" on public.customers
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "rls_customers_ops_all" on public.customers
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- orders ----------------------------------------------------------------
create policy "rls_orders_owner_all" on public.orders
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "rls_orders_ops_all" on public.orders
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- order_items -----------------------------------------------------------
create policy "rls_order_items_owner_all" on public.order_items
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.owns_restaurant(o.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.owns_restaurant(o.restaurant_id)
  ));

create policy "rls_order_items_ops_all" on public.order_items
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- customer_tags ---------------------------------------------------------
create policy "rls_customer_tags_owner_all" on public.customer_tags
  for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id
      and public.owns_restaurant(c.restaurant_id)
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_tags.customer_id
      and public.owns_restaurant(c.restaurant_id)
  ));

create policy "rls_customer_tags_ops_all" on public.customer_tags
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- push_subscriptions ----------------------------------------------------
create policy "rls_push_subs_owner_select" on public.push_subscriptions
  for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = push_subscriptions.customer_id
      and public.owns_restaurant(c.restaurant_id)
  ));

create policy "rls_push_subs_ops_all" on public.push_subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- menu_categories -------------------------------------------------------
create policy "rls_menu_categories_owner_all" on public.menu_categories
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "rls_menu_categories_ops_all" on public.menu_categories
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- menu_items ------------------------------------------------------------
create policy "rls_menu_items_owner_all" on public.menu_items
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy "rls_menu_items_ops_all" on public.menu_items
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- menu_item_variants ----------------------------------------------------
create policy "rls_menu_variants_owner_all" on public.menu_item_variants
  for all to authenticated
  using (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_variants.menu_item_id
      and public.owns_restaurant(mi.restaurant_id)
  ))
  with check (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_variants.menu_item_id
      and public.owns_restaurant(mi.restaurant_id)
  ));

create policy "rls_menu_variants_ops_all" on public.menu_item_variants
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- restaurant_owners -----------------------------------------------------
create policy "rls_restaurant_owners_self_select" on public.restaurant_owners
  for select to authenticated
  using (user_id = auth.uid());

create policy "rls_restaurant_owners_ops_all" on public.restaurant_owners
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- subscriptions ---------------------------------------------------------
create policy "rls_subscriptions_owner_select" on public.subscriptions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy "rls_subscriptions_ops_all" on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- payments --------------------------------------------------------------
create policy "rls_payments_owner_select" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.subscriptions s
    where s.id = payments.subscription_id
      and public.owns_restaurant(s.restaurant_id)
  ));

create policy "rls_payments_ops_all" on public.payments
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---- platform_admins -------------------------------------------------------
create policy "rls_platform_admins_ops_select" on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4. Schema additions: English fields for the simplified item form.
-- ---------------------------------------------------------------------------

alter table public.menu_categories
  add column if not exists name_en text;

alter table public.menu_items
  add column if not exists name_en text,
  add column if not exists description_en text;

-- ---------------------------------------------------------------------------
-- 5. Storage RLS on menu-images bucket — same JWT-claim-path bug as 0007.
--    Rewrite to use auth.uid() + restaurant_owners lookup.
-- ---------------------------------------------------------------------------

drop policy if exists "menu_images_anon_read"    on storage.objects;
drop policy if exists "menu_images_owner_insert" on storage.objects;
drop policy if exists "menu_images_owner_update" on storage.objects;
drop policy if exists "menu_images_owner_delete" on storage.objects;
drop policy if exists "menu_images_ops_all"      on storage.objects;

create policy "menu_images_anon_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-images');

-- Owners can CRUD inside their own restaurant_id folder
create policy "menu_images_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and public.owns_restaurant_text((storage.foldername(name))[1])
  );

create policy "menu_images_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu-images'
    and public.owns_restaurant_text((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'menu-images'
    and public.owns_restaurant_text((storage.foldername(name))[1])
  );

create policy "menu_images_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and public.owns_restaurant_text((storage.foldername(name))[1])
  );

create policy "menu_images_ops_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'menu-images' and public.is_platform_admin())
  with check (bucket_id = 'menu-images' and public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 6. Defensive: re-run refresh_user_app_metadata for everyone. Harmless if
--    triggers already kept things in sync; corrects any drift from earlier
--    seed steps that may have inserted rows before the trigger existed.
-- ---------------------------------------------------------------------------

do $$
declare
  v_user record;
begin
  for v_user in select user_id from public.restaurant_owners loop
    perform public.refresh_user_app_metadata(v_user.user_id);
  end loop;
  for v_user in select user_id from public.platform_admins loop
    perform public.refresh_user_app_metadata(v_user.user_id);
  end loop;
end$$;
