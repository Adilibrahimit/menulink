"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

export async function createPromotion(input: {
  restaurantId: string; titleAr: string; subtitleAr: string; badgeTextAr: string;
  imageUrl: string; priority: number; startsAt: string; endsAt: string;
}): Promise<{ error?: string }> {
  await requireOps();
  if (!input.titleAr.trim()) return { error: "العنوان مطلوب" };
  const sb = createClient();
  const { error } = await sb.from("promotions").insert({
    restaurant_id: input.restaurantId,
    title_ar: input.titleAr.trim(),
    subtitle_ar: input.subtitleAr || null,
    badge_text_ar: input.badgeTextAr || null,
    image_url: input.imageUrl || null,
    priority: Number.isFinite(input.priority) ? input.priority : 0,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    is_active: true,
    show_on_menu_home: true,
  });
  if (error) return { error: error.message };
  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return {};
}

export async function setPromotionActive(input: { restaurantId: string; id: string; active: boolean }): Promise<{ error?: string }> {
  await requireOps();
  const sb = createClient();
  const { error } = await sb.from("promotions").update({ is_active: input.active }).eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return {};
}

export async function deletePromotion(input: { restaurantId: string; id: string }): Promise<{ error?: string }> {
  await requireOps();
  const sb = createClient();
  const { error } = await sb.from("promotions").delete().eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return {};
}
