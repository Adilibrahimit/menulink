"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Restaurant } from "@/lib/types";

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
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logo_url);
  const [coverUrl, setCoverUrl] = useState<string | null>(initial.cover_image_url);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
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

  async function uploadBrandAsset(kind: "logo" | "cover", file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ kind: "err", text: "حجم الصورة أكبر من 5 ميغا" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMsg({ kind: "err", text: "الملف يجب أن يكون صورة" });
      return;
    }
    setUploading(kind);
    setMsg(null);
    const sb = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${initial.id}/_brand/${kind}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("menu-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(null);
      setMsg({ kind: "err", text: upErr.message });
      return;
    }
    const { data: pub } = sb.storage.from("menu-images").getPublicUrl(path);
    const column = kind === "logo" ? "logo_url" : "cover_image_url";
    const { error: updErr } = await sb
      .from("restaurants")
      .update({ [column]: pub.publicUrl })
      .eq("id", initial.id);
    setUploading(null);
    if (updErr) {
      setMsg({ kind: "err", text: updErr.message });
      return;
    }
    if (kind === "logo") setLogoUrl(pub.publicUrl);
    else setCoverUrl(pub.publicUrl);
    setMsg({ kind: "ok", text: kind === "logo" ? "الشعار محدّث ✓" : "صورة الغلاف محدّثة ✓" });
    router.refresh();
  }

  async function clearBrandAsset(kind: "logo" | "cover") {
    if (!window.confirm(kind === "logo" ? "إزالة الشعار؟" : "إزالة صورة الغلاف؟")) return;
    const sb = createClient();
    const column = kind === "logo" ? "logo_url" : "cover_image_url";
    const { error } = await sb
      .from("restaurants")
      .update({ [column]: null })
      .eq("id", initial.id);
    if (error) {
      setMsg({ kind: "err", text: error.message });
      return;
    }
    if (kind === "logo") setLogoUrl(null);
    else setCoverUrl(null);
    setMsg({ kind: "ok", text: "تمت الإزالة" });
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

      <section className="bg-white border border-neutral-200 rounded-xl p-4 space-y-4">
        <h2 className="font-semibold text-neutral-900">الهوية البصرية</h2>

        <AssetUploader
          label="الشعار (Logo)"
          currentUrl={logoUrl}
          previewClass="w-16 h-16 rounded-xl"
          busy={uploading === "logo"}
          onPick={(f) => uploadBrandAsset("logo", f)}
          onClear={() => clearBrandAsset("logo")}
        />

        <AssetUploader
          label="صورة الغلاف (Cover)"
          currentUrl={coverUrl}
          previewClass="w-full h-24 rounded-lg"
          busy={uploading === "cover"}
          onPick={(f) => uploadBrandAsset("cover", f)}
          onClear={() => clearBrandAsset("cover")}
        />

        <div className="flex items-center gap-3 text-sm pt-3 border-t border-neutral-100">
          <Swatch color={initial.primary_color} label="اللون الأساسي" />
          <Swatch color={initial.background_color} label="لون الخلفية" />
          <span className="text-[10px] text-neutral-500 mr-auto">الألوان: تواصل مع MenuLink</span>
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

function AssetUploader({
  label,
  currentUrl,
  previewClass,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  currentUrl: string | null;
  previewClass: string;
  busy: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <span className="block text-xs text-neutral-600">{label}</span>
      <div className="flex items-center gap-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className={`${previewClass} object-cover bg-neutral-100 border border-neutral-200 shrink-0`}
          />
        ) : (
          <div
            className={`${previewClass} bg-neutral-50 border border-dashed border-neutral-300 flex items-center justify-center text-xl text-neutral-400 shrink-0`}
          >
            📷
          </div>
        )}
        <div className="flex flex-col gap-1.5 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md bg-neutral-100 hover:bg-neutral-200 text-sm px-3 py-1.5 w-fit disabled:opacity-50"
          >
            {busy ? "جاري الرفع..." : currentUrl ? "استبدال" : "رفع صورة"}
          </button>
          {currentUrl && !busy && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-700 hover:underline w-fit"
            >
              إزالة
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-neutral-500">حد أقصى ٥ ميغا · jpg / png / webp</p>
    </div>
  );
}
