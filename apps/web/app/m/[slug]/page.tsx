import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import { getTheme, buildCssVars } from "@/lib/themes";
import { resolveDesignTokens } from "@/lib/design/resolver";
import type { ResolveDesignTokensInput } from "@/lib/design/resolver";
import { tokensToCssVars, googleFontsUrl } from "@/lib/design/css-vars";
import { resolveThemeLayout } from "@/lib/design/layout";
import { getDesign, cssVarsForTheme } from "@/lib/design-library";
import type { CSSProperties } from "react";
import MenuExperience from "./menu-experience";
import DisplayOnlyMenu from "./display-only-menu";
import HeritageListMenu from "./heritage-list-menu";
import PwaBootstrap from "./pwa-bootstrap";
import CustomerShell from "./customer-shell";
import type { PublicMenu, PublicMenuItem } from "./types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sb = createClient();
  const { data } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  const menu = data as PublicMenu | null;
  if (!menu) return { title: "MenuLink" };
  return {
    title: `${menu.restaurant.name} · قائمة الطعام`,
    description: menu.restaurant.tagline_ar ?? `اطلب من ${menu.restaurant.name} عبر واتساب`,
    themeColor: menu.restaurant.primary_color,
    manifest: `/m/${params.slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: menu.restaurant.name,
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function CustomerMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sb = createClient();
  const { data, error } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  if (error || !data) notFound();
  const menu = data as PublicMenu;

  // `?table=5` from the table-QR scan. Take the first value if an array
  // sneaks through (`?table=5&table=6` → "5"). Trim whitespace.
  const raw = searchParams.table;
  const rawTableLabel = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

  // Soft-degrade: if the restaurant doesn't have the tables_qr addon enabled,
  // ignore the ?table= param. Old printed QRs keep scanning to a working
  // menu — they just no longer lock dine-in. This avoids stranding tenants
  // who deactivate the service but still have physical stickers out.
  const tableLabel = rawTableLabel && (await hasAddon(menu.restaurant.id, "tables_qr"))
    ? rawTableLabel
    : null;

  // Loyalty preview: when the loyalty addon is on for this tenant AND
  // loyalty_settings.enabled is true, the cart drawer renders an "earn X
  // points" preview once the customer types a phone. Lookup happens here
  // (server) so the client doesn't round-trip on every render.
  const pushEnabled = await hasAddon(menu.restaurant.id, "push_marketing");
  const notifCenterEnabled = await hasAddon(menu.restaurant.id, "notification_center");

  const { data: branchRows } = await sb
    .from("restaurant_branches")
    .select("id, name_ar, name_en, slug, whatsapp, address_ar, lat, lng, supports_delivery, supports_pickup, supports_dine_in, supports_car, is_default")
    .eq("restaurant_id", menu.restaurant.id)
    .eq("is_active", true)
    .order("sort_order");
  const branches = branchRows ?? [];

  let loyaltyPointsPerSar: number | null = null;
  let redemptionValueSar = 0;
  if (await hasAddon(menu.restaurant.id, "loyalty")) {
    const { data: ls } = await sb
      .from("loyalty_settings")
      .select("enabled, points_per_sar, redemption_value_sar")
      .eq("restaurant_id", menu.restaurant.id)
      .maybeSingle();
    if (ls?.enabled) loyaltyPointsPerSar = Number(ls.points_per_sar);
    if (ls?.enabled) redemptionValueSar = Number(ls.redemption_value_sar) || 0;
  }

  let theme = getTheme(params.slug);
  const baseCssVars = buildCssVars(params.slug, {
    primary_color: menu.restaurant.primary_color,
    background_color: menu.restaurant.background_color,
  });

  // DS-3: apply a published design profile's palette + fonts (colors/fonts only;
  // layout/behavior stay from getTheme). Falls back to today's vars when none.
  const { data: design } = await sb.rpc("get_published_design", { p_slug: params.slug });
  let cssVars: CSSProperties = baseCssVars;
  let profileFontsUrl: string | null = null;
  if (design) {
    const d = design as { template_tokens?: unknown; profile_tokens?: unknown };
    const resolved = resolveDesignTokens({
      templateTokens: d.template_tokens as ResolveDesignTokensInput["templateTokens"],
      profileTokens: d.profile_tokens as ResolveDesignTokensInput["profileTokens"],
    });
    cssVars = { ...(baseCssVars as Record<string, string>), ...tokensToCssVars(resolved) } as CSSProperties;
    profileFontsUrl = googleFontsUrl(resolved);
  }

  // DS-3B-1: a published profile's menu-page-template can override theme layout flags.
  theme = resolveThemeLayout(theme, (design as { menu_layout_config?: unknown } | null)?.menu_layout_config);

  // DS-9: design library. If ops assigned a menu_design_key (0069), that
  // library design is authoritative — it overrides theme + tokens + fonts,
  // decoupling the design from the slug. NULL key → everything above stands,
  // so existing tenants render identically. Read uses the anon RLS policy
  // (0019); get_public_menu is untouched.
  const { data: rDesign } = await sb
    .from("restaurants")
    .select("menu_design_key, poster_hero_item_id")
    .eq("id", menu.restaurant.id)
    .maybeSingle();
  const designRow = rDesign as {
    menu_design_key?: string | null;
    poster_hero_item_id?: string | null;
  } | null;
  const libraryEntry = getDesign(designRow?.menu_design_key);
  if (libraryEntry) {
    theme = libraryEntry.theme;
    cssVars = cssVarsForTheme(libraryEntry.theme);
    profileFontsUrl = null; // fonts come from theme.fonts.googleUrl below
  }

  // Signature/hero dish for the rzrz-signature layout: the ops-pinned
  // poster_hero_item_id (DS-12, migration 0070), re-validated against the live
  // menu (same guard the print poster uses). NULL/stale → layout heuristic.
  let signatureItem: PublicMenuItem | null = null;
  if (designRow?.poster_hero_item_id) {
    for (const c of menu.categories) {
      const found = c.items.find((i) => i.id === designRow.poster_hero_item_id);
      if (found) {
        signatureItem = found;
        break;
      }
    }
  }

  if (menu.restaurant.display_only_mode) {
    const MenuComponent = theme.menuLayout === "heritage-list" ? HeritageListMenu : DisplayOnlyMenu;
    return (
      <div dir="rtl" style={cssVars} className="min-h-[100dvh]">
        {theme.fonts.googleUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={theme.fonts.googleUrl} />
        )}
        {profileFontsUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={profileFontsUrl} />
        )}
        <MenuComponent menu={menu} theme={theme} />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={cssVars}
      className="min-h-[100dvh]"
    >
      {theme.fonts.googleUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={theme.fonts.googleUrl} />
      )}
      {profileFontsUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={profileFontsUrl} />
      )}
      <CustomerShell menu={menu} tableParam={tableLabel} theme={theme} notifCenterEnabled={notifCenterEnabled}>
        <MenuExperience
          menu={menu}
          tableLabel={tableLabel}
          loyaltyPointsPerSar={loyaltyPointsPerSar}
          redemptionValueSar={redemptionValueSar}
          theme={theme}
          pushEnabled={pushEnabled}
          vapidKey={process.env.NEXT_PUBLIC_VAPID_KEY ?? ""}
          branches={branches}
          signatureItem={signatureItem}
        />
        <PwaBootstrap />
      </CustomerShell>
    </div>
  );
}
