"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type TierKey = "bronze" | "silver" | "gold" | "platinum";

type RewardRow = {
  id: string;
  name_ar: string;
  description_ar: string | null;
  points_cost: number;
  min_tier: TierKey;
  max_per_customer: number | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

const TIER_LABEL: Record<TierKey, string> = {
  bronze:   "🥉 برونزي",
  silver:   "🥈 فضي",
  gold:     "🥇 ذهبي",
  platinum: "💎 بلاتيني",
};

const TIER_OPTIONS: TierKey[] = ["bronze", "silver", "gold", "platinum"];

type DraftState = {
  name_ar: string;
  description_ar: string;
  points_cost: string;
  min_tier: TierKey;
  max_per_customer: string;
};

const EMPTY_DRAFT: DraftState = {
  name_ar: "",
  description_ar: "",
  points_cost: "",
  min_tier: "bronze",
  max_per_customer: "",
};

export default function RewardsEditor({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: RewardRow[];
}) {
  const [rewards, setRewards] = useState<RewardRow[]>(initial);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<DraftState>(EMPTY_DRAFT);
  const [editError, setEditError] = useState<string | null>(null);

  async function add() {
    const name = draft.name_ar.trim();
    const cost = Number(draft.points_cost);
    if (!name) { setError("اسم المكافأة مطلوب."); return; }
    if (!Number.isFinite(cost) || cost <= 0) { setError("اكتب عدد نقاط أكبر من صفر."); return; }
    setError(null);
    const sb = createClient();
    const nextSort = (rewards[rewards.length - 1]?.sort_order ?? 0) + 10;
    const { data, error: err } = await sb
      .from("loyalty_rewards")
      .insert({
        restaurant_id:    restaurantId,
        name_ar:          name,
        description_ar:   draft.description_ar.trim() || null,
        points_cost:      cost,
        min_tier:         draft.min_tier,
        max_per_customer: draft.max_per_customer.trim() ? Number(draft.max_per_customer) : null,
        active:           true,
        sort_order:       nextSort,
      })
      .select("id, name_ar, description_ar, points_cost, min_tier, max_per_customer, active, sort_order, created_at")
      .single();
    if (err) { setError(err.message); return; }
    setRewards((r) => [...r, data as RewardRow]);
    setDraft(EMPTY_DRAFT);
  }

  async function deleteReward(id: string) {
    if (!confirm("احذف هذه المكافأة؟ لن يتمكن العميل من استبدالها بعد الحذف.")) return;
    const sb = createClient();
    const { error: err } = await sb.from("loyalty_rewards").delete().eq("id", id);
    if (err) { setError(err.message); return; }
    setRewards((r) => r.filter((x) => x.id !== id));
  }

  async function toggleActive(r: RewardRow) {
    setBusyId(r.id);
    const sb = createClient();
    const { error: err } = await sb
      .from("loyalty_rewards")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (!err) setRewards((arr) => arr.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)));
    setBusyId(null);
  }

  async function swap(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= rewards.length) return;
    const a = rewards[index];
    const b = rewards[j];
    const next = [...rewards];
    next[index] = { ...b, sort_order: a.sort_order };
    next[j] = { ...a, sort_order: b.sort_order };
    setRewards(next);
    const sb = createClient();
    await Promise.all([
      sb.from("loyalty_rewards").update({ sort_order: b.sort_order }).eq("id", a.id),
      sb.from("loyalty_rewards").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  }

  function startEdit(r: RewardRow) {
    setEditingId(r.id);
    setEditState({
      name_ar: r.name_ar,
      description_ar: r.description_ar ?? "",
      points_cost: String(r.points_cost),
      min_tier: r.min_tier,
      max_per_customer: r.max_per_customer != null ? String(r.max_per_customer) : "",
    });
    setEditError(null);
  }

  async function saveEdit(r: RewardRow) {
    const name = editState.name_ar.trim();
    const cost = Number(editState.points_cost);
    if (!name) { setEditError("الاسم مطلوب."); return; }
    if (!Number.isFinite(cost) || cost <= 0) { setEditError("اكتب عدد نقاط أكبر من صفر."); return; }
    const sb = createClient();
    const { error: err } = await sb
      .from("loyalty_rewards")
      .update({
        name_ar:          name,
        description_ar:   editState.description_ar.trim() || null,
        points_cost:      cost,
        min_tier:         editState.min_tier,
        max_per_customer: editState.max_per_customer.trim() ? Number(editState.max_per_customer) : null,
      })
      .eq("id", r.id);
    if (err) { setEditError(err.message); return; }
    setRewards((arr) =>
      arr.map((x) =>
        x.id === r.id
          ? {
              ...x,
              name_ar:          name,
              description_ar:   editState.description_ar.trim() || null,
              points_cost:      cost,
              min_tier:         editState.min_tier,
              max_per_customer: editState.max_per_customer.trim() ? Number(editState.max_per_customer) : null,
            }
          : x,
      ),
    );
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          إضافة مكافأة جديدة
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={draft.name_ar}
            onChange={(e) => setDraft((d) => ({ ...d, name_ar: e.target.value }))}
            placeholder="اسم المكافأة · مثال: قهوة مجانية"
            className="h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm sm:col-span-2"
          />
          <input
            type="number" min="1"
            value={draft.points_cost}
            onChange={(e) => setDraft((d) => ({ ...d, points_cost: e.target.value }))}
            placeholder="عدد النقاط"
            className="h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={draft.min_tier}
            onChange={(e) => setDraft((d) => ({ ...d, min_tier: e.target.value as TierKey }))}
            className="h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm bg-white"
          >
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>الحد الأدنى: {TIER_LABEL[t]}</option>
            ))}
          </select>
          <input
            type="number" min="1"
            value={draft.max_per_customer}
            onChange={(e) => setDraft((d) => ({ ...d, max_per_customer: e.target.value }))}
            placeholder="حد أقصى لكل عميل (اختياري)"
            className="h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
          <input
            type="text"
            value={draft.description_ar}
            onChange={(e) => setDraft((d) => ({ ...d, description_ar: e.target.value }))}
            placeholder="وصف قصير (اختياري)"
            className="h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
          />
        </div>
        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <button
            onClick={add}
            className="h-10 px-5 rounded-xl bg-brand-primary text-white font-extrabold hover:opacity-90 active:translate-y-px"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            إضافة المكافأة
          </button>
        </div>
      </div>

      {/* List */}
      {rewards.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2">🎁</div>
          <p className="text-sm text-neutral-600">لم تضف أي مكافأة بعد. أضف واحدة من النموذج أعلاه.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r, i) => {
            const isEditing = editingId === r.id;
            return (
              <li
                key={r.id}
                className={
                  "bg-white border rounded-xl p-3 space-y-2 " +
                  (r.active ? "border-neutral-200" : "border-neutral-200 opacity-60")
                }
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editState.name_ar}
                      onChange={(e) => setEditState((s) => ({ ...s, name_ar: e.target.value }))}
                      className="w-full h-10 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    />
                    <input
                      type="text"
                      value={editState.description_ar}
                      onChange={(e) => setEditState((s) => ({ ...s, description_ar: e.target.value }))}
                      placeholder="وصف قصير (اختياري)"
                      className="w-full h-9 rounded-lg border border-neutral-200 px-3 outline-none focus:border-brand-primary text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number" min="1"
                        value={editState.points_cost}
                        onChange={(e) => setEditState((s) => ({ ...s, points_cost: e.target.value }))}
                        className="h-9 rounded-lg border border-neutral-200 px-2 outline-none focus:border-brand-primary text-sm"
                      />
                      <select
                        value={editState.min_tier}
                        onChange={(e) => setEditState((s) => ({ ...s, min_tier: e.target.value as TierKey }))}
                        className="h-9 rounded-lg border border-neutral-200 px-2 text-sm bg-white"
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t} value={t}>{TIER_LABEL[t]}</option>
                        ))}
                      </select>
                      <input
                        type="number" min="1"
                        value={editState.max_per_customer}
                        onChange={(e) => setEditState((s) => ({ ...s, max_per_customer: e.target.value }))}
                        placeholder="حد أقصى"
                        className="h-9 rounded-lg border border-neutral-200 px-2 outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    {editError && (
                      <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">{editError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(r)}
                        className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-extrabold hover:opacity-90"
                      >
                        ✓ حفظ
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-9 px-4 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-bold hover:bg-neutral-200"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shrink-0">
                      🎁
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                        {r.name_ar}
                      </div>
                      {r.description_ar && (
                        <div className="text-xs text-neutral-500 mt-0.5 leading-snug">{r.description_ar}</div>
                      )}
                      <div className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-amber-700">🏆 {r.points_cost} نقطة</span>
                        <span>· {TIER_LABEL[r.min_tier]} وأعلى</span>
                        {r.max_per_customer != null && <span>· حد أقصى {r.max_per_customer}/عميل</span>}
                        {!r.active && <span className="text-rose-700 font-bold">· موقوف</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => swap(i, -1)} disabled={i === 0}
                        className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40" title="رفع">↑</button>
                      <button onClick={() => swap(i, 1)} disabled={i === rewards.length - 1}
                        className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40" title="إنزال">↓</button>
                      <button
                        onClick={() => toggleActive(r)}
                        disabled={busyId === r.id}
                        className={
                          "h-9 px-3 rounded-lg text-xs font-extrabold " +
                          (r.active
                            ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200")
                        }
                        title={r.active ? "إيقاف" : "تفعيل"}
                      >
                        {busyId === r.id ? "..." : (r.active ? "إيقاف" : "تفعيل")}
                      </button>
                      <button onClick={() => startEdit(r)}
                        className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200" title="تعديل">✏️</button>
                      <button onClick={() => deleteReward(r.id)}
                        className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200" title="حذف">✕</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
