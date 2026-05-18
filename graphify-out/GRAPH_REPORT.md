# Graph Report - D:/menulink  (2026-05-18)

## Corpus Check
- Corpus is ~10,670 words - fits in a single context window. You may not need a graph.

## Summary
- 90 nodes · 86 edges · 19 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend and PWA Stack|Frontend and PWA Stack]]
- [[_COMMUNITY_Backend and Auth Stack|Backend and Auth Stack]]
- [[_COMMUNITY_POS Landscape and Pricing|POS Landscape and Pricing]]
- [[_COMMUNITY_RzRz Integration|RzRz Integration]]
- [[_COMMUNITY_Project Foundation|Project Foundation]]
- [[_COMMUNITY_KO-KO Customer|KO-KO Customer]]
- [[_COMMUNITY_RzRz Testbed Restaurant|RzRz Testbed Restaurant]]
- [[_COMMUNITY_Marketing and Push|Marketing and Push]]
- [[_COMMUNITY_Payment Gateways|Payment Gateways]]
- [[_COMMUNITY_Web App Layout|Web App Layout]]
- [[_COMMUNITY_Web App Home Page|Web App Home Page]]
- [[_COMMUNITY_Multi-Tenant Routing|Multi-Tenant Routing]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Service Worker|Service Worker]]
- [[_COMMUNITY_Tenant Config Example|Tenant Config Example]]
- [[_COMMUNITY_Principle Single Source of Data|Principle: Single Source of Data]]
- [[_COMMUNITY_Principle Fail-Safe Features|Principle: Fail-Safe Features]]

## God Nodes (most connected - your core abstractions)
1. `PWA v6` - 14 edges
2. `Phase 2: Backend (Next.js+Supabase)` - 7 edges
3. `MenuLink Project` - 6 edges
4. `KO-KO Chicky Licky` - 6 edges
5. `RzRz Restaurant (Testbed)` - 6 edges
6. `Supabase` - 6 edges
7. `Foodics POS` - 6 edges
8. `RzRz POS (Punnelifosys ResApp)` - 6 edges
9. `Pricing 59 SAR Monthly` - 5 edges
10. `Bridge App (.NET)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Integration Tier 1b (Bridge App)` --semantically_similar_to--> `Bridge App (.NET)`  [INFERRED] [semantically similar]
  rzrz-restaurant.md → HANDOFF.md
- `Rationale: Don't Build Everything At Once` --semantically_similar_to--> `Rule: Don't Build Before 3 Customers Request`  [INFERRED] [semantically similar]
  design-docs/ROADMAP.md → CLAUDE.md
- `MenuLink Pro Tier (149/1499 SAR)` --conceptually_related_to--> `Phase 2: Backend (Next.js+Supabase)`  [INFERRED]
  PRICING.md → HANDOFF.md
- `POS Bundle (299/2999 SAR)` --conceptually_related_to--> `RzRz POS (Punnelifosys ResApp)`  [INFERRED]
  PRICING.md → HANDOFF.md
- `README: Project Overview` --references--> `MenuLink Project`  [EXTRACTED]
  README.md → CLAUDE.md

## Hyperedges (group relationships)
- **Phase 2 Backend Stack** — handoff_phase_2_backend, claude_nextjs_14, claude_supabase, claude_supabase_auth, claude_unifonic, roadmap_db_schema, roadmap_order_history [EXTRACTED 0.95]
- **RzRz POS Integration Cluster** — claude_rzrz_restaurant, handoff_rzrz_pos, handoff_bridge_app, handoff_insert_invoice, rzrz_dotnet_stack, rzrz_brother_ops_manager, rzrz_tier_1b_bridge, handoff_addon_pricing [EXTRACTED 0.95]
- **Competitor Landscape (POS + Menu Platforms)** — handoff_foodics, handoff_chatfood, handoff_marn, handoff_loyverse, handoff_rewaa, pricing_competitor_comparison [EXTRACTED 0.90]

## Communities

### Community 0 - "Frontend and PWA Stack"
Cohesion: 0.15
Nodes (14): Leaflet + OpenStreetMap, PWA v6, Rule: Use Managed Services, shadcn/ui, Tailwind CSS, Vercel, HTTPS Requirement for PWA, PWA Install Prompt (+6 more)

### Community 1 - "Backend and Auth Stack"
Cohesion: 0.15
Nodes (14): Next.js 14, Rule: Don't Build Before 3 Customers Request, Supabase, Supabase Auth (OTP via SMS), Unifonic SMS, Phase 2: Backend (Next.js+Supabase), Principle: No Custom Backend, MenuLink Pro Tier (149/1499 SAR) (+6 more)

### Community 2 - "POS Landscape and Pricing"
Cohesion: 0.18
Nodes (12): Pricing 59 SAR Monthly, ChatFood Competitor, Foodics POS, Loyverse POS, Marn POS, Phase 4: POS Integration, Pricing Rationale (12x cheaper than Foodics), Rewaa POS (+4 more)

### Community 3 - "RzRz Integration"
Cohesion: 0.25
Nodes (9): Add-On Pricing for RzRz Bridge (99 SAR / 899 SAR), Bridge App (.NET), InsertInvoice Stored Procedure, RzRz POS (Punnelifosys ResApp), POS Bundle (299/2999 SAR), .NET Framework 4.7.2 + EF + SQL Server, RzRz Schema (Invoice/InvoiceDetails/Items), Strategic Endgame: Punnelifosys Partnership (+1 more)

### Community 4 - "Project Foundation"
Cohesion: 0.25
Nodes (8): MenuLink Project, Pricing 499 SAR Yearly, Rule: Arabic-First, RTL-First, Mobile-First, SaaS Idea: Digital Menus + WhatsApp Orders, Target Audience: Small-Medium Saudi Restaurants, Rationale: WhatsApp Dominates Saudi Market, Rationale: Yearly Plan = Upfront Cash Flow + Lock-In, README: Project Overview

### Community 5 - "KO-KO Customer"
Cohesion: 0.29
Nodes (7): KO-KO Chicky Licky, KO-KO Brand (Red D32027 / Cream FAF6EE), Burgerizzr-Inspired Aesthetic, KO-KO: First Paying Customer, KO-KO Location: Al-Rawdah Riyadh, KO-KO POS Tier 0 (WhatsApp Only), Open: Two Instances Interpretation

### Community 6 - "RzRz Testbed Restaurant"
Cohesion: 0.33
Nodes (6): menulink-integration Skill, RzRz Restaurant (Testbed), Brother as Operations Manager, RzRz: Strategic R&D Partner (Not Paying), Rationale: Risk-Tolerant Testbed Before Paying Customers, Integration Tier 1b (Bridge App)

### Community 7 - "Marketing and Push"
Cohesion: 0.5
Nodes (4): OneSignal Push, Phase 3: Push Notifications & Marketing, Loyalty Points, Resend (Marketing Email)

### Community 8 - "Payment Gateways"
Cohesion: 1.0
Nodes (3): HyperPay, Moyasar, Phase 6: Payment Gateway

### Community 9 - "Web App Layout"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Web App Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Multi-Tenant Routing"
Cohesion: 1.0
Nodes (2): Phase 5: Multi-Tenant, Subdomain Routing

### Community 12 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Service Worker"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Tenant Config Example"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Principle: Single Source of Data"
Cohesion: 1.0
Nodes (1): Principle: Single Source of Data

### Community 18 - "Principle: Fail-Safe Features"
Cohesion: 1.0
Nodes (1): Principle: Fail-Safe Features

## Knowledge Gaps
- **42 isolated node(s):** `Tailwind CSS`, `shadcn/ui`, `Unifonic SMS`, `Leaflet + OpenStreetMap`, `Rule: Arabic-First, RTL-First, Mobile-First` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Web App Layout`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web App Home Page`** (2 nodes): `page.tsx`, `HomePage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Multi-Tenant Routing`** (2 nodes): `Phase 5: Multi-Tenant`, `Subdomain Routing`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Worker`** (1 nodes): `service-worker.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tenant Config Example`** (1 nodes): `tenant-config-example.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Principle: Single Source of Data`** (1 nodes): `Principle: Single Source of Data`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Principle: Fail-Safe Features`** (1 nodes): `Principle: Fail-Safe Features`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MenuLink Project` connect `Project Foundation` to `Frontend and PWA Stack`, `POS Landscape and Pricing`, `KO-KO Customer`, `RzRz Testbed Restaurant`?**
  _High betweenness centrality (0.466) - this node is a cross-community bridge._
- **Why does `PWA v6` connect `Frontend and PWA Stack` to `Backend and Auth Stack`, `Project Foundation`, `Marketing and Push`?**
  _High betweenness centrality (0.420) - this node is a cross-community bridge._
- **Why does `RzRz Restaurant (Testbed)` connect `RzRz Testbed Restaurant` to `Project Foundation`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **What connects `Tailwind CSS`, `shadcn/ui`, `Unifonic SMS` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._