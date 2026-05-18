"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTenant, type CreateTenantInput, type CreateTenantResult } from "./actions";

const PLAN_AMOUNT = { yearly: 499, monthly: 59 } as const;

export default function NewTenantForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateTenantInput>({
    name: "",
    slug: "",
    whatsapp_phone: "",
    city: "الرياض",
    address_ar: "",
    owner_email: "",
    plan: "yearly",
    amount_sar: 499,
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateTenantResult | null>(null);

  function set<K extends keyof CreateTenantInput>(key: K, value: CreateTenantInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setPlan(plan: "yearly" | "monthly") {
    setForm((f) => ({ ...f, plan, amount_sar: PLAN_AMOUNT[plan] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const r = await createTenant({ ...form, amount_sar: Number(form.amount_sar) });
    setSaving(false);
    setResult(r);
    if (r.ok) router.refresh();
  }

  if (result?.ok) {
    return (
      <SuccessCard
        tenant={result.tenant}
        owner={result.owner}
        onReset={() => {
          setResult(null);
          setForm({
            name: "", slug: "", whatsapp_phone: "", city: "الرياض",
            address_ar: "", owner_email: "", plan: "yearly", amount_sar: 499,
          });
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {result && !result.ok && (
        <p className="rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-sm p-3">
          {result.error}
        </p>
      )}

      {/* Card 1 — Restaurant */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <SectionTitle>معلومات المطعم</SectionTitle>
        <Field
          label="الاسم"
          required
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="مطعم الكبسة الذهبية"
        />
        <Field
          label="Slug (يظهر في URL)"
          required
          mono
          value={form.slug}
          onChange={(v) => set("slug", v.toLowerCase())}
          placeholder="kabsa-gold"
          helper="حروف إنجليزية صغيرة + شرطات · مثال: koko, burger-house"
        />
        <Field
          label="رقم واتساب"
          required
          mono
          value={form.whatsapp_phone}
          onChange={(v) => set("whatsapp_phone", v)}
          placeholder="966512345678"
          helper="بدون + — مع رمز الدولة"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="المدينة" value={form.city} onChange={(v) => set("city", v)} />
          <Field
            label="العنوان"
            value={form.address_ar}
            onChange={(v) => set("address_ar", v)}
            placeholder="حي الروضة"
          />
        </div>
      </section>

      {/* Card 2 — Owner */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <SectionTitle>المالك</SectionTitle>
        <Field
          label="إيميل المالك"
          required
          type="email"
          value={form.owner_email}
          onChange={(v) => set("owner_email", v)}
          placeholder="owner@kabsa.sa"
        />
        <div className="flex items-start gap-2 text-xs text-neutral-400 leading-relaxed">
          <KeyIcon className="text-neutral-500 mt-0.5 shrink-0" />
          <span>
            كلمة مرور توقّتية تُولّد تلقائياً وتظهر بعد الإنشاء — تشاركها مع المالك على واتساب،
            وهو يغيّرها بعد أول دخول.
          </span>
        </div>
      </section>

      {/* Card 3 — Subscription */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <SectionTitle>الاشتراك</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PlanCard
            selected={form.plan === "yearly"}
            onClick={() => setPlan("yearly")}
            title="سنوي"
            price="٤٩٩"
            suffix="ر.س / سنة"
            footnote="وفّر ٢٠٩ ر.س"
            footnoteColor="text-green-400"
            badge="الأكثر طلباً"
          />
          <PlanCard
            selected={form.plan === "monthly"}
            onClick={() => setPlan("monthly")}
            title="شهري"
            price="٥٩"
            suffix="ر.س / شهر"
            footnote="إلغاء في أي وقت"
            footnoteColor="text-neutral-400"
          />
        </div>
        <Field
          label="المبلغ (ر.س)"
          type="number"
          mono
          value={String(form.amount_sar)}
          onChange={(v) => set("amount_sar", Number(v) as any)}
          helper="(اختياري — لخصم خاص)"
        />
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          الاشتراك يبدأ بحالة "بانتظار الدفع". بعد استلام المبلغ، سجّل دفعة من{" "}
          <span className="text-neutral-300">/ops/payments</span> لتفعيل المطعم.
        </p>
      </section>

      {/* Footer action */}
      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={saving}
          className={
            "w-full h-11 rounded-md font-semibold text-sm transition active:translate-y-px " +
            (saving
              ? "bg-neutral-300 text-neutral-900 animate-pulse"
              : "bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-60")
          }
        >
          {saving ? "جاري الإنشاء..." : "إنشاء المطعم"}
        </button>
        <p className="text-center text-[11px] text-neutral-500">
          بعد الإنشاء ستحصل على كلمة مرور — احفظها فوراً.
        </p>
      </div>
    </form>
  );
}

/* ---------------- success ---------------- */

function SuccessCard({
  tenant,
  owner,
  onReset,
}: {
  tenant: { id: string; name: string; slug: string };
  owner: { email: string; password: string };
  onReset: () => void;
}) {
  const ADMIN_URL = "https://menulink-admin-five.vercel.app/admin/login";
  const [copiedRow, setCopiedRow] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function copyRow(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedRow(key);
    setTimeout(() => setCopiedRow(null), 1600);
  }

  async function copyAll() {
    const text =
      `MenuLink · ${tenant.name}\n` +
      `URL:      ${ADMIN_URL}\n` +
      `Email:    ${owner.email}\n` +
      `Password: ${owner.password}`;
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <CheckIcon />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-neutral-100">تم إنشاء المطعم</h2>
          <p className="text-sm text-neutral-400">
            {tenant.name}{" "}
            <span className="font-mono text-xs text-neutral-500">({tenant.slug})</span>
          </p>
        </div>
      </header>

      {/* Credentials box */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
        <div className="text-[11px] text-neutral-500 tracking-wider font-medium uppercase mb-1">
          شارك هذه البيانات مع المالك على واتساب
        </div>
        <CredentialRow
          keyName="url"
          label="الرابط"
          value={ADMIN_URL}
          onCopy={() => copyRow("url", ADMIN_URL)}
          copied={copiedRow === "url"}
          mono
        />
        <CredentialRow
          keyName="email"
          label="الإيميل"
          value={owner.email}
          onCopy={() => copyRow("email", owner.email)}
          copied={copiedRow === "email"}
        />
        <CredentialRow
          keyName="password"
          label="كلمة المرور"
          value={owner.password}
          onCopy={() => copyRow("password", owner.password)}
          copied={copiedRow === "password"}
          mono
          highlighted
        />
        <p className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-800 mt-2">
          كلمة المرور لن تظهر مرة ثانية. انسخها الآن.
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={copyAll}
          className="w-full h-11 rounded-md bg-neutral-100 text-neutral-900 font-semibold text-sm hover:bg-white active:translate-y-px"
        >
          {copiedAll ? "تم النسخ ✓" : "نسخ كل البيانات"}
        </button>
        <div className="flex justify-between text-xs">
          <button
            onClick={onReset}
            className="text-neutral-400 hover:text-neutral-100"
          >
            ← إضافة مطعم آخر
          </button>
          <Link href="/ops" className="text-neutral-400 hover:text-neutral-100">
            العودة لقائمة المطاعم
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- atoms ---------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-neutral-100">{children}</h2>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helper,
  required = false,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-400 mb-1.5">
        {label}
        {required && <span className="text-neutral-600 mr-1">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={
          "w-full h-10 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-100 px-3 outline-none focus:border-neutral-100 transition-colors placeholder:text-neutral-600 " +
          (mono ? "font-mono text-sm tracking-tight" : "text-sm")
        }
        dir={mono ? "ltr" : undefined}
      />
      {helper && (
        <span className="block text-[11px] text-neutral-500 mt-1.5">{helper}</span>
      )}
    </label>
  );
}

function PlanCard({
  selected,
  onClick,
  title,
  price,
  suffix,
  footnote,
  footnoteColor,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  price: string;
  suffix: string;
  footnote: string;
  footnoteColor: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative text-right rounded-xl bg-neutral-900 p-5 transition " +
        (selected
          ? "ring-1 ring-neutral-100 border border-neutral-100"
          : "border border-neutral-800 hover:border-neutral-700")
      }
    >
      {badge && (
        <span className="absolute top-3 left-3 text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-full bg-green-500/25 text-green-300">
          {badge}
        </span>
      )}
      <div className="text-xs text-neutral-400 mb-1">{title}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-3xl font-bold text-neutral-100"
          style={{ fontFamily: "Tajawal, sans-serif" }}
        >
          {price}
        </span>
        <span className="text-[11px] text-neutral-400">{suffix}</span>
      </div>
      <div className={`text-[10px] mt-1 ${footnoteColor}`}>{footnote}</div>
    </button>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
  copied,
  mono = false,
  highlighted = false,
}: {
  keyName: string;
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <button
        type="button"
        onClick={onCopy}
        title="نسخ"
        className="shrink-0 w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-neutral-100"
      >
        {copied ? <CheckIcon small /> : <CopyIcon />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-neutral-500">{label}</div>
        <div
          className={
            "truncate " +
            (mono ? "font-mono text-sm " : "text-sm ") +
            (highlighted ? "text-amber-300 font-semibold" : "text-neutral-100")
          }
          dir="ltr"
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* ---------------- icons (inline SVG, no dep) ---------------- */

function CheckIcon({ small = false }: { small?: boolean }) {
  const size = small ? 14 : 24;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={small ? "" : "text-green-400"}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function KeyIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.6 9.6" />
      <path d="M15.5 7.5l3 3" />
    </svg>
  );
}
