"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant, type CreateTenantInput, type CreateTenantResult } from "./actions";

const PLAN_AMOUNT = { yearly: 499, monthly: 59 } as const;

export default function NewTenantForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateTenantInput>({
    name: "",
    slug: "",
    whatsapp_phone: "",
    city: "الرياض",
    address_ar: "",
    owner_email: "",
    plan: "yearly",
    amount_sar: 499,
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateTenantResult | null>(null);

  const onChange =
    <K extends keyof CreateTenantInput>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value;
      setForm((f) => {
        const next = { ...f, [key]: v as any };
        // Keep amount in sync with plan switch
        if (key === "plan") {
          next.amount_sar = PLAN_AMOUNT[v as keyof typeof PLAN_AMOUNT];
        }
        return next;
      });
    };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const r = await createTenant({ ...form, amount_sar: Number(form.amount_sar) });
    setSaving(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  if (result?.ok) {
    return (
      <div className="bg-neutral-900 border border-green-800 rounded-xl p-6 space-y-4 text-neutral-100">
        <div className="text-green-300 font-bold text-lg">✓ تم إنشاء المطعم</div>
        <div className="text-sm">
          <div className="text-neutral-400">المطعم:</div>
          <div className="font-medium">{result.tenant.name} <span className="text-neutral-500 font-mono text-xs">({result.tenant.slug})</span></div>
        </div>
        <div className="rounded-md bg-neutral-950 border border-neutral-800 p-3 text-sm space-y-1" dir="ltr">
          <div className="text-neutral-500 text-xs">شارك هذه البيانات مع المالك عبر واتساب — هو يغيّر الباسوورد أول مرة يدخل:</div>
          <div><b>URL:</b> https://menulink-admin-five.vercel.app/admin/login</div>
          <div><b>Email:</b> <code className="text-amber-300">{result.owner.email}</code></div>
          <div><b>Password:</b> <code className="text-amber-300">{result.owner.password}</code></div>
        </div>
        <button
          onClick={() => {
            setResult(null);
            setForm({
              name: "", slug: "", whatsapp_phone: "", city: "الرياض",
              address_ar: "", owner_email: "", plan: "yearly", amount_sar: 499,
            });
          }}
          className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-700"
        >
          إضافة مطعم آخر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {result && !result.ok && (
        <p className="rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
          {result.error}
        </p>
      )}

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-100">المطعم</h2>
        <Field label="الاسم" value={form.name} onChange={onChange("name")} required />
        <Field
          label="الـ slug (إنجليزي — يظهر في الـ URL)"
          value={form.slug}
          onChange={onChange("slug")}
          placeholder="koko-2"
          required
        />
        <Field
          label="رقم واتساب (مع رمز الدولة، بدون +)"
          value={form.whatsapp_phone}
          onChange={onChange("whatsapp_phone")}
          placeholder="966500000000"
          required
        />
        <Field label="المدينة" value={form.city} onChange={onChange("city")} />
        <Field label="العنوان" value={form.address_ar} onChange={onChange("address_ar")} placeholder="الرياض - حي الروضة" />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-100">المالك</h2>
        <Field
          label="إيميل المالك"
          type="email"
          value={form.owner_email}
          onChange={onChange("owner_email")}
          placeholder="owner@restaurant.com"
          required
        />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-100">الاشتراك</h2>
        <label className="block">
          <span className="block text-xs text-neutral-400 mb-1">الخطة</span>
          <select
            value={form.plan}
            onChange={onChange("plan") as any}
            className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none"
          >
            <option value="yearly">سنوي — 499 ر.س</option>
            <option value="monthly">شهري — 59 ر.س</option>
          </select>
        </label>
        <Field
          label="المبلغ (ر.س)"
          type="number"
          value={String(form.amount_sar)}
          onChange={onChange("amount_sar") as any}
        />
        <p className="text-xs text-neutral-500">
          الاشتراك يُنشأ بحالة "بانتظار الدفع". بعد استلام المبلغ، سجّل دفعة من <span className="text-neutral-300">/ops/payments</span> لتفعيل المطعم.
        </p>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 font-semibold hover:bg-white disabled:opacity-60"
      >
        {saving ? "جاري الإنشاء..." : "إنشاء المطعم"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
      />
    </label>
  );
}
