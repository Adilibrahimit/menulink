"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { adminClient } from "@/lib/supabase-admin";

const VALID_ROLES = ["branch_manager", "cashier", "accountant", "viewer"] as const;
type TeamRole = (typeof VALID_ROLES)[number];

export type AddMemberInput = {
  email: string;
  password: string;
  role: TeamRole;
  branch_ids: string[];
};

export type EditMemberInput = {
  admin_id: string;
  role: TeamRole;
  is_active: boolean;
  branch_ids: string[];
};

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type AddMemberResult =
  | { ok: true; generated_password: string; admin: { admin_id: string; user_id: string; email: string; role: string; is_active: boolean; created_at: string; branch_ids: string[] } }
  | { ok: false; error: string };

function isValidRole(r: string): r is TeamRole {
  return (VALID_ROLES as readonly string[]).includes(r);
}

export async function addTeamMember(input: AddMemberInput): Promise<AddMemberResult> {
  const me = await requireOwner();
  if (!input.email?.includes("@")) return { ok: false, error: "إيميل غير صحيح" };
  if (!isValidRole(input.role)) return { ok: false, error: "دور غير صحيح" };

  const password = input.password?.trim() || generatePassword();
  if (password.length < 6) return { ok: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };

  const sb = adminClient();

  let userId: string;
  let isExisting = false;

  const { data: newUser, error: uErr } = await sb.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });

  if (uErr) {
    if (!uErr.message?.includes("already been registered")) {
      return { ok: false, error: `فشل إنشاء الحساب: ${uErr.message}` };
    }
    // User exists — paginate listUsers to find them
    let foundId: string | null = null;
    let page = 1;
    while (!foundId) {
      const { data: pageData } = await sb.auth.admin.listUsers({ page, perPage: 50 });
      if (!pageData?.users?.length) break;
      const match = pageData.users.find(
        (u) => u.email?.toLowerCase() === input.email.toLowerCase()
      );
      if (match) { foundId = match.id; break; }
      if (pageData.users.length < 50) break;
      page++;
    }
    if (!foundId) {
      return { ok: false, error: "فشل البحث عن المستخدم الموجود" };
    }
    userId = foundId;
    isExisting = true;

    const { data: existingAdmin } = await sb
      .from("restaurant_admins")
      .select("id")
      .eq("user_id", userId)
      .eq("restaurant_id", me.restaurant_id)
      .maybeSingle();

    if (existingAdmin) {
      return { ok: false, error: "هذا المستخدم مضاف بالفعل لفريق المطعم" };
    }
  } else {
    userId = newUser.user!.id;
  }

  // Insert into restaurant_admins
  const { data: admin, error: aErr } = await sb
    .from("restaurant_admins")
    .insert({
      user_id: userId,
      restaurant_id: me.restaurant_id,
      role: input.role,
    })
    .select("id")
    .single();

  if (aErr || !admin) {
    return { ok: false, error: `فشل إضافة العضو: ${aErr?.message ?? "unknown"}` };
  }

  // Insert branch access
  if (input.branch_ids.length > 0) {
    await sb.from("restaurant_admin_branch_access").insert(
      input.branch_ids.map((bid) => ({ admin_id: admin.id, branch_id: bid }))
    );
  }

  revalidatePath("/admin/team");
  return {
    ok: true,
    generated_password: isExisting ? "(حساب موجود)" : password,
    admin: {
      admin_id: admin.id,
      user_id: userId,
      email: input.email,
      role: input.role,
      is_active: true,
      created_at: new Date().toISOString(),
      branch_ids: input.branch_ids,
    },
  };
}

export async function editTeamMember(input: EditMemberInput): Promise<ActionResult> {
  const me = await requireOwner();
  if (!isValidRole(input.role)) return { ok: false, error: "دور غير صحيح" };

  const sb = adminClient();

  // Verify this admin belongs to this restaurant
  const { data: admin } = await sb
    .from("restaurant_admins")
    .select("id, role")
    .eq("id", input.admin_id)
    .eq("restaurant_id", me.restaurant_id)
    .single();

  if (!admin) return { ok: false, error: "العضو غير موجود" };
  if (admin.role === "owner") return { ok: false, error: "لا يمكن تعديل صلاحيات المالك" };

  // Update role + active status
  const { error: uErr } = await sb
    .from("restaurant_admins")
    .update({ role: input.role, is_active: input.is_active })
    .eq("id", input.admin_id);

  if (uErr) return { ok: false, error: uErr.message };

  // Replace branch access
  await sb
    .from("restaurant_admin_branch_access")
    .delete()
    .eq("admin_id", input.admin_id);

  if (input.branch_ids.length > 0) {
    await sb.from("restaurant_admin_branch_access").insert(
      input.branch_ids.map((bid) => ({ admin_id: input.admin_id, branch_id: bid }))
    );
  }

  revalidatePath("/admin/team");
  return { ok: true };
}

export async function removeTeamMember(adminId: string): Promise<ActionResult> {
  const me = await requireOwner();
  const sb = adminClient();

  const { data: admin } = await sb
    .from("restaurant_admins")
    .select("id, role")
    .eq("id", adminId)
    .eq("restaurant_id", me.restaurant_id)
    .single();

  if (!admin) return { ok: false, error: "العضو غير موجود" };
  if (admin.role === "owner") return { ok: false, error: "لا يمكن حذف المالك" };

  // Cascade handles branch_access
  const { error } = await sb
    .from("restaurant_admins")
    .delete()
    .eq("id", adminId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/team");
  return { ok: true };
}

function generatePassword(): string {
  const adj = ["Bright", "Swift", "Crisp", "Bold", "Clean", "Sharp"];
  const noun = ["Menu", "Order", "Plate", "Spice", "Table", "Tray"];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${n}!`;
}
