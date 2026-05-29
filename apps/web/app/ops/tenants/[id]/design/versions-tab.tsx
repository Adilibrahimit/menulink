"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type ProfileRow = {
  id: string; status: string; version_number: number;
  updated_at: string; published_at: string | null;
  brand_template_id: string | null; menu_page_template_id: string | null;
  brand_tokens_json: unknown; menu_tokens_json: unknown;
  brand: { name_ar: string } | null;
  page: { name_ar: string } | null;
};

const STATUS_AR: Record<string, string> = { draft: "مسودة", published: "منشور", archived: "مؤرشف" };

export default function VersionsTab({
  restaurantId, profiles,
}: { restaurantId: string; profiles: ProfileRow[] }) {
  const router = useRouter();
  const sb = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function publish(id: string) {
    setBusy(id); setMsg(null);
    const { error } = await sb.rpc("publish_design_profile", { p_profile_id: id });
    setBusy(null);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم النشر ✓" });
    router.refresh();
  }

  async function duplicate(p: ProfileRow) {
    setBusy(p.id); setMsg(null);
    const { error } = await sb.from("restaurant_design_profiles").insert({
      restaurant_id: restaurantId,
      brand_template_id: p.brand_template_id,
      menu_page_template_id: p.menu_page_template_id,
      brand_tokens_json: p.brand_tokens_json ?? {},
      menu_tokens_json: p.menu_tokens_json ?? {},
      status: "draft",
    });
    setBusy(null);
    if (error) { setMsg({ kind: "err", text: error.message }); return; }
    setMsg({ kind: "ok", text: "تم إنشاء مسودة جديدة ✓" });
    router.refresh();
  }

  if (profiles.length === 0) {
    return <p className="text-sm text-neutral-500">لا توجد ملفات تصميم بعد. أنشئ مسودة من تبويب الهوية البصرية.</p>;
  }

  return (
    <div className="space-y-3">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-500 text-xs text-right border-b border-neutral-800">
              <th className="py-2 px-2">الإصدار</th>
              <th className="py-2 px-2">الحالة</th>
              <th className="py-2 px-2">الهوية</th>
              <th className="py-2 px-2">قالب القائمة</th>
              <th className="py-2 px-2">آخر تحديث</th>
              <th className="py-2 px-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-neutral-900">
                <td className="py-2 px-2">v{p.version_number}</td>
                <td className="py-2 px-2">{STATUS_AR[p.status] ?? p.status}</td>
                <td className="py-2 px-2">{p.brand?.name_ar ?? "—"}</td>
                <td className="py-2 px-2">{p.page?.name_ar ?? "—"}</td>
                <td className="py-2 px-2 text-neutral-500 text-xs">
                  {new Date(p.updated_at).toLocaleDateString("ar-SA")}
                </td>
                <td className="py-2 px-2">
                  <div className="flex gap-2">
                    {p.status !== "published" && (
                      <button onClick={() => publish(p.id)} disabled={busy === p.id}
                        className="text-xs rounded bg-neutral-100 text-neutral-900 px-2 py-1 font-semibold hover:bg-white disabled:opacity-60">
                        نشر
                      </button>
                    )}
                    <button onClick={() => duplicate(p)} disabled={busy === p.id}
                      className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">
                      نسخ كمسودة
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
