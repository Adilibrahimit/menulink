# DS-4-1 Dynamic QR Backbone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/q/{code}` route resolves an active `qr_link` and 302-redirects to its `destination_url`, recording a `qr_scan_event`.

**Architecture:** Migration `0065` adds a `SECURITY DEFINER` `resolve_qr_link(...)` RPC (anon-safe, best-effort scan insert). A `/q/[code]` GET Route Handler calls it and 302-redirects. No UI, no link creation (DS-4-2), nothing else touched.

**Tech Stack:** Next.js 14 Route Handler, Supabase RPC (anon via `@/lib/supabase-server`), Postgres.

**Verification model (no JS test runner):** `tsc --noEmit`, `next build` (`NODE_OPTIONS=--max-old-space-size=8192`), SQL via the Management API PAT on `rzrz-bukhari-test` only. Never touch `koko`/`rzrz-bukhari`.

**Branch:** `ds-4-1-dynamic-qr-backbone` (off `main`; spec commit there).

**Reference:** spec `docs/superpowers/specs/2026-05-29-ds-4-1-dynamic-qr-backbone-design.md`.

---

## File Structure

**Create**
- `apps/web/supabase/migrations/0065_resolve_qr_link.sql` — the resolve+track RPC.
- `apps/web/app/q/[code]/route.ts` — the public 302-redirect Route Handler.

No other files touched.

---

## Task 1: Migration 0065 — `resolve_qr_link` RPC

**Files:** Create `apps/web/supabase/migrations/0065_resolve_qr_link.sql`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- MenuLink · 0065_resolve_qr_link
--
-- DS-4-1: resolve a dynamic QR short-link and record a scan, for the public
-- /q/{code} route. SECURITY DEFINER (the route is anonymous; qr_links and
-- qr_scan_events are RLS ops/owner-only). Tracking is best-effort and never
-- blocks the redirect. Additive; get_public_menu and existing QR untouched.
-- ============================================================================

create or replace function public.resolve_qr_link(
  p_code text,
  p_user_agent text default null,
  p_referrer text default null,
  p_source_type text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_rid uuid;
  v_dest text;
  v_src text;
begin
  select id, restaurant_id, destination_url
    into v_id, v_rid, v_dest
  from public.qr_links
  where code = p_code and is_active = true
  limit 1;

  if v_id is null then
    return null;
  end if;

  v_src := case
    when p_source_type in ('table', 'poster', 'sticker', 'offer', 'category', 'item')
    then p_source_type else 'unknown'
  end;

  begin
    insert into public.qr_scan_events (restaurant_id, qr_link_id, user_agent, referrer, source_type)
    values (v_rid, v_id, left(p_user_agent, 500), left(p_referrer, 500), v_src);
  exception when others then
    null; -- scan tracking is best-effort; never block the redirect
  end;

  return v_dest;
end;
$$;

grant execute on function public.resolve_qr_link(text, text, text, text) to anon, authenticated;
```

- [ ] **Step 2: Static review**

Run:
```bash
cd /d/menulink && f=apps/web/supabase/migrations/0065_resolve_qr_link.sql; \
echo "fn: $(grep -c 'create or replace function public.resolve_qr_link' $f)"; \
echo "definer: $(grep -c 'security definer' $f)"; \
echo "grant: $(grep -c 'to anon, authenticated' $f)"; \
echo "exception guard: $(grep -c 'exception when others then' $f)"; \
echo "destructive: $(grep -ciE 'drop table|truncate|delete from|create extension|alter table' $f)"
```
Expected: fn=1, definer=1, grant=1, exception guard=1, destructive=0.

- [ ] **Step 3 (MAIN AGENT, DB): apply + insert a test link + verify (clone only)**

Apply `0065` via the Management API PAT (project `dhmjrrsynfvomlzhggvu`). Then run (exact-slug guarded — insert only matches `rzrz-bukhari-test`):
```sql
insert into public.qr_links (restaurant_id, code, target_type, destination_url, is_active)
select id, 'velolabqr1', 'menu', '/m/rzrz-bukhari-test', true
from public.restaurants where slug = 'rzrz-bukhari-test'
on conflict (code) do nothing;

select public.resolve_qr_link('velolabqr1', 'ua/test', 'ref/test', 'poster') as dest;
select count(*) as scans, max(source_type) as src
from public.qr_scan_events e join public.qr_links l on l.id = e.qr_link_id
where l.code = 'velolabqr1';
select public.resolve_qr_link('nope-not-real') as miss;
```
Expected: `dest = /m/rzrz-bukhari-test`; `scans >= 1`, `src = poster`; `miss = null`.

- [ ] **Step 4: Commit**

```bash
cd /d/menulink && git add apps/web/supabase/migrations/0065_resolve_qr_link.sql && \
git commit -m "DS-4-1: migration 0065 — resolve_qr_link RPC"
```

---

## Task 2: `/q/[code]` Route Handler

**Files:** Create `apps/web/app/q/[code]/route.ts`.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Public dynamic QR short-link: resolve the code -> 302 to its destination,
// recording a scan (side effect inside the RPC). Miss -> graceful 302 to "/".
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const sb = createClient();
  const source = new URL(request.url).searchParams.get("s");
  const { data: destination } = await sb.rpc("resolve_qr_link", {
    p_code: params.code,
    p_user_agent: request.headers.get("user-agent"),
    p_referrer: request.headers.get("referer"),
    p_source_type: source,
  });
  const target = typeof destination === "string" && destination.length > 0 ? destination : "/";
  return NextResponse.redirect(new URL(target, request.url), 302);
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build`
Expected: tsc clean; build SUCCESS; `/q/[code]` appears in the route list (as a dynamic route `ƒ`).

- [ ] **Step 3: Commit**

```bash
cd /d/menulink && git add ':(literal)apps/web/app/q/[code]/route.ts' && \
git commit -m "DS-4-1: /q/[code] dynamic QR redirect route"
```

---

## Task 3: E2E verification, proof, PR (MAIN AGENT)

**Files:** Create `docs/proofs/DS-4-1-dynamic-qr-backbone.md`.

- [ ] **Step 1: Re-confirm the RPC + scan (clone)**

Via the PAT:
```sql
select
  public.resolve_qr_link('velolabqr1', 'verify-ua', null, 'sticker') as dest,
  (select count(*) from public.qr_scan_events e join public.qr_links l on l.id = e.qr_link_id where l.code = 'velolabqr1') as total_scans;
```
Expected: `dest = /m/rzrz-bukhari-test`; `total_scans` incremented (>= 2 after Task 1's scan).

- [ ] **Step 2: tsc + build**

```bash
cd /d/menulink/apps/web && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=8192 npm run build
```
Expected: clean + SUCCESS.

- [ ] **Step 3: Manual route smoke (operator, after deploy)**

GET `https://<deploy>/q/velolabqr1` → 302 → `/m/rzrz-bukhari-test`; a scan event records. GET `/q/nope` → 302 → `/`. (Local verification optional; the page is public.)

- [ ] **Step 4: Decide on the test link**

Keep `velolabqr1` on the clone as a live demo dynamic link, OR remove it:
```sql
delete from public.qr_scan_events e using public.qr_links l where e.qr_link_id = l.id and l.code = 'velolabqr1';
delete from public.qr_links where code = 'velolabqr1';
```

- [ ] **Step 5: Proof + commit + push + draft PR**

Create `docs/proofs/DS-4-1-dynamic-qr-backbone.md` (Goal · Scope · Files · Migration 0065 · RPC contract · route behavior · verification (clone link resolves + scan recorded; miss → null) · Guardrails incl. **existing /admin/qr + table-QR + get_public_menu untouched, no raw IP, clone-only** · Known limitations (no link creation yet — DS-4-2; HTTP smoke on deploy) · Next: DS-4-2). Then:
```bash
cd /d/menulink && git add docs/proofs/DS-4-1-dynamic-qr-backbone.md && \
git commit -m "DS-4-1: proof doc" && git push -u origin ds-4-1-dynamic-qr-backbone
gh pr create --draft --base main --head ds-4-1-dynamic-qr-backbone \
  --title "DS-4-1: dynamic QR backbone (/q/{code} + scan tracking)" \
  --body "Implements DS-4-1 per docs/superpowers/specs/2026-05-29-ds-4-1-dynamic-qr-backbone-design.md. Migration 0065 (resolve_qr_link SECURITY DEFINER RPC, best-effort scan tracking, no raw IP) + /q/[code] 302-redirect route. Link creation deferred to DS-4-2. Existing /admin/qr + table-QR + get_public_menu untouched. Verified on rzrz-bukhari-test."
```

---

## Self-Review

**Spec coverage:**
- Migration 0065 / `resolve_qr_link` RPC (resolve + best-effort scan + source coercion + no IP) → Task 1. ✓
- `/q/[code]` 302-redirect route (hit → destination; miss → "/"; relative resolution; `?s=` source) → Task 2. ✓
- Scan recorded; tenant-scoped via the link's `restaurant_id` → Task 1 verify + RPC. ✓
- Clone-only verification; existing QR untouched → Tasks 1 & 3. ✓

**Placeholder scan:** none — full SQL + full route code; Task 3 Step 4 is an explicit keep/delete either-or with exact SQL.

**Type consistency:** RPC name `resolve_qr_link` and its 4 params (`p_code`, `p_user_agent`, `p_referrer`, `p_source_type`) match between the migration (Task 1), the grant signature `(text, text, text, text)`, and the route's `sb.rpc("resolve_qr_link", { p_code, p_user_agent, p_referrer, p_source_type })` (Task 2). The RPC returns `text`; the route handles `string | null` (`typeof destination === "string"`). `qr_scan_events` insert columns match the 0059 schema; `source_type` coercion matches its check constraint; `qr_links` lookup uses `code`/`is_active`/`destination_url`/`restaurant_id` (all 0059 columns).
