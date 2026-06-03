-- ============================================================================
-- MenuLink · 0071_harden_tenant_isolation
--
-- Closes the tenant-isolation gaps found in the 2026-06-03 restaurants <-> Auth&RLS
-- bridge trace. Every fix re-derives tenant authority from the side pivot tables
-- (restaurant_owners / restaurant_admins / platform_admins) via auth.uid() — the
-- model migration 0008 established — instead of trusting a client-supplied id or a
-- JWT claim, OR locks the path to the one trusted role that should reach it.
-- All statements are CREATE OR REPLACE / policy + grant swaps: re-runnable, no data
-- is touched.
--
-- Gaps fixed (see docs/auth-rls-bridge-trace.md for the full trace):
--   1. Analytics views (0002) were plain views (security_invoker=false => they run
--      with the view OWNER's rights and SKIP RLS on customers/orders), and were
--      GRANTed to anon + authenticated. 0002's comment "Underlying RLS on the base
--      tables still enforces tenant scoping" was FALSE: any authenticated caller
--      could pass another tenant's restaurant_id to .eq() and read it; the app's
--      own .eq() filter was the only boundary. FIX: each view now self-filters by
--      has_restaurant_access(restaurant_id) OR is_platform_admin() — both read
--      auth.uid(), so the filter holds no matter what restaurant_id the client
--      passes — and anon loses SELECT. Owners + team admins keep exactly today's
--      access (all four consumers use the user-session client); platform admins
--      still see all tenants; cross-tenant reads now return zero rows.
--   2. get_tenant_owners (0006) gated on auth.jwt()->>'role' (a claim, never
--      rewritten in 0008). FIX: gate on is_platform_admin() (auth.uid() pivot).
--      /ops calls it under the platform-admin user session, so auth.uid() resolves.
--   3. pos_outbox_claim / _mark_synced / _mark_failed (0009) were SECURITY DEFINER
--      granted to `authenticated` with NO ownership check — any signed-in user could
--      claim or mutate ANY tenant's POS queue. FIX: the Bridge App is the only
--      legitimate caller and it connects with the service_role key (see
--      bridge-app/README.md). EXECUTE is revoked from anon/authenticated/public and
--      granted to service_role only. (An internal auth.uid() check would be WRONG
--      here: a service_role call has no auth.uid(), so owns_restaurant() would
--      reject the real bridge. No app code or owner UI calls these RPCs.)
--   4. bridge_insert_heartbeats (0055) had `with check (true)` — any authenticated
--      user could write a heartbeat for any restaurant. FIX: require
--      owns_restaurant() OR is_platform_admin(). The /api/bridge/heartbeat route
--      inserts under the caller's USER session, so the owner check applies there;
--      a service_role bridge writing directly bypasses RLS and is unaffected.
--   5. open_table_session (0044) trusted a client restaurant_id with no is_active
--      check. FIX: validate restaurants.is_active first (matches submit_order).
--   6. auto_link_customer (0028) self-provisioned a customers row against any
--      restaurant id with no is_active check. FIX: validate is_active first.
--
-- BRIDGE AUTH CONTRACT (rationale for #3 and #4): per bridge-app/README.md the
-- Bridge App authenticates with the Supabase service_role key, which bypasses RLS
-- and which we now make the ONLY role able to execute the pos_outbox RPCs. The
-- heartbeat path is different — it goes through a Next.js route under the caller's
-- user session — so #4 binds it to a restaurant the caller owns. A future non-bridge
-- caller of the pos_outbox RPCs would need its own service_role path or an explicit
-- owns_restaurant()-checked wrapper.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Analytics views — make each one self-filter to the caller's restaurants.
--    Every view body is reused verbatim from 0002 and wrapped, so the aggregate
--    logic and output columns are unchanged (CREATE OR REPLACE keeps the existing
--    grants; we only revoke anon below). has_restaurant_access and is_platform_admin
--    are STABLE SECURITY DEFINER helpers that read auth.uid().
-- ---------------------------------------------------------------------------

create or replace view public.v_customer_rfm as
select * from (
  with agg as (
    select
      c.id              as customer_id,
      c.restaurant_id,
      c.name,
      c.phone,
      count(o.id)::int  as frequency,
      coalesce(sum(o.total), 0)::numeric(12,2) as monetary,
      max(o.created_at) as last_order_at
    from public.customers c
    left join public.orders o on o.customer_id = c.id
    group by c.id, c.restaurant_id, c.name, c.phone
  )
  select
    customer_id,
    restaurant_id,
    name,
    phone,
    frequency,
    monetary,
    last_order_at,
    case
      when last_order_at is null then null
      else extract(day from (now() - last_order_at))::int
    end as recency_days,
    case
      when frequency = 0 then 'Prospect'
      when frequency = 1 then 'New'
      when last_order_at >= now() - interval '14 days' and frequency >= 5 then 'Champion'
      when last_order_at >= now() - interval '30 days' and frequency >= 3 then 'Loyal'
      when last_order_at >= now() - interval '60 days' then 'At-Risk'
      else 'Lost'
    end as segment
  from agg
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

create or replace view public.v_customer_ltv as
select * from (
  select
    c.id                                          as customer_id,
    c.restaurant_id,
    c.name,
    c.phone,
    count(o.id)::int                              as orders_count,
    coalesce(sum(o.total), 0)::numeric(12,2)      as lifetime_value,
    coalesce(avg(o.total), 0)::numeric(12,2)      as avg_order_value,
    min(o.created_at)                             as first_order_at,
    max(o.created_at)                             as last_order_at
  from public.customers c
  left join public.orders o on o.customer_id = c.id
  group by c.id, c.restaurant_id, c.name, c.phone
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

create or replace view public.v_dormant_customers as
select * from (
  select
    c.id          as customer_id,
    c.restaurant_id,
    c.name,
    c.phone,
    c.marketing_opt_in,
    max(o.created_at) as last_order_at,
    extract(day from (now() - max(o.created_at)))::int as days_since_last_order,
    count(o.id)::int as past_orders,
    case
      when max(o.created_at) < now() - interval '90 days' then 'dormant_90'
      when max(o.created_at) < now() - interval '60 days' then 'dormant_60'
      when max(o.created_at) < now() - interval '30 days' then 'dormant_30'
      else 'active'
    end as dormancy_bucket
  from public.customers c
  join public.orders o on o.customer_id = c.id
  group by c.id, c.restaurant_id, c.name, c.phone, c.marketing_opt_in
  having max(o.created_at) < now() - interval '30 days'
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

create or replace view public.v_top_items_per_customer as
select * from (
  with item_counts as (
    select
      o.customer_id,
      o.restaurant_id,
      oi.item_name,
      sum(oi.qty)::int                          as total_qty,
      sum(oi.line_total)::numeric(12,2)         as total_spent,
      count(distinct o.id)::int                 as orders_with_item,
      max(o.created_at)                         as last_ordered_at
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    group by o.customer_id, o.restaurant_id, oi.item_name
  )
  select
    customer_id,
    restaurant_id,
    item_name,
    total_qty,
    total_spent,
    orders_with_item,
    last_ordered_at,
    row_number() over (partition by customer_id order by total_qty desc, last_ordered_at desc) as rank_for_customer
  from item_counts
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

create or replace view public.v_top_items_per_restaurant as
select * from (
  select
    o.restaurant_id,
    oi.item_name,
    count(distinct o.id)::int               as orders_count_lifetime,
    sum(oi.qty)::int                        as qty_lifetime,
    sum(oi.line_total)::numeric(12,2)       as revenue_lifetime,
    sum(case when o.created_at >= now() - interval '30 days' then oi.qty else 0 end)::int            as qty_30d,
    sum(case when o.created_at >= now() - interval '30 days' then oi.line_total else 0 end)::numeric(12,2) as revenue_30d
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  group by o.restaurant_id, oi.item_name
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

create or replace view public.v_revenue_daily as
select * from (
  select
    restaurant_id,
    date_trunc('day', created_at)::date  as day,
    count(*)::int                        as orders,
    count(distinct customer_id)::int     as unique_customers,
    sum(total)::numeric(12,2)            as revenue,
    avg(total)::numeric(12,2)            as avg_ticket
  from public.orders
  group by restaurant_id, date_trunc('day', created_at)
) _s
where public.has_restaurant_access(_s.restaurant_id) or public.is_platform_admin();

-- Anon never legitimately reads analytics; remove the 0002 grant. The
-- authenticated grant from 0002 is preserved by CREATE OR REPLACE above.
revoke select on public.v_customer_rfm             from anon;
revoke select on public.v_customer_ltv             from anon;
revoke select on public.v_dormant_customers        from anon;
revoke select on public.v_top_items_per_customer   from anon;
revoke select on public.v_top_items_per_restaurant from anon;
revoke select on public.v_revenue_daily            from anon;

-- ---------------------------------------------------------------------------
-- 2. get_tenant_owners — gate on the pivot lookup, not the JWT role claim.
-- ---------------------------------------------------------------------------

create or replace function public.get_tenant_owners(p_restaurant_id uuid)
returns table (
  user_id    uuid,
  email      text,
  role       text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'access denied';
  end if;

  return query
  select
    ro.user_id,
    u.email::text,
    ro.role,
    ro.created_at,
    u.last_sign_in_at
  from public.restaurant_owners ro
  join auth.users u on u.id = ro.user_id
  where ro.restaurant_id = p_restaurant_id
  order by ro.created_at;
end;
$$;

grant execute on function public.get_tenant_owners(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. pos_outbox RPCs — lock to service_role (the Bridge App). No app code or
--    owner UI calls these; the bridge uses the service_role key. Revoking the
--    `authenticated` grant closes the "any signed-in user can mutate any tenant's
--    POS queue" hole; service_role still reaches them via the explicit grant.
--    Function bodies are intentionally left unchanged (a service_role call has no
--    auth.uid(), so an internal owns_restaurant() check would wrongly reject it).
-- ---------------------------------------------------------------------------

revoke execute on function public.pos_outbox_claim(uuid, text, int)                  from public, anon, authenticated;
revoke execute on function public.pos_outbox_mark_synced(uuid, text, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.pos_outbox_mark_failed(uuid, text, boolean)        from public, anon, authenticated;

grant execute on function public.pos_outbox_claim(uuid, text, int)                   to service_role;
grant execute on function public.pos_outbox_mark_synced(uuid, text, bigint, bigint)  to service_role;
grant execute on function public.pos_outbox_mark_failed(uuid, text, boolean)         to service_role;

-- ---------------------------------------------------------------------------
-- 4. bridge_heartbeats insert — bind the heartbeat to a restaurant the caller
--    owns (the /api/bridge/heartbeat route inserts under the caller's user
--    session; a service_role bridge bypasses RLS and is unaffected).
-- ---------------------------------------------------------------------------

drop policy if exists "bridge_insert_heartbeats" on public.bridge_heartbeats;
create policy "bridge_insert_heartbeats" on public.bridge_heartbeats
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. open_table_session — validate the restaurant is active (body otherwise
--    reproduced verbatim from 0044 with the guard prepended).
-- ---------------------------------------------------------------------------

create or replace function public.open_table_session(
  p_restaurant_id uuid,
  p_table_label text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_branch_id uuid default null,
  p_table_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_branch_id uuid;
begin
  if not exists (select 1 from public.restaurants where id = p_restaurant_id and is_active) then
    raise exception 'restaurant % is not active', p_restaurant_id;
  end if;

  v_branch_id := coalesce(p_branch_id, public.get_default_branch_id(p_restaurant_id));

  select id into v_session_id
  from public.table_sessions
  where restaurant_id = p_restaurant_id
    and table_label = p_table_label
    and status = 'open'
    and opened_at > now() - interval '8 hours'
  order by opened_at desc
  limit 1;

  if v_session_id is not null then
    if p_customer_name is not null or p_customer_phone is not null then
      update public.table_sessions
      set customer_name = coalesce(p_customer_name, customer_name),
          customer_phone = coalesce(p_customer_phone, customer_phone)
      where id = v_session_id;
    end if;
    return v_session_id;
  end if;

  insert into public.table_sessions (
    restaurant_id, branch_id, table_id, table_label,
    customer_name, customer_phone
  )
  values (
    p_restaurant_id, v_branch_id, p_table_id, p_table_label,
    p_customer_name, p_customer_phone
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.open_table_session(uuid, text, text, text, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. auto_link_customer — validate the restaurant is active (body otherwise
--    reproduced verbatim from 0028 with the guard added). Self-provisioning still
--    requires auth.uid() and only copies the caller's own phone/name.
-- ---------------------------------------------------------------------------

create or replace function public.auto_link_customer(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_existing record;
  v_new_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  if not exists (select 1 from public.restaurants where id = p_restaurant_id and is_active) then
    return jsonb_build_object('ok', false, 'reason', 'restaurant_inactive');
  end if;

  -- Already has a record on this restaurant?
  if exists (
    select 1 from customers
     where auth_user_id = v_uid
       and restaurant_id = p_restaurant_id
       and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_exists');
  end if;

  -- Find an existing linked record on ANY restaurant
  select phone, name into v_existing
    from customers
   where auth_user_id = v_uid
     and deleted_at is null
     and phone not like 'deleted_%'
   limit 1;

  if v_existing.phone is null then
    return jsonb_build_object('ok', false, 'reason', 'no_source');
  end if;

  insert into customers (restaurant_id, phone, name, auth_user_id)
  values (p_restaurant_id, v_existing.phone, v_existing.name, v_uid)
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'customer_id', v_new_id);
end;
$$;
