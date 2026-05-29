"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Promo = {
  id: string; title_ar: string; subtitle_ar: string | null;
  description_ar: string | null; badge_text_ar: string | null; image_url: string | null;
};

export default function PromotionsRail({ slug }: { slug: string }) {
  const [promos, setPromos] = useState<Promo[]>([]);
  useEffect(() => {
    const sb = createClient();
    sb.rpc("get_active_promotions", { p_slug: slug }).then(({ data }) => {
      if (Array.isArray(data)) setPromos(data as Promo[]);
    });
  }, [slug]);

  if (promos.length === 0) return null;

  return (
    <div className="px-4 mt-4">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {promos.map((p) => (
          <div key={p.id} className="shrink-0 w-64 rounded-2xl overflow-hidden border border-[var(--card-border,rgba(0,0,0,0.06))] bg-[var(--card-bg,#fff)] shadow-sm">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt="" className="w-full h-28 object-cover" />
            ) : null}
            <div className="p-3">
              {p.badge_text_ar ? (
                <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 mb-1 bg-[var(--cta-bg,var(--brand))] text-[var(--cta-text,#fff)]">{p.badge_text_ar}</span>
              ) : null}
              <div className="font-extrabold text-[var(--ink,#18181b)] text-sm" style={{ fontFamily: "var(--font-display)" }}>{p.title_ar}</div>
              {p.subtitle_ar ? <div className="text-xs text-[var(--text-secondary,#71717a)] mt-0.5">{p.subtitle_ar}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
