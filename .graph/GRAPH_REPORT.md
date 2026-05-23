# Graph Report - D:/menulink/apps/web  (2026-05-24)

## Corpus Check
- 112 files · ~78,419 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 213 nodes · 173 edges · 74 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Menu Editor (Admin CRUD)|Menu Editor (Admin CRUD)]]
- [[_COMMUNITY_Customer Menu Experience|Customer Menu Experience]]
- [[_COMMUNITY_Loyalty Rewards Editor|Loyalty Rewards Editor]]
- [[_COMMUNITY_Excel Export Engine|Excel Export Engine]]
- [[_COMMUNITY_Orders Realtime Feed|Orders Realtime Feed]]
- [[_COMMUNITY_Tables Editor + QR|Tables Editor + QR]]
- [[_COMMUNITY_API Routes (Export + Auth + Manifest)|API Routes (Export + Auth + Manifest)]]
- [[_COMMUNITY_Customer Google Account|Customer Google Account]]
- [[_COMMUNITY_Ops Onboarding Form|Ops Onboarding Form]]
- [[_COMMUNITY_Admin Info Form|Admin Info Form]]
- [[_COMMUNITY_Addon Manager (Ops)|Addon Manager (Ops)]]
- [[_COMMUNITY_QR Poster Generator|QR Poster Generator]]
- [[_COMMUNITY_Loyalty Settings Form|Loyalty Settings Form]]
- [[_COMMUNITY_Redemptions Queue|Redemptions Queue]]
- [[_COMMUNITY_Tenant Design Panel|Tenant Design Panel]]
- [[_COMMUNITY_Menu QR Component|Menu QR Component]]
- [[_COMMUNITY_Auth Guards|Auth Guards]]
- [[_COMMUNITY_Login Forms (Admin + Ops)|Login Forms (Admin + Ops)]]
- [[_COMMUNITY_Logout Routes|Logout Routes]]
- [[_COMMUNITY_Add Item Modal|Add Item Modal]]
- [[_COMMUNITY_Location Picker (Leaflet)|Location Picker (Leaflet)]]
- [[_COMMUNITY_Customer Menu Page (SSR)|Customer Menu Page (SSR)]]
- [[_COMMUNITY_Customer Rewards Page|Customer Rewards Page]]
- [[_COMMUNITY_Ops Payments|Ops Payments]]
- [[_COMMUNITY_Tenant Creation Action|Tenant Creation Action]]
- [[_COMMUNITY_Addon Helpers (lib)|Addon Helpers (lib)]]
- [[_COMMUNITY_Service Worker (PWA)|Service Worker (PWA)]]
- [[_COMMUNITY_Middleware (Auth Cookies)|Middleware (Auth Cookies)]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Marketing Landing|Marketing Landing]]
- [[_COMMUNITY_Dashboard Chart|Dashboard Chart]]
- [[_COMMUNITY_Customers Table|Customers Table]]
- [[_COMMUNITY_Customers Page|Customers Page]]
- [[_COMMUNITY_Admin Info Page|Admin Info Page]]
- [[_COMMUNITY_Loyalty Customers Table|Loyalty Customers Table]]
- [[_COMMUNITY_Loyalty Redemptions Page|Loyalty Redemptions Page]]
- [[_COMMUNITY_Loyalty Rewards Page|Loyalty Rewards Page]]
- [[_COMMUNITY_Add Category Modal|Add Category Modal]]
- [[_COMMUNITY_Menu Page|Menu Page]]
- [[_COMMUNITY_Admin QR Page|Admin QR Page]]
- [[_COMMUNITY_Admin Tables Page|Admin Tables Page]]
- [[_COMMUNITY_Category Tabs (Scroll-spy)|Category Tabs (Scroll-spy)]]
- [[_COMMUNITY_Not Found Page|Not Found Page]]
- [[_COMMUNITY_PWA Bootstrap|PWA Bootstrap]]
- [[_COMMUNITY_Customer Account Page|Customer Account Page]]
- [[_COMMUNITY_Customer Rewards Entry|Customer Rewards Entry]]
- [[_COMMUNITY_New Tenant Page|New Tenant Page]]
- [[_COMMUNITY_Tenant Actions|Tenant Actions]]
- [[_COMMUNITY_Phone Normalizer|Phone Normalizer]]
- [[_COMMUNITY_Supabase Admin Client|Supabase Admin Client]]
- [[_COMMUNITY_Supabase Browser Client|Supabase Browser Client]]
- [[_COMMUNITY_Supabase Server Client|Supabase Server Client]]
- [[_COMMUNITY_TypeScript Env Types|TypeScript Env Types]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Admin Layout|Admin Layout]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Subscription Banner|Subscription Banner]]
- [[_COMMUNITY_Admin Login Page|Admin Login Page]]
- [[_COMMUNITY_Loyalty Hub Page|Loyalty Hub Page]]
- [[_COMMUNITY_Loyalty Customers Page|Loyalty Customers Page]]
- [[_COMMUNITY_Orders Page|Orders Page]]
- [[_COMMUNITY_Loading Skeleton|Loading Skeleton]]
- [[_COMMUNITY_Menu Item Card|Menu Item Card]]
- [[_COMMUNITY_Customer Types|Customer Types]]
- [[_COMMUNITY_Ops Layout|Ops Layout]]
- [[_COMMUNITY_Ops Dashboard|Ops Dashboard]]
- [[_COMMUNITY_Ops Login Page|Ops Login Page]]
- [[_COMMUNITY_Ops Payments Page|Ops Payments Page]]
- [[_COMMUNITY_Tenant Detail Page|Tenant Detail Page]]
- [[_COMMUNITY_Allergens Library|Allergens Library]]
- [[_COMMUNITY_KO-KO Images Map|KO-KO Images Map]]
- [[_COMMUNITY_DB Type Definitions|DB Type Definitions]]

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
  D:\menulink\apps\web\app\api\admin\export\customers\route.ts → D:\menulink\apps\web\app\api\admin\export\orders\route.ts

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

### Community 6 - "API Routes (Export + Auth + Manifest)"
Cohesion: 0.4
Nodes (2): GET(), todayRiyadhISO()

### Community 7 - "Customer Google Account"
Cohesion: 0.33
Nodes (0): 

### Community 8 - "Ops Onboarding Form"
Cohesion: 0.33
Nodes (0): 

### Community 9 - "Admin Info Form"
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

### Community 14 - "Tenant Design Panel"
Cohesion: 0.5
Nodes (0): 

### Community 15 - "Menu QR Component"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "Auth Guards"
Cohesion: 0.83
Nodes (3): getCurrentUser(), requireOps(), requireOwner()

### Community 17 - "Login Forms (Admin + Ops)"
Cohesion: 0.67
Nodes (1): onSubmit()

### Community 18 - "Logout Routes"
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

### Community 27 - "Middleware (Auth Cookies)"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Root Layout"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Marketing Landing"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Dashboard Chart"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Customers Table"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Customers Page"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Admin Info Page"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Loyalty Customers Table"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Loyalty Redemptions Page"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Loyalty Rewards Page"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Add Category Modal"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Menu Page"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Admin QR Page"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Admin Tables Page"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Category Tabs (Scroll-spy)"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Not Found Page"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "PWA Bootstrap"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Customer Account Page"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Customer Rewards Entry"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "New Tenant Page"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Tenant Actions"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Phone Normalizer"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Supabase Admin Client"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Supabase Browser Client"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Supabase Server Client"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "TypeScript Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Admin Layout"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Admin Dashboard"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Subscription Banner"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Admin Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Loyalty Hub Page"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Loyalty Customers Page"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Orders Page"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Loading Skeleton"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Menu Item Card"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Customer Types"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Ops Layout"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Ops Dashboard"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Ops Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Ops Payments Page"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Tenant Detail Page"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Allergens Library"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "KO-KO Images Map"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "DB Type Definitions"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Middleware (Auth Cookies)`** (2 nodes): `middleware.ts`, `middleware()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Marketing Landing`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Chart`** (2 nodes): `dashboard-chart.tsx`, `DashboardChart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customers Table`** (2 nodes): `digitsOnly()`, `customers-table.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customers Page`** (2 nodes): `page.tsx`, `fmt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Info Page`** (2 nodes): `page.tsx`, `InfoPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loyalty Customers Table`** (2 nodes): `loyalty-customers-table.tsx`, `patchRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loyalty Redemptions Page`** (2 nodes): `page.tsx`, `AdminLoyaltyRedemptionsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loyalty Rewards Page`** (2 nodes): `page.tsx`, `AdminLoyaltyRewardsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Add Category Modal`** (2 nodes): `submit()`, `add-category-modal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Menu Page`** (2 nodes): `page.tsx`, `MenuPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin QR Page`** (2 nodes): `page.tsx`, `AdminQrPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Tables Page`** (2 nodes): `page.tsx`, `AdminTablesPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Category Tabs (Scroll-spy)`** (2 nodes): `scrollTo()`, `category-tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Not Found Page`** (2 nodes): `not-found.tsx`, `NotFound()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PWA Bootstrap`** (2 nodes): `pwa-bootstrap.tsx`, `PwaBootstrap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customer Account Page`** (2 nodes): `page.tsx`, `CustomerAccountPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customer Rewards Entry`** (2 nodes): `page.tsx`, `CustomerRewardsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `New Tenant Page`** (2 nodes): `page.tsx`, `NewTenantPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tenant Actions`** (2 nodes): `tenant-actions.tsx`, `TenantActions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Phone Normalizer`** (2 nodes): `phone.ts`, `normalizePhone()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Admin Client`** (2 nodes): `supabase-admin.ts`, `adminClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Browser Client`** (2 nodes): `supabase-browser.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Server Client`** (2 nodes): `supabase-server.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Layout`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Dashboard`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Subscription Banner`** (1 nodes): `subscription-banner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Login Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loyalty Hub Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loyalty Customers Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Orders Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loading Skeleton`** (1 nodes): `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Menu Item Card`** (1 nodes): `menu-item.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customer Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ops Layout`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ops Dashboard`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ops Login Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ops Payments Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tenant Detail Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Allergens Library`** (1 nodes): `allergens.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `KO-KO Images Map`** (1 nodes): `koko-images.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Type Definitions`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._