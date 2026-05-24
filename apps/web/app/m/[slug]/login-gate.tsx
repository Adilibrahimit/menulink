"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/phone";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
};

export default function LoginGate({
  restaurant,
  tableParam,
  onGuest,
  googleOnly = false,
}: {
  restaurant: Restaurant;
  tableParam: string | null;
  onGuest: (phone: string, name: string) => void;
  googleOnly?: boolean;
}) {
  const [mode, setMode] = useState<"choose" | "guest">("choose");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    const sb = createClient();
    const callbackUrl = new URL(`/auth/callback`, window.location.origin);
    callbackUrl.searchParams.set("next", `/m/${restaurant.slug}${tableParam ? `?table=${tableParam}` : ""}`);

    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
  }

  function handleGuest() {
    if (!phone.trim()) return;
    const normalized = normalizePhone(phone);
    onGuest(normalized, name.trim());
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6"
      dir="rtl"
      style={{ background: "var(--bg)" }}
    >
      {/* Logo */}
      <div className="mb-6">
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-lg"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold shadow-lg"
            style={{ background: restaurant.primary_color }}
          >
            {restaurant.name.charAt(0)}
          </div>
        )}
      </div>

      <h1
        className="text-2xl font-extrabold text-neutral-900 mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {restaurant.name}
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        {googleOnly ? "سجّل بحساب Google للمتابعة" : "أهلاً بك! ادخل لتجربة أفضل"}
      </p>

      {googleOnly ? (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-white border-2 border-neutral-200 flex items-center justify-center gap-3 text-base font-bold text-neutral-800 hover:border-neutral-300 active:translate-y-px shadow-sm disabled:opacity-50"
          >
            <GoogleIcon />
            {busy ? "..." : "الدخول بحساب Google"}
          </button>

          {tableParam && (
            <p className="text-center text-xs text-neutral-400 mt-2">
              {"\u{1FA91}"} الطاولة: {tableParam}
            </p>
          )}
        </div>
      ) : mode === "choose" ? (
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full h-12 rounded-2xl bg-white border-2 border-neutral-200 flex items-center justify-center gap-3 text-sm font-bold text-neutral-800 hover:border-neutral-300 active:translate-y-px shadow-sm disabled:opacity-50"
          >
            <GoogleIcon />
            {busy ? "..." : "الدخول بحساب Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-neutral-200" />
            <span className="text-xs text-neutral-400">{"أو"}</span>
            <div className="flex-1 h-px bg-neutral-200" />
          </div>

          <button
            onClick={() => setMode("guest")}
            className="w-full h-12 rounded-2xl border-2 border-neutral-200 bg-neutral-50 text-sm font-bold text-neutral-700 hover:border-neutral-300 active:translate-y-px"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {"متابعة كزائر"}
          </button>

          {tableParam && (
            <p className="text-center text-xs text-neutral-400 mt-2">
              {"\u{1FA91}"} الطاولة: {tableParam}
            </p>
          )}
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          <p className="text-sm text-neutral-600 font-bold" style={{ fontFamily: "var(--font-display)" }}>
            {"أدخل بياناتك للمتابعة"}
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={"الاسم (اختياري)"}
            className="w-full h-11 px-4 rounded-xl border border-neutral-200 outline-none focus:border-[var(--brand)] text-sm"
          />

          <div className="flex gap-2">
            <span className="h-11 px-3 rounded-xl border border-neutral-200 flex items-center text-sm text-neutral-500 bg-neutral-50 shrink-0">
              966+
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5X XXX XXXX"
              type="tel"
              className="flex-1 h-11 px-4 rounded-xl border border-neutral-200 outline-none focus:border-[var(--brand)] text-sm"
              dir="ltr"
            />
          </div>

          <button
            onClick={handleGuest}
            disabled={!phone.trim()}
            className="w-full h-12 rounded-2xl text-white font-extrabold disabled:opacity-50 active:translate-y-px shadow-md"
            style={{ background: "var(--brand)", fontFamily: "var(--font-display)" }}
          >
            {"متابعة"}
          </button>

          <button
            onClick={() => setMode("choose")}
            className="w-full h-10 rounded-xl text-sm text-neutral-500 hover:text-neutral-700"
          >
            {"← رجوع"}
          </button>
        </div>
      )}

      {/* Terms footer */}
      <p className="mt-8 text-[11px] text-neutral-400 text-center leading-snug max-w-xs">
        {"بالمتابعة أنت توافق على"}{" "}
        <a href={`/m/${restaurant.slug}/terms`} className="underline">
          {"الشروط والأحكام"}
        </a>{" "}
        {"و"}{" "}
        <a href={`/m/${restaurant.slug}/privacy`} className="underline">
          {"سياسة الخصوصية"}
        </a>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
