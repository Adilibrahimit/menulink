-- ============================================================================
-- MenuLink · verify.sql
-- End-to-end smoke checks. Run with:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f verify.sql
-- Or paste into Studio SQL editor at http://localhost:54323
-- ============================================================================

\echo '--- 1. Tables created ---'
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type   = 'BASE TABLE'
order by table_name;

\echo '--- 2. Views created ---'
select table_name
from information_schema.views
where table_schema = 'public'
order by table_name;

\echo '--- 3. Row counts ---'
select 'restaurants' as t, count(*) from public.restaurants
union all select 'customers',         count(*) from public.customers
union all select 'orders',            count(*) from public.orders
union all select 'order_items',       count(*) from public.order_items
union all select 'customer_tags',     count(*) from public.customer_tags;

\echo '--- 4. RFM segments distribution ---'
select segment, count(*) as customers, round(avg(frequency)::numeric, 1) as avg_freq, round(avg(monetary)::numeric, 2) as avg_spend
from public.v_customer_rfm
group by segment
order by customers desc;

\echo '--- 5. Dormant customers (re-engagement targets) ---'
select name, phone, days_since_last_order, past_orders, dormancy_bucket
from public.v_dormant_customers
order by days_since_last_order desc
limit 10;

\echo '--- 6. Top items restaurant-wide ---'
select item_name, qty_lifetime, revenue_lifetime, qty_30d
from public.v_top_items_per_restaurant
order by qty_lifetime desc
limit 10;

\echo '--- 7. Top item per customer (sample) ---'
select c.name, t.item_name, t.total_qty, t.total_spent
from public.v_top_items_per_customer t
join public.customers c on c.id = t.customer_id
where t.rank_for_customer = 1
order by t.total_spent desc
limit 10;

\echo '--- 8. Daily revenue rollup (last 14 days) ---'
select day, orders, unique_customers, revenue, avg_ticket
from public.v_revenue_daily
where day >= current_date - interval '14 days'
order by day desc;

\echo '--- 9. RLS enabled on every table ---'
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
