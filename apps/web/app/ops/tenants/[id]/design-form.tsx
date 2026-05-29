"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { DESIGN_LIBRARY } from "@/lib/design-library";

type DesignFields = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string;
  background_color: string;
  menu_design_key: string | null;
  display_only_mode: boolean;
};

export default function DesignForm({ initial }: { initial: DesignFields }) {
  const router = useRouter();
  const sb = createClient();
  const [form, setForm] = useState({
    name: initial.name,
    slug: initial.slug,
    logo_url: initial.logo_url ?? "",
    cover_image_url: initial.cover_image_url ?? "",
    primary_color: initial.primary_color,
    background_color: initial.background_color,
    menu_design_key: initial.menu_design_key ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (form.slug !== initial.slug) {
      if (!window.confirm("تغيير الـ slug يكسر روابط القائمة المحفوظة عند العملاء. تأكيد؟")) return;
    }

    setSaving(true);
    const { error } = await sb
      .from("restaurants")
      .update({
        name: form.name,
        slug: form.slug,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        primary_color: form.primary_color,
        background_color: form.background_color,
        menu_design_key: form.menu_design_key || null,
      })
      .eq("id", initial.id);
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
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // Random suffix so caches don't serve the old image after a re-upload
    const path = `${initial.id}/_brand/${kind}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await sb.storage
      .from("menu-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setMsg({ kind: "err", text: upErr.message });
      return;
    }
    const { data: pub } = sb.storage.from("menu-images").getPublicUrl(path);
    const column = kind === "logo" ? "logo_url" : "cover_image_url";
    const { error: updErr } = await sb
      .from("restaurants")
      .update({ [column]: pub.publicUrl })
      .eq("id", initial.id);
    if (updErr) {
      setMsg({ kind: "err", text: updErr.message });
      return;
    }
    setForm((f) => ({ ...f, [column === "logo_url" ? "logo_url" : "cover_image_url"]: pub.publicUrl }));
    setMsg({ kind: "ok", text: `${kind === "logo" ? "الشعار" : "صورة الغلاف"} محدّث` });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Slug (يظهر في URL)" value={form.slug} onChange={(v) => set("slug", v)} />
      </div>

      <AssetUploader
        label="الشعار (Logo)"
        currentUrl={form.logo_url}
        previewSize="w-16 h-16 rounded-xl"
        onPick={(f) => uploadBrandAsset("logo", f)}
        onClear={() => set("logo_url", "")}
      />

      <AssetUploader
        label="صورة الغلاف (Cover)"
        currentUrl={form.cover_image_url}
        previewSize="w-full h-24 rounded-lg"
        onPick={(f) => uploadBrandAsset("cover", f)}
        onClear={() => set("cover_image_url", "")}
      />

      <div className="grid grid-cols-2 gap-3" dir="ltr">
        <ColorField label="Primary color" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
        <ColorField label="Background color" value={form.background_color} onChange={(v) => set("background_color", v)} />
      </div>

      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">تصميم القائمة (Design Library)</span>
        <select
          value={form.menu_design_key}
          onChange={(e) => set("menu_design_key", e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
        >
          <option value="">افتراضي (حسب إعداد العميل)</option>
          {DESIGN_LIBRARY.map((d) => {
            // Ordering layouts (premium-epicurean) are incompatible with
            // display-only tenants — those render via DisplayOnlyMenu, so a
            // dark ordering design would produce a broken page. Disable it.
            const incompatible = initial.display_only_mode && d.theme.menuLayout === "premium-epicurean";
            return (
              <option key={d.key} value={d.key} disabled={incompatible}>
                {d.name_ar}
                {incompatible ? " (غير متاح لوضع العرض فقط)" : ""}
              </option>
            );
          })}
        </select>
        <p className="text-[10px] text-neutral-600 mt-1">
          يطبّق تصميماً جاهزاً من المكتبة على قائمة العميل. «افتراضي» = السلوك الحالي حسب العميل.
        </p>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60"
      >
        {saving ? "جاري الحفظ..." : "حفظ التصميم"}
      </button>
    </form>
  );
}

function AssetUploader({
  label,
  currentUrl,
  previewSize,
  onPick,
  onClear,
}: {
  label: string;
  currentUrl: string;
  previewSize: string;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-neutral-400">{label}</span>
      <div className="flex items-center gap-3">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className={`${previewSize} object-cover bg-neutral-800 border border-neutral-700 shrink-0`}
          />
        ) : (
          <div
            className={`${previewSize} bg-neutral-800 border border-dashed border-neutral-700 flex items-center justify-center text-xl text-neutral-500 shrink-0`}
          >
            📷
          </div>
        )}
        <div className="flex flex-col gap-2 flex-1">
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
            className="rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-1.5 text-xs hover:bg-neutral-700 w-fit"
          >
            {currentUrl ? "استبدال" : "رفع صورة"}
          </button>
          {currentUrl && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-neutral-500 hover:text-red-400 w-fit"
            >
              إزالة
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-neutral-600">حد أقصى 5 ميغا · jpg / png / webp</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1">{label}</span>
      <div className="flex items-center gap-2 rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-neutral-100 px-1 py-1 outline-none font-mono text-sm"
        />
      </div>
    </label>
  );
}
