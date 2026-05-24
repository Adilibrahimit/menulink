"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function ProfileClient({
  slug,
  restaurantId,
  customerId,
  initialName,
  initialPhone,
  initialEmail,
  initialBirthday,
}: {
  slug: string;
  restaurantId: string;
  customerId: string;
  initialName: string;
  initialPhone: string;
  initialEmail: string;
  initialBirthday: string;
}) {
  const [name, setName] = useState(initialName);
  const [email] = useState(initialEmail);
  const [birthday, setBirthday] = useState(initialBirthday);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = name !== initialName || birthday !== initialBirthday;

  async function save() {
    setSaving(true);
    setError(null);
    const sb = createClient();
    const { error: err } = await sb
      .from("customers")
      .update({
        name: name.trim() || null,
        birthday: birthday || null,
      })
      .eq("id", customerId);

    if (err) {
      setError("حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
      setSaving(false);
      return;
    }
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function deleteAccount() {
    setDeleting(true);
    const sb = createClient();
    const { error: err } = await sb
      .from("customers")
      .update({
        deleted_at: new Date().toISOString(),
        name: null,
        phone: `deleted_${customerId.slice(0, 8)}`,
        email: null,
        birthday: null,
      })
      .eq("id", customerId);

    if (err) {
      setError("حدث خطأ أثناء حذف الحساب.");
      setDeleting(false);
      return;
    }
    await sb.auth.signOut();
    window.location.href = `/m/${slug}`;
  }

  return (
    <main className="px-4 py-5 space-y-4">
      {/* Name */}
      <Field label="الاسم">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-12 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-base"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          placeholder="اكتب اسمك"
        />
      </Field>

      {/* Phone (read-only) */}
      <Field label="رقم الجوال">
        <input
          type="tel"
          value={initialPhone}
          readOnly
          dir="ltr"
          className="w-full h-12 rounded-xl border border-neutral-200 px-3 text-base bg-neutral-50 text-neutral-500 cursor-not-allowed"
        />
        <p className="text-[11px] text-neutral-400 mt-1">لا يمكن تغيير رقم الجوال</p>
      </Field>

      {/* Email (read-only from Google) */}
      <Field label="البريد الإلكتروني">
        <input
          type="email"
          value={email}
          readOnly
          dir="ltr"
          className="w-full h-12 rounded-xl border border-neutral-200 px-3 text-base bg-neutral-50 text-neutral-500 cursor-not-allowed"
        />
        <p className="text-[11px] text-neutral-400 mt-1">مرتبط بحساب Google</p>
      </Field>

      {/* Birthday */}
      <Field label="تاريخ الميلاد">
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full h-12 rounded-xl border border-neutral-200 px-3 outline-none focus:border-[var(--brand)] text-base"
          dir="ltr"
        />
      </Field>

      {/* Save button */}
      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          ✅ تم الحفظ بنجاح
        </p>
      )}
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold disabled:opacity-40 active:translate-y-px shadow-md"
        style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
      >
        {saving ? "..." : "حفظ التغييرات"}
      </button>

      {/* Delete account */}
      <div className="pt-6 border-t border-neutral-200">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full h-12 rounded-2xl bg-white border-2 border-red-200 text-red-700 font-bold hover:bg-red-50 active:translate-y-px"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            حذف حسابي
          </button>
        ) : (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-red-900 font-bold text-center" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              هل أنت متأكد من حذف حسابك؟
            </p>
            <p className="text-[11px] text-red-700 text-center leading-relaxed">
              سيتم حذف بياناتك الشخصية (الاسم، الجوال، البريد). لن تتمكن من استعادة نقاطك أو سجل طلباتك.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-10 rounded-xl bg-white border border-neutral-200 text-neutral-700 text-sm font-bold"
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
              >
                إلغاء
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
              >
                {deleting ? "..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-sm font-bold text-neutral-700 mb-1.5"
        style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
