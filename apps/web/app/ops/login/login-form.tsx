"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("الإيميل أو كلمة المرور غير صحيحة.");
      return;
    }
    router.replace("/ops");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" dir="ltr">
      {error && (
        <p className="rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
          {error}
        </p>
      )}
      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1 text-right" dir="rtl">
          البريد الإلكتروني
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
        />
      </label>
      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1 text-right" dir="rtl">
          كلمة المرور
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-neutral-100 text-neutral-900 py-2 font-semibold hover:bg-white disabled:opacity-60"
      >
        {loading ? "..." : "دخول"}
      </button>
    </form>
  );
}
