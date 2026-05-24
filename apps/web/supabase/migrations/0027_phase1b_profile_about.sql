-- ============================================================================
-- MenuLink · 0027_phase1b_profile_about
--
-- Phase 1b schema additions:
-- 1. customers: birthday, email, deleted_at (soft delete)
-- 2. restaurants: about_ar, vision_ar, mission_ar (per-tenant About Us)
-- ============================================================================

begin;

-- Customer profile fields
alter table public.customers
  add column if not exists birthday date,
  add column if not exists email text,
  add column if not exists deleted_at timestamptz;

create index if not exists customers_deleted_at_idx
  on public.customers(deleted_at) where deleted_at is not null;

-- Per-tenant About Us / Vision & Mission
alter table public.restaurants
  add column if not exists about_ar text,
  add column if not exists vision_ar text,
  add column if not exists mission_ar text;

commit;
