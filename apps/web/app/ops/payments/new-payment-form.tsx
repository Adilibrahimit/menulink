"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type TenantOption = {
  restaurant_id: string;
  name: string;
  slug: string;
  subscription_id: string | null;
  amount_sar: number | null;
};

export default function NewPaymentForm({
  tenants,
  defaultTenantId,
}: {
  tenants: TenantOption[];
  defaultTenantId?: string;
}) {
  const router = useRouter();
  const defaultTenant = tenants.find((t) => t.restaurant_id === defaultTenantId) ?? tenants[0];

  const [subscriptionId, setSubscriptionId] = useState<string | null>(defaultTenant?.subscription_id ?? null);
  const [amount, setAmount] = useState<string>(String(defaultTenant?.amount_sar ?? 499));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onTenantChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = tenants.find((x) => x.restaurant_id === e.target.value);
    setSubscriptionId(t?.subscription_id ?? null);
    setAmount(String(t?.amount_sar ?? 499));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!subscriptionId) {
      setMsg({ kind: "err", text: "هذا المطعم بدون اشتراك. عدّل ملفه أولاً." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const sb = createClient();
    const { error } = await sb.from("payments").insert({
      subscription_id: subscriptionId,
      amount_sar: Number(amount),
      method,
      reference: reference || null,
      notes: notes || null,
      paid_at: new Date(paidAt).toISOString(),
    });
    setSaving(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setMsg({ kind: "ok", text: "تم تسجيل الدفعة وتفعيل الاشتراك ✓" });
    setReference("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {msg && (
        <p
          className={`rounded-md text-sm p-3 ${
            msg.kind === "ok"
              ? "bg-green-900/40 border border-green-800 text-green-300"
              : "bg-red-900/40 border border-red-800 text-red-300"
          }`}
        >
          {msg.text}
        </p>
      )}
      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">المطعم</span>
        <select
          defaultValue={defaultTenant?.restaurant_id}
          onChange={onTenantChange}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
        >
          {tenants.map((t) => (
            <option key={t.restaurant_id} value={t.restaurant_id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-neutral-400 mb-1">المبلغ (ر.س)</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-400 mb-1">طريقة الدفع</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
          >
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="mada">مدى</option>
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="manual">يدوي</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-neutral-400 mb-1">تاريخ الدفع</span>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-neutral-400 mb-1">مرجع (اختياري)</span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="رقم التحويل / آخر 4 أرقام / إلخ"
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">ملاحظات (اختياري)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 font-semibold hover:bg-white disabled:opacity-60"
      >
        {saving ? "جاري الحفظ..." : "تسجيل الدفعة"}
      </button>
    </form>
  );
}
