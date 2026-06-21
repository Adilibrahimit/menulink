# Product Brief · MenuLink Brand & Print Studio

## One-line definition

MenuLink Brand & Print Studio is a platform-level design and output system that lets the operator create, assign, preview, publish, and export professional restaurant identities, menu pages, print menus, QR designs, and promotion materials from one source of truth.

## Why build this

Current MenuLink design configuration is useful but basic:

- Restaurant name
- Slug
- Logo
- Cover
- Primary color
- Background color

This is not enough for a commercial design workflow.

Clients will ask for:

- A digital menu page with a matching brand identity
- A printable A3 or A4 full menu
- Table QR cards
- QR posters
- Promotion cards
- Single item cards
- Category cards
- High-quality PDF files after price changes
- A consistent look across digital and printed assets

## Target customers

Primary:

- Broasted restaurants
- Burger restaurants
- Cafés
- Small local restaurants
- Food trucks
- Small chains with 2 to 5 branches

Secondary:

- Premium restaurants
- Coffee lounges
- Restaurant plus café concepts
- Local brands that need better visual presentation

## Product tiers

| Tier | Customer type | Included outputs |
|---|---|---|
| Standard | Small café or restaurant | Page template, basic QR poster, A4 menu |
| Pro | Active restaurant | Page template, A3/A4 menu, offer cards, QR templates |
| Premium | Lounge, café, premium restaurant | Premium identity, premium print, QR cards, motion-ready assets later |

## Core user stories

### Platform operator

- As an operator, I can choose a saved brand identity template for a tenant.
- As an operator, I can assign a page template to the tenant.
- As an operator, I can assign print templates and QR templates.
- As an operator, I can preview the tenant design before publishing.
- As an operator, I can save a customized tenant design as a reusable template.
- As an operator, I can generate A3 and A4 PDFs from current menu data.
- As an operator, I can see if an export is outdated after prices, images, or offers change.
- As an operator, I can regenerate outputs without redesigning them manually.

### Tenant owner

- As a restaurant owner, I can update menu prices once.
- As a restaurant owner, my digital menu reflects the latest data.
- As a restaurant owner, I can ask the operator to regenerate print files.
- As a restaurant owner, I can run a temporary offer that appears on the menu and print outputs.
- As a restaurant owner, I can print table QR designs that match my brand.

### Customer

- As a customer, I scan a QR and reach the correct menu, table, offer, category, or item.
- As a customer, I see prices, calories, allergens, and VAT notice clearly.
- As a customer, I see a professional design that matches the restaurant.

## Scope

### In scope

- Template registry
- Restaurant design profiles
- QR design templates
- Print template profiles
- Promotions
- Export history
- Data hash based outdated detection
- Preview pages
- Seed templates
- RLS-safe tenant data
- Basic proof docs

### Later scope

- Remotion-generated videos
- Social media stories
- Animated QR videos
- AI-assisted design suggestions
- Customer self-service design editing

### Out of scope for first phase

- Full PDF rendering
- Remotion rendering
- Payment integration
- POS integration changes
- Large redesign of `/m/[slug]`
- Replacing current menu CRUD
- Letting tenants fully customize layout freely

## Business value

This feature creates a new commercial reason to sell MenuLink:

- Digital menu
- Brand identity
- QR table assets
- Print-ready A3/A4 menus
- Promotion cards
- Future social media output

It also reduces manual design work because outputs are generated from the live MenuLink data model.
