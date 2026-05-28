"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type PageTemplate = {
  id: string; key: string; name_ar: string;
  layout_type: string; supported_business_types: string[];
};
type Draft = { id: string; menu_page_template_id: string | null } | null;

export default function MenuPageTab({
  draft, pageTemplates,
}: { draft: Draft; pageTemplates: PageTemplate[] }) {
  const router = useRouter();
  const sb = createClient();
  const [sel, setSel] = useState<string>(draft?.menu_page_template_id ?? pageTemplates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    if (!draft) {
      setMsg({ kind: "err", text: "أنشئ مسودة من تبويب الهوية البصرية أولاً." });
      return;
    }
    setBusy(true); setMsg(null);
    const { error } = await sb.from("restaurant_design_profiles")
      .update({ menu_page_template_id: sel || null }).eq("id", draft.id);
    setBusy(false);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم الحفظ ✓" });
    router.refresh();
  }

  const current = pageTemplates.find((t) => t.id === sel) ?? null;

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}
      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">قالب صفحة القائمة</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
          {pageTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name_ar} · {t.layout_type}</option>
          ))}
        </select>
      </label>
      {current && (
        <p className="text-xs text-neutral-500">
          الأنواع المدعومة: {current.supported_business_types.join("، ")}
        </p>
      )}
      <button onClick={save} disabled={busy}
        className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
        {busy ? "..." : "حفظ"}
      </button>
    </div>
  );
}
