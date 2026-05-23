-- ============================================================================
-- MenuLink · 0013_variant_key_extended
--
-- Extend the menu_item_variants.variant_key CHECK constraint to cover
-- size-based menus (grilled chicken full/half/quarter, kilo/half_kilo cuts,
-- small/medium/large drinks). The original 0001-era constraint allowed only
-- 'single', 'piece', 'meal' — fine for KO-KO Chicky Licky (which uses
-- piece/meal for chicken bundles) but blocking for RzRz Bukhari, where every
-- grilled dish has full/half/quarter variants.
--
-- All previously-valid values are preserved. New values: full, half, quarter,
-- small, medium, large, kilo, half_kilo. Migration applied to Supabase Cloud
-- 2026-05-23 ahead of the RzRz menu import (56 variants across 36 dishes).
-- ============================================================================

alter table public.menu_item_variants
  drop constraint if exists menu_item_variants_variant_key_check;

alter table public.menu_item_variants
  add constraint menu_item_variants_variant_key_check
  check (variant_key in (
    -- original allowed set
    'single', 'piece', 'meal',
    -- size variants for grilled/charcoal/madghoot dishes
    'full', 'half', 'quarter',
    -- size variants for drinks / sides
    'small', 'medium', 'large',
    -- weight variants for kebabs/meats
    'kilo', 'half_kilo'
  ));
