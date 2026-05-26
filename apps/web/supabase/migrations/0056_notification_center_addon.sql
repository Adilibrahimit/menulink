-- Notification center addon: gated bell icon + notifications page on customer PWA.
-- NOT auto-enabled for existing tenants — sold as a paid upgrade.

INSERT INTO addon_catalog (key, name_ar, name_en, description_ar, description_en, category, default_price_sar, trial_days, is_default, sort_order)
VALUES (
  'notification_center',
  'مركز الإشعارات',
  'Notification Center',
  'صفحة إشعارات مخصصة للعملاء مع شارة التنبيه',
  'Customer-facing notification page with bell badge and history',
  'growth',
  19,
  14,
  false,
  35
)
ON CONFLICT (key) DO NOTHING;
