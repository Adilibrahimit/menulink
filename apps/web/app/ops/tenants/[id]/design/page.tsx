import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import OverviewTab from "./overview-tab";
import BrandIdentityTab from "./brand-identity-tab";
import MenuPageTab from "./menu-page-tab";
import VersionsTab from "./versions-tab";
import QrTab from "./qr-tab";
import PromosTab from "./promos-tab";
import OutputsTab from "./outputs-tab";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "brand", label: "الهوية البصرية" },
  { key: "menu", label: "قالب القائمة" },
  { key: "versions", label: "الإصدارات" },
  { key: "qr", label: "رموز QR" },
  { key: "promos", label: "العروض" },
  { key: "outputs", label: "المخرجات" },
] as const;

export default async function DesignStudioPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  await requireOps();
  const sb = createClient();
  const active = TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "overview";

  const [{ data: r }, { data: profiles }, { data: brandTemplates }, { data: pageTemplates }, { data: qrProfiles }, { data: qrTemplates }, { data: promotions }, { data: qrExports }] =
    await Promise.all([
      sb.from("restaurants")
        .select("id, slug, name, logo_url, cover_image_url, primary_color, background_color, tagline_ar, poster_hero_item_id, poster_offer_item_id")
        .eq("id", params.id).single(),
      sb.from("restaurant_design_profiles")
        .select("*, brand:brand_identity_templates(key,name_ar), page:menu_page_templates(key,name_ar)")
        .eq("restaurant_id", params.id)
        .order("updated_at", { ascending: false }),
      sb.from("brand_identity_templates")
        .select("id, key, name_ar, name_en, tier, business_type, default_tokens_json")
        .eq("is_active", true).order("tier", { ascending: true }),
      sb.from("menu_page_templates")
        .select("id, key, name_ar, layout_type, supported_business_types")
        .eq("is_active", true).order("key", { ascending: true }),
      sb.from("restaurant_qr_profiles")
        .select("id, name_ar, purpose, links:qr_links(id, code, target_type, is_active)")
        .eq("restaurant_id", params.id)
        .order("created_at", { ascending: false }),
      sb.from("qr_design_templates")
        .select("id, key, name_ar")
        .eq("is_active", true).order("key", { ascending: true }),
      sb.from("promotions")
        .select("id, title_ar, subtitle_ar, badge_text_ar, priority, is_active, show_on_menu_home, starts_at, ends_at")
        .eq("restaurant_id", params.id)
        .order("priority", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("qr_exports")
        .select("id, qr_link_id, file_url, data_hash, status, rendered_at")
        .eq("restaurant_id", params.id)
        .order("rendered_at", { ascending: false }),
    ]);

  if (!r) notFound();
  const { data: fingerprint } = await sb.rpc("get_export_fingerprint", { p_slug: r.slug });

  // Poster hero/offer pickers (DS-12) list photo-bearing items only — same
  // get_public_menu source the poster renders from, so options always match.
  const { data: menuData } = await sb.rpc("get_public_menu", { p_slug: r.slug });
  const posterItems = (((menuData as { categories?: any[] } | null)?.categories) ?? [])
    .flatMap((c: any) =>
      (c.items ?? [])
        .filter((it: any) => it.image_url)
        .map((it: any) => ({ id: it.id as string, name_ar: it.name_ar as string, category_ar: c.name_ar as string })),
    );
  const rows = profiles ?? [];
  const draft = rows.find((p: any) => p.status === "draft") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/ops/tenants/${r.id}`} className="text-xs text-neutral-400 hover:text-neutral-200">
          ← {r.name}
        </Link>
        <h1 className="text-xl font-bold mt-1">استوديو التصميم</h1>
        <p className="text-xs text-neutral-400 font-mono">{r.slug}</p>
      </div>

      <nav className="flex gap-1 border-b border-neutral-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/ops/tenants/${r.id}/design?tab=${t.key}`}
            className={`px-3 py-2 text-sm rounded-t-md ${
              active === t.key
                ? "bg-neutral-900 border border-b-0 border-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div>
        {active === "overview" && <OverviewTab tenantId={r.id} profiles={rows as any} />}
        {active === "brand" && (
          <BrandIdentityTab
            restaurant={r as any}
            draft={draft as any}
            brandTemplates={(brandTemplates ?? []) as any}
          />
        )}
        {active === "menu" && (
          <MenuPageTab draft={draft as any} pageTemplates={(pageTemplates ?? []) as any} />
        )}
        {active === "versions" && <VersionsTab restaurantId={r.id} profiles={rows as any} />}
        {active === "qr" && (
          <QrTab restaurant={r as any} templates={(qrTemplates ?? []) as any} qrProfiles={(qrProfiles ?? []) as any} qrExports={(qrExports ?? []) as any} fingerprint={(fingerprint as string) ?? ""} />
        )}
        {active === "promos" && <PromosTab restaurantId={r.id} promotions={(promotions ?? []) as any} />}
        {active === "outputs" && (
          <OutputsTab
            tenantId={r.id}
            slug={r.slug}
            heroItemId={(r as any).poster_hero_item_id ?? null}
            offerItemId={(r as any).poster_offer_item_id ?? null}
            posterItems={posterItems}
          />
        )}
      </div>
    </div>
  );
}
