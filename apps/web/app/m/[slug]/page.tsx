import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import MenuExperience from "./menu-experience";
import PwaBootstrap from "./pwa-bootstrap";
import type { PublicMenu } from "./types";

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
  const tableLabel = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

  const cssVars = {
    "--brand": menu.restaurant.primary_color,
    "--bg": menu.restaurant.background_color || "#fff8f6",
    "--ink": "#29170f",
    "--accent-gold": "#fdc415",
  } as React.CSSProperties;

  return (
    <div
      dir="rtl"
      style={cssVars}
      className="min-h-[100dvh]"
    >
      <MenuExperience menu={menu} tableLabel={tableLabel} />
      <PwaBootstrap />
    </div>
  );
}
