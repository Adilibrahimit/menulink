-- ============================================================================
-- MenuLink · 0007_menu_images_storage
--
-- Public bucket "menu-images" for tenant-owned menu item photos.
--   - Anonymous: SELECT only (customers see the images on the public PWA)
--   - Authenticated restaurant owner: full CRUD inside their own
--     restaurant_id folder, enforced by path prefix.
--
-- Storage path convention: <restaurant_id>/<menu_item_id>.<ext>
-- Public URL pattern: <supabase_url>/storage/v1/object/public/menu-images/...
-- ============================================================================

-- 1. Create the bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5 * 1024 * 1024,   -- 5 MB ceiling per upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS policies on storage.objects (Supabase enables RLS by default)

-- Drop our own previous versions (idempotent re-runs)
drop policy if exists "menu_images_anon_read"      on storage.objects;
drop policy if exists "menu_images_owner_insert"   on storage.objects;
drop policy if exists "menu_images_owner_update"   on storage.objects;
drop policy if exists "menu_images_owner_delete"   on storage.objects;
drop policy if exists "menu_images_ops_all"        on storage.objects;

-- Anyone can read menu images (the bucket is public, but RLS still applies
-- on direct API calls).
create policy "menu_images_anon_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'menu-images');

-- Owners can upload to their own restaurant_id folder.
-- Folder convention: '<restaurant_id_uuid>/...'
-- (storage.foldername(name))[1] returns the first path segment.
create policy "menu_images_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'restaurant_id')
  );

create policy "menu_images_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'restaurant_id')
  )
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'restaurant_id')
  );

create policy "menu_images_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'restaurant_id')
  );

-- Platform admins can manage all menu images across tenants.
create policy "menu_images_ops_all"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'menu-images'
    and (auth.jwt() ->> 'role') = 'platform_admin'
  )
  with check (
    bucket_id = 'menu-images'
    and (auth.jwt() ->> 'role') = 'platform_admin'
  );
