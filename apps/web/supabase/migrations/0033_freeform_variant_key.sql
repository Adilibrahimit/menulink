-- 0033: Drop variant_key CHECK constraint to allow freeform keys
-- Owners need to add custom sizes/kinds (can, 1L, 2.2L, etc.)
-- that don't fit the original enum (single/piece/meal/full/half/quarter/...).

ALTER TABLE public.menu_item_variants
  DROP CONSTRAINT IF EXISTS menu_item_variants_variant_key_check;
