-- ============================================================================
-- MenuLink · 0004_multi_tenant_menu
--
-- Multi-tenant menu schema. Each restaurant has its own categories, items,
-- and per-variant prices. The customer PWA reads via get_public_menu(slug),
-- the owner edits via /admin/menu, all scoped by restaurant_id with RLS.
--
-- Also expands `restaurants` with editable info (address, hours, brand
-- colors, social handles), and adds `restaurant_owners` to link auth users
-- to the restaurant they manage.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expand restaurants with editable info
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists address_ar       text,
  add column if not exists city             text default 'الرياض',
  add column if not exists lat              numeric(9,6),
  add column if not exists lng              numeric(9,6),
  add column if not exists contact_email    text,
  add column if not exists instagram_handle text,
  add column if not exists tiktok_handle    text,
  add column if not exists hours_json       jsonb,
  add column if not exists logo_url         text,
  add column if not exists cover_image_url  text,
  add column if not exists tagline_ar       text,
  add column if not exists primary_color    text default '#D32027',
  add column if not exists background_color text default '#FAF6EE',
  add column if not exists is_published     boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Menu tables
-- ---------------------------------------------------------------------------

create table public.menu_categories (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  slug            text not null,
  name_ar         text not null,
  emoji           text,
  info_ar         text,
  sort            int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index menu_categories_restaurant_sort_idx
  on public.menu_categories(restaurant_id, sort);

create trigger menu_categories_set_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

create table public.menu_items (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  category_id     uuid not null references public.menu_categories(id) on delete cascade,
  slug            text not null,
  name_ar         text not null,
  description_ar  text,
  image_url       text,
  sort            int not null default 0,
  is_active       boolean not null default true,
  is_chicken      boolean not null default false, -- drives "٤ قطع" labels in PWA
  badges_json     jsonb,                          -- [{ type:'hot', label:'حار' }, ...]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, slug)
);

create index menu_items_category_sort_idx
  on public.menu_items(category_id, sort);

create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create table public.menu_item_variants (
  id                uuid primary key default gen_random_uuid(),
  menu_item_id      uuid not null references public.menu_items(id) on delete cascade,
  variant_key       text not null check (variant_key in ('piece','meal','single')),
  variant_label_ar  text,                         -- '٤ قطع' | 'وجبة (٤ قطع)' | 'قطعة' | 'وجبة' | ''
  price             numeric(10,2) not null check (price >= 0),
  sort              int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (menu_item_id, variant_key)
);

create index menu_item_variants_item_idx
  on public.menu_item_variants(menu_item_id, sort);

-- ---------------------------------------------------------------------------
-- 3. Restaurant owners link table
-- ---------------------------------------------------------------------------

create table public.restaurant_owners (
  user_id        uuid not null references auth.users(id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  role           text not null default 'owner' check (role in ('owner','manager')),
  created_at     timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index restaurant_owners_restaurant_idx on public.restaurant_owners(restaurant_id);

-- ---------------------------------------------------------------------------
-- 4. RLS on the new tables
-- ---------------------------------------------------------------------------

alter table public.menu_categories     enable row level security;
alter table public.menu_items          enable row level security;
alter table public.menu_item_variants  enable row level security;
alter table public.restaurant_owners   enable row level security;

-- Menu categories — owner full access within their tenant
create policy "owner_all_menu_categories"
  on public.menu_categories for all to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

-- Menu items — owner full access within their tenant
create policy "owner_all_menu_items"
  on public.menu_items for all to authenticated
  using (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'))
  with check (restaurant_id::text = (auth.jwt() ->> 'restaurant_id'));

-- Menu item variants — owner full access through the item's restaurant
create policy "owner_all_menu_item_variants"
  on public.menu_item_variants for all to authenticated
  using (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_variants.menu_item_id
      and mi.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ))
  with check (exists (
    select 1 from public.menu_items mi
    where mi.id = menu_item_variants.menu_item_id
      and mi.restaurant_id::text = (auth.jwt() ->> 'restaurant_id')
  ));

-- Restaurant owners — owner can see their own link rows
create policy "owner_select_restaurant_owners"
  on public.restaurant_owners for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. get_public_menu(slug) RPC
--   Anon-callable. Returns full menu JSON for the published+active tenant.
--   Runs SECURITY DEFINER so anon doesn't need any direct table access.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_menu(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant jsonb;
  v_categories jsonb;
begin
  -- Restaurant header (only if active AND published)
  select to_jsonb(r) - 'owner_user_id'
    into v_restaurant
  from (
    select
      r.id, r.slug, r.name, r.whatsapp_phone, r.currency, r.timezone,
      r.address_ar, r.city, r.lat, r.lng,
      r.contact_email, r.instagram_handle, r.tiktok_handle,
      r.hours_json, r.logo_url, r.cover_image_url, r.tagline_ar,
      r.primary_color, r.background_color
    from public.restaurants r
    where r.slug = p_slug
      and r.is_active
      and r.is_published
  ) r;

  if v_restaurant is null then
    return null;
  end if;

  -- Categories with nested items and variants
  select coalesce(jsonb_agg(cat order by cat ->> 'sort'), '[]'::jsonb)
    into v_categories
  from (
    select jsonb_build_object(
      'id',         c.id,
      'slug',       c.slug,
      'name_ar',    c.name_ar,
      'emoji',      c.emoji,
      'info_ar',    c.info_ar,
      'sort',       c.sort,
      'items', (
        select coalesce(jsonb_agg(it order by it ->> 'sort'), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'id',             mi.id,
            'slug',           mi.slug,
            'name_ar',        mi.name_ar,
            'description_ar', mi.description_ar,
            'image_url',      mi.image_url,
            'sort',           mi.sort,
            'is_chicken',     mi.is_chicken,
            'badges',         mi.badges_json,
            'variants', (
              select coalesce(jsonb_agg(v order by v ->> 'sort'), '[]'::jsonb)
              from (
                select jsonb_build_object(
                  'key',   mv.variant_key,
                  'label', mv.variant_label_ar,
                  'price', mv.price,
                  'sort',  mv.sort
                ) as v
                from public.menu_item_variants mv
                where mv.menu_item_id = mi.id and mv.is_active
              ) sv
            )
          ) as it
          from public.menu_items mi
          where mi.category_id = c.id and mi.is_active
        ) si
      )
    ) as cat
    from public.menu_categories c
    where c.restaurant_id = (v_restaurant ->> 'id')::uuid
      and c.is_active
  ) cats;

  return jsonb_build_object(
    'restaurant', v_restaurant,
    'categories', v_categories
  );
end;
$$;

revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
