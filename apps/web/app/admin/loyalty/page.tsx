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

  // Headline counter: how many active loyalty customers. Point totals are
  // surfaced on a future stats page (slice 2) — keeping this page focused
  // on settings so the owner isn't overwhelmed on the addon's first day.
  const { count: customerCount } = await sb
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", me.restaurant_id)
    .gt("loyalty_lifetime_points", 0);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="عملاء جمعوا نقاطاً" value={String(customerCount ?? 0)} />
        <KpiCard label="حالة البرنامج" value={settings?.enabled ? "مفعّل" : "موقوف"} />
        <KpiCard label="معدّل الكسب الحالي" value={`${settings?.points_per_sar ?? 1} نقطة / ر.س`} />
      </div>

      {/* Quick links to sub-pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      <LoyaltySettingsForm
        restaurantId={me.restaurant_id}
        initial={settings!}
      />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-2xl font-extrabold mt-1 text-neutral-900">{value}</div>
    </div>
  );
}
