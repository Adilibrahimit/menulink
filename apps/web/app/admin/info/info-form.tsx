"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Restaurant } from "@/lib/types";

type Editable = Pick<
  Restaurant,
  | "name"
  | "tagline_ar"
  | "whatsapp_phone"
  | "contact_email"
  | "address_ar"
  | "city"
  | "instagram_handle"
  | "tiktok_handle"
  | "logo_url"
  | "cover_image_url"
  | "primary_color"
  | "background_color"
  | "is_published"
>;

export default function InfoForm({ initial }: { initial: Restaurant }) {
  const router = useRouter();
  const [form, setForm] = useState<Editable>({
    name: initial.name,
    tagline_ar: initial.tagline_ar,
    whatsapp_phone: initial.whatsapp_phone,
    contact_email: initial.contact_email,
    address_ar: initial.address_ar,
    city: initial.city,
    instagram_handle: initial.instagram_handle,
    tiktok_handle: initial.tiktok_handle,
    logo_url: initial.logo_url,
    cover_image_url: initial.cover_image_url,
    primary_color: initial.primary_color,
    background_color: initial.background_color,
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
        <h2 className="font-semibold text-neutral-900">الأساسيات</h2>
        <Field label="اسم المطعم" value={form.name ?? ""} onChange={onChange("name")} />
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
        <h2 className="font-semibold text-neutral-900">المنصات</h2>
        <Field label="حساب إنستقرام" value={form.instagram_handle ?? ""} onChange={onChange("instagram_handle")} placeholder="@kokochicky" />
        <Field label="حساب تيك توك" value={form.tiktok_handle ?? ""} onChange={onChange("tiktok_handle")} placeholder="@kokochicky" />
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-neutral-900">الهوية البصرية</h2>
        <Field label="رابط الشعار (Logo URL)" value={form.logo_url ?? ""} onChange={onChange("logo_url")} placeholder="https://..." />
        <Field label="رابط صورة الغلاف" value={form.cover_image_url ?? ""} onChange={onChange("cover_image_url")} placeholder="https://..." />
        <div className="flex gap-3" dir="ltr">
          <ColorField label="اللون الأساسي" value={form.primary_color} onChange={onChange("primary_color")} />
          <ColorField label="لون الخلفية" value={form.background_color} onChange={onChange("background_color")} />
        </div>
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block flex-1">
      <span className="block text-xs text-neutral-600 mb-1">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-neutral-300 px-2 py-1">
        <input type="color" value={value} onChange={onChange} className="h-8 w-12 cursor-pointer" />
        <input
          type="text"
          value={value}
          onChange={onChange}
          className="flex-1 px-1 py-1 outline-none"
        />
      </div>
    </label>
  );
}
