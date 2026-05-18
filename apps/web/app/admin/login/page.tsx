import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const u = await getCurrentUser();
  if (u?.role === "restaurant_owner" && u.restaurant_id) redirect("/admin");
  if (u?.role === "platform_admin") redirect("/ops");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-brand-bg">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-brand-primary mb-1">MenuLink</h1>
        <p className="text-sm text-neutral-500 mb-6">دخول مالك المطعم</p>

        {searchParams.error === "unauthorized" && (
          <p className="mb-4 rounded-md bg-red-50 text-red-700 text-sm p-3">
            هذا الحساب غير مرتبط بأي مطعم. اتصل بمشغّل المنصة.
          </p>
        )}
        {searchParams.error === "invalid" && (
          <p className="mb-4 rounded-md bg-red-50 text-red-700 text-sm p-3">
            الإيميل أو كلمة المرور غير صحيحة.
          </p>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
