"use server";

import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function recordQrExport(input: {
  restaurantId: string;
  slug: string;
  qrLinkId: string;
  pngDataUrl: string;
}): Promise<{ error?: string }> {
  await requireOps();

  const base64 = input.pngDataUrl.split(",")[1] ?? "";
  if (!base64) return { error: "صورة غير صالحة" };

  const sb = createClient();
  const { data: fp } = await sb.rpc("get_export_fingerprint", { p_slug: input.slug });
  const fingerprint = typeof fp === "string" ? fp : "";

  const admin = adminClient();
  const buffer = Buffer.from(base64, "base64");
  const path = `exports/${input.restaurantId}/qr/${input.qrLinkId}-${Date.now()}.png`;
  const up = await admin.storage
    .from("menu-images")
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  if (up.error) return { error: up.error.message };

  const { data: pub } = admin.storage.from("menu-images").getPublicUrl(path);

  const { error } = await admin.from("qr_exports").insert({
    restaurant_id: input.restaurantId,
    qr_link_id: input.qrLinkId,
    export_type: "png",
    file_url: pub.publicUrl,
    data_hash: fingerprint,
    status: "rendered",
    rendered_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/ops/tenants/${input.restaurantId}/design`);
  return {};
}
