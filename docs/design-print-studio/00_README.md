# MenuLink Brand & Print Studio · Planning Pack

## Purpose

This pack defines the full MenuLink Brand & Print Studio initiative for Claude Code.

The goal is to evolve MenuLink from a simple digital menu SaaS into a reusable design, print, QR, promotion, and future motion-output system for restaurants, cafés, and lounges.

## Current project reality

MenuLink already has:

- Customer PWA at `/m/[slug]`
- Tenant Admin at `/admin/*`
- Platform Ops at `/ops/*`
- Multi-tenant Supabase data model
- Menu CRUD
- Tenant design panel
- QR poster generation
- Table QR features
- Loyalty and nutrition foundations
- Per-tenant logo, cover, colors
- Existing design system in `DESIGN.md`

This project must build on the current architecture. Do not rebuild the app.

## What this pack contains

| File | Purpose |
|---|---|
| `00_README.md` | Navigation and execution order |
| `01_PRODUCT_BRIEF.md` | Strategic product definition |
| `02_ARCHITECTURE.md` | High-level architecture and module boundaries |
| `03_DATABASE_SCHEMA.md` | Supabase schema and RLS plan |
| `04_TEMPLATE_TAXONOMY.md` | Brand, page, print, QR, offer template model |
| `05_QR_DESIGN_SYSTEM.md` | QR template rules, safety, export, scan tracking |
| `06_PRINT_EXPORT_ENGINE.md` | PDF, PNG, SVG export architecture |
| `07_PROMOTIONS_SYSTEM.md` | Offers shown in PWA, print, QR, exports |
| `08_REMOTION_MOTION_ASSETS.md` | Future video and animated asset scope |
| `09_IMPLEMENTATION_PHASES.md` | Phased build plan with acceptance gates |
| `10_CLAUDE_CODE_MASTER_PROMPT.md` | Copy-paste prompt for Claude Code |
| `11_ACCEPTANCE_QA_CHECKLIST.md` | Test, validation, and proof checklist |
| `12_SEED_TEMPLATES.md` | Starter templates: KO-KO, RzRz, Velora, Standard |

## Recommended execution order

1. Read `memory.md`, `CLAUDE.md`, and `DESIGN.md`.
2. Read this pack from `00` to `12`.
3. Implement **Phase DS-1 only** first.
4. Stop after DS-1 and produce a proof file.
5. Do not implement PDF rendering, Remotion, or major customer PWA redesign in DS-1.

## Strategic decision

Build this as:

> **MenuLink Brand & Print Studio**

Not as a small enhancement to the current design form.

The system must separate:

- Brand identity templates
- Menu page templates
- Print templates
- QR design templates
- Promotion cards
- Export history
- Motion assets later

## Non-negotiable principles

- Arabic-first, RTL-first, mobile-first.
- Existing customer PWA must not break.
- Existing KO-KO and RzRz pages must remain operational.
- No hardcoded tenant data in reusable templates.
- Do not store all template state inside `restaurants`.
- All public output must be generated from actual MenuLink menu data.
- No AI-generated food images in generated menus unless explicitly approved.
- QR readability beats visual styling.
- PDF outputs must be print-safe.
- All new data must be tenant-scoped and RLS-protected.
