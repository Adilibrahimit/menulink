-- ============================================================================
-- MenuLink · 0002_analytics_views
-- The product-value layer: views that turn raw orders into business insight
-- for the restaurant owner — segmentation, dormancy, top items, revenue.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_customer_rfm
--   Recency (days since last order), Frequency (lifetime order count),
--   Monetary (lifetime spend). Bucketed into a segment label.
--
--   Buckets (simple, owner-friendly):
--     Champion : ordered <=14 days ago AND frequency >=5
--     Loyal    : ordered <=30 days ago AND frequency >=3
--     At-Risk  : last order 31-60 days ago
--     Lost     : last order >60 days ago
--     New      : frequency == 1
-- ---------------------------------------------------------------------------

create or replace view public.v_customer_rfm as
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
from agg;

-- ---------------------------------------------------------------------------
-- v_customer_ltv
--   Lifetime value + average order value per customer.
-- ---------------------------------------------------------------------------

create or replace view public.v_customer_ltv as
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
group by c.id, c.restaurant_id, c.name, c.phone;

-- ---------------------------------------------------------------------------
-- v_dormant_customers
--   Customers who used to order but haven't in a while.
--   Bucketed at 30 / 60 / 90 day thresholds — owner picks a segment to target.
-- ---------------------------------------------------------------------------

create or replace view public.v_dormant_customers as
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
having max(o.created_at) < now() - interval '30 days';

-- ---------------------------------------------------------------------------
-- v_top_items_per_customer
--   Each customer's most-ordered items (rank within customer).
--   Useful for personalized re-order push: "بروستد ٤ قطع زي العادة؟"
-- ---------------------------------------------------------------------------

create or replace view public.v_top_items_per_customer as
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
from item_counts;

-- ---------------------------------------------------------------------------
-- v_top_items_per_restaurant
--   Bestsellers (and worst sellers) per restaurant.
--   Last 30 days for "what's hot now", lifetime for historical context.
-- ---------------------------------------------------------------------------

create or replace view public.v_top_items_per_restaurant as
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
group by o.restaurant_id, oi.item_name;

-- ---------------------------------------------------------------------------
-- v_revenue_daily
--   Daily revenue rollup per restaurant. Powers the owner dashboard chart.
-- ---------------------------------------------------------------------------

create or replace view public.v_revenue_daily as
select
  restaurant_id,
  date_trunc('day', created_at)::date  as day,
  count(*)::int                        as orders,
  count(distinct customer_id)::int     as unique_customers,
  sum(total)::numeric(12,2)            as revenue,
  avg(total)::numeric(12,2)            as avg_ticket
from public.orders
group by restaurant_id, date_trunc('day', created_at);

-- ---------------------------------------------------------------------------
-- Convenience: grant read access on views to the standard roles.
-- Underlying RLS on the base tables still enforces tenant scoping.
-- ---------------------------------------------------------------------------

grant select on public.v_customer_rfm             to authenticated, anon;
grant select on public.v_customer_ltv             to authenticated, anon;
grant select on public.v_dormant_customers        to authenticated, anon;
grant select on public.v_top_items_per_customer   to authenticated, anon;
grant select on public.v_top_items_per_restaurant to authenticated, anon;
grant select on public.v_revenue_daily            to authenticated, anon;
