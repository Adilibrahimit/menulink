-- ============================================================================
-- MenuLink · 0077_menu_view_tracking
--
-- Record a "visit" for EVERY tenant — ordering tenants AND display-only
-- (menu-only) tenants — so /ops can report per-tenant QR/menu traffic. Until
-- now qr_scan_events only filled on the dynamic short-link route /q/[code]
-- (0065 resolve_qr_link); printed client QRs point straight at /m/[slug], which
-- logged nothing. This adds a server-side log on the menu render itself.
--
-- Design reviewed by the LLM Council (docs/superpowers/council/...-183716). The
-- council's must-fixes are folded in here:
--   * CHECK widened via explicit DROP/ADD (no ALTER CONSTRAINT for CHECKs); the
--     inline constraint from 0059 is auto-named qr_scan_events_source_type_check.
--   * v_tenant_engagement is security_invoker so base-table RLS still applies
--     (ops see all via is_platform_admin(); owners see only their own; anon sees
--     nothing) — granted to authenticated only, never anon.
--   * composite index for the ops aggregation read path.
--   * 90-day retention job (pg_cron) for PDPL hygiene on ip_hash + user_agent.
--   * the daily-device dedup key (ip_hash) is built caller-side in Asia/Riyadh
--     time, and the metric is named device_days (honest: distinct device per
--     day, NOT unique people — Saudi carrier-NAT collapses people behind shared
--     IPs). Double-counting with /q/[code] is prevented app-side (the resolved
--     redirect carries ?qr=1 and page.tsx skips logging then).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Widen the source_type CHECK to allow 'menu' (a direct menu open, no QR
--    short-link). DROP + ADD because Postgres has no ALTER ... ALTER CONSTRAINT
--    for CHECKs; the name is the 0059 auto-generated one (verified live).
-- ---------------------------------------------------------------------------
alter table public.qr_scan_events
  drop constraint if exists qr_scan_events_source_type_check;

alter table public.qr_scan_events
  add constraint qr_scan_events_source_type_check
  check (source_type in
    ('table', 'poster', 'sticker', 'offer', 'category', 'item', 'unknown', 'menu'));

-- ---------------------------------------------------------------------------
-- 2. Read-path index. v_tenant_engagement aggregates this append-only table by
--    restaurant_id + time window + source_type; without this it degrades to a
--    widening seq-scan as scans accumulate.
-- ---------------------------------------------------------------------------
create index if not exists qr_scan_events_rid_time_src_idx
  on public.qr_scan_events (restaurant_id, scanned_at, source_type);

-- ---------------------------------------------------------------------------
-- 3. log_menu_view: best-effort visit logger for the public /m/[slug] render.
--    SECURITY DEFINER (the caller is anon; qr_scan_events is RLS ops/owner-only,
--    mirroring resolve_qr_link). The insert is wrapped so a logging failure can
--    NEVER raise into the menu render. ip_hash is pre-hashed by the caller
--    (sha256(ip|ua|riyadh-date)) — no raw IP is ever sent or stored.
-- ---------------------------------------------------------------------------
create or replace function public.log_menu_view(
  p_slug       text,
  p_table      text default null,
  p_user_agent text default null,
  p_referrer   text default null,
  p_ip_hash    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rid uuid;
begin
  select id into v_rid
  from public.restaurants
  where slug = p_slug and is_active
  limit 1;

  if v_rid is null then
    return; -- unknown/inactive slug: no-op
  end if;

  begin
    insert into public.qr_scan_events
      (restaurant_id, qr_link_id, user_agent, referrer, source_type, ip_hash)
    values (
      v_rid,
      null,                                        -- direct open: no short-link
      left(p_user_agent, 500),
      left(p_referrer, 500),
      case when coalesce(p_table, '') <> '' then 'table' else 'menu' end,
      p_ip_hash
    );
  exception when others then
    null; -- best-effort; tracking must never block the menu render
  end;
end;
$$;

grant execute on function public.log_menu_view(text, text, text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. v_tenant_engagement: one row per restaurant — the /ops/analytics table.
--    security_invoker => base-table RLS applies to whoever queries:
--      * platform admin (ops): is_platform_admin() => sees all tenants
--      * restaurant owner: owns_restaurant() => sees only their own row
--      * anon/customer: no qr_scan_events read policy => zero
--    Granted to authenticated only (NOT anon). Ops page also gates via requireOps().
--
--    device_days = count(distinct ip_hash). Because ip_hash embeds the Riyadh
--    date, this counts distinct (device × day) buckets — an honest lower-ish
--    proxy for visitors, NOT unique people. total_views counts every open.
-- ---------------------------------------------------------------------------
drop view if exists public.v_tenant_engagement;
create view public.v_tenant_engagement
with (security_invoker = true) as
select
  r.id                                                       as restaurant_id,
  r.name,
  r.slug,
  r.display_only_mode                                        as menu_only,
  count(q.id)::int                                           as total_views,
  count(distinct q.ip_hash)::int                            as device_days,
  (count(q.id) filter (where q.scanned_at >= now() - interval '30 days'))::int
                                                            as views_30d,
  (count(distinct q.ip_hash) filter (where q.scanned_at >= now() - interval '30 days'))::int
                                                            as device_days_30d,
  (select count(*) from public.orders o
     where o.restaurant_id = r.id)::int                      as orders_total,
  (select count(*) from public.orders o
     where o.restaurant_id = r.id
       and o.created_at >= now() - interval '30 days')::int  as orders_30d,
  max(q.scanned_at)                                          as last_visit_at
from public.restaurants r
left join public.qr_scan_events q on q.restaurant_id = r.id
group by r.id, r.name, r.slug, r.display_only_mode;

grant select on public.v_tenant_engagement to authenticated;

-- ---------------------------------------------------------------------------
-- 5. PDPL retention: purge scan rows older than 90 days (ip_hash + user_agent
--    are behavioral data). Daily at 00:17 UTC. Idempotent re-schedule.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('purge_qr_scan_events_90d');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'purge_qr_scan_events_90d',
  '17 0 * * *',
  $$delete from public.qr_scan_events where scanned_at < now() - interval '90 days'$$
);
