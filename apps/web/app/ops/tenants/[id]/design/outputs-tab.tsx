// Outputs tab — print-ready menu outputs for a tenant. Each entry opens the
// existing /print/[slug]/[size] route in a new tab (browser print-to-PDF):
//   a4 / a3 -> full booklet menu (DS-10)
//   poster  -> single-page signature poster (DS-11)
// Pure links, no client state.

const OUTPUTS = [
  { size: "a4", label: "القائمة A4", hint: "قائمة كاملة عمودية" },
  { size: "a3", label: "القائمة A3", hint: "قائمة كاملة عريضة" },
  { size: "poster", label: "بوستر A4", hint: "صفحة واحدة مميّزة (طبق التوقيع + عرض)" },
] as const;

export default function OutputsTab({ slug }: { slug: string }) {
  return (
    <div className="space-y-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">المخرجات المطبوعة</h3>
          <p className="text-[11px] text-neutral-500 mt-1">
            تُفتح في تبويب جديد للطباعة أو الحفظ كـ PDF. تُبنى من بيانات القائمة الحالية.
          </p>
        </div>
        <ul className="divide-y divide-neutral-800">
          {OUTPUTS.map((o) => (
            <li key={o.size} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-neutral-100">{o.label}</div>
                <div className="text-[11px] text-neutral-500">{o.hint}</div>
              </div>
              <a
                href={`/print/${slug}/${o.size}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs rounded bg-neutral-100 text-neutral-900 px-3 py-1.5 font-semibold hover:bg-white"
              >
                فتح ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
