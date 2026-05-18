import { createClient } from "@/lib/supabase-server";
import type { PublicMenu } from "../types";

// Per-tenant PWA manifest. Lets each restaurant install as its own app
// (own name, own theme color, own start_url scope). Customer "Add to Home
// Screen" produces a tile that opens straight into /m/<slug>.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const sb = createClient();
  const { data } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  if (!data) return new Response(null, { status: 404 });

  const menu = data as PublicMenu;
  const r = menu.restaurant;

  // Best effort: derive a short-name (12 char cap is browser convention).
  const shortName = r.name.length > 12 ? r.name.slice(0, 12) : r.name;

  const icons = r.logo_url
    ? [
        {
          src: r.logo_url,
          sizes: "any",
          type: "image/png",
          purpose: "any",
        },
      ]
    : [];

  const manifest = {
    name: r.name,
    short_name: shortName,
    description: r.tagline_ar ?? `قائمة ${r.name}`,
    start_url: `/m/${params.slug}`,
    scope: `/m/${params.slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: r.background_color,
    theme_color: r.primary_color,
    lang: "ar",
    dir: "rtl",
    icons,
    categories: ["food", "shopping", "lifestyle"],
  };

  return Response.json(manifest, {
    headers: {
      // 5-minute cache so price/color changes show up reasonably fast
      // without hammering Supabase on every reload.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
