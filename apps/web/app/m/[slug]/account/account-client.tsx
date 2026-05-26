"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";
import { toArabicDigits } from "@/lib/arabic";
import SarSymbol from "../sar-symbol";

type CustomerView = {
  id: string;
  name: string | null;
  phone: string;
  loyalty_points_balance: number;
  loyalty_lifetime_points: number;
  loyalty_tier: string;
  orders_count: number;
};

type OrderView = {
  id: string;
  total: number;
  created_at: string;
  status: string;
};

type RedemptionView = {
  id: string;
  points_cost: number;
  status: "pending" | "fulfilled" | "cancelled";
  redeemed_at: string;
  reward_name: string | null;
};

const STATUS_AR: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const REDEMPTION_STATUS_LABEL: Record<RedemptionView["status"], string> = {
  pending:   "بانتظار التسليم",
  fulfilled: "تم التسليم",
  cancelled: "ملغي (تم استرجاع النقاط)",
};

const REDEMPTION_STATUS_TONE: Record<RedemptionView["status"], string> = {
  pending:   "bg-amber-100 text-amber-900",
  fulfilled: "bg-green-100 text-green-900",
  cancelled: "bg-neutral-100 text-neutral-700",
};

export default function AccountClient({
  slug,
  tenantName,
  signedIn,
  userEmail,
  userName,
  customer,
  recentOrders,
  recentRedemptions,
  tierLabel,
  loyaltyEnabled = true,
  googleFirstFlow = false,
}: {
  slug: string;
  tenantName: string;
  signedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  customer: CustomerView | null;
  recentOrders: OrderView[];
  recentRedemptions: RedemptionView[];
  tierLabel: string | null;
  loyaltyEnabled?: boolean;
  googleFirstFlow?: boolean;
}) {
  // Hooks must be called unconditionally before any early returns.
  const [redemptions, setRedemptions] = useState<RedemptionView[]>(recentRedemptions);
  const [toast, setToast] = useState<{ kind: "success" | "info"; message: string } | null>(null);

  // Realtime: subscribe to status changes on this customer's redemptions.
  // Toast on pending→fulfilled (success) and pending→cancelled (info).
  // Also updates the local redemption list so the status pill changes live.
  useEffect(() => {
    if (!customer) return;
    const sb = createClient();
    const channel = sb
      .channel(`customer-redemptions:${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loyalty_redemptions",
          filter: `customer_id=eq.${customer.id}`,
        },
        (payload) => {
          const fresh = payload.new as {
            id: string;
            status: "pending" | "fulfilled" | "cancelled";
            points_cost: number;
            redeemed_at: string;
          };
          setRedemptions((arr) =>
            arr.map((r) =>
              r.id === fresh.id ? { ...r, status: fresh.status } : r,
            ),
          );
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

  // Auto-dismiss toast after 5 seconds.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ---------------- signed-out ---------------- */
  if (!signedIn) return <SignedOutCard slug={slug} tenantName={tenantName} googleFirstFlow={googleFirstFlow} />;

  /* ---------------- signed in, no link ---------------- */
  if (!customer) {
    if (googleFirstFlow) {
      return <GoogleLinkedCard slug={slug} userEmail={userEmail} userName={userName} />;
    }
    return <LinkPhoneCard slug={slug} userEmail={userEmail} userName={userName} />;
  }

  /* ---------------- signed in + linked ---------------- */
  return (
    <div className="space-y-4">
      {/* Toast: realtime redemption status notifications */}
      {toast && (
        <div
          className={
            "rounded-2xl px-4 py-3 text-sm font-bold leading-snug shadow-md " +
            (toast.kind === "success"
              ? "bg-green-50 border-2 border-green-300 text-green-900"
              : "bg-neutral-50 border-2 border-neutral-300 text-neutral-800")
          }
          style={{ fontFamily: "var(--font-display)" }}
        >
          {toast.message}
        </div>
      )}

      {/* Identity */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {(userName ?? userEmail ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-neutral-900 truncate" style={{ fontFamily: "var(--font-display)" }}>
            {userName ?? customer.name ?? userEmail ?? "—"}
          </div>
          <div className="text-xs text-neutral-500 truncate" dir="ltr">
            {customer.phone}
            {userEmail && <span className="mr-1">· {userEmail}</span>}
          </div>
        </div>
        <SignOutButton />
      </div>

      {/* Points + tier */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-3xl font-extrabold text-amber-900" style={{ fontFamily: "var(--font-display)" }}>
            {toArabicDigits(String(customer.loyalty_points_balance))}
          </div>
          <div className="text-xs text-amber-800 mt-0.5">نقطة متاحة</div>
        </div>
        <div className="bg-white border-2 border-neutral-200 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-1">{tierLabel?.split(" ")[0] ?? "🥉"}</div>
          <div className="text-base font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
            {tierLabel?.split(" ").slice(1).join(" ") ?? "برونزي"}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {toArabicDigits(String(customer.orders_count))} طلب · {toArabicDigits(String(customer.loyalty_lifetime_points))} إجمالي النقاط
          </div>
        </div>
      </div>

      {/* Rewards shortcut */}
      <a
        href={`/m/${slug}/rewards`}
        className="block bg-white border-2 border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-amber-300 active:translate-y-px"
      >
        <span className="text-3xl shrink-0">🎁</span>
        <span className="flex-1 min-w-0">
          <span className="block font-extrabold text-neutral-900 text-sm" style={{ fontFamily: "var(--font-display)" }}>
            استبدل نقاطك بمكافآت
          </span>
          <span className="block text-[11px] text-neutral-500 mt-0.5">شاهد المكافآت المتاحة لك</span>
        </span>
        <span className="text-neutral-400 shrink-0">←</span>
      </a>

      {/* Order history */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4">
        <h2 className="font-extrabold mb-3" style={{ fontFamily: "var(--font-display)" }}>
          آخر الطلبات
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">لم تطلب بعد. تصفح القائمة وابدأ.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {recentOrders.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900">
                    {new Date(o.created_at).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {STATUS_AR[o.status] ?? o.status}
                  </div>
                </div>
                <div className="font-extrabold text-neutral-900 flex items-center gap-0.5" style={{ fontFamily: "var(--font-display)" }}>
                  {toArabicDigits(String(o.total))} <SarSymbol size={14} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Redemption history */}
      {redemptions.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <h2 className="font-extrabold mb-3" style={{ fontFamily: "var(--font-display)" }}>
            آخر الاستبدالات
          </h2>
          <ul className="divide-y divide-neutral-100">
            {redemptions.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    🎁 {r.reward_name ?? "—"}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {new Date(r.redeemed_at).toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh" })} ·{" "}
                    {toArabicDigits(String(r.points_cost))} نقطة
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${REDEMPTION_STATUS_TONE[r.status]}`}>
                  {REDEMPTION_STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={`/m/${slug}`}
        className="block w-full h-12 rounded-2xl bg-[var(--brand)] text-white text-center text-base font-extrabold leading-[3rem] active:translate-y-px shadow-md"
        style={{ fontFamily: "var(--font-display)" }}
      >
        تصفح القائمة
      </a>
    </div>
  );
}

/* ============================================================
 * Signed-out: Google sign-in CTA
 * ============================================================ */
function SignedOutCard({ slug, tenantName, googleFirstFlow = false }: { slug: string; tenantName: string; googleFirstFlow?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/m/${slug}/account`,
      },
    });
    if (error) {
      alert(`فشل تسجيل الدخول: ${error.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-3">
        <div className="text-5xl">{googleFirstFlow ? "👤" : "🏆"}</div>
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
          {googleFirstFlow ? "ربط حسابك" : "احفظ نقاطك وطلباتك"}
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          {googleFirstFlow
            ? `اربط حسابك بـ Google لحفظ طلباتك ونقاطك في ${tenantName}.`
            : `ادخل بـ Google لرؤية رصيد نقاطك في ${tenantName}، مستواك، وقائمة طلباتك السابقة.`
          }
        </p>
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full h-12 rounded-2xl bg-white border-2 border-neutral-300 text-neutral-900 font-extrabold hover:border-neutral-400 disabled:opacity-60 active:translate-y-px shadow-sm flex items-center justify-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <GoogleG />
          {busy ? "..." : "ربط الحساب بـ Google"}
        </button>

        <a
          href={`/m/${slug}`}
          className="block w-full h-12 rounded-2xl bg-neutral-100 text-neutral-700 font-extrabold text-center leading-[3rem] hover:bg-neutral-200 active:translate-y-px"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {googleFirstFlow ? "رجوع للقائمة" : "متابعة كزائر"}
        </a>
      </div>
    </div>
  );
}

/* ============================================================
 * Signed in but no customer row → ask for phone, then link.
 * ============================================================ */
function LinkPhoneCard({ slug, userEmail, userName }: { slug: string; userEmail: string | null; userName: string | null }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExisting, setConfirmExisting] = useState<{ count: number } | null>(null);

  async function attemptLink(forceProceed = false) {
    const phone = normalizePhone(raw);
    if (!phone || phone.length < 8) {
      setError("الرجاء إدخال رقم جوال صحيح.");
      return;
    }
    setBusy(true);
    setError(null);
    const sb = createClient();
    const { data, error: err } = await sb.rpc("link_customer_account", { p_phone: phone });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    const r = data as { ok: boolean; reason?: string; linked_count?: number; existing_orders?: number };
    if (!r.ok) {
      if (r.reason === "phone_already_linked") {
        setError("هذا الرقم مرتبط بحساب آخر. تواصل مع المطعم إذا كان رقمك.");
      } else if (r.reason === "phone_required") {
        setError("الرجاء إدخال رقم جوال صحيح.");
      } else if (r.reason === "not_signed_in") {
        setError("الجلسة منتهية. أعد الدخول.");
      } else {
        setError("تعذر الربط. أعد المحاولة.");
      }
      setBusy(false);
      return;
    }
    // Success — but if there were existing orders and the customer didn't yet
    // confirm, show the soft confirmation. (We've already linked — this is
    // informational, the linking already happened. Future: split into a
    // preview-then-confirm RPC if soft-confirm becomes a real requirement.)
    if (r.existing_orders && r.existing_orders > 0 && !forceProceed) {
      setConfirmExisting({ count: r.existing_orders });
      setBusy(false);
      return;
    }
    // Refresh the page so the server re-renders with the linked customer state.
    window.location.reload();
  }

  if (confirmExisting) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
          تم ربط حسابك
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          وجدنا {toArabicDigits(String(confirmExisting.count))} طلب سابقاً بهذا الرقم. تم ربطها بحسابك.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          متابعة
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-3">
      <div className="text-center">
        <div className="text-4xl mb-2">📱</div>
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "var(--font-display)" }}>
          ربط حسابك برقم جوالك
        </h2>
        <p className="text-sm text-neutral-600 mt-1 leading-relaxed">
          أهلاً {userName ?? userEmail}. اكتب رقم الجوال الذي تستخدمه عند الطلب لربط طلباتك بحسابك.
        </p>
      </div>

      <input
        type="tel"
        placeholder="05XXXXXXXX"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        dir="ltr"
        className="w-full h-12 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-base text-center"
      />

      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={() => attemptLink()}
        disabled={busy}
        className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold disabled:opacity-60 active:translate-y-px shadow-md"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {busy ? "..." : "ربط الحساب"}
      </button>

      <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
        لا نرسل أي رسائل ترويجية. الرقم يُستخدم فقط لمعرفة طلباتك.
      </p>
      <SignOutButton />
    </div>
  );
}

function GoogleLinkedCard({ slug, userEmail, userName }: { slug: string; userEmail: string | null; userName: string | null }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-3xl font-bold mx-auto">
          {(userName ?? userEmail ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="font-extrabold text-neutral-900 text-lg" style={{ fontFamily: "var(--font-display)" }}>
            {userName ?? "مرحباً"}
          </div>
          {userEmail && (
            <div className="text-sm text-neutral-500 mt-0.5" dir="ltr">{userEmail}</div>
          )}
        </div>
        <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3">
          <div className="flex items-center justify-center gap-2">
            <GoogleG />
            <span className="text-sm font-bold text-green-800" style={{ fontFamily: "var(--font-display)" }}>
              حسابك مربوط بـ Google
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            طلباتك ونقاطك ستُحفظ تلقائياً مع حسابك.
          </p>
        </div>
        <a
          href={`/m/${slug}`}
          className="block w-full h-12 rounded-2xl bg-[var(--brand)] text-white text-center text-base font-extrabold leading-[3rem] active:translate-y-px shadow-md"
          style={{ fontFamily: "var(--font-display)" }}
        >
          تصفح القائمة
        </a>
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    const sb = createClient();
    await sb.auth.signOut();
    window.location.reload();
  }
  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="text-xs text-neutral-500 hover:text-neutral-900 underline"
    >
      {busy ? "..." : "خروج"}
    </button>
  );
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
