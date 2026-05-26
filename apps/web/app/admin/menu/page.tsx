import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import MenuEditor from "./menu-editor";
import type { Category, MenuItem, Variant } from "@/lib/types";

export type CategoryWithItems = Category & {
  items: (MenuItem & { variants: Variant[] })[];
};

export default async function MenuPage() {
  const me = await requireAdmin();
  const sb = createClient();

  // Server-side data fetch — RLS auto-scopes to the owner's restaurant.
  const [{ data: categories }, { data: items }, { data: variants }] = await Promise.all([
    sb.from("menu_categories").select("*").eq("restaurant_id", me.restaurant_id).order("sort"),
    sb.from("menu_items").select("*").eq("restaurant_id", me.restaurant_id).order("sort"),
    sb.from("menu_item_variants").select("*").order("sort"),
  ]);

  const byCategory: CategoryWithItems[] = (categories ?? []).map((c: any) => ({
    ...c,
    items: (items ?? [])
      .filter((it: any) => it.category_id === c.id)
      .map((it: any) => ({
        ...it,
        variants: (variants ?? []).filter((v: any) => v.menu_item_id === it.id),
      })),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">القائمة</h1>
      <p className="text-sm text-neutral-500">
        أي تعديل ينطبق فوراً على صفحة العميل. الأسعار بالريال السعودي.
      </p>
      <MenuEditor restaurantId={me.restaurant_id} initial={byCategory} />
    </div>
  );
}
