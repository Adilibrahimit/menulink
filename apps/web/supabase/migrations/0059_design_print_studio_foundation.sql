-- ============================================================================
-- MenuLink · 0059_design_print_studio_foundation
--
-- Phase DS-1 of the Brand & Print Studio initiative. FOUNDATION ONLY:
-- additive tables, indexes, RLS, and idempotent template seeds. No UI, no PDF
-- rendering, no Remotion, no /m/[slug] changes, no POS changes.
--
-- Adds the reusable design/print/QR/promotion data model that DS-2 (Ops Studio
-- UI) and DS-3 (customer PWA resolver) consume later. Nothing here is wired into
-- any existing route yet, so existing tenants (KO-KO, RzRz, Mazaj) are unaffected.
--
-- Tables (13):
--   Global templates : brand_identity_templates, menu_page_templates,
--                      print_templates, qr_design_templates
--   Tenant profiles  : restaurant_design_profiles, restaurant_print_profiles,
--                      restaurant_qr_profiles
--   QR + exports     : qr_links, qr_exports, print_exports, qr_scan_events
--   Promotions       : promotions, promotion_items
--
-- RLS: reuses public.is_platform_admin() / public.owns_restaurant(uuid) (0008).
--   Global templates -> ops full + authenticated read of active rows.
--   Tenant tables    -> ops full + owner read only (write stays ops-only in DS-1).
--
-- Seeds: 14 global template rows, idempotent (on conflict (key) do update).
--   No tenant design profiles are seeded (would alter rendering once DS-3 lands).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Global template tables
-- ---------------------------------------------------------------------------

create table if not exists public.brand_identity_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text,
  business_type text not null default 'general',
  tier text not null default 'standard'
    check (tier in ('standard', 'pro', 'premium')),
  preview_image_url text,
  default_tokens_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_page_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text,
  layout_type text not null default 'grid',
  supported_business_types text[] not null default array['general'],
  default_config_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.print_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text,
  output_type text not null
    check (output_type in ('full_menu', 'category', 'item_card', 'offer', 'qr_table', 'qr_poster')),
  paper_size text not null
    check (paper_size in ('A3', 'A4', 'A5', 'square', 'custom')),
  orientation text not null
    check (orientation in ('portrait', 'landscape', 'square')),
  config_schema_json jsonb not null default '{}'::jsonb,
  preview_image_url text,
  is_global boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_design_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text,
  output_type text not null
    check (output_type in ('poster', 'table_tent', 'sticker', 'offer', 'category', 'item', 'business_card')),
  paper_size text not null
    check (paper_size in ('A3', 'A4', 'A5', 'square', 'custom')),
  orientation text not null
    check (orientation in ('portrait', 'landscape', 'square')),
  supported_tiers text[] not null default array['standard'],
  default_tokens_json jsonb not null default '{}'::jsonb,
  preview_image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Tenant design / print / QR profiles
-- ---------------------------------------------------------------------------

create table if not exists public.restaurant_design_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  brand_template_id uuid references public.brand_identity_templates(id),
  menu_page_template_id uuid references public.menu_page_templates(id),
  brand_tokens_json jsonb not null default '{}'::jsonb,
  menu_tokens_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  version_number integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid  -- no FK: matches MenuLink convention (membership via restaurant_owners/platform_admins)
);

create table if not exists public.restaurant_print_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  print_template_id uuid not null references public.print_templates(id),
  custom_tokens_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_qr_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  qr_design_template_id uuid not null references public.qr_design_templates(id),
  name_ar text not null,
  purpose text not null
    check (purpose in ('menu', 'table', 'offer', 'category', 'item')),
  custom_tokens_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Dynamic QR links + exports
-- ---------------------------------------------------------------------------

create table if not exists public.qr_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  qr_profile_id uuid references public.restaurant_qr_profiles(id) on delete set null,
  code text not null unique,
  target_type text not null
    check (target_type in ('menu', 'table', 'offer', 'category', 'item')),
  target_id uuid,
  table_id uuid,  -- soft ref restaurant_tables(id); intentionally FK-less per DS-1 spec
  destination_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_exports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  qr_profile_id uuid references public.restaurant_qr_profiles(id) on delete set null,
  qr_link_id uuid references public.qr_links(id) on delete set null,
  export_type text not null
    check (export_type in ('pdf', 'png', 'svg')),
  file_url text,
  data_hash text not null,
  status text not null default 'queued'
    check (status in ('queued', 'rendered', 'failed', 'outdated')),
  error_message text,
  rendered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.print_exports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  print_template_id uuid references public.print_templates(id) on delete set null,
  export_type text not null
    check (export_type in ('pdf', 'png')),
  file_url text,
  data_hash text not null,
  status text not null default 'queued'
    check (status in ('queued', 'rendered', 'failed', 'outdated')),
  error_message text,
  rendered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  qr_link_id uuid references public.qr_links(id) on delete set null,
  scanned_at timestamptz not null default now(),
  user_agent text,
  referrer text,
  source_type text
    check (source_type in ('table', 'poster', 'sticker', 'offer', 'category', 'item', 'unknown')),
  ip_hash text
);

-- ---------------------------------------------------------------------------
-- 4. Promotions
-- ---------------------------------------------------------------------------

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title_ar text not null,
  subtitle_ar text,
  description_ar text,
  badge_text_ar text,
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  priority integer not null default 0,
  show_on_menu_home boolean not null default true,
  show_in_print_exports boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promotion_items (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  old_price numeric,
  new_price numeric,
  bundle_price numeric,
  notes_ar text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------

create index if not exists ix_restaurant_design_profiles_restaurant
on public.restaurant_design_profiles(restaurant_id);

create index if not exists ix_restaurant_print_profiles_restaurant
on public.restaurant_print_profiles(restaurant_id);

create index if not exists ix_restaurant_qr_profiles_restaurant
on public.restaurant_qr_profiles(restaurant_id);

create index if not exists ix_promotions_restaurant_active
on public.promotions(restaurant_id, is_active, starts_at, ends_at);

create index if not exists ix_qr_links_restaurant
on public.qr_links(restaurant_id);

create index if not exists ix_qr_exports_restaurant
on public.qr_exports(restaurant_id);

create index if not exists ix_print_exports_restaurant
on public.print_exports(restaurant_id);

-- One published design profile per tenant.
create unique index if not exists ux_restaurant_design_profiles_one_published
on public.restaurant_design_profiles(restaurant_id)
where status = 'published';

-- ---------------------------------------------------------------------------
-- 6. RLS — enable on all 13 tables
-- ---------------------------------------------------------------------------

alter table public.brand_identity_templates   enable row level security;
alter table public.menu_page_templates        enable row level security;
alter table public.print_templates            enable row level security;
alter table public.qr_design_templates        enable row level security;
alter table public.restaurant_design_profiles enable row level security;
alter table public.restaurant_print_profiles  enable row level security;
alter table public.restaurant_qr_profiles     enable row level security;
alter table public.qr_links                   enable row level security;
alter table public.qr_exports                 enable row level security;
alter table public.print_exports              enable row level security;
alter table public.qr_scan_events             enable row level security;
alter table public.promotions                 enable row level security;
alter table public.promotion_items            enable row level security;

-- ---------------------------------------------------------------------------
-- 6a. Global template policies: ops full access + authenticated read of active
-- ---------------------------------------------------------------------------

drop policy if exists brand_identity_templates_ops_all  on public.brand_identity_templates;
drop policy if exists brand_identity_templates_auth_read on public.brand_identity_templates;
create policy brand_identity_templates_ops_all on public.brand_identity_templates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy brand_identity_templates_auth_read on public.brand_identity_templates
  for select to authenticated using (is_active);

drop policy if exists menu_page_templates_ops_all  on public.menu_page_templates;
drop policy if exists menu_page_templates_auth_read on public.menu_page_templates;
create policy menu_page_templates_ops_all on public.menu_page_templates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy menu_page_templates_auth_read on public.menu_page_templates
  for select to authenticated using (is_active);

drop policy if exists print_templates_ops_all  on public.print_templates;
drop policy if exists print_templates_auth_read on public.print_templates;
create policy print_templates_ops_all on public.print_templates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy print_templates_auth_read on public.print_templates
  for select to authenticated using (is_active);

drop policy if exists qr_design_templates_ops_all  on public.qr_design_templates;
drop policy if exists qr_design_templates_auth_read on public.qr_design_templates;
create policy qr_design_templates_ops_all on public.qr_design_templates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy qr_design_templates_auth_read on public.qr_design_templates
  for select to authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- 6b. Tenant-scoped policies: ops full access + owner read (write = ops-only)
-- ---------------------------------------------------------------------------

drop policy if exists restaurant_design_profiles_ops_all    on public.restaurant_design_profiles;
drop policy if exists restaurant_design_profiles_owner_read on public.restaurant_design_profiles;
create policy restaurant_design_profiles_ops_all on public.restaurant_design_profiles
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy restaurant_design_profiles_owner_read on public.restaurant_design_profiles
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists restaurant_print_profiles_ops_all    on public.restaurant_print_profiles;
drop policy if exists restaurant_print_profiles_owner_read on public.restaurant_print_profiles;
create policy restaurant_print_profiles_ops_all on public.restaurant_print_profiles
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy restaurant_print_profiles_owner_read on public.restaurant_print_profiles
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists restaurant_qr_profiles_ops_all    on public.restaurant_qr_profiles;
drop policy if exists restaurant_qr_profiles_owner_read on public.restaurant_qr_profiles;
create policy restaurant_qr_profiles_ops_all on public.restaurant_qr_profiles
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy restaurant_qr_profiles_owner_read on public.restaurant_qr_profiles
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists qr_links_ops_all    on public.qr_links;
drop policy if exists qr_links_owner_read on public.qr_links;
create policy qr_links_ops_all on public.qr_links
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy qr_links_owner_read on public.qr_links
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists qr_exports_ops_all    on public.qr_exports;
drop policy if exists qr_exports_owner_read on public.qr_exports;
create policy qr_exports_ops_all on public.qr_exports
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy qr_exports_owner_read on public.qr_exports
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists print_exports_ops_all    on public.print_exports;
drop policy if exists print_exports_owner_read on public.print_exports;
create policy print_exports_ops_all on public.print_exports
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy print_exports_owner_read on public.print_exports
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists qr_scan_events_ops_all    on public.qr_scan_events;
drop policy if exists qr_scan_events_owner_read on public.qr_scan_events;
create policy qr_scan_events_ops_all on public.qr_scan_events
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy qr_scan_events_owner_read on public.qr_scan_events
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists promotions_ops_all    on public.promotions;
drop policy if exists promotions_owner_read on public.promotions;
create policy promotions_ops_all on public.promotions
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy promotions_owner_read on public.promotions
  for select to authenticated using (public.owns_restaurant(restaurant_id));

-- promotion_items has no restaurant_id; resolve ownership via parent promotion.
drop policy if exists promotion_items_ops_all    on public.promotion_items;
drop policy if exists promotion_items_owner_read on public.promotion_items;
create policy promotion_items_ops_all on public.promotion_items
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy promotion_items_owner_read on public.promotion_items
  for select to authenticated using (
    exists (
      select 1 from public.promotions p
      where p.id = promotion_items.promotion_id
        and public.owns_restaurant(p.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Idempotent seeds — global template rows only (no tenant profiles)
-- ---------------------------------------------------------------------------

-- 7a. Brand identity templates
insert into public.brand_identity_templates (key, name_ar, name_en, business_type, tier, default_tokens_json)
values
  ('koko-bold-v1', 'كوكو جريء', 'KO-KO Bold', 'broasted', 'standard', '{
    "colors": {"background": "#FAF6EE", "surface": "#FFFFFF", "primary": "#D32027", "primaryDark": "#A0181D", "accent": "#FFC619", "text": "#2A1810", "muted": "#71717A"},
    "typography": {"heading": "Tajawal", "body": "Cairo", "latin": "Geist"},
    "mood": "bold-fast-food",
    "radius": {"card": "18px", "button": "14px"}
  }'::jsonb),
  ('rzrz-navy-v1', 'رزرز كحلي', 'RzRz Navy', 'rice-restaurant', 'pro', '{
    "colors": {"background": "#061A3A", "surface": "#FFFFFF", "primary": "#C8A15A", "accent": "#F7C948", "text": "#0B1220", "muted": "#6B7280"},
    "typography": {"heading": "Alexandria", "body": "Cairo", "latin": "Geist"},
    "mood": "navy-saudi-restaurant",
    "radius": {"card": "20px", "button": "999px"}
  }'::jsonb),
  ('velora-premium-v1', 'فيلورا بريميوم', 'Velora Premium', 'restaurant-cafe-lounge', 'premium', '{
    "colors": {"background": "#0F0E0D", "surface": "#1C1A17", "surfaceSoft": "#25221D", "primary": "#C8A15A", "accent": "#6B1E1E", "text": "#F3EBDD", "muted": "#A79A86", "line": "#4A3821"},
    "typography": {"heading": "Tajawal", "body": "Cairo", "latin": "Geist"},
    "mood": "premium-lounge",
    "radius": {"card": "22px", "button": "16px"}
  }'::jsonb),
  ('standard-clean-v1', 'نظيف قياسي', 'Standard Clean', 'general', 'standard', '{
    "colors": {"background": "#FAF6EE", "surface": "#FFFFFF", "primary": "#D32027", "text": "#18181B", "muted": "#71717A"},
    "typography": {"heading": "Tajawal", "body": "Cairo", "latin": "Geist"},
    "mood": "clean-general"
  }'::jsonb),
  ('cafe-minimal-v1', 'مقهى هادئ', 'Cafe Minimal', 'cafe', 'standard', '{
    "colors": {"background": "#F8F4ED", "surface": "#FFFFFF", "primary": "#3D2914", "accent": "#C9A86A", "text": "#1A1108", "muted": "#8B7B6B"},
    "typography": {"heading": "Tajawal", "body": "Cairo", "latin": "Geist"},
    "mood": "calm-cafe"
  }'::jsonb)
on conflict (key) do update set
  name_ar             = excluded.name_ar,
  name_en             = excluded.name_en,
  business_type       = excluded.business_type,
  tier                = excluded.tier,
  default_tokens_json = excluded.default_tokens_json;

-- 7b. Menu page templates
insert into public.menu_page_templates (key, name_ar, layout_type, supported_business_types)
values
  ('fast-food-grid-v1', 'شبكة الوجبات السريعة', 'grid', array['broasted', 'burger', 'fast-food', 'general']),
  ('premium-lounge-grid-v1', 'شبكة لاونج فاخرة', 'premium-grid', array['restaurant-cafe-lounge', 'premium', 'cafe'])
on conflict (key) do update set
  name_ar                  = excluded.name_ar,
  layout_type              = excluded.layout_type,
  supported_business_types = excluded.supported_business_types;

-- 7c. Print templates
insert into public.print_templates (key, name_ar, output_type, paper_size, orientation)
values
  ('a3-full-menu-bold-v1', 'منيو كامل A3 جريء', 'full_menu', 'A3', 'landscape'),
  ('a4-full-menu-clean-v1', 'منيو كامل A4 نظيف', 'full_menu', 'A4', 'portrait')
on conflict (key) do update set
  name_ar     = excluded.name_ar,
  output_type = excluded.output_type,
  paper_size  = excluded.paper_size,
  orientation = excluded.orientation;

-- 7d. QR design templates
insert into public.qr_design_templates (key, name_ar, output_type, paper_size, orientation, supported_tiers)
values
  ('qr-standard-a4-poster-v1', 'بوستر QR قياسي A4', 'poster', 'A4', 'portrait', array['standard', 'pro', 'premium']),
  ('qr-standard-table-tent-v1', 'ستاند طاولة QR قياسي', 'table_tent', 'custom', 'portrait', array['standard', 'pro', 'premium']),
  ('qr-koko-bold-poster-v1', 'بوستر QR كوكو', 'poster', 'A4', 'portrait', array['standard', 'pro']),
  ('qr-rzrz-navy-table-v1', 'QR طاولة رزرز كحلي', 'table_tent', 'custom', 'portrait', array['pro', 'premium']),
  ('qr-velora-premium-card-v1', 'بطاقة QR فيلورا بريميوم', 'business_card', 'A5', 'portrait', array['premium'])
on conflict (key) do update set
  name_ar         = excluded.name_ar,
  output_type     = excluded.output_type,
  paper_size      = excluded.paper_size,
  orientation     = excluded.orientation,
  supported_tiers = excluded.supported_tiers;
