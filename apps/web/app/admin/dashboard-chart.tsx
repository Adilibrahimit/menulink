"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type DailyPoint = { day: string; orders: number; revenue: number };

export default function DashboardChart({ data }: { data: DailyPoint[] }) {
  const labels = data.map((d) =>
    new Date(d.day).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })
  );

  const revenueData = {
    labels,
    datasets: [
      {
        label: "الإيراد (ر.س)",
        data: data.map((d) => Number(d.revenue) || 0),
        borderColor: "#D32027",
        backgroundColor: "rgba(211, 32, 39, 0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  };

  const ordersData = {
    labels,
    datasets: [
      {
        label: "عدد الطلبات",
        data: data.map((d) => d.orders),
        backgroundColor: "#1f2937",
        borderRadius: 6,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { rtl: true },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { font: { size: 11 } } },
    },
  } as const;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="bg-white rounded-xl border border-neutral-200 p-4">
        <h2 className="font-semibold mb-3">الإيراد · آخر ١٤ يوم</h2>
        <div className="h-56">
          <Line data={revenueData} options={commonOptions} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-neutral-200 p-4">
        <h2 className="font-semibold mb-3">الطلبات · آخر ١٤ يوم</h2>
        <div className="h-56">
          <Bar data={ordersData} options={commonOptions} />
        </div>
      </section>
    </div>
  );
}
