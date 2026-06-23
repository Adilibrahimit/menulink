# Seed Templates · Starter Set

## Purpose

This file defines the first reusable templates to seed during DS-1.

## Brand identity templates

### 1. KO-KO Bold

```json
{
  "key": "koko-bold-v1",
  "name_ar": "كوكو جريء",
  "name_en": "KO-KO Bold",
  "business_type": "broasted",
  "tier": "standard",
  "default_tokens_json": {
    "colors": {
      "background": "#FAF6EE",
      "surface": "#FFFFFF",
      "primary": "#D32027",
      "primaryDark": "#A0181D",
      "accent": "#FFC619",
      "text": "#2A1810",
      "muted": "#71717A"
    },
    "typography": {
      "heading": "Tajawal",
      "body": "Cairo",
      "latin": "Geist"
    },
    "mood": "bold-fast-food",
    "radius": {
      "card": "18px",
      "button": "14px"
    }
  }
}
```

### 2. RzRz Navy

```json
{
  "key": "rzrz-navy-v1",
  "name_ar": "رزرز كحلي",
  "name_en": "RzRz Navy",
  "business_type": "rice-restaurant",
  "tier": "pro",
  "default_tokens_json": {
    "colors": {
      "background": "#061A3A",
      "surface": "#FFFFFF",
      "primary": "#C8A15A",
      "accent": "#F7C948",
      "text": "#0B1220",
      "muted": "#6B7280"
    },
    "typography": {
      "heading": "Alexandria",
      "body": "Cairo",
      "latin": "Geist"
    },
    "mood": "navy-saudi-restaurant",
    "radius": {
      "card": "20px",
      "button": "999px"
    }
  }
}
```

### 3. Velora Premium

```json
{
  "key": "velora-premium-v1",
  "name_ar": "فيلورا بريميوم",
  "name_en": "Velora Premium",
  "business_type": "restaurant-cafe-lounge",
  "tier": "premium",
  "default_tokens_json": {
    "colors": {
      "background": "#0F0E0D",
      "surface": "#1C1A17",
      "surfaceSoft": "#25221D",
      "primary": "#C8A15A",
      "accent": "#6B1E1E",
      "text": "#F3EBDD",
      "muted": "#A79A86",
      "line": "#4A3821"
    },
    "typography": {
      "heading": "Tajawal",
      "body": "Cairo",
      "latin": "Geist"
    },
    "mood": "premium-lounge",
    "radius": {
      "card": "22px",
      "button": "16px"
    }
  }
}
```

### 4. Standard Clean

```json
{
  "key": "standard-clean-v1",
  "name_ar": "نظيف قياسي",
  "name_en": "Standard Clean",
  "business_type": "general",
  "tier": "standard",
  "default_tokens_json": {
    "colors": {
      "background": "#FAF6EE",
      "surface": "#FFFFFF",
      "primary": "#D32027",
      "text": "#18181B",
      "muted": "#71717A"
    },
    "typography": {
      "heading": "Tajawal",
      "body": "Cairo",
      "latin": "Geist"
    },
    "mood": "clean-general"
  }
}
```

### 5. Café Minimal

```json
{
  "key": "cafe-minimal-v1",
  "name_ar": "مقهى هادئ",
  "name_en": "Cafe Minimal",
  "business_type": "cafe",
  "tier": "standard",
  "default_tokens_json": {
    "colors": {
      "background": "#F8F4ED",
      "surface": "#FFFFFF",
      "primary": "#3D2914",
      "accent": "#C9A86A",
      "text": "#1A1108",
      "muted": "#8B7B6B"
    },
    "typography": {
      "heading": "Tajawal",
      "body": "Cairo",
      "latin": "Geist"
    },
    "mood": "calm-cafe"
  }
}
```

## Menu page templates

```json
[
  {
    "key": "fast-food-grid-v1",
    "name_ar": "شبكة الوجبات السريعة",
    "layout_type": "grid",
    "supported_business_types": ["broasted", "burger", "fast-food", "general"]
  },
  {
    "key": "premium-lounge-grid-v1",
    "name_ar": "شبكة لاونج فاخرة",
    "layout_type": "premium-grid",
    "supported_business_types": ["restaurant-cafe-lounge", "premium", "cafe"]
  }
]
```

## Print templates

```json
[
  {
    "key": "a3-full-menu-bold-v1",
    "name_ar": "منيو كامل A3 جريء",
    "output_type": "full_menu",
    "paper_size": "A3",
    "orientation": "landscape"
  },
  {
    "key": "a4-full-menu-clean-v1",
    "name_ar": "منيو كامل A4 نظيف",
    "output_type": "full_menu",
    "paper_size": "A4",
    "orientation": "portrait"
  }
]
```

## QR design templates

```json
[
  {
    "key": "qr-standard-a4-poster-v1",
    "name_ar": "بوستر QR قياسي A4",
    "output_type": "poster",
    "paper_size": "A4",
    "orientation": "portrait",
    "supported_tiers": ["standard", "pro", "premium"]
  },
  {
    "key": "qr-standard-table-tent-v1",
    "name_ar": "ستاند طاولة QR قياسي",
    "output_type": "table_tent",
    "paper_size": "custom",
    "orientation": "portrait",
    "supported_tiers": ["standard", "pro", "premium"]
  },
  {
    "key": "qr-koko-bold-poster-v1",
    "name_ar": "بوستر QR كوكو",
    "output_type": "poster",
    "paper_size": "A4",
    "orientation": "portrait",
    "supported_tiers": ["standard", "pro"]
  },
  {
    "key": "qr-rzrz-navy-table-v1",
    "name_ar": "QR طاولة رزرز كحلي",
    "output_type": "table_tent",
    "paper_size": "custom",
    "orientation": "portrait",
    "supported_tiers": ["pro", "premium"]
  },
  {
    "key": "qr-velora-premium-card-v1",
    "name_ar": "بطاقة QR فيلورا بريميوم",
    "output_type": "business_card",
    "paper_size": "A5",
    "orientation": "portrait",
    "supported_tiers": ["premium"]
  }
]
```

## Seed implementation rule

Use `insert ... on conflict (key) do update` or equivalent idempotent logic.

Do not create duplicate templates when the migration is re-run.
