# Billing & Payments — schema, trigger, recipes

The money model is three tables + one trigger. Read this before any non-trivial billing write.

## Tables

### `subscriptions` (one per restaurant)
| column | notes |
|---|---|
| `id` | uuid PK |
| `restaurant_id` | FK |
| `plan` | `'yearly'` (default) or `'monthly'` |
| `status` | `'pending_payment'` (default) → `'active'` / `'overdue'` / `'cancelled'` |
| `amount_sar` | recurring **base** price (default 499.00). Menu-only deals here are 500. |
| `current_period_start` / `current_period_end` | the paid window |
| `last_payment_at` | set by the payment trigger |
| `cancelled_at`, `notes`, `created_at`, `updated_at` | |

### `payments` (the money ledger; insert = "money received")
`subscription_id`, `amount_sar`, `method` (`bank_transfer`|`mada`|`cash`|`card`|`manual`),
`reference` (nullable), `paid_at` (default now()), `recorded_by` (nullable uuid), `notes`, `created_at`.

The ops form `/ops/payments` (`new-payment-form.tsx`) literally just does
`insert into payments {subscription_id, amount_sar, method, reference, notes, paid_at}`.

### `subscription_addons` (per-tenant paid services)
`restaurant_id`, `addon_key`, `enabled` (default true), `enabled_at`, `trial_ends_at`,
`price_override_sar`, `notes`. Catalog of addon keys + default prices is `addon_catalog`
(e.g. `google_review` 100, `tables_qr`, `loyalty`, `pos_bridge`, `push_marketing`, `excel_export`).

## The trigger — `apply_payment_to_subscription()` (AFTER INSERT ON payments)

```sql
v_period := case when plan='monthly' then interval '30 days' else interval '365 days' end;
update subscriptions set
  status='active',
  current_period_start = coalesce(case when current_period_end > now() then current_period_end end, now()),
  current_period_end   = coalesce(case when current_period_end > now() then current_period_end else now() end, now()) + v_period,
  last_payment_at = new.paid_at,
  cancelled_at = null
where id = new.subscription_id;
-- also: republish the restaurant (is_published=true, is_active=true)
```

Two consequences to remember:
1. **It stacks.** If `current_period_end` is already in the future it adds the interval on TOP. Tenant
   creation pre-seeds `current_period_end = created+1yr` while `pending_payment`, so the first payment
   double-counts → ~2-year end. **Override with an explicit UPDATE** (below) for backdated/first
   payments.
2. **It does NOT set `amount_sar`.** If a sub was created with `amount_sar=0` (Coffee Secret was),
   set it yourself.

## Recipe — record an annual payment dated from creation day

```sql
-- 1) ledger row(s)
insert into public.payments (subscription_id, amount_sar, method, paid_at, notes)
values ('<sub_id>', 500, 'bank_transfer',
        (select created_at from public.restaurants where slug='<slug>'),
        'اشتراك سنوي ٥٠٠ ر.س — منيو عرض فقط');

-- 1b) (if a paid addon was bought) second ledger row + ensure the addon is enabled
insert into public.payments (subscription_id, amount_sar, method, paid_at, notes)
values ('<sub_id>', 100, 'bank_transfer',
        (select created_at from public.restaurants where slug='<slug>'),
        'خدمة QR تقييم Google (إضافة) — ١٠٠ ر.س');
insert into public.subscription_addons (restaurant_id, addon_key, enabled, price_override_sar)
values ((select id from public.restaurants where slug='<slug>'), 'google_review', true, 100)
on conflict (restaurant_id, addon_key) do update set enabled=true, price_override_sar=100;

-- 2) authoritative subscription state (overrides the trigger's stacking)
update public.subscriptions s
   set status='active', amount_sar=500,
       last_payment_at      = r.created_at,
       current_period_start = r.created_at,
       current_period_end   = r.created_at + interval '365 days',
       cancelled_at=null, updated_at=now()
  from public.restaurants r
 where r.id = s.restaurant_id and r.slug='<slug>';
```

## Verify (always)

```sql
select r.slug, s.status, s.amount_sar, s.current_period_start::date, s.current_period_end::date,
       s.last_payment_at::date,
       (select sum(amount_sar) from payments p where p.subscription_id=s.id) as total_paid
from subscriptions s join restaurants r on r.id=s.restaurant_id where r.slug='<slug>';
```

Expect: `status=active`, the right `amount_sar`, period = creation→+365d (for "from creation day"
deals), `total_paid` = base + any addons.

## Notes
- Apply via Management API + PAT (see SKILL.md "How to apply"). Use a non-browser User-Agent.
- The overdue path: a separate trigger auto-unpublishes a restaurant when the sub goes overdue; a
  payment republishes it. So logging a late payment also brings the menu back online.
- `recorded_by` is nullable; SQL inserts can leave it null (the UI does too).
