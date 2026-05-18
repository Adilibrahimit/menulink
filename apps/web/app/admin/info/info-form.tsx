"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Restaurant } from "@/lib/types";

// Owner-editable fields ONLY. The visual-identity columns
// (logo_url, cover_image_url, primary_color, background_color, slug, name)
// belong to MenuLink design/ops and are changed from /ops/tenants/[id].
type Editable = Pick<
  Restaurant,
  | "tagline_ar"
  | "whatsapp_phone"
  | "contact_email"
  | "address_ar"
  | "city"
  | "instagram_handle"
  | "tiktok_handle"
  | "is_published"
>;

export default function InfoForm({ initial }: { initial: Restaurant }) {
  const router = useRouter();
  const [form, setForm] = useState<Editable>({
    tagline_ar: initial.tagline_ar,
    whatsapp_phone: initial.whatsapp_phone,
    contact_email: initial.contact_email,
    address_ar: initial.address_ar,
    city: initial.city,
    instagram_handle: initial.instagram_handle,
    tiktok_handle: initial.tiktok_handle,
    is_published: initial.is_published,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const onChange = <K extends keyof Editable>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((f) => ({ ...f, [key]: v as Editable[K] }));
    };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const sb = createClient();
    const { error } = await sb.from("restaurants").update(form).eq("id", initial.id);
    setSaving(false);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    setMsg({ kind: "ok", text: "تم الحفظ ✓" });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {msg && (
        <p
          className={`rounded-md text-sm p-3 ${
            msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-900">معلومات تشغيلية</h2>
        <ReadOnly label="اسم المطعم" value={initial.name} />
        <Field label="الشعار (Tagline)" value={form.tagline_ar ?? ""} onChange={onChange("tagline_ar")} />
        <Field label="رقم واتساب (بدون +)" value={form.whatsapp_phone ?? ""} onChange={onChange("whatsapp_phone")} placeholder="966500000000" />
        <Field label="إيميل التواصل" value={form.contact_email ?? ""} onChange={onChange("contact_email")} type="email" />
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-900">العنوان</h2>
        <Field label="المدينة" value={form.city ?? ""} onChange={onChange("city")} />
        <Field label="العنوان (الحي · الشارع)" value={form.address_ar ?? ""} onChange={onChange("address_ar")} />
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-900">منصات التواصل</h2>
        <Field label="حساب إنستقرام" value={form.instagram_handle ?? ""} onChange={onChange("instagram_handle")} placeholder="@kokochicky" />
        <Field label="حساب تيك توك" value={form.tiktok_handle ?? ""} onChange={onChange("tiktok_handle")} placeholder="@kokochicky" />
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-neutral-900">الهوية البصرية</h2>
          <span className="text-[10px] text-neutral-500 mt-1">للتعديل تواصل مع MenuLink</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Swatch color={initial.primary_color} label="اللون الأساسي" />
          <Swatch color={initial.background_color} label="لون الخلفية" />
        </div>
        {initial.logo_url && (
          <div className="text-xs text-neutral-600">
            <span className="text-neutral-500">الشعار:</span>{" "}
            <a href={initial.logo_url} target="_blank" rel="noreferrer" className="text-brand-primary underline">
              عرض
            </a>
          </div>
        )}
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl p-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="font-semibold">منشور (Live للعملاء)</div>
            <div className="text-xs text-neutral-500">
              إيقاف هذا الخيار يخفي القائمة من العملاء فوراً.
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!form.is_published}
            onChange={onChange("is_published")}
            className="h-5 w-5"
          />
        </label>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-brand-primary text-white px-4 py-2 font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
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
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-600 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-brand-primary"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="block">
      <span className="block text-xs text-neutral-600 mb-1">{label}</span>
      <div className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700">
        {value || "—"}
      </div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-7 h-7 rounded-md border border-neutral-300"
        style={{ background: color }}
      />
      <div>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-xs font-mono">{color}</div>
      </div>
    </div>
  );
}
