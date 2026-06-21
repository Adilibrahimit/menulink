# Database Schema · Design, Print, QR, Promotions

## Migration strategy

Use additive Supabase migrations.

Do not alter existing tenant tables destructively in DS-1.

Recommended migration name:

```text
0025_design_print_studio_foundation.sql
```

Adjust the number to the next available migration in the repository.

## Enums

Use `text` plus check constraints instead of PostgreSQL enum types for early flexibility.

## 1. Brand identity templates

```sql
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
```

## 2. Menu page templates

```sql
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
```

## 3. Print templates

```sql
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
```

## 4. QR design templates

```sql
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
```

## 5. Restaurant design profiles

```sql
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
  created_by uuid
);
```

Suggested unique constraint for one published profile per tenant:

```sql
create unique index if not exists ux_restaurant_design_profiles_one_published
on public.restaurant_design_profiles(restaurant_id)
where status = 'published';
```

## 6. Restaurant print profiles

```sql
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
```

## 7. Restaurant QR profiles

```sql
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
```

## 8. Dynamic QR links

```sql
create table if not exists public.qr_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  qr_profile_id uuid references public.restaurant_qr_profiles(id) on delete set null,
  code text not null unique,
  target_type text not null
    check (target_type in ('menu', 'table', 'offer', 'category', 'item')),
  target_id uuid,
  table_id uuid,
  destination_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

## 9. QR exports

```sql
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
```

## 10. Promotions

```sql
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
```

## 11. Promotion items

```sql
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
```

## 12. Print exports

```sql
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
```

## 13. QR scan events

```sql
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
```

## RLS plan

Enable RLS on all new tables.

Public read:

- Active global templates can be read by authenticated platform users.
- Public customer pages do not need direct access to template tables. They should use server-side route/RPC output.

Owner read/write:

- Tenant owners may read published profiles and their own generated exports.
- For DS-1, write access should stay ops-only to reduce risk.
- Future tenant self-service can be added later.

Ops read/write:

- Platform ops can read, insert, update, and archive all template/profile/export records.

Use existing helper functions where available:

- `public.is_platform_admin()`
- `public.owns_restaurant(uuid)`

## Indexes

```sql
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
```

## DS-1 minimum proof

After migration:

- Build passes.
- Existing pages still load.
- Tables exist in Supabase.
- RLS enabled.
- Seed templates inserted idempotently.
- No existing tenant data changed.
