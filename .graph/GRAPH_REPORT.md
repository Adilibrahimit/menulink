# Graph Report - D:/menulink/apps/web  (2026-05-24)

## Corpus Check
- 112 files · ~78,419 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 214 nodes · 173 edges · 75 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Menu Editor (Admin CRUD)|Menu Editor (Admin CRUD)]]
- [[_COMMUNITY_Customer Menu Experience|Customer Menu Experience]]
- [[_COMMUNITY_Loyalty Rewards Editor|Loyalty Rewards Editor]]
- [[_COMMUNITY_Excel Export Engine|Excel Export Engine]]
- [[_COMMUNITY_Orders Realtime Feed|Orders Realtime Feed]]
- [[_COMMUNITY_Tables Editor + QR|Tables Editor + QR]]
- [[_COMMUNITY_Supabase Clients + Middleware|Supabase Clients + Middleware]]
- [[_COMMUNITY_Customer Google Account|Customer Google Account]]
- [[_COMMUNITY_Ops Tenant Management|Ops Tenant Management]]
- [[_COMMUNITY_Tenant Design Panel|Tenant Design Panel]]
- [[_COMMUNITY_Addon Manager (Ops)|Addon Manager (Ops)]]
- [[_COMMUNITY_QR Poster Generator|QR Poster Generator]]
- [[_COMMUNITY_Loyalty Settings Form|Loyalty Settings Form]]
- [[_COMMUNITY_Redemptions Queue|Redemptions Queue]]
- [[_COMMUNITY_Admin Info Page|Admin Info Page]]
- [[_COMMUNITY_Menu QR Component|Menu QR Component]]
- [[_COMMUNITY_Auth Guards|Auth Guards]]
- [[_COMMUNITY_Ops Onboarding Wizard|Ops Onboarding Wizard]]
- [[_COMMUNITY_API Export Routes|API Export Routes]]
- [[_COMMUNITY_Add Item Modal|Add Item Modal]]
- [[_COMMUNITY_Location Picker (Leaflet)|Location Picker (Leaflet)]]
- [[_COMMUNITY_Customer Menu Page (SSR)|Customer Menu Page (SSR)]]
- [[_COMMUNITY_Customer Rewards Page|Customer Rewards Page]]
- [[_COMMUNITY_Ops Payments|Ops Payments]]
- [[_COMMUNITY_Tenant Creation Action|Tenant Creation Action]]
- [[_COMMUNITY_Addon Helpers (lib)|Addon Helpers (lib)]]
- [[_COMMUNITY_Service Worker (PWA)|Service Worker (PWA)]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]

## God Nodes (most connected - your core abstractions)
1. `notify()` - 11 edges
2. `refresh()` - 11 edges
3. `GET()` - 5 edges
4. `renameCategory()` - 3 edges
5. `toggleCategoryActive()` - 3 edges
6. `deleteCategory()` - 3 edges
7. `renameItem()` - 3 edges
8. `toggleItemActive()` - 3 edges
9. `deleteItem()` - 3 edges
10. `uploadImage()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `todayRiyadhISO()`  [EXTRACTED]
  D:\menulink\apps\web\app\m\[slug]\manifest.webmanifest\route.ts → D:\menulink\apps\web\app\api\admin\export\orders\route.ts

## Communities

### Community 0 - "Menu Editor (Admin CRUD)"
Cohesion: 0.37
Nodes (13): deleteCategory(), deleteItem(), notify(), refresh(), removeImage(), renameCategory(), renameItem(), toggleAllergen() (+5 more)

### Community 1 - "Customer Menu Experience"
Cohesion: 0.24
Nodes (3): clearTracking(), startTracking(), trackingKey()

### Community 2 - "Loyalty Rewards Editor"
Cohesion: 0.22
Nodes (0): 

### Community 3 - "Excel Export Engine"
Cohesion: 0.22
Nodes (0): 

### Community 4 - "Orders Realtime Feed"
Cohesion: 0.29
Nodes (2): isToday(), todayRiyadhISO()

### Community 5 - "Tables Editor + QR"
Cohesion: 0.29
Nodes (2): cancelEdit(), saveEdit()

### Community 6 - "Supabase Clients + Middleware"
Cohesion: 0.4
Nodes (2): GET(), todayRiyadhISO()

### Community 7 - "Customer Google Account"
Cohesion: 0.33
Nodes (0): 

### Community 8 - "Ops Tenant Management"
Cohesion: 0.33
Nodes (0): 

### Community 9 - "Tenant Design Panel"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Addon Manager (Ops)"
Cohesion: 0.5
Nodes (2): patch(), setTrialPreset()

### Community 11 - "QR Poster Generator"
Cohesion: 0.6
Nodes (3): generatePosterDataUrl(), loadImage(), roundRect()

### Community 12 - "Loyalty Settings Form"
Cohesion: 0.5
Nodes (0): 

### Community 13 - "Redemptions Queue"
Cohesion: 0.5
Nodes (0): 

### Community 14 - "Admin Info Page"
Cohesion: 0.5
Nodes (0): 

### Community 15 - "Menu QR Component"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Auth Guards"
Cohesion: 0.83
Nodes (3): getCurrentUser(), requireOps(), requireOwner()

### Community 17 - "Ops Onboarding Wizard"
Cohesion: 0.67
Nodes (1): onSubmit()

### Community 18 - "API Export Routes"
Cohesion: 0.67
Nodes (1): POST()

### Community 19 - "Add Item Modal"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Location Picker (Leaflet)"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Customer Menu Page (SSR)"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Customer Rewards Page"
Cohesion: 1.0
Nodes (2): confirmRedeem(), toArabicDigits()

### Community 23 - "Ops Payments"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Tenant Creation Action"
Cohesion: 1.0
Nodes (2): createTenant(), generatePassword()

### Community 25 - "Addon Helpers (lib)"
Cohesion: 1.0
Nodes (2): getEnabledAddons(), hasAddon()

### Community 26 - "Service Worker (PWA)"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (1): MenuLink Web App

## Knowledge Gaps
- **1 isolated node(s):** `MenuLink Web App`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (2 nodes): `middleware.ts`, `middleware()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `dashboard-chart.tsx`, `DashboardChart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `digitsOnly()`, `customers-table.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `page.tsx`, `fmt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `page.tsx`, `InfoPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `loyalty-customers-table.tsx`, `patchRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `page.tsx`, `AdminLoyaltyRedemptionsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `page.tsx`, `AdminLoyaltyRewardsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `submit()`, `add-category-modal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `page.tsx`, `MenuPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `page.tsx`, `AdminQrPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `page.tsx`, `AdminTablesPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `scrollTo()`, `category-tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `not-found.tsx`, `NotFound()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `pwa-bootstrap.tsx`, `PwaBootstrap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `page.tsx`, `CustomerAccountPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `page.tsx`, `CustomerRewardsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `page.tsx`, `NewTenantPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `tenant-actions.tsx`, `TenantActions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `phone.ts`, `normalizePhone()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `supabase-admin.ts`, `adminClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `supabase-browser.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `supabase-server.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `subscription-banner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `menu-item.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `allergens.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `koko-images.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `MenuLink Web App`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `MenuLink Web App` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._