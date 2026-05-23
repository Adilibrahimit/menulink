"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";

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

const STATUS_AR: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

function toArabicDigits(s: string): string {
  const m: Record<string, string> = {
    "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
    "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
  };
  return s.replace(/[0-9]/g, (d) => m[d] ?? d);
}

export default function AccountClient({
  slug,
  tenantName,
  signedIn,
  userEmail,
  userName,
  customer,
  recentOrders,
  tierLabel,
}: {
  slug: string;
  tenantName: string;
  signedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  customer: CustomerView | null;
  recentOrders: OrderView[];
  tierLabel: string | null;
}) {
  /* ---------------- signed-out ---------------- */
  if (!signedIn) return <SignedOutCard slug={slug} tenantName={tenantName} />;

  /* ---------------- signed in, no link ---------------- */
  if (!customer) return <LinkPhoneCard slug={slug} userEmail={userEmail} userName={userName} />;

  /* ---------------- signed in + linked ---------------- */
  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {(userName ?? userEmail ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-neutral-900 truncate" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
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
          <div className="text-3xl font-extrabold text-amber-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            {toArabicDigits(String(customer.loyalty_points_balance))}
          </div>
          <div className="text-xs text-amber-800 mt-0.5">نقطة متاحة</div>
        </div>
        <div className="bg-white border-2 border-neutral-200 rounded-2xl p-4 text-center">
          <div className="text-3xl mb-1">{tierLabel?.split(" ")[0] ?? "🥉"}</div>
          <div className="text-base font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
            {tierLabel?.split(" ").slice(1).join(" ") ?? "برونزي"}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {toArabicDigits(String(customer.orders_count))} طلب · {toArabicDigits(String(customer.loyalty_lifetime_points))} إجمالي النقاط
          </div>
        </div>
      </div>

      {/* Order history */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4">
        <h2 className="font-extrabold mb-3" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
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
                <div className="font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                  {toArabicDigits(String(o.total))} ر.س
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a
        href={`/m/${slug}`}
        className="block w-full h-12 rounded-2xl bg-[var(--brand)] text-white text-center text-base font-extrabold leading-[3rem] active:translate-y-px shadow-md"
        style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
      >
        تصفح القائمة
      </a>
    </div>
  );
}

/* ============================================================
 * Signed-out: Google sign-in CTA
 * ============================================================ */
function SignedOutCard({ slug, tenantName }: { slug: string; tenantName: string }) {
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
    // On success the browser is redirected — no need to clear `busy`.
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center space-y-3">
        <div className="text-5xl">🏆</div>
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          احفظ نقاطك وطلباتك
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          ادخل بـ Google لرؤية رصيد نقاطك في {tenantName}،
          مستواك، وقائمة طلباتك السابقة.
        </p>
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full h-12 rounded-2xl bg-white border-2 border-neutral-300 text-neutral-900 font-extrabold hover:border-neutral-400 disabled:opacity-60 active:translate-y-px shadow-sm flex items-center justify-center gap-2"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          <GoogleG />
          {busy ? "..." : "متابعة بحساب Google"}
        </button>

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-neutral-200" />
          <span className="text-[11px] text-neutral-400">أو</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>

        <a
          href={`/m/${slug}`}
          className="block w-full h-12 rounded-2xl bg-neutral-100 text-neutral-700 font-extrabold text-center leading-[3rem] hover:bg-neutral-200 active:translate-y-px"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          متابعة كزائر
        </a>

        <p className="text-[11px] text-neutral-500 leading-relaxed mt-1">
          ستظل نقاطك مرتبطة برقم جوالك حتى لو لم تدخل بحساب.
        </p>
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
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          تم ربط حسابك
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed">
          وجدنا {toArabicDigits(String(confirmExisting.count))} طلب سابقاً بهذا الرقم. تم ربطها بحسابك.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
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
        <h2 className="text-lg font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
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
        style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
      >
        {busy ? "..." : "ربط الحساب"}
      </button>

      <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
        لا نرسل أي رسائل ترويجية. الرقم يُستخدم فقط لمعرفة طلباتك.
      </p>
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
