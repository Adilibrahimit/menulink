-- ============================================================================
-- MenuLink · seed.sql
-- Deterministic seed: 1 restaurant (KO-KO Chicky Licky) + 20 customers across
-- five RFM personas + ~100 orders distributed over the last 90 days, so the
-- analytics views show meaningful segments immediately after `db reset`.
-- ============================================================================

set client_min_messages = warning;

-- Make randomness deterministic so the seed produces identical data each reset
select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Restaurant
-- ---------------------------------------------------------------------------

insert into public.restaurants (id, slug, name, whatsapp_phone, plan, currency, timezone)
values (
  '11111111-1111-1111-1111-111111111111',
  'koko-chicky-licky',
  'KO-KO Chicky Licky',
  '+966500000000',
  'yearly',
  'SAR',
  'Asia/Riyadh'
);

-- ---------------------------------------------------------------------------
-- Customers (20) split into 5 personas to populate every RFM bucket
-- ---------------------------------------------------------------------------
--
--   persona       count   freq target    last-order recency
--   Champion        5     6-9 orders     0-14 days ago
--   Loyal           5     3-5 orders     0-30 days ago
--   At-Risk         4     2-4 orders     31-60 days ago
--   Lost            3     2-3 orders     61-120 days ago
--   New             3     1 order        0-14 days ago
-- ---------------------------------------------------------------------------

with new_customers as (
  insert into public.customers (id, restaurant_id, phone, name, default_address, marketing_opt_in, first_seen_at, last_seen_at)
  values
    -- Champions
    ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','+966500000101','أحمد العتيبي','الرياض - الروضة', true, now() - interval '120 days', now() - interval '2 days'),
    ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','+966500000102','نورة الشمري','الرياض - النخيل', true, now() - interval '110 days', now() - interval '5 days'),
    ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','+966500000103','خالد القحطاني','الرياض - الملز', true, now() - interval '100 days', now() - interval '3 days'),
    ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','+966500000104','سارة الدوسري','الرياض - العليا', true, now() - interval '95 days', now() - interval '1 days'),
    ('a0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','+966500000105','فهد المطيري','الرياض - الياسمين', false, now() - interval '90 days', now() - interval '6 days'),
    -- Loyal
    ('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','+966500000201','منى الحربي','الرياض - الورود', true, now() - interval '85 days', now() - interval '12 days'),
    ('b0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','+966500000202','عبدالله الزهراني','الرياض - الملقا', true, now() - interval '80 days', now() - interval '18 days'),
    ('b0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','+966500000203','هند الغامدي','الرياض - النرجس', true, now() - interval '70 days', now() - interval '20 days'),
    ('b0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','+966500000204','بدر السلمي','الرياض - العزيزية', true, now() - interval '65 days', now() - interval '25 days'),
    ('b0000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','+966500000205','ريم العنزي','الرياض - الصحافة', true, now() - interval '60 days', now() - interval '28 days'),
    -- At-Risk
    ('c0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','+966500000301','يوسف العمري','الرياض - الربيع', true, now() - interval '85 days', now() - interval '35 days'),
    ('c0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','+966500000302','لمى البقمي','الرياض - الفلاح', true, now() - interval '75 days', now() - interval '45 days'),
    ('c0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','+966500000303','مازن الجهني','الرياض - الياسمين', true, now() - interval '70 days', now() - interval '50 days'),
    ('c0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','+966500000304','شهد المالكي','الرياض - النفل', false, now() - interval '65 days', now() - interval '55 days'),
    -- Lost
    ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','+966500000401','طارق الشهري','الرياض - حي الجامعة', true, now() - interval '150 days', now() - interval '75 days'),
    ('d0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','+966500000402','أمل الزايدي','الرياض - السليمانية', true, now() - interval '160 days', now() - interval '95 days'),
    ('d0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','+966500000403','راكان البلوي','الرياض - الحمراء', true, now() - interval '170 days', now() - interval '110 days'),
    -- New
    ('e0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','+966500000501','جود الخالدي','الرياض - الياسمين', true, now() - interval '4 days', now() - interval '4 days'),
    ('e0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','+966500000502','تركي الفيفي','الرياض - الروابي', true, now() - interval '8 days', now() - interval '8 days'),
    ('e0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','+966500000503','رهف الصاعدي','الرياض - النزهة', true, now() - interval '2 days', now() - interval '2 days')
  returning id
)
select * from new_customers;

-- ---------------------------------------------------------------------------
-- Menu reference (used by the order-generation block below)
-- ---------------------------------------------------------------------------
create temp table _menu (name text, price numeric(10,2)) on commit drop;
insert into _menu (name, price) values
  ('بروستد ٤ قطع', 25.00),
  ('بروستد ٨ قطع', 45.00),
  ('بروستد عائلي', 85.00),
  ('تندر ٥ قطع', 22.00),
  ('تندر ١٠ قطع', 40.00),
  ('برجر دجاج', 18.00),
  ('برجر زنجر', 22.00),
  ('برجر دبل', 28.00),
  ('تويستر كلاسيك', 19.00),
  ('تويستر حار', 21.00),
  ('بطاطس صغير', 7.00),
  ('بطاطس وسط', 10.00),
  ('بطاطس كبير', 13.00),
  ('كولسلو', 8.00),
  ('صوص ثوم', 3.00),
  ('صوص حار', 3.00),
  ('بيبسي', 6.00),
  ('سفن أب', 6.00),
  ('ماء', 2.00);

-- ---------------------------------------------------------------------------
-- Generate orders per persona
-- ---------------------------------------------------------------------------

do $$
declare
  rest_id constant uuid := '11111111-1111-1111-1111-111111111111';
  rec record;
  i int;
  order_id uuid;
  order_time timestamptz;
  item_count int;
  sub numeric(10,2);
  total_val numeric(10,2);
  delivery numeric(10,2);
  otype text;
  -- per-persona settings
  freq_min int;
  freq_max int;
  recency_min_days int;
  recency_max_days int;
begin
  for rec in
    select id, phone from public.customers where restaurant_id = rest_id
  loop
    -- Decide persona from phone prefix
    -- +966500000{1xx,2xx,3xx,4xx,5xx} → Champion / Loyal / At-Risk / Lost / New
    case substring(rec.phone from 11 for 1)
      when '1' then freq_min := 6; freq_max := 9; recency_min_days := 0;  recency_max_days := 14;
      when '2' then freq_min := 3; freq_max := 5; recency_min_days := 0;  recency_max_days := 30;
      when '3' then freq_min := 2; freq_max := 4; recency_min_days := 31; recency_max_days := 60;
      when '4' then freq_min := 2; freq_max := 3; recency_min_days := 61; recency_max_days := 120;
      when '5' then freq_min := 1; freq_max := 1; recency_min_days := 0;  recency_max_days := 14;
      else continue;
    end case;

    for i in 1 .. (freq_min + floor(random() * (freq_max - freq_min + 1))::int) loop
      order_id   := gen_random_uuid();
      order_time := now()
                  - make_interval(days => recency_min_days)
                  - (random() * (recency_max_days - recency_min_days) || ' days')::interval
                  - (random() * 12 || ' hours')::interval;

      otype     := (array['delivery','pickup','dine_in'])[1 + floor(random() * 3)::int];
      delivery  := case when otype = 'delivery' then 10.00 else 0 end;

      -- Pick 1-4 items, build totals
      with picked as (
        select name, price, 1 + floor(random() * 3)::int as qty
        from _menu
        order by random()
        limit 1 + floor(random() * 4)::int
      ),
      ins_order as (
        insert into public.orders (id, restaurant_id, customer_id, order_type, channel, status, subtotal, delivery_fee, total, address, notes, created_at, updated_at)
        select
          order_id, rest_id, rec.id, otype, 'whatsapp', 'delivered',
          coalesce(sum(price * qty), 0)::numeric(10,2),
          delivery,
          (coalesce(sum(price * qty), 0) + delivery)::numeric(10,2),
          case when otype = 'delivery' then 'الرياض' else null end,
          null,
          order_time, order_time
        from picked
        returning id
      )
      insert into public.order_items (order_id, item_name, qty, unit_price, line_total)
      select order_id, name, qty, price, (price * qty)::numeric(10,2)
      from picked;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sample customer tags
-- ---------------------------------------------------------------------------

insert into public.customer_tags (customer_id, tag) values
  ('a0000000-0000-0000-0000-000000000001','VIP'),
  ('a0000000-0000-0000-0000-000000000004','VIP'),
  ('c0000000-0000-0000-0000-000000000004','complainer');

-- ---------------------------------------------------------------------------
-- Sanity output (visible in `supabase db reset` log)
-- ---------------------------------------------------------------------------

do $$
declare
  c_count int; o_count int; i_count int;
begin
  select count(*) into c_count from public.customers;
  select count(*) into o_count from public.orders;
  select count(*) into i_count from public.order_items;
  raise notice 'Seed complete: % customers, % orders, % order_items', c_count, o_count, i_count;
end $$;
