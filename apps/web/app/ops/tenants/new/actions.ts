"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase-admin";
import { requireOps } from "@/lib/auth";

export type CreateTenantInput = {
  name: string;
  slug: string;
  whatsapp_phone: string;
  city: string;
  address_ar: string;
  owner_email: string;
  plan: "monthly" | "yearly";
  amount_sar: number;
};

export type CreateTenantResult = {
  ok: true;
  tenant: { id: string; name: string; slug: string };
  owner: { email: string; password: string };
} | { ok: false; error: string };

// Generates a memorable password for new tenant owners. Ops shares it
// out-of-band (WhatsApp/SMS) — the owner can rotate it after first login.
function generatePassword(): string {
  const adj = ["Bright", "Swift", "Crisp", "Bold", "Clean", "Sharp"];
  const noun = ["Menu", "Order", "Plate", "Spice", "Table", "Tray"];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${n}!`;
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  await requireOps();

  // Validate
  if (!input.name?.trim()) return { ok: false, error: "اسم المطعم مطلوب" };
  if (!/^[a-z0-9-]{3,32}$/.test(input.slug)) {
    return { ok: false, error: "الـ slug يجب أن يكون بأحرف إنجليزية صغيرة وأرقام وشرطات (3-32 حرف)" };
  }
  if (!/^\+?\d{8,15}$/.test(input.whatsapp_phone.replace(/\s/g, ""))) {
    return { ok: false, error: "رقم واتساب غير صحيح" };
  }
  if (!input.owner_email?.includes("@")) {
    return { ok: false, error: "إيميل المالك غير صحيح" };
  }
  if (!Number.isFinite(input.amount_sar) || input.amount_sar < 0) {
    return { ok: false, error: "المبلغ غير صحيح" };
  }

  const admin = adminClient();          // service_role
  const userPassword = generatePassword();

  // 1) Create the restaurant row. Use service_role (admin) so ops onboarding
  //    never depends on RLS being correctly configured for the calling ops
  //    user — the requireOps() gate above is the authorization boundary.
  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .insert({
      slug: input.slug,
      name: input.name,
      whatsapp_phone: input.whatsapp_phone.replace(/\s/g, ""),
      city: input.city || "الرياض",
      address_ar: input.address_ar || null,
      plan: input.plan,
      is_active: true,
      is_published: false,        // owner publishes after editing menu
    })
    .select("id, name, slug")
    .single();

  if (rErr || !restaurant) {
    return { ok: false, error: `فشل إنشاء المطعم: ${rErr?.message ?? "unknown"}` };
  }

  // 2) Create the owner auth user (service_role required)
  const { data: userResult, error: uErr } = await admin.auth.admin.createUser({
    email: input.owner_email,
    password: userPassword,
    email_confirm: true,
    user_metadata: { display_name: `${input.name} Owner` },
  });

  if (uErr || !userResult.user) {
    // Rollback the restaurant insert
    await admin.from("restaurants").delete().eq("id", restaurant.id);
    return { ok: false, error: `فشل إنشاء حساب المالك: ${uErr?.message ?? "unknown"}` };
  }

  // 3) Link them — trigger writes restaurant_id claim to JWT app_metadata
  const { error: linkErr } = await admin
    .from("restaurant_owners")
    .insert({ user_id: userResult.user.id, restaurant_id: restaurant.id, role: "owner" });

  if (linkErr) {
    // Best-effort rollback
    await admin.auth.admin.deleteUser(userResult.user.id);
    await admin.from("restaurants").delete().eq("id", restaurant.id);
    return { ok: false, error: `فشل ربط المالك: ${linkErr.message}` };
  }

  // 4) Create the subscription (pending_payment until ops logs first payment)
  const { error: subErr } = await admin
    .from("subscriptions")
    .insert({
      restaurant_id: restaurant.id,
      plan: input.plan,
      status: "pending_payment",
      amount_sar: input.amount_sar,
    });

  if (subErr) {
    return { ok: false, error: `المطعم والحساب أُنشئا، لكن فشل الاشتراك: ${subErr.message}` };
  }

  revalidatePath("/ops");
  return {
    ok: true,
    tenant: restaurant,
    owner: { email: input.owner_email, password: userPassword },
  };
}
