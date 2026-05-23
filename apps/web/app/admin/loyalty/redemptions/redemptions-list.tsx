"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type RewardInfo = { name_ar: string };
type CustomerInfo = { name: string | null; phone: string };

type RedemptionRow = {
  id: string;
  points_cost: number;
  status: "pending" | "fulfilled" | "cancelled";
  redeemed_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  customer_id: string;
  reward_id: string;
  loyalty_rewards: RewardInfo | RewardInfo[] | null;
  customers: CustomerInfo | CustomerInfo[] | null;
};

const STATUS_LABEL: Record<RedemptionRow["status"], string> = {
  pending:   "معلّق",
  fulfilled: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_TONE: Record<RedemptionRow["status"], string> = {
  pending:   "bg-amber-50 border-amber-300",
  fulfilled: "bg-green-50 border-green-300",
  cancelled: "bg-neutral-50 border-neutral-300 opacity-70",
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function RedemptionsList({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: RedemptionRow[];
}) {
  const [rows, setRows] = useState<RedemptionRow[]>(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "fulfilled" | "cancelled">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  // Realtime: refresh row when status changes, append on INSERT (fetch the
  // full joined row by re-querying that one id to get customers + rewards).
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`redemptions:${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loyalty_redemptions", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const { data: full } = await sb
            .from("loyalty_redemptions")
            .select("id, points_cost, status, redeemed_at, fulfilled_at, cancelled_at, notes, customer_id, reward_id, loyalty_rewards(name_ar), customers(name, phone)")
            .eq("id", (payload.new as RedemptionRow).id)
            .single();
          if (full) setRows((r) => [full as unknown as RedemptionRow, ...r].slice(0, 200));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loyalty_redemptions", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const fresh = payload.new as RedemptionRow;
          setRows((r) => r.map((o) => (o.id === fresh.id ? { ...o, ...fresh } : o)));
        },
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [restaurantId]);

  async function fulfill(id: string) {
    setBusyId(id);
    setError(null);
    const sb = createClient();
    const { data, error: err } = await sb.rpc("fulfill_redemption", { p_redemption_id: id });
    if (err) setError(err.message);
    else {
      const r = data as { ok: boolean; reason?: string };
      if (!r.ok) setError(`فشل: ${r.reason}`);
      else setRows((arr) => arr.map((x) => (x.id === id ? { ...x, status: "fulfilled", fulfilled_at: new Date().toISOString() } : x)));
    }
    setBusyId(null);
  }

  async function cancel(id: string) {
    const reason = prompt("سبب الإلغاء (سيظهر في الملاحظات):", "");
    if (reason === null) return; // user dismissed
    setBusyId(id);
    setError(null);
    const sb = createClient();
    const { data, error: err } = await sb.rpc("cancel_redemption", { p_redemption_id: id, p_reason: reason || null });
    if (err) setError(err.message);
    else {
      const r = data as { ok: boolean; reason?: string };
      if (!r.ok) setError(`فشل: ${r.reason}`);
      else setRows((arr) => arr.map((x) => (x.id === id ? { ...x, status: "cancelled", cancelled_at: new Date().toISOString(), notes: reason || x.notes } : x)));
    }
    setBusyId(null);
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        {(["pending", "fulfilled", "cancelled", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "h-9 px-3 rounded-lg text-sm font-bold border " +
              (filter === f
                ? "bg-brand-primary text-white border-brand-primary"
                : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300")
            }
          >
            {f === "all" ? "الكل" : STATUS_LABEL[f]}
            {f === "pending" && pendingCount > 0 && filter !== "pending" && (
              <span className="mr-1 text-xs bg-amber-200 text-amber-900 rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
        <span className="text-xs text-neutral-500">{visible.length} من {rows.length}</span>
      </div>

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2">🛎️</div>
          <p className="text-sm text-neutral-600">لا توجد طلبات استبدال {filter !== "all" && `بحالة "${STATUS_LABEL[filter as keyof typeof STATUS_LABEL]}"`}.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const reward = first(r.loyalty_rewards);
            const cust = first(r.customers);
            return (
              <li key={r.id} className={`rounded-xl border-2 p-3 flex items-center gap-3 flex-wrap ${STATUS_TONE[r.status]}`}>
                <div className="w-12 h-12 rounded-xl bg-white border border-amber-300 flex items-center justify-center text-2xl shrink-0">🎁</div>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                    {reward?.name_ar ?? "—"}
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    {cust?.name ?? "—"} · <span dir="ltr">{cust?.phone ?? "—"}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    🏆 {r.points_cost} نقطة · {new Date(r.redeemed_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </div>
                  {r.notes && <div className="text-[11px] text-neutral-600 mt-1">📝 {r.notes}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "pending" ? (
                    <>
                      <button
                        onClick={() => fulfill(r.id)}
                        disabled={busyId === r.id}
                        className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-extrabold hover:opacity-90 disabled:opacity-60"
                      >
                        {busyId === r.id ? "..." : "✓ تم التسليم"}
                      </button>
                      <button
                        onClick={() => cancel(r.id)}
                        disabled={busyId === r.id}
                        className="h-9 px-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold hover:bg-rose-100 disabled:opacity-60"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-neutral-600">{STATUS_LABEL[r.status]}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
