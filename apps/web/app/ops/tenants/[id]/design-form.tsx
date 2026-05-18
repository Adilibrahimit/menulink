"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type DesignFields = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string;
  background_color: string;
};

export default function DesignForm({ initial }: { initial: DesignFields }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial.name,
    slug: initial.slug,
    logo_url: initial.logo_url ?? "",
    cover_image_url: initial.cover_image_url ?? "",
    primary_color: initial.primary_color,
    background_color: initial.background_color,
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
    const sb = createClient();
    const { error } = await sb
      .from("restaurants")
      .update({
        name: form.name,
        slug: form.slug,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        primary_color: form.primary_color,
        background_color: form.background_color,
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Slug (يظهر في URL)" value={form.slug} onChange={(v) => set("slug", v)} />
      </div>

      <Field label="رابط الشعار (Logo URL)" value={form.logo_url} onChange={(v) => set("logo_url", v)} placeholder="https://..." />
      <Field label="رابط صورة الغلاف" value={form.cover_image_url} onChange={(v) => set("cover_image_url", v)} placeholder="https://..." />

      <div className="grid grid-cols-2 gap-3" dir="ltr">
        <ColorField label="Primary color" value={form.primary_color} onChange={(v) => set("primary_color", v)} />
        <ColorField label="Background color" value={form.background_color} onChange={(v) => set("background_color", v)} />
      </div>

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
