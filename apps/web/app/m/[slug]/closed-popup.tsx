"use client";

const DAY_LABELS: Record<string, string> = {
  sun: "الأحد", mon: "الإثنين", tue: "الثلاثاء", wed: "الأربعاء",
  thu: "الخميس", fri: "الجمعة", sat: "السبت",
};

export function isRestaurantOpen(hoursJson: Record<string, string> | null): { open: boolean; todayHours: string | null } {
  if (!hoursJson) return { open: true, todayHours: null };
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const day = days[now.getDay()];
  const entry = hoursJson[day];
  if (!entry) return { open: true, todayHours: null };
  if (entry.toLowerCase() === "closed") return { open: false, todayHours: "مغلق" };
  const match = entry.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return { open: true, todayHours: entry };
  const [, oh, om, ch, cm] = match;
  const openMin = Number(oh) * 60 + Number(om);
  const closeMin = Number(ch) * 60 + Number(cm);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isOpen = closeMin > openMin
    ? nowMin >= openMin && nowMin < closeMin
    : nowMin >= openMin || nowMin < closeMin;
  return { open: isOpen, todayHours: entry };
}

export default function ClosedPopup({
  restaurantName,
  hoursJson,
  onClose,
}: {
  restaurantName: string;
  hoursJson: Record<string, string> | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div className="relative w-[90%] max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-2">🕐</div>
          <h2
            className="font-extrabold text-lg text-neutral-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {restaurantName} مغلق حالياً
          </h2>
          <p className="text-sm text-neutral-600 mt-1" style={{ fontFamily: "var(--font-display)" }}>
            لا يمكن إضافة أصناف للسلة خارج أوقات العمل
          </p>
        </div>

        {hoursJson && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 space-y-1">
            <h3 className="text-xs font-bold text-neutral-500 mb-1" style={{ fontFamily: "var(--font-display)" }}>
              أوقات العمل
            </h3>
            {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => {
              const val = hoursJson[d];
              if (!val) return null;
              const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
              const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
              const isToday = days[now.getDay()] === d;
              return (
                <div
                  key={d}
                  className={`flex items-center justify-between text-sm py-0.5 ${isToday ? "font-bold text-[var(--brand)]" : "text-neutral-700"}`}
                >
                  <span>{DAY_LABELS[d]}</span>
                  <span dir="ltr" className="text-xs">
                    {val.toLowerCase() === "closed" ? "مغلق" : val}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-[var(--brand)] text-white font-extrabold active:translate-y-px shadow-md"
          style={{ fontFamily: "var(--font-display)" }}
        >
          حسناً
        </button>
      </div>
    </div>
  );
}
