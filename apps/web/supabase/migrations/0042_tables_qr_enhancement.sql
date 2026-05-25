-- ============================================================================
-- MenuLink · 0042_tables_qr_enhancement
--
-- Phase 8 of Global Operations Core:
--   1. Enhance restaurant_tables: bilingual names, qr_token, is_active
--   2. Generate QR tokens for existing tables
--   3. Table-branch unique constraints
--
-- restaurant_tables already has branch_id from migration 0037.
-- This migration adds the remaining columns for full branch-scoped
-- table management with QR code support.
-- ============================================================================

-- --- 1. Add columns ---------------------------------------------------------

alter table public.restaurant_tables
  add column if not exists display_name_ar text,
  add column if not exists display_name_en text,
  add column if not exists qr_token text,
  add column if not exists is_active boolean not null default true;

-- --- 2. Backfill display_name_ar from existing label ------------------------

update public.restaurant_tables
set display_name_ar = label
where display_name_ar is null;

-- --- 3. Generate unique QR tokens for existing tables -----------------------

update public.restaurant_tables
set qr_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
where qr_token is null;

-- --- 4. Unique constraints --------------------------------------------------

-- QR token must be globally unique (for scanning)
create unique index if not exists idx_tables_qr_token
  on public.restaurant_tables(qr_token)
  where qr_token is not null;

-- Branch + label must be unique (for branch-scoped table management)
-- Note: original constraint is (restaurant_id, label). We keep it for
-- single-branch compat and add branch-scoped one.
create unique index if not exists idx_tables_branch_label
  on public.restaurant_tables(branch_id, label)
  where branch_id is not null;
