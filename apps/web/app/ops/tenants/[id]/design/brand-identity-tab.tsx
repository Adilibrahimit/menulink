"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { prefillBrandTokens } from "@/lib/design/prefill";
import { resolveDesignTokens } from "@/lib/design/resolver";
import type { DesignTokens } from "@/lib/design/types";

type BrandTemplate = {
  id: string; key: string; name_ar: string; name_en: string | null;
  tier: string; default_tokens_json: DesignTokens;
};
type Restaurant = {
  id: string; primary_color: string | null; background_color: string | null;
};
type Draft = {
  id: string; brand_template_id: string | null;
  brand_tokens_json: Partial<DesignTokens>;
} | null;

const COLOR_KEYS = ["background", "surface", "primary", "accent", "text", "muted"] as const;

export default function BrandIdentityTab({
  restaurant, draft, brandTemplates,
}: { restaurant: Restaurant; draft: Draft; brandTemplates: BrandTemplate[] }) {
  const router = useRouter();
  const sb = createClient();

  const [templateId, setTemplateId] = useState<string>(
    draft?.brand_template_id ?? brandTemplates[0]?.id ?? "",
  );
  const selected = useMemo(
    () => brandTemplates.find((t) => t.id === templateId) ?? null,
    [brandTemplates, templateId],
  );

  const seed = (): DesignTokens =>
    prefillBrandTokens(selected?.default_tokens_json, {
      primary_color: restaurant.primary_color,
      background_color: restaurant.background_color,
    });

  const [tokens, setTokens] = useState<DesignTokens>(
    draft?.brand_tokens_json && Object.keys(draft.brand_tokens_json).length
      ? (draft.brand_tokens_json as DesignTokens)
      : seed(),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const preview = resolveDesignTokens({
    templateTokens: selected?.default_tokens_json,
    profileTokens: tokens,
  });

  function setColor(key: string, value: string) {
    setTokens((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  }
  function resetFromLive() {
    setTokens(seed());
    setMsg({ kind: "ok", text: "تمت إعادة التهيئة من الهوية الحالية" });
  }

  async function persist(publish: boolean) {
    setBusy(true); setMsg(null);
    try {
      let profileId = draft?.id ?? null;
      if (profileId) {
        const { error } = await sb.from("restaurant_design_profiles")
          .update({ brand_template_id: templateId || null, brand_tokens_json: tokens })
          .eq("id", profileId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("restaurant_design_profiles")
          .insert({ restaurant_id: restaurant.id, brand_template_id: templateId || null, brand_tokens_json: tokens, status: "draft" })
          .select("id").single();
        if (error) throw error;
        profileId = data.id;
      }
      if (publish) {
        const { error } = await sb.rpc("publish_design_profile", { p_profile_id: profileId });
        if (error) throw error;
      }
      setMsg({ kind: "ok", text: publish ? "تم النشر ✓" : "تم حفظ المسودة ✓" });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "خطأ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}

      <p className="text-xs text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-md p-2">
        هذه المسودة لا تؤثر على صفحة العميل الحالية حتى يتم ربطها في DS-3.
      </p>

      <label className="block">
        <span className="block text-xs text-neutral-400 mb-1">قالب الهوية</span>
        <select
          value={templateId}
          onChange={(e) => { setTemplateId(e.target.value); }}
          className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400"
        >
          {brandTemplates.map((t) => (
            <option key={t.id} value={t.id}>{t.name_ar} · {t.tier}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" dir="ltr">
        {COLOR_KEYS.map((k) => (
          <label key={k} className="block">
            <span className="block text-xs text-neutral-400 mb-1">{k}</span>
            <div className="flex items-center gap-2 rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1">
              <input type="color" value={(preview.colors as any)[k] ?? "#000000"}
                onChange={(e) => setColor(k, e.target.value)}
                className="h-8 w-10 cursor-pointer bg-transparent" />
              <input type="text" value={(tokens.colors as any)[k] ?? ""}
                onChange={(e) => setColor(k, e.target.value)}
                placeholder="(من القالب)"
                className="flex-1 bg-transparent text-neutral-100 px-1 py-1 outline-none font-mono text-xs" />
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-800 p-4" style={{ background: preview.colors.background }}>
        <div className="text-xs mb-2" style={{ color: preview.colors.muted }}>معاينة</div>
        <div className="rounded-lg p-3" style={{ background: preview.colors.surface }}>
          <div style={{ color: preview.colors.text, fontWeight: 700 }}>عنوان تجريبي</div>
          <button className="mt-2 px-3 py-1.5 text-sm rounded-md"
            style={{ background: preview.colors.primary, color: "#fff",
                     borderRadius: preview.radius?.button ?? "12px" }}>
            زر
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => persist(false)} disabled={busy}
          className="rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-60">
          {busy ? "..." : "حفظ كمسودة"}
        </button>
        <button onClick={() => persist(true)} disabled={busy}
          className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
          نشر
        </button>
        <button onClick={resetFromLive} type="button"
          className="text-xs text-neutral-500 hover:text-neutral-300 self-center">
          إعادة التهيئة من الهوية الحالية
        </button>
      </div>
    </div>
  );
}
