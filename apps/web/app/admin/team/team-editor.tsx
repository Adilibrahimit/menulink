"use client";

import { useState } from "react";
import { addTeamMember, editTeamMember, removeTeamMember } from "./actions";

type AdminRow = {
  admin_id: string;
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  branch_ids: string[];
};

type BranchRow = {
  id: string;
  name_ar: string;
  is_active: boolean;
};

type Props = {
  restaurantId: string;
  initialAdmins: AdminRow[];
  branches: BranchRow[];
};

const ROLES = [
  { value: "owner", label: "مالك" },
  { value: "branch_manager", label: "مدير فرع" },
  { value: "cashier", label: "كاشير" },
  { value: "accountant", label: "محاسب" },
  { value: "viewer", label: "مشاهد فقط" },
] as const;

type EditableRole = "branch_manager" | "cashier" | "accountant" | "viewer";

const EMPTY_FORM = {
  email: "",
  password: "",
  role: "branch_manager" as EditableRole,
  branch_ids: [] as string[],
};

type FormState = typeof EMPTY_FORM;

export default function TeamEditor({ initialAdmins, branches }: Props) {
  const [admins, setAdmins] = useState<AdminRow[]>(initialAdmins);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: AdminRow) {
    setEditingId(a.admin_id);
    setForm({
      email: a.email,
      password: "",
      role: a.role as EditableRole,
      branch_ids: a.branch_ids ?? [],
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function toggleBranch(branchId: string) {
    setForm((f) => ({
      ...f,
      branch_ids: f.branch_ids.includes(branchId)
        ? f.branch_ids.filter((id) => id !== branchId)
        : [...f.branch_ids, branchId],
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);

    if (editingId) {
      const existing = admins.find((a) => a.admin_id === editingId);
      const result = await editTeamMember({
        admin_id: editingId,
        role: form.role,
        is_active: existing?.is_active ?? true,
        branch_ids: form.branch_ids,
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setAdmins((arr) =>
        arr.map((a) =>
          a.admin_id === editingId
            ? { ...a, role: form.role, branch_ids: form.branch_ids }
            : a
        )
      );
    } else {
      if (!form.email.includes("@")) {
        setError("إيميل غير صحيح");
        setSaving(false);
        return;
      }
      const result = await addTeamMember({
        email: form.email,
        password: form.password,
        role: form.role,
        branch_ids: form.branch_ids,
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setAdmins((arr) => [...arr, result.admin]);
      if (result.generated_password !== "(حساب موجود)") {
        setShowPassword(result.generated_password);
      }
    }

    setSaving(false);
    closeForm();
  }

  async function toggleActive(a: AdminRow) {
    if (a.role === "owner") return;
    const result = await editTeamMember({
      admin_id: a.admin_id,
      role: a.role as EditableRole,
      is_active: !a.is_active,
      branch_ids: a.branch_ids,
    });
    if (!result.ok) return;
    setAdmins((arr) =>
      arr.map((x) =>
        x.admin_id === a.admin_id ? { ...x, is_active: !x.is_active } : x
      )
    );
  }

  async function deleteMember(a: AdminRow) {
    if (a.role === "owner") return;
    if (!confirm(`حذف "${a.email}" من الفريق؟`)) return;
    const result = await removeTeamMember(a.admin_id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setAdmins((arr) => arr.filter((x) => x.admin_id !== a.admin_id));
  }

  function roleLabel(role: string) {
    return ROLES.find((r) => r.value === role)?.label ?? role;
  }

  function roleBadgeColor(role: string) {
    switch (role) {
      case "owner":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "branch_manager":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "cashier":
        return "bg-green-50 text-green-700 border-green-200";
      case "accountant":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-neutral-50 text-neutral-600 border-neutral-200";
    }
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name_ar ?? id;
  }

  return (
    <div className="space-y-4">
      <button
        onClick={openAdd}
        className="h-11 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
      >
        + إضافة عضو
      </button>

      {admins.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 text-center">
          <div className="text-3xl mb-2">👥</div>
          <p className="text-sm text-neutral-600">لا يوجد أعضاء فريق بعد.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {admins.map((a) => (
            <li
              key={a.admin_id}
              className={
                "bg-white border rounded-xl p-4 space-y-2 " +
                (a.is_active
                  ? "border-neutral-200"
                  : "border-neutral-200 opacity-60")
              }
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" dir="ltr">
                      {a.email}
                    </span>
                    <span
                      className={
                        "text-[10px] border rounded-full px-2 py-0.5 font-bold " +
                        roleBadgeColor(a.role)
                      }
                    >
                      {roleLabel(a.role)}
                    </span>
                    {!a.is_active && (
                      <span className="text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200 rounded-full px-2 py-0.5">
                        معطّل
                      </span>
                    )}
                  </div>
                  {a.branch_ids && a.branch_ids.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {a.branch_ids.map((bid) => (
                        <span
                          key={bid}
                          className="text-[10px] bg-brand-primary/5 text-brand-primary border border-brand-primary/20 rounded-full px-2 py-0.5"
                        >
                          {branchName(bid)}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.role === "owner" && (
                    <p className="text-[10px] text-neutral-400 mt-1">
                      المالك — صلاحيات كاملة
                    </p>
                  )}
                </div>
                {a.role !== "owner" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(a)}
                      className="h-9 px-3 rounded-lg bg-neutral-100 text-neutral-700 text-xs font-semibold hover:bg-neutral-200"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => toggleActive(a)}
                      className={
                        "h-9 px-3 rounded-lg text-xs font-semibold " +
                        (a.is_active
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100")
                      }
                    >
                      {a.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                    <button
                      onClick={() => deleteMember(a)}
                      className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Password reveal dialog */}
      {showPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4"
            dir="rtl"
          >
            <h3 className="text-lg font-bold">تم إضافة العضو</h3>
            <p className="text-sm text-neutral-600">
              شارك كلمة المرور مع العضو الجديد (واتساب/SMS):
            </p>
            <div
              className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-center font-mono text-lg select-all"
              dir="ltr"
            >
              {showPassword}
            </div>
            <p className="text-[10px] text-neutral-400">
              تسجيل دخول الموظفين سيُفعّل في تحديث قادم.
            </p>
            <button
              onClick={() => setShowPassword(null)}
              className="w-full px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:opacity-90"
            >
              تم
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="p-5 border-b border-neutral-100">
              <h3 className="text-lg font-bold">
                {editingId ? "تعديل العضو" : "إضافة عضو جديد"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Email */}
              {!editingId && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    البريد الإلكتروني *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    dir="ltr"
                    placeholder="staff@example.com"
                  />
                </div>
              )}
              {editingId && (
                <div className="text-sm text-neutral-500" dir="ltr">
                  {form.email}
                </div>
              )}

              {/* Password (add only) */}
              {!editingId && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    كلمة المرور (اختياري — تُولّد تلقائياً)
                  </label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm font-mono"
                    dir="ltr"
                    placeholder="تُولّد تلقائياً إذا تركتها فارغة"
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الدور *
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value as EditableRole,
                    }))
                  }
                  className="w-full h-11 rounded-xl border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm bg-white"
                >
                  <option value="branch_manager">مدير فرع</option>
                  <option value="cashier">كاشير</option>
                  <option value="accountant">محاسب</option>
                  <option value="viewer">مشاهد فقط</option>
                </select>
              </div>

              {/* Branch access */}
              {branches.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-2">
                    صلاحية الفروع
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {branches.map((b) => (
                      <label
                        key={b.id}
                        className={
                          "flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors " +
                          (form.branch_ids.includes(b.id)
                            ? "border-brand-primary bg-brand-primary/5"
                            : "border-neutral-200 hover:border-neutral-300")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={form.branch_ids.includes(b.id)}
                          onChange={() => toggleBranch(b.id)}
                          className="accent-brand-primary"
                        />
                        <span className="text-sm">{b.name_ar}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    بدون تحديد = لا صلاحية على أي فرع (المالك يرى الكل تلقائياً)
                  </p>
                </div>
              )}

              {error && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="p-4 border-t border-neutral-100 flex gap-2">
              <button
                onClick={closeForm}
                className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold hover:bg-neutral-50"
              >
                إلغاء
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saving
                  ? "جاري الحفظ..."
                  : editingId
                    ? "حفظ التعديلات"
                    : "إضافة العضو"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
