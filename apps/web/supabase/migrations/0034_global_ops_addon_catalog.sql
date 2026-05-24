-- ============================================================================
-- MenuLink · 0034_global_ops_addon_catalog
--
-- Phase 1 of Global Operations Core:
--   1. Add name_en + description_en columns to addon_catalog (bilingual)
--   2. Backfill English labels for existing 5 catalog entries
--   3. Seed 7 new catalog entries with Arabic + English labels
--
-- This migration does NOT create branches, drivers, numbering tables,
-- modify orders, or enable any new service for any tenant.
-- All new entries use is_default=false.
-- ============================================================================

-- --- 1. Add bilingual columns ------------------------------------------------
alter table public.addon_catalog
  add column if not exists name_en text,
  add column if not exists description_en text;

-- --- 2. Backfill English for existing catalog entries ------------------------
update public.addon_catalog set
  name_en = 'Tables & QR',
  description_en = 'Add named tables with individual QR codes. Customers scan, order, and the order arrives tagged with the table.'
where key = 'tables_qr' and name_en is null;

update public.addon_catalog set
  name_en = 'Excel Reports',
  description_en = 'Download orders and customers as Excel files with KPIs, charts, and formatted dashboards.'
where key = 'excel_export' and name_en is null;

update public.addon_catalog set
  name_en = 'POS Integration',
  description_en = 'Bridge integration with RzRz, Foodics, or other POS systems. Orders sync automatically to the cashier and kitchen printer.'
where key = 'pos_bridge' and name_en is null;

update public.addon_catalog set
  name_en = 'Loyalty Program',
  description_en = 'Reward customers with points on every order, tiered levels (Bronze to Platinum), and redeemable rewards.'
where key = 'loyalty' and name_en is null;

update public.addon_catalog set
  name_en = 'Push Notifications',
  description_en = 'Send push notifications to dormant customers or run targeted campaigns by RFM segment.'
where key = 'push_marketing' and name_en is null;

-- --- 3. Seed new Global Operations Core catalog entries ----------------------
insert into public.addon_catalog
  (key, name_ar, name_en, description_ar, description_en, category, default_price_sar, trial_days, is_default, sort_order)
values
  ('multi_branch',
   'الفروع المتعددة',
   'Multi-Branch',
   'إضافة أكثر من فرع داخل نفس المطعم. كل فرع له واتساب وعنوان وأوقات عمل وخدمات مستقلة.',
   'Add multiple branches under one restaurant. Each branch has its own WhatsApp, address, hours, and service types.',
   'operations', 39, 0, false, 5),

  ('branch_admins',
   'مدراء الفروع',
   'Branch Admins',
   'صلاحيات مخصصة لكل فرع: مدير فرع يرى فقط طلبات فرعه، كاشير للتشغيل اليومي، محاسب للتقارير المالية.',
   'Branch-scoped permissions: branch managers see only their orders, cashiers handle daily operations, accountants access financial reports.',
   'operations', 29, 0, false, 6),

  ('branch_accounting',
   'حسابات الفروع',
   'Branch Accounting',
   'حسابات منفصلة لكل فرع مع تقرير مجمّع للمالك. يشمل إيرادات وطلبات وإلغاءات حسب الفرع.',
   'Separate accounting per branch with consolidated reports for the owner. Includes revenue, orders, and cancellations by branch.',
   'operations', 29, 0, false, 7),

  ('business_day_numbering',
   'أرقام الطلبات حسب يوم التشغيل',
   'Business-Day Order Numbering',
   'رقم فاتورة دائم ورقم طلب يومي يتصفّر حسب يوم التشغيل (وليس منتصف الليل). مطلوب للمحاسبة.',
   'Permanent invoice sequence and daily order number that resets by business day (not midnight). Required for accounting.',
   'operations', 19, 0, false, 8),

  ('drivers',
   'السائقين',
   'Drivers',
   'إدارة سائقين لكل فرع: تسليم الطلب للسائق، متابعة التوصيل، تسوية الكاش، أسباب الفشل والإرجاع.',
   'Manage drivers per branch: assign orders, track delivery, settle cash, and record failure or return reasons.',
   'operations', 49, 0, false, 9),

  ('delivery_zones',
   'نطاقات التوصيل',
   'Delivery Zones',
   'تحديد مناطق توصيل لكل فرع حسب الموقع. توجيه الطلب لأقرب فرع تلقائياً. رسوم توصيل حسب المنطقة.',
   'Define delivery areas per branch by location. Automatically route orders to the nearest branch. Zone-based delivery fees.',
   'operations', 39, 0, false, 11),

  ('advanced_reports',
   'التقارير المتقدمة',
   'Advanced Reports',
   'تقارير تشغيلية ومحاسبية: حسب الفرع، السائق، يوم التشغيل، نوع الطلب، سبب الإلغاء، طريقة الدفع.',
   'Operational and accounting reports: by branch, driver, business day, order type, cancellation reason, and payment method.',
   'operations', 29, 0, false, 12)

on conflict (key) do nothing;
