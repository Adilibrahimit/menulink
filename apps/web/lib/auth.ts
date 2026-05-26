import { redirect } from "next/navigation";
import { createClient } from "./supabase-server";

export type AuthedUser = {
  id: string;
  email: string;
  role: "restaurant_owner" | "restaurant_admin" | "platform_admin" | null;
  restaurant_id: string | null;
  team_role: string | null;
};

// Read the current user from cookies. Returns null if not signed in.
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const sb = createClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  const meta = (data.user.app_metadata ?? {}) as {
    role?: string;
    restaurant_id?: string;
    team_role?: string;
  };
  const role =
    meta.role === "platform_admin" || meta.role === "restaurant_owner" || meta.role === "restaurant_admin"
      ? meta.role
      : null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    role,
    restaurant_id: meta.restaurant_id ?? null,
    team_role: meta.team_role ?? null,
  };
}

// Guard for /admin/* routes — redirects to /admin/login if no session,
// to /ops if the user is platform_admin (their dashboard is /ops),
// or to login with error if missing tenant linkage.
export async function requireOwner(): Promise<AuthedUser & { restaurant_id: string }> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (u.role === "platform_admin") redirect("/ops");
  if (u.role !== "restaurant_owner" || !u.restaurant_id) {
    redirect("/admin/login?error=unauthorized");
  }
  return u as AuthedUser & { restaurant_id: string };
}

// Guard for /admin/* routes — accepts both owners and team admins.
export async function requireAdmin(): Promise<AuthedUser & { restaurant_id: string }> {
  const u = await getCurrentUser();
  if (!u) redirect("/admin/login");
  if (u.role === "platform_admin") redirect("/ops");
  if ((u.role !== "restaurant_owner" && u.role !== "restaurant_admin") || !u.restaurant_id) {
    redirect("/admin/login?error=unauthorized");
  }
  return u as AuthedUser & { restaurant_id: string };
}

// Guard for /ops/* routes — only platform admins.
export async function requireOps(): Promise<AuthedUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/ops/login");
  if (u.role === "restaurant_owner") redirect("/admin");
  if (u.role !== "platform_admin") redirect("/ops/login?error=unauthorized");
  return u;
}
