"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

type Row = {
  id: string;
  name: string | null;
  phone: string;
  loyalty_points_balance: number;
  loyalty_lifetime_points: number;
  loyalty_tier: TierKey;
  orders_count: number;
  lifetime_spend: number;
  last_seen_at: string | null;
  auth_user_id: string | null;
};

const TIER_LABEL: Record<TierKey, string> = {
  bronze:   "🥉",
  silver:   "🥈",
  gold:     "🥇",
  platinum: "💎",
};

const TIER_STYLE: Record<TierKey, string> = {
  bronze:   "bg-orange-50 text-orange-800 border-orange-200",
  silver:   "bg-neutral-100 text-neutral-700 border-neutral-300",
  gold:     "bg-amber-100 text-amber-900 border-amber-300",
  platinum: "bg-violet-100 text-violet-900 border-violet-300",
};

export default function LoyaltyCustomersTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | TierKey>("all");
  const [adjusting, setAdjusting] = useState<Row | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = query.replace(/\D/g, "");
    return rows.filter((r) => {
      if (tierFilter !== "all" && r.loyalty_tier !== tierFilter) return false;
      if (!q) return true;
      const nameMatch = (r.name ?? "").toLowerCase().includes(q);
      const phoneMatch = qDigits.length > 0 && r.phone.includes(qDigits);
      return nameMatch || phoneMatch;
    });
  }, [rows, query, tierFilter]);

  function patchRow(id: string, p: Partial<Row>) {
    setRows((arr) => arr.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الجوال"
          className="flex-1 min-w-[200px] h-9 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as "all" | TierKey)}
          className="h-9 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm bg-white"
        >
          <option value="all">كل المستويات</option>
          <option value="platinum">💎 بلاتيني</option>
          <option value="gold">🥇 ذهبي</option>
          <option value="silver">🥈 فضي</option>
          <option value="bronze">🥉 برونزي</option>
        </select>
        <span className="text-xs text-neutral-500">{visible.length} من {rows.length}</span>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-sm text-neutral-500">
          لا يوجد عملاء مطابقون.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 ${TIER_STYLE[r.loyalty_tier]}`}>
                {TIER_LABEL[r.loyalty_tier]}
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold text-neutral-900 truncate">
                  {r.name ?? "—"} <span className="text-neutral-400 font-normal text-xs" dir="ltr">· {r.phone}</span>
                  {r.auth_user_id && (
                    <span className="mr-2 text-[10px] bg-sky-100 text-sky-900 rounded px-1.5 py-0.5">🔗 Google</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{r.orders_count} طلب</span>
                  <span>· {Number(r.lifetime_spend).toFixed(0)} ر.س إجمالي</span>
                  {r.last_seen_at && (
                    <span>· آخر زيارة {new Date(r.last_seen_at).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-extrabold text-amber-700" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                  🏆 {r.loyalty_points_balance}
                </div>
                <div className="text-[10px] text-neutral-500">إجمالي العمر: {r.loyalty_lifetime_points}</div>
              </div>
              <button
                onClick={() => setAdjusting(r)}
                className="h-9 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-extrabold hover:bg-neutral-200 shrink-0"
              >
                تعديل النقاط
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Adjust modal */}
      {adjusting && (
        <AdjustModal
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={(newBalance) => {
            patchRow(adjusting.id, { loyalty_points_balance: newBalance });
            setAdjusting(null);
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (newBalance: number) => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) { setError("اكتب رقماً صحيحاً غير صفر."); return; }
    if (!reason.trim()) { setError("اكتب سبباً قصيراً."); return; }
    setError(null);
    setBusy(true);
    const sb = createClient();
    const { data, error: err } = await sb.rpc("adjust_customer_points", {
      p_customer_id: row.id,
      p_delta: d,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    const r = data as { ok: boolean; reason?: string; new_balance?: number; current_balance?: number };
    if (!r.ok) {
      if (r.reason === "would_go_negative") {
        setError(`الرصيد الحالي ${r.current_balance} لا يكفي لخصم ${Math.abs(d)}.`);
      } else if (r.reason === "delta_zero") {
        setError("اكتب رقماً غير صفر.");
      } else if (r.reason === "forbidden") {
        setError("ليس لديك صلاحية لتعديل هذا العميل.");
      } else {
        setError("فشل التعديل. أعد المحاولة.");
      }
      return;
    }
    onSaved(r.new_balance ?? row.loyalty_points_balance + d);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div onClick={() => !busy && onClose()} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            تعديل نقاط: {row.name ?? "—"}
          </h2>
          <p className="text-xs text-neutral-500 mt-1" dir="ltr">{row.phone}</p>
          <p className="text-xs text-neutral-500 mt-1">الرصيد الحالي: <b>{row.loyalty_points_balance}</b> نقطة</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            عدد النقاط (موجب لإضافة · سالب للخصم)
          </label>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="مثال: 50 أو -20"
            className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-base"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">السبب</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: طلب نقدي بقيمة ٧٣ ر.س"
            className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="space-y-2">
          <button
            onClick={save}
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-brand-primary text-white font-extrabold disabled:opacity-60 active:translate-y-px shadow-md"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            {busy ? "..." : "حفظ التعديل"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full h-10 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold hover:bg-neutral-200"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
