-- ============================================================================
-- MenuLink · 0016_addon_framework
--
-- Per-tenant feature flags ("services"). The catalog defines what we offer;
-- subscription_addons tracks who has what, with optional trial period and
-- per-tenant price override (for future billing).
--
-- Backfill on apply:
--   tables_qr     → all existing tenants enabled (preserves current UX)
--   excel_export  → all existing tenants enabled (preserves current UX)
--   pos_bridge    → only tenants with pos_settings.enabled=true today
--                   (RzRz Bukhari) — kill-switch for accidental sends to
--                   tenants that didn't request the integration
--   loyalty, push_marketing → no one (placeholders for future)
--
-- Also rewrites enqueue_pos_outbox so the trigger AND-gates on the
-- pos_bridge addon. A mis-flipped pos_settings.enabled can no longer
-- enqueue rows for a tenant that doesn't have the addon.
-- ============================================================================

-- --- 1. addon_catalog ----------------------------------------------------
create table if not exists public.addon_catalog (
  key                 text primary key,
  name_ar             text not null,
  description_ar      text,
  category            text not null default 'operations'
                      check (category in ('operations','growth','integrations')),
  default_price_sar   numeric(10,2) not null default 0,
  trial_days          int not null default 0,
  is_default          boolean not null default false,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

-- --- 2. subscription_addons ---------------------------------------------
create table if not exists public.subscription_addons (
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  addon_key           text not null references public.addon_catalog(key) on delete cascade,
  enabled             boolean not null default true,
  enabled_at          timestamptz not null default now(),
  trial_ends_at       timestamptz,
  price_override_sar  numeric(10,2),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (restaurant_id, addon_key)
);

drop trigger if exists subscription_addons_set_updated_at on public.subscription_addons;
create trigger subscription_addons_set_updated_at
  before update on public.subscription_addons
  for each row execute function public.set_updated_at();

create index if not exists subscription_addons_addon_key_idx
  on public.subscription_addons(addon_key)
  where enabled = true;

-- --- 3. RLS --------------------------------------------------------------
alter table public.addon_catalog       enable row level security;
alter table public.subscription_addons enable row level security;

drop policy if exists all_read_addon_catalog on public.addon_catalog;
drop policy if exists ops_all_addon_catalog  on public.addon_catalog;
create policy "all_read_addon_catalog"
  on public.addon_catalog for select to authenticated
  using (true);
create policy "ops_all_addon_catalog"
  on public.addon_catalog for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists owner_read_subscription_addons on public.subscription_addons;
drop policy if exists ops_all_subscription_addons    on public.subscription_addons;
create policy "owner_read_subscription_addons"
  on public.subscription_addons for select to authenticated
  using (public.owns_restaurant(restaurant_id));
create policy "ops_all_subscription_addons"
  on public.subscription_addons for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- --- 4. Seed the catalog -------------------------------------------------
insert into public.addon_catalog (key, name_ar, description_ar, category, default_price_sar, trial_days, is_default, sort_order)
values
  ('tables_qr',
   'إدارة الطاولات + QR لكل طاولة',
   'أضف طاولات بأسماء مخصصة وكل طاولة لها رمز QR خاص. العميل يمسح، يطلب، والطلب يصل بمعلومة الطاولة.',
   'operations', 0, 0, true, 10),
  ('excel_export',
   'تقارير Excel متقدمة',
   'تنزيل الطلبات والعملاء كملفات Excel مع KPIs ومخططات بيانية جاهزة.',
   'operations', 0, 0, true, 20),
  ('pos_bridge',
   'ربط مع نظام نقاط البيع',
   'تكامل مع RzRz أو Foodics: كل طلب من MenuLink يصل تلقائياً للكاشير ويُطبع في المطبخ.',
   'integrations', 99, 0, false, 30),
  ('loyalty',
   'برنامج الولاء والنقاط',
   'مكافأة العملاء بنقاط على كل طلب، مستويات (برونزي/ذهبي/بلاتيني)، ومكافآت قابلة للاسترداد. (قريباً)',
   'growth', 49, 30, false, 40),
  ('push_marketing',
   'الإشعارات والتسويق',
   'إشعارات Push للعملاء النائمين أو حملات ترويجية لشريحة محددة. (قريباً)',
   'growth', 29, 14, false, 50)
on conflict (key) do nothing;

-- --- 5. Backfill existing tenants ---------------------------------------
-- is_default = true → enable for every existing restaurant.
insert into public.subscription_addons (restaurant_id, addon_key, enabled, notes)
select r.id, c.key, true, 'auto-enabled at addon framework launch · 0016'
  from public.restaurants r
 cross join public.addon_catalog c
 where c.is_default = true
on conflict (restaurant_id, addon_key) do nothing;

-- pos_bridge: only tenants with pos_settings.enabled = true today.
insert into public.subscription_addons (restaurant_id, addon_key, enabled, notes)
select ps.restaurant_id, 'pos_bridge', true,
       'migrated from pos_settings.enabled=true · 0016'
  from public.pos_settings ps
 where ps.enabled = true
on conflict (restaurant_id, addon_key) do nothing;

-- --- 6. Trigger now AND-gates on the addon -------------------------------
-- pos_settings.enabled remains the "ready to send" operational flag.
-- subscription_addons.pos_bridge.enabled is the master kill-switch.
create or replace function public.enqueue_pos_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_enqueue boolean;
begin
  select
    coalesce(ps.enabled, false)
    and exists (
      select 1 from public.subscription_addons sa
       where sa.restaurant_id = new.restaurant_id
         and sa.addon_key = 'pos_bridge'
         and sa.enabled = true
         and (sa.trial_ends_at is null or sa.trial_ends_at > now())
    )
  into v_should_enqueue
  from public.pos_settings ps
 where ps.restaurant_id = new.restaurant_id;

  if not coalesce(v_should_enqueue, false) then
    return new;
  end if;

  insert into public.pos_outbox (restaurant_id, order_id, payload)
  values (new.restaurant_id, new.id, public.build_pos_outbox_payload(new.id))
  on conflict (restaurant_id, order_id) do nothing;

  return new;
end;
$$;

-- --- 7. Post-flight sanity ----------------------------------------------
-- The bridge needs BOTH pos_settings.enabled=true AND pos_bridge addon
-- enabled. If no tenant has both, warn loudly so the migration log catches
-- the regression. (RAISE WARNING — not EXCEPTION — because a fresh project
-- without any bridge tenant is a legitimate state.)
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.pos_settings ps
   where ps.enabled = true
     and exists (
       select 1 from public.subscription_addons sa
        where sa.restaurant_id = ps.restaurant_id
          and sa.addon_key = 'pos_bridge'
          and sa.enabled = true
     );
  if v_count = 0 then
    raise warning 'POST-FLIGHT 0016: no tenant has both pos_settings.enabled=true AND pos_bridge addon enabled — bridge will be silent for everyone. If you have a tenant using the bridge, this is a regression.';
  else
    raise notice 'POST-FLIGHT 0016: % tenant(s) configured for pos_bridge.', v_count;
  end if;
end $$;
