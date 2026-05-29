-- ============================================================================
-- MenuLink · 0068_motion_arch_space  (DS-8 — Remotion architecture-space)
--
-- Future-schema foundation ONLY. Reserves the database space for a later
-- motion/video feature (promo reels, item spotlights, offer stories) by
-- mirroring the existing template -> profile -> export pattern (cf. DS-1
-- qr_design_templates / restaurant_qr_profiles / qr_exports).
--
-- Per the pack: Remotion is NOT installed; there is no render worker, no UI,
-- and no app code consuming these tables yet. Purely additive: 3 tables + RLS
-- + 3 global template seeds. No existing object is touched; no tenant rows.
-- ============================================================================

-- 1. GLOBAL: motion templates --------------------------------------------------
create table if not exists public.motion_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name_ar text not null,
  name_en text,
  format text not null
    check (format in ('reel_9_16', 'square_1_1', 'story_9_16', 'landscape_16_9')),
  composition_id text,                       -- future Remotion composition name
  duration_seconds int not null default 15,
  default_props_json jsonb not null default '{}'::jsonb,
  supported_tiers text[] not null default array['standard', 'pro', 'premium'],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. TENANT: motion profiles ---------------------------------------------------
create table if not exists public.restaurant_motion_profiles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  motion_template_id uuid not null references public.motion_templates(id),
  name_ar text not null,
  props_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_by uuid,                           -- soft ref auth.users(id)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TENANT: motion exports ----------------------------------------------------
create table if not exists public.motion_exports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  motion_profile_id uuid references public.restaurant_motion_profiles(id) on delete set null,
  export_type text not null
    check (export_type in ('mp4', 'gif', 'webm')),
  file_url text,
  data_hash text not null,
  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'rendered', 'failed', 'outdated')),
  error_message text,
  duration_ms int,
  rendered_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Indexes -------------------------------------------------------------------
create index if not exists ix_restaurant_motion_profiles_restaurant
  on public.restaurant_motion_profiles (restaurant_id);
create index if not exists ix_motion_exports_restaurant
  on public.motion_exports (restaurant_id);
create unique index if not exists ux_restaurant_motion_profiles_one_published
  on public.restaurant_motion_profiles (restaurant_id) where status = 'published';

-- 5. RLS -----------------------------------------------------------------------
alter table public.motion_templates            enable row level security;
alter table public.restaurant_motion_profiles  enable row level security;
alter table public.motion_exports              enable row level security;

drop policy if exists motion_templates_ops_all   on public.motion_templates;
drop policy if exists motion_templates_auth_read on public.motion_templates;
create policy motion_templates_ops_all on public.motion_templates
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy motion_templates_auth_read on public.motion_templates
  for select to authenticated using (is_active);

drop policy if exists restaurant_motion_profiles_ops_all    on public.restaurant_motion_profiles;
drop policy if exists restaurant_motion_profiles_owner_read on public.restaurant_motion_profiles;
create policy restaurant_motion_profiles_ops_all on public.restaurant_motion_profiles
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy restaurant_motion_profiles_owner_read on public.restaurant_motion_profiles
  for select to authenticated using (public.owns_restaurant(restaurant_id));

drop policy if exists motion_exports_ops_all    on public.motion_exports;
drop policy if exists motion_exports_owner_read on public.motion_exports;
create policy motion_exports_ops_all on public.motion_exports
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy motion_exports_owner_read on public.motion_exports
  for select to authenticated using (public.owns_restaurant(restaurant_id));

-- 6. Seeds (GLOBAL templates only; idempotent) ---------------------------------
insert into public.motion_templates (key, name_ar, name_en, format, composition_id, duration_seconds, supported_tiers)
values
  ('promo-reel-9-16-v1',    'ريل ترويجي عمودي',  'Promo Reel',     'reel_9_16',  'PromoReel',      15, array['standard', 'pro', 'premium']),
  ('item-spotlight-1-1-v1', 'تسليط ضوء على صنف', 'Item Spotlight', 'square_1_1', 'ItemSpotlight',   8, array['pro', 'premium']),
  ('offer-story-9-16-v1',   'ستوري عرض',         'Offer Story',    'story_9_16', 'OfferStory',     10, array['standard', 'pro', 'premium'])
on conflict (key) do update set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  format = excluded.format,
  composition_id = excluded.composition_id,
  duration_seconds = excluded.duration_seconds,
  supported_tiers = excluded.supported_tiers;
