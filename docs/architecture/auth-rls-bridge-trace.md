# Auth & RLS Bridge Trace — `restaurants` ⇄ tenant authority

> Trace date: 2026-06-03 · Source: all 73 `apps/web/supabase/migrations/*.sql` + the
> `apps/web` app layer · Fix shipped as migration `0071_harden_tenant_isolation.sql`.
> This doc is the human-readable companion to the `.graph` knowledge graph, where
> `restaurants` shows up as the highest-betweenness bridge between the
> `Core Tenant Data Model` and `Auth & RLS Policies` communities.

## 1. Thesis — why `restaurants` is the bridge

`public.restaurants` is the single table where the **Core Data Model** (customers,
orders, order_items, menu_*, branches, tables, loyalty, pos_*, design/print/qr/motion)
and the **Auth & RLS subsystem** (auth.users, the pivot tables, the helper functions,
the JWT) meet. What flows across the boundary is exactly one thing: the tenant key
**`restaurant_id` (= `restaurants.id`)**, plus the question "does this principal have
authority over it?"

It bridges in two ways:

- **Vestigial literal link:** `restaurants.owner_user_id` (migration 0001) is a direct
  FK to `auth.users`, but it is **authorization-dead** — no RLS policy, helper,
  resolver, or RPC reads it. Its only live uses are the 0001 definition and four
  `to_jsonb(r) - 'owner_user_id'` strips that REMOVE it from public menu JSON
  (0004 / 0024 / 0031 / 0049).
- **Live functional link:** every Core-Data table carries a `restaurant_id` FK, and
  every principal resolves to a `restaurant_id` through the **side pivot tables** —
  `restaurant_owners`, `restaurant_admins` (+ `restaurant_admin_branch_access`),
  `platform_admins`, and `customers.auth_user_id` for the customer principal.

## 2. The pivot (migration 0008)

- **0001 / 0003** wrote every RLS policy as `id::text = auth.jwt() ->> 'restaurant_id'`.
  On Supabase that path silently returns NULL (real claims nest under `app_metadata`),
  so authenticated queries fell through; only the anon PWA worked (via SECURITY DEFINER
  RPCs).
- **0008** dropped every claim-based policy and rebuilt authorization on `auth.uid()`
  + two SECURITY DEFINER helpers: `owns_restaurant()` → `restaurant_owners`,
  `is_platform_admin()` → `platform_admins`. **0039** added `has_restaurant_access()` /
  `has_branch_access()` for team admins.

## 3. The two-layer model

The same `restaurant_id` is derived twice by two independent mechanisms:

| Layer | Mechanism | Authority? |
|---|---|---|
| **DB / RLS** | `auth.uid()` → pivot lookup inside SECURITY DEFINER helpers (`owns_restaurant`, `is_platform_admin`, `has_restaurant_access`) | ✅ The security authority for every authenticated principal. Ignores the JWT claim. |
| **App** | reads `app_metadata.{role,restaurant_id,team_role}` from the JWT (`lib/auth.ts`), scopes every `/admin` query with it | ❌ for row isolation (RLS re-derives independently), but **load-bearing** for routing/redirect gates (`requireOwner`/`requireAdmin`/`requireOps`) which RLS structurally cannot replace |

`refresh_user_app_metadata` (0005, extended for team members in 0048) mirrors pivot
membership into `app_metadata`. It is **not vestigial** — killing it bounces every
owner to login — but it is **not the security authority** either.

## 4. Principals that cross the boundary

- **owner** — `auth.uid()` → `restaurant_owners` → `owns_restaurant()`
- **team admin** — `restaurant_admins` (+ branch scope via `restaurant_admin_branch_access`) → `has_restaurant_access()` / `has_branch_access()`
- **platform admin** — `platform_admins` → `is_platform_admin()` (cross-tenant; `restaurant_id` intentionally stripped from its JWT claim, 0048)
- **customer** — `customers.auth_user_id = auth.uid()`
- **anon** — no `auth.uid()`, no claim: resolves `restaurants` by **slug** for reads, by a **client-supplied id** for writes, validated only inside SECURITY DEFINER RPCs
- **bridge_service (POS Bridge App)** — connects with the **service_role key** (bypasses RLS); not a dedicated DB identity

## 5. Gaps found, and the 0071 fix

The clean "DB re-derives from `auth.uid()`" story holds for **all table RLS** (grep
confirms `auth.jwt()` appears in no migration after 0008). But the trace found paths
where an app-layer claim — or nothing — was the only boundary. Migration `0071`
closes them:

| # | Gap | Where | 0071 fix |
|---|---|---|---|
| 1 | **Analytics views bypass RLS.** `v_customer_rfm`, `v_customer_ltv`, `v_dormant_customers`, `v_top_items_*`, `v_revenue_daily` were plain views (run as owner, skip RLS) GRANTed to anon+authenticated. An authenticated user could pass another tenant's id to `.eq()` and read it. 0002's "RLS still enforces scoping" comment was false. | 0002 | Each view self-filters by `has_restaurant_access(restaurant_id) OR is_platform_admin()` (both read `auth.uid()`); `anon` loses SELECT. Owners + team admins keep today's access; cross-tenant reads return zero rows. |
| 2 | **`get_tenant_owners` trusts the JWT role claim** — a pre-0008 SECURITY DEFINER RPC never rewritten; returns any tenant's owner emails. | 0006 | Gate on `is_platform_admin()` instead of `auth.jwt()->>'role'`. |
| 3 | **`pos_outbox_claim/mark_synced/mark_failed` had no ownership check** — granted to `authenticated`; any signed-in user could claim/mutate any tenant's POS queue. | 0009 | Revoke EXECUTE from anon/authenticated/public; grant to `service_role` only (the Bridge App's role; no app/owner UI calls them). |
| 4 | **`bridge_insert_heartbeats` was `with check (true)`** — any authenticated user could write a heartbeat for any restaurant. | 0055 | `with check (owns_restaurant(restaurant_id) OR is_platform_admin())`. |
| 5 | **`open_table_session` trusted a client `restaurant_id`** with no `is_active` check. | 0044 | Validate `restaurants.is_active` first (matches `submit_order`). |
| 6 | **`auto_link_customer` self-provisioned a customers row** on any restaurant id with no `is_active` check. | 0028 | Validate `is_active` first. |

**Bridge auth contract (rationale for #3/#4):** per `bridge-app/README.md` the Bridge
App authenticates with the **service_role** key, which bypasses RLS. So #3 locks the
pos_outbox RPCs to `service_role` by GRANT (an internal `auth.uid()` check would WRONGLY
reject the bridge, which has no `auth.uid()`), and #4's heartbeat policy targets the
`/api/bridge/heartbeat` route's user-session insert path (a service_role bridge writing
directly is unaffected because it bypasses RLS).

## 6. Verification status

- Gaps verified against current (live) migration + app source, including caller
  analysis (all four analytics-view consumers use the user-session client; no app code
  calls the pos_outbox RPCs).
- `0071` was **applied via the Management API on 2026-06-03 (HTTP 201)** and **smoke-tested
  live**: a koko-owner read of `v_customer_rfm` returns its own 2 customers and **0** for another
  tenant; a team-admin still sees their analytics (V2 confirmed); `pos_outbox_claim` is denied for
  `authenticated`; `get_tenant_owners` works for ops and raises `access denied` otherwise; anon is
  denied on the views. All six gaps verified closed.
