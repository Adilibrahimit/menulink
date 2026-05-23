import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import LoyaltySettingsForm from "./settings-form";

export default async function AdminLoyaltyPage() {
  const me = await requireOwner();
  if (!(await hasAddon(me.restaurant_id, "loyalty"))) notFound();

  const sb = createClient();

  // Materialize the settings row if missing so the form has stable defaults.
  // The earn trigger creates the row lazily on first order; doing it here
  // ensures the form has something to load even before any order has run.
  const { data: existing } = await sb
    .from("loyalty_settings")
    .select("*")
    .eq("restaurant_id", me.restaurant_id)
    .maybeSingle();

  let settings = existing;
  if (!settings) {
    const { data: created } = await sb
      .from("loyalty_settings")
      .insert({ restaurant_id: me.restaurant_id })
      .select("*")
      .single();
    settings = created;
  }

  // Headline counters in parallel
  const [
    { count: customerCount },
    { data: redeemRows },
    { count: pendingCount },
    { count: activeRewardsCount },
  ] = await Promise.all([
    sb
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", me.restaurant_id)
      .gt("loyalty_lifetime_points", 0),
    sb
      .from("loyalty_transactions")
      .select("points")
      .eq("restaurant_id", me.restaurant_id)
      .eq("kind", "redeem"),
    sb
      .from("loyalty_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", me.restaurant_id)
      .eq("status", "pending"),
    sb
      .from("loyalty_rewards")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", me.restaurant_id)
      .eq("active", true),
  ]);

  // redeem transactions store points as negative; flip sign for display
  const totalRedeemed = (redeemRows ?? []).reduce(
    (acc, r) => acc + Math.abs(Number((r as { points?: number }).points ?? 0)),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">برنامج الولاء</h1>
          <p className="text-sm text-neutral-500 mt-1">
            اضبط معدّل الكسب، المستويات، ومكافأة الترحيب. يبدأ الكسب فور التفعيل.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="عملاء جمعوا نقاطاً" value={String(customerCount ?? 0)} />
        <KpiCard label="معدّل الكسب" value={`${settings?.points_per_sar ?? 1} نقطة / ر.س`} />
        <KpiCard label="حالة البرنامج" value={settings?.enabled ? "مفعّل" : "موقوف"} />
        <KpiCard label="نقاط مستبدَلة (إجمالي)" value={String(totalRedeemed)} />
        <KpiCard
          label="استبدالات بانتظار التسليم"
          value={String(pendingCount ?? 0)}
          tone={(pendingCount ?? 0) > 0 ? "bg-amber-50 border-amber-300 text-amber-900" : undefined}
        />
        <KpiCard label="مكافآت نشطة" value={String(activeRewardsCount ?? 0)} />
      </div>

      {/* Quick links to sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/admin/loyalty/rewards"
          className="bg-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-neutral-300 active:translate-y-px"
        >
          <span className="text-3xl">🎁</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              المكافآت
            </span>
            <span className="block text-[11px] text-neutral-500 mt-0.5">
              ما يستطيع العميل استبداله بنقاطه
            </span>
          </span>
          <span className="text-neutral-400">←</span>
        </Link>
        <Link
          href="/admin/loyalty/redemptions"
          className="bg-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-neutral-300 active:translate-y-px"
        >
          <span className="text-3xl">🛎️</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              طلبات الاستبدال
            </span>
            <span className="block text-[11px] text-neutral-500 mt-0.5">
              العملاء طلبوا مكافأة وانتظروا التسليم
            </span>
          </span>
          <span className="text-neutral-400">←</span>
        </Link>
        <Link
          href="/admin/loyalty/customers"
          className="bg-white border border-neutral-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-neutral-300 active:translate-y-px"
        >
          <span className="text-3xl">👥</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              عملاء الولاء
            </span>
            <span className="block text-[11px] text-neutral-500 mt-0.5">
              ترتيب حسب النقاط · تعديل يدوي
            </span>
          </span>
          <span className="text-neutral-400">←</span>
        </Link>
      </div>

      <LoyaltySettingsForm
        restaurantId={me.restaurant_id}
        initial={settings!}
      />
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tone ?? "bg-white border-neutral-200"}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
