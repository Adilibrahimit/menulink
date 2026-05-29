"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { generateShortCode, buildQrDestination, type QrTarget } from "@/lib/design/qr";

type Purpose = "menu" | "table" | "offer" | "category" | "item";

export async function createQrCode(input: {
  restaurantId: string;
  slug: string;
  templateId: string;
  nameAr: string;
  purpose: Purpose;
  target: string;
}): Promise<{ code?: string; error?: string }> {
  await requireOps();
  const sb = createClient();

  let qrTarget: QrTarget;
  switch (input.purpose) {
    case "menu": qrTarget = { type: "menu" }; break;
    case "table": qrTarget = { type: "table", tableLabel: input.target }; break;
    case "offer": qrTarget = { type: "offer", offerId: input.target }; break;
    case "category": qrTarget = { type: "category", categoryId: input.target }; break;
    case "item": qrTarget = { type: "item", itemId: input.target }; break;
  }
  const destination = buildQrDestination(input.slug, qrTarget);
  const code = generateShortCode();

  const { data: prof, error: e1 } = await sb
    .from("restaurant_qr_profiles")
    .insert({
      restaurant_id: input.restaurantId,
      qr_design_template_id: input.templateId,
      name_ar: input.nameAr || "رمز QR",
      purpose: input.purpose,
      status: "published",
    })
    .select("id").single();
  if (e1 || !prof) return { error: e1?.message ?? "profile insert failed" };

  const { error: e2 } = await sb.from("qr_links").insert({
    restaurant_id: input.restaurantId,
    qr_profile_id: prof.id,
    code,
    target_type: input.purpose,
    destination_url: destination,
    is_active: true,
  });
  if (e2) return { error: e2.message };

  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return { code };
}
