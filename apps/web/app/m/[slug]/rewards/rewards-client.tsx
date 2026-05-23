"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

type Reward = {
  id: string;
  name_ar: string;
  description_ar: string | null;
  points_cost: number;
  min_tier: TierKey;
  max_per_customer: number | null;
  image_url: string | null;
};

type Customer = {
  id: string;
  loyalty_points_balance: number;
  loyalty_tier: TierKey;
};

const TIER_LABEL: Record<TierKey, string> = {
  bronze:   "🥉 برونزي",
  silver:   "🥈 فضي",
  gold:     "🥇 ذهبي",
  platinum: "💎 بلاتيني",
};

const TIER_RANK: Record<TierKey, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };

function toArabicDigits(s: string): string {
  const m: Record<string, string> = { "0":"٠","1":"١","2":"٢","3":"٣","4":"٤","5":"٥","6":"٦","7":"٧","8":"٨","9":"٩" };
  return s.replace(/[0-9]/g, (d) => m[d] ?? d);
}

export default function RewardsClient({
  slug,
  signedIn,
  customer,
  rewards,
}: {
  slug: string;
  signedIn: boolean;
  customer: Customer | null;
  rewards: Reward[];
}) {
  const [pendingReward, setPendingReward] = useState<Reward | null>(null);
  const [success, setSuccess] = useState<{ rewardName: string; newBalance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "info"; message: string } | null>(null);

  // Realtime: notify customer when one of their redemptions changes status
  // (owner marked fulfilled or cancelled it). Same subscription pattern as
  // the account page — kept here too so customers browsing rewards see the
  // ping without navigating away.
  useEffect(() => {
    if (!customer) return;
    const sb = createClient();
    const channel = sb
      .channel(`customer-rewards:${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loyalty_redemptions",
          filter: `customer_id=eq.${customer.id}`,
        },
        (payload) => {
          const fresh = payload.new as { status: "pending" | "fulfilled" | "cancelled" };
          if (fresh.status === "fulfilled") {
            setToast({ kind: "success", message: "✅ مكافأتك جاهزة! المطعم سلّمها." });
          } else if (fresh.status === "cancelled") {
            setToast({ kind: "info", message: "ℹ️ تم إلغاء الاستبدال وإعادة نقاطك." });
          }
        },
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [customer]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function confirmRedeem(r: Reward) {
    setBusy(true);
    setError(null);
    const sb = createClient();
    const { data, error: err } = await sb.rpc("redeem_reward", { p_reward_id: r.id });
    setBusy(false);
    if (err) {
      setError("تعذر إرسال الطلب. أعد المحاولة.");
      return;
    }
    const result = data as { ok: boolean; reason?: string; balance?: number; required?: number; current_tier?: TierKey; required_tier?: TierKey; points_after?: number };
    if (!result.ok) {
      if (result.reason === "insufficient_points") {
        setError(`رصيدك ${toArabicDigits(String(result.balance))} نقطة، والمكافأة تحتاج ${toArabicDigits(String(result.required))} نقطة.`);
      } else if (result.reason === "tier_too_low") {
        setError(`هذه المكافأة من ${TIER_LABEL[result.required_tier as TierKey]} وأعلى.`);
      } else if (result.reason === "limit_reached") {
        setError("لقد استبدلت هذه المكافأة الحد الأقصى المسموح به.");
      } else if (result.reason === "not_linked_to_tenant") {
        setError("اربط حسابك برقم جوالك أولاً من صفحة الحساب.");
      } else if (result.reason === "not_signed_in") {
        setError("الجلسة منتهية. ادخل من جديد.");
      } else {
        setError("تعذر الاستبدال. أعد المحاولة.");
      }
      return;
    }
    setPendingReward(null);
    setSuccess({ rewardName: r.name_ar, newBalance: result.points_after ?? 0 });
  }

  /* ---------------- header card: balance ---------------- */
  const HeaderCard = (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
      <span className="text-4xl">🏆</span>
      <div className="flex-1 min-w-0">
        {customer ? (
          <>
            <div className="text-2xl font-extrabold text-amber-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              {toArabicDigits(String(customer.loyalty_points_balance))} نقطة
            </div>
            <div className="text-xs text-amber-800 mt-0.5">
              مستواك: {TIER_LABEL[customer.loyalty_tier]}
            </div>
          </>
        ) : signedIn ? (
          <>
            <div className="text-sm font-extrabold text-amber-900">اربط حسابك أولاً</div>
            <a href={`/m/${slug}/account`} className="text-xs text-amber-800 underline">من صفحة الحساب →</a>
          </>
        ) : (
          <>
            <div className="text-sm font-extrabold text-amber-900">ادخل لرؤية رصيدك</div>
            <a href={`/m/${slug}/account`} className="text-xs text-amber-800 underline">تسجيل دخول بـ Google →</a>
          </>
        )}
      </div>
    </div>
  );

  /* ---------------- empty state ---------------- */
  if (rewards.length === 0) {
    return (
      <div>
        {HeaderCard}
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
          <div className="text-3xl mb-2">🎁</div>
          <p className="text-sm text-neutral-600">لم يضف المطعم مكافآت بعد.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div
          className={
            "rounded-2xl px-4 py-3 text-sm font-bold leading-snug shadow-md " +
            (toast.kind === "success"
              ? "bg-green-50 border-2 border-green-300 text-green-900"
              : "bg-neutral-50 border-2 border-neutral-300 text-neutral-800")
          }
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {toast.message}
        </div>
      )}

      {HeaderCard}

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <ul className="space-y-2">
        {rewards.map((r) => {
          const tierOk = !customer || TIER_RANK[customer.loyalty_tier] >= TIER_RANK[r.min_tier];
          const balanceOk = !customer || customer.loyalty_points_balance >= r.points_cost;
          const eligible = signedIn && customer && tierOk && balanceOk;
          const shortBy = customer ? Math.max(0, r.points_cost - customer.loyalty_points_balance) : 0;
          return (
            <li key={r.id} className="bg-white border border-neutral-200 rounded-2xl p-3 flex items-center gap-3 flex-wrap">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url}
                  alt={r.name_ar}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-amber-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl shrink-0">
                  🎁
                </div>
              )}
              <div className="flex-1 min-w-[160px]">
                <div className="font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                  {r.name_ar}
                </div>
                {r.description_ar && (
                  <div className="text-xs text-neutral-500 mt-0.5 leading-snug">{r.description_ar}</div>
                )}
                <div className="text-[11px] mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-700">🏆 {toArabicDigits(String(r.points_cost))} نقطة</span>
                  {r.min_tier !== "bronze" && (
                    <span className="text-neutral-500">· {TIER_LABEL[r.min_tier]} وأعلى</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {!signedIn ? (
                  <a
                    href={`/m/${slug}/account`}
                    className="inline-flex items-center h-10 px-4 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-extrabold hover:bg-neutral-200"
                  >
                    ادخل للاستبدال
                  </a>
                ) : !customer ? (
                  <a
                    href={`/m/${slug}/account`}
                    className="inline-flex items-center h-10 px-4 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-extrabold hover:bg-neutral-200"
                  >
                    اربط حسابك
                  </a>
                ) : !tierOk ? (
                  <button disabled className="h-10 px-4 rounded-xl bg-neutral-100 text-neutral-500 text-xs font-bold opacity-70">
                    متاح من {TIER_LABEL[r.min_tier]}
                  </button>
                ) : !balanceOk ? (
                  <button disabled className="h-10 px-4 rounded-xl bg-neutral-100 text-neutral-500 text-xs font-bold opacity-70">
                    تحتاج {toArabicDigits(String(shortBy))} نقطة
                  </button>
                ) : (
                  <button
                    onClick={() => setPendingReward(r)}
                    className="h-10 px-5 rounded-xl bg-[var(--brand)] text-white text-sm font-extrabold hover:opacity-90 active:translate-y-px shadow-md"
                    style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
                  >
                    استبدل
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Confirmation modal */}
      {pendingReward && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
          <div onClick={() => !busy && setPendingReward(null)} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">🎁</div>
              <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                تأكيد الاستبدال
              </h2>
              <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                سيُخصم <b>{toArabicDigits(String(pendingReward.points_cost))} نقطة</b> من رصيدك لاستبدال <b>{pendingReward.name_ar}</b>.
                المطعم سيُحضّر المكافأة ويسلّمها لك.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => confirmRedeem(pendingReward)}
                disabled={busy}
                className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold disabled:opacity-60 active:translate-y-px shadow-md"
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
              >
                {busy ? "..." : "تأكيد الاستبدال"}
              </button>
              <button
                onClick={() => setPendingReward(null)}
                disabled={busy}
                className="w-full h-10 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold hover:bg-neutral-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" dir="rtl">
          <div onClick={() => setSuccess(null)} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-6 space-y-4 text-center">
            <div className="text-6xl">✅</div>
            <h2 className="text-lg font-extrabold text-green-800" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              تم إرسال طلب الاستبدال
            </h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              <b>{success.rewardName}</b> · المطعم سيحضّرها لك. رصيدك الجديد: {toArabicDigits(String(success.newBalance))} نقطة.
            </p>
            <button
              onClick={() => { setSuccess(null); window.location.reload(); }}
              className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold"
              style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
            >
              تمام
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
