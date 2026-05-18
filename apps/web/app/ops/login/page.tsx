import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function OpsLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const u = await getCurrentUser();
  if (u?.role === "platform_admin") redirect("/ops");
  if (u?.role === "restaurant_owner") redirect("/admin");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-neutral-950">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-8 text-neutral-100">
        <h1 className="text-2xl font-bold mb-1">MenuLink · Ops</h1>
        <p className="text-sm text-neutral-400 mb-6">دخول مشغّل المنصة</p>

        {searchParams.error === "unauthorized" && (
          <p className="mb-4 rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
            هذا الحساب ليس لديه صلاحيات Ops.
          </p>
        )}
        {searchParams.error === "invalid" && (
          <p className="mb-4 rounded-md bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
            الإيميل أو كلمة المرور غير صحيحة.
          </p>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
