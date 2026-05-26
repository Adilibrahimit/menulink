"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Settings = {
  restaurant_id: string;
  enabled: boolean;
  points_per_sar: number;
  redemption_value_sar: number;
  tier_thresholds_json: TierMap;
  welcome_bonus_points: number;
  birthday_bonus_points: number;
};

type TierMap = Record<TierKey, { orders: number; spend: number }>;
type TierKey = "bronze" | "silver" | "gold" | "platinum";

const TIER_LABEL: Record<TierKey, string> = {
  bronze:   "🥉 برونزي",
  silver:   "🥈 فضي",
  gold:     "🥇 ذهبي",
  platinum: "💎 بلاتيني",
};

const TIER_ORDER: TierKey[] = ["bronze", "silver", "gold", "platinum"];

const DEFAULT_TIERS: TierMap = {
  bronze:   { orders: 0,  spend: 0 },
  silver:   { orders: 5,  spend: 500 },
  gold:     { orders: 20, spend: 2000 },
  platinum: { orders: 50, spend: 5000 },
};

function normalizeTiers(raw: unknown): TierMap {
  const out: TierMap = { ...DEFAULT_TIERS };
  if (!raw || typeof raw !== "object") return out;
  for (const k of TIER_ORDER) {
    const v = (raw as Record<string, { orders?: number; spend?: number }>)[k];
    if (v && typeof v === "object") {
      out[k] = {
        orders: Number(v.orders ?? DEFAULT_TIERS[k].orders),
        spend:  Number(v.spend  ?? DEFAULT_TIERS[k].spend),
      };
    }
  }
  return out;
}

export default function LoyaltySettingsForm({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: Settings;
}) {
  const [enabled,            setEnabled]            = useState(initial.enabled);
  const [pointsPerSar,       setPointsPerSar]       = useState(String(initial.points_per_sar));
  const [redemptionValueSar, setRedemptionValueSar] = useState(String(initial.redemption_value_sar));
  const [welcomeBonus,       setWelcomeBonus]       = useState(String(initial.welcome_bonus_points));
  const [birthdayBonus,      setBirthdayBonus]      = useState(String(initial.birthday_bonus_points));
  const [expiryDays,         setExpiryDays]         = useState(String((initial as unknown as { points_expiry_days?: number | null }).points_expiry_days ?? ""));
  const [tiers, setTiers] = useState<TierMap>(() => normalizeTiers(initial.tier_thresholds_json));

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patchTier(k: TierKey, field: "orders" | "spend", v: string) {
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return;
    setTiers((cur) => ({ ...cur, [k]: { ...cur[k], [field]: n } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const sb = createClient();
    const payload = {
      enabled,
      points_per_sar:        Number(pointsPerSar)        || 0,
      redemption_value_sar:  Number(redemptionValueSar)  || 0,
      welcome_bonus_points:  Number(welcomeBonus)        || 0,
      birthday_bonus_points: Number(birthdayBonus)       || 0,
      tier_thresholds_json:  tiers,
      points_expiry_days:    expiryDays.trim() ? Number(expiryDays) : null,
    };
    const { error: err } = await sb
      .from("loyalty_settings")
      .update(payload)
      .eq("restaurant_id", restaurantId);
    if (err) setError(err.message);
    else setSavedAt(new Date().toLocaleTimeString("ar-SA"));
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Enable / disable */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            تشغيل برنامج الولاء
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            عند الإيقاف، يبقى رصيد العملاء كما هو لكن لا يُكتسب أو يُستبدل شيء.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 accent-brand-primary"
          />
          <span className="text-sm font-bold">{enabled ? "مفعّل" : "موقوف"}</span>
        </label>
      </div>

      {/* Earn + redemption rates */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="نقاط لكل ١ ر.س"
          hint="مثال: ١ يعني كل ريال = نقطة. ٠٫٥ = نصف نقطة."
        >
          <input
            type="number" step="0.001" min="0"
            value={pointsPerSar}
            onChange={(e) => setPointsPerSar(e.target.value)}
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </Field>
        <Field
          label="قيمة النقطة عند الاسترداد (ر.س)"
          hint="مثال: ٠٫١ يعني ١٠ نقاط = ١ ر.س خصم. يظهر للعميل زر 'استخدم نقاطك' في السلة."
        >
          <input
            type="number" step="0.001" min="0"
            value={redemptionValueSar}
            onChange={(e) => setRedemptionValueSar(e.target.value)}
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </Field>
      </div>

      {/* Tier thresholds */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <div>
          <h2 className="font-extrabold" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            مستويات العملاء
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            يصل العميل للمستوى عند تحقيق <b>عدد الطلبات</b> أو <b>الإنفاق الإجمالي</b>،
            أيهما يحققه أولاً.
          </p>
        </div>
        <div className="space-y-2">
          {TIER_ORDER.map((k) => (
            <div key={k} className="grid grid-cols-[1fr,1fr,1fr] gap-2 items-center">
              <div className="text-sm font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                {TIER_LABEL[k]}
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 mb-0.5">عدد الطلبات</label>
                <input
                  type="number" min="0"
                  value={String(tiers[k].orders)}
                  onChange={(e) => patchTier(k, "orders", e.target.value)}
                  disabled={k === "bronze"}
                  className="w-full h-9 rounded-lg border border-neutral-200 px-2 outline-none focus:border-brand-primary text-sm disabled:bg-neutral-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 mb-0.5">الإنفاق (ر.س)</label>
                <input
                  type="number" min="0"
                  value={String(tiers[k].spend)}
                  onChange={(e) => patchTier(k, "spend", e.target.value)}
                  disabled={k === "bronze"}
                  className="w-full h-9 rounded-lg border border-neutral-200 px-2 outline-none focus:border-brand-primary text-sm disabled:bg-neutral-50"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Welcome + birthday bonuses + expiry */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field
          label="مكافأة الترحيب (نقاط)"
          hint="تُمنح عند ربط العميل لحسابه أول مرة."
        >
          <input
            type="number" min="0"
            value={welcomeBonus}
            onChange={(e) => setWelcomeBonus(e.target.value)}
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </Field>
        <Field
          label="مكافأة عيد الميلاد (نقاط)"
          hint="تُمنح سنوياً في يوم ميلاد العميل. (تفعّل لاحقاً)"
        >
          <input
            type="number" min="0"
            value={birthdayBonus}
            onChange={(e) => setBirthdayBonus(e.target.value)}
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </Field>
        <Field
          label="انتهاء صلاحية النقاط (أيام)"
          hint="بعد X يوم من آخر طلب يكسب فيه العميل نقاطاً، تنتهي نقاطه. فارغ = لا تنتهي أبداً. يُطبّق عند الطلب التالي (lazy)."
        >
          <input
            type="number" min="0"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
            placeholder="فارغ = لا تنتهي"
            className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </Field>
      </div>

      {/* Save bar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap sticky bottom-3 z-10 shadow-md">
        <div className="text-xs">
          {error && <span className="text-rose-700">{error}</span>}
          {!error && savedAt && <span className="text-green-700">✓ حُفظ في {savedAt}</span>}
          {!error && !savedAt && <span className="text-neutral-500">اضغط حفظ لتطبيق التغييرات</span>}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 h-10 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-md"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {saving ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}
