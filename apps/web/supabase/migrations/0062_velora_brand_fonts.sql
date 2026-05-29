-- ============================================================================
-- MenuLink · 0062_velora_brand_fonts
--
-- Correct the velora-premium-v1 brand template to the real Velora brand board
-- (docs/clients-menu/Design-template): Latin display face Cormorant Garamond,
-- Arabic face Tajawal, plus the secondary brown/green palette swatches. Colors
-- already matched. Idempotent UPDATE by key; no schema change.
-- ============================================================================

update public.brand_identity_templates
set default_tokens_json = '{
  "colors": {
    "background": "#0F0E0D",
    "surface": "#1C1A17",
    "surfaceSoft": "#25221D",
    "primary": "#C8A15A",
    "accent": "#6B1E1E",
    "secondaryBrown": "#3A3026",
    "secondaryGreen": "#183A2F",
    "text": "#F3EBDD",
    "muted": "#A79A86",
    "line": "#4A3821"
  },
  "typography": { "heading": "Tajawal", "body": "Tajawal", "latin": "Cormorant Garamond" },
  "mood": "premium-lounge",
  "radius": { "card": "22px", "button": "16px" }
}'::jsonb
where key = 'velora-premium-v1';
