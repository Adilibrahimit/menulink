/**
 * GET /api/admin/export/orders?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Tier-2 Excel workbook: Dashboard (KPI cards) + Detail (orders table with
 * formulas + data bars) + Summary (by-hour, by-type, by-status pivots).
 *
 * Date range defaults: today only (Riyadh timezone).
 * Auth: requireOwner — restaurant scoping handled by RLS via auth.uid().
 */
import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import {
  newWorkbook, setupSheet, placeBrandedHeader, placeKpiCard, placeTableHeader,
  addDataBar, stripeRows, workbookResponse, PALETTE, FMT, FONTS, BORDERS,
} from "@/lib/excel-tier2";

export const dynamic = "force-dynamic";

function todayRiyadhISO(): string {
  // YYYY-MM-DD for "today" in Asia/Riyadh, regardless of server tz.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

const ORDER_TYPE_AR: Record<string, string> = {
  delivery: "توصيل",
  pickup:   "استلام",
  dine_in:  "في المطعم",
  car:      "سيارة",
};
const STATUS_AR: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready:     "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export async function GET(req: NextRequest) {
  const me = await requireOwner();
  const sb = createClient();

  const params = req.nextUrl.searchParams;
  const from = params.get("from") ?? todayRiyadhISO();
  const to   = params.get("to")   ?? from;
  // Inclusive range: from 00:00:00 to next-day 00:00:00 (exclusive upper).
  const fromTs = `${from}T00:00:00+03:00`;
  const toTs   = new Date(`${to}T00:00:00+03:00`);
  toTs.setDate(toTs.getDate() + 1);

  // Restaurant name for header
  const { data: rest } = await sb
    .from("restaurants")
    .select("name, slug")
    .eq("id", me.restaurant_id)
    .single();

  // Pull orders + customer join for the date range
  const { data: orders } = await sb
    .from("orders")
    .select("id, order_type, channel, status, subtotal, delivery_fee, total, address, notes, created_at, customers(name, phone)")
    .eq("restaurant_id", me.restaurant_id)
    .gte("created_at", fromTs)
    .lt("created_at", toTs.toISOString())
    .order("created_at", { ascending: false });

  const rows = (orders ?? []).map((o: any) => {
    const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
    return {
      id: o.id,
      created_at: new Date(o.created_at),
      customer_name: cust?.name ?? "",
      phone: cust?.phone ?? "",
      order_type_ar: ORDER_TYPE_AR[o.order_type] ?? o.order_type,
      order_type: o.order_type,
      status_ar: STATUS_AR[o.status] ?? o.status,
      status: o.status,
      subtotal: Number(o.subtotal),
      delivery_fee: Number(o.delivery_fee),
      total: Number(o.total),
      address: o.address ?? "",
      notes: o.notes ?? "",
    };
  });

  // ---- Build workbook ------------------------------------------------------
  const wb = newWorkbook({ creator: "MenuLink", title: `Orders ${from}` });

  // === Sheet 1: Dashboard ===
  const dash = wb.addWorksheet("لوحة التحكم", { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(dash, { rtl: true });
  for (let c = 1; c <= 12; c++) dash.getColumn(c).width = 9;

  const restName = rest?.name?.trim() || "MenuLink";
  const subtitle = from === to ? `تقرير ${from}` : `من ${from} إلى ${to}`;
  let nextRow = placeBrandedHeader(dash, {
    title: "تقرير الطلبات",
    subtitle,
    restaurantName: restName,
    startCol: 1,
    endCol: 12,
  });

  // KPI grid — 3 cards per row × 4 rows = 12 cards, each spans 4 columns × 4 rows
  // Card width = 4 cols. Layout: cards at cols 1, 5, 9.
  // Each card occupies rows nextRow → nextRow+3.
  const cardCols = [1, 5, 9];
  const cardRowH = 4;
  let cardRow = nextRow;

  // We'll reference the Detail sheet via formulas. Detail headers will be on row 4 (after branded header),
  // data starts at row 5. So Detail!H:H is the `total` column (assuming column order below).
  // Column order on Detail (set below): A=#, B=created_at, C=customer, D=phone, E=type_ar,
  //                                     F=status_ar, G=subtotal, H=delivery_fee, I=total, J=address, K=notes, L=type, M=status
  const D = "تفاصيل"; // sheet name reference

  type Kpi = { label: string; formula?: string; value?: number; numFmt?: string; bg?: string; sub?: string };
  const kpis: Kpi[] = [
    { label: "إجمالي الطلبات", formula: `=COUNTA('${D}'!A5:A10000)`, numFmt: FMT.count },
    { label: "إجمالي المبيعات", formula: `=SUM('${D}'!I5:I10000)`, numFmt: FMT.sar },
    { label: "متوسط قيمة الطلب", formula: `=IFERROR(AVERAGE('${D}'!I5:I10000),0)`, numFmt: FMT.sar },

    { label: "طلبات توصيل",  formula: `=COUNTIF('${D}'!L5:L10000,"delivery")`, numFmt: FMT.count, bg: PALETTE.green },
    { label: "طلبات استلام",  formula: `=COUNTIF('${D}'!L5:L10000,"pickup")`,   numFmt: FMT.count, bg: PALETTE.sky },
    { label: "طلبات في المطعم", formula: `=COUNTIF('${D}'!L5:L10000,"dine_in")`,  numFmt: FMT.count, bg: PALETTE.slate },

    { label: "جديد", formula: `=COUNTIF('${D}'!M5:M10000,"submitted")`, numFmt: FMT.count, bg: PALETTE.amber, sub: "في انتظار التأكيد" },
    { label: "مؤكد", formula: `=COUNTIF('${D}'!M5:M10000,"confirmed")`, numFmt: FMT.count, bg: PALETTE.primary },
    { label: "تجهيز", formula: `=COUNTIF('${D}'!M5:M10000,"preparing")`, numFmt: FMT.count, bg: PALETTE.primary },

    { label: "جاهز", formula: `=COUNTIF('${D}'!M5:M10000,"ready")`, numFmt: FMT.count, bg: PALETTE.green },
    { label: "تم التسليم", formula: `=COUNTIF('${D}'!M5:M10000,"delivered")`, numFmt: FMT.count, bg: PALETTE.green },
    { label: "ملغي", formula: `=COUNTIF('${D}'!M5:M10000,"cancelled")`, numFmt: FMT.count, bg: PALETTE.rose },
  ];

  kpis.forEach((kpi, i) => {
    const colIdx = cardCols[i % 3];
    const r      = cardRow + Math.floor(i / 3) * cardRowH;
    placeKpiCard(dash, { row: r, col: colIdx }, kpi.label, {
      valueFormula: kpi.formula,
      value: kpi.value,
      numFmt: kpi.numFmt,
      bgColor: kpi.bg,
      subLabel: kpi.sub,
    });
    // Visual gap between cards (col 4 and col 8)
  });
  // Set the "gap" column widths slim
  [4, 8].forEach((c) => (dash.getColumn(c).width = 1.5));

  // Meta footer
  const metaRow = cardRow + 4 * cardRowH + 2;
  dash.mergeCells(metaRow, 1, metaRow, 12);
  const metaCell = dash.getCell(metaRow, 1);
  metaCell.value = `تم إنشاء التقرير في ${new Date().toLocaleString("ar-SA")} · صادر من MenuLink Admin`;
  metaCell.font = FONTS.meta;
  metaCell.alignment = { horizontal: "center" };

  // === Sheet 2: Detail ===
  const det = wb.addWorksheet(D, { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(det, { rtl: true });

  placeBrandedHeader(det, {
    title: "تفاصيل الطلبات",
    subtitle,
    restaurantName: restName,
    startCol: 1,
    endCol: 13,
  });

  const detailCols = [
    { header: "#",          key: "n",            width: 5,  numFmt: FMT.count },
    { header: "التاريخ",     key: "created_at",   width: 18, numFmt: FMT.dateTime },
    { header: "العميل",      key: "customer",     width: 22 },
    { header: "الجوال",      key: "phone",        width: 15 },
    { header: "النوع",       key: "type_ar",      width: 12 },
    { header: "الحالة",      key: "status_ar",    width: 12 },
    { header: "المجموع الفرعي", key: "subtotal", width: 14, numFmt: FMT.sar },
    { header: "رسوم التوصيل",   key: "delivery_fee", width: 14, numFmt: FMT.sar },
    { header: "الإجمالي",    key: "total",         width: 14, numFmt: FMT.sar },
    { header: "العنوان",     key: "address",       width: 28 },
    { header: "ملاحظات",     key: "notes",         width: 24 },
    { header: "_type",       key: "order_type",    width: 12 },  // hidden key columns
    { header: "_status",     key: "status",        width: 12 },
  ];
  placeTableHeader(det, 4, detailCols);
  // Hide internal columns L+M (used by Dashboard formulas)
  det.getColumn(12).hidden = true;
  det.getColumn(13).hidden = true;

  // Data rows start at 5
  rows.forEach((r, i) => {
    const rowNum = 5 + i;
    det.getCell(rowNum, 1).value  = i + 1;
    det.getCell(rowNum, 2).value  = r.created_at;
    det.getCell(rowNum, 3).value  = r.customer_name;
    det.getCell(rowNum, 4).value  = r.phone;
    det.getCell(rowNum, 5).value  = r.order_type_ar;
    det.getCell(rowNum, 6).value  = r.status_ar;
    det.getCell(rowNum, 7).value  = r.subtotal;
    det.getCell(rowNum, 8).value  = r.delivery_fee;
    det.getCell(rowNum, 9).value  = r.total;
    det.getCell(rowNum, 10).value = r.address;
    det.getCell(rowNum, 11).value = r.notes;
    det.getCell(rowNum, 12).value = r.order_type;
    det.getCell(rowNum, 13).value = r.status;
    det.getRow(rowNum).font = FONTS.body;
    det.getRow(rowNum).alignment = { vertical: "middle" };
  });

  const lastDetailRow = 4 + Math.max(rows.length, 0);
  if (rows.length > 0) {
    stripeRows(det, 4, lastDetailRow, 11);
    // Data bar on Total column (I)
    addDataBar(det, `I5:I${lastDetailRow}`);

    // Footer totals row with formulas (one row below data)
    const footRow = lastDetailRow + 1;
    det.getCell(footRow, 6).value = "الإجمالي";
    det.getCell(footRow, 6).font  = { ...FONTS.thHead, color: { argb: PALETTE.primary } };
    det.getCell(footRow, 6).alignment = { horizontal: "left", vertical: "middle" };
    det.getCell(footRow, 7).value = { formula: `SUM(G5:G${lastDetailRow})` };
    det.getCell(footRow, 8).value = { formula: `SUM(H5:H${lastDetailRow})` };
    det.getCell(footRow, 9).value = { formula: `SUM(I5:I${lastDetailRow})` };
    [7, 8, 9].forEach((c) => {
      det.getCell(footRow, c).font  = { ...FONTS.thHead, color: { argb: PALETTE.primary } };
      det.getCell(footRow, c).border = { top: { style: "medium", color: { argb: PALETTE.primary } } };
      det.getCell(footRow, c).numFmt = FMT.sar;
    });
  } else {
    det.mergeCells(5, 1, 5, 11);
    const empty = det.getCell(5, 1);
    empty.value = "لا توجد طلبات في الفترة المحددة";
    empty.font = { ...FONTS.body, italic: true, color: { argb: PALETTE.graySec } };
    empty.alignment = { horizontal: "center", vertical: "middle" };
  }

  // === Sheet 3: Summary ===
  const sum = wb.addWorksheet("الملخص", { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(sum, { rtl: true });
  placeBrandedHeader(sum, {
    title: "ملخص التحليلات",
    subtitle,
    restaurantName: restName,
    startCol: 1,
    endCol: 8,
  });

  // Block 1: by order type
  sum.getCell(4, 1).value = "حسب نوع الطلب";
  sum.getCell(4, 1).font = { ...FONTS.thHead, color: { argb: PALETTE.primary }, size: 13 };
  placeTableHeader(sum, 5, [
    { header: "النوع",   key: "type",   width: 16 },
    { header: "العدد",   key: "count",  width: 12, numFmt: FMT.count },
    { header: "الإيرادات", key: "rev",  width: 16, numFmt: FMT.sar },
  ]);
  const typeRows = [
    { ar: "توصيل",    key: "delivery" },
    { ar: "استلام",    key: "pickup" },
    { ar: "في المطعم", key: "dine_in" },
    { ar: "سيارة",     key: "car" },
  ];
  typeRows.forEach((t, i) => {
    const r = 6 + i;
    sum.getCell(r, 1).value = t.ar;
    sum.getCell(r, 2).value = { formula: `COUNTIF('${D}'!L5:L10000,"${t.key}")` };
    sum.getCell(r, 3).value = { formula: `SUMIF('${D}'!L5:L10000,"${t.key}",'${D}'!I5:I10000)` };
    sum.getCell(r, 2).numFmt = FMT.count;
    sum.getCell(r, 3).numFmt = FMT.sar;
  });
  stripeRows(sum, 5, 5 + typeRows.length, 3);

  // Block 2: by status (below)
  const statBlockTop = 12;
  sum.getCell(statBlockTop, 1).value = "حسب الحالة";
  sum.getCell(statBlockTop, 1).font = { ...FONTS.thHead, color: { argb: PALETTE.primary }, size: 13 };
  placeTableHeader(sum, statBlockTop + 1, [
    { header: "الحالة",   key: "stat",   width: 16 },
    { header: "العدد",    key: "count",  width: 12, numFmt: FMT.count },
    { header: "الإيرادات", key: "rev",   width: 16, numFmt: FMT.sar },
  ]);
  const statRows = [
    { ar: "جديد",      key: "submitted" },
    { ar: "مؤكد",      key: "confirmed" },
    { ar: "تجهيز",     key: "preparing" },
    { ar: "جاهز",      key: "ready" },
    { ar: "تم التسليم", key: "delivered" },
    { ar: "ملغي",      key: "cancelled" },
  ];
  statRows.forEach((s, i) => {
    const r = statBlockTop + 2 + i;
    sum.getCell(r, 1).value = s.ar;
    sum.getCell(r, 2).value = { formula: `COUNTIF('${D}'!M5:M10000,"${s.key}")` };
    sum.getCell(r, 3).value = { formula: `SUMIF('${D}'!M5:M10000,"${s.key}",'${D}'!I5:I10000)` };
    sum.getCell(r, 2).numFmt = FMT.count;
    sum.getCell(r, 3).numFmt = FMT.sar;
  });
  stripeRows(sum, statBlockTop + 1, statBlockTop + 1 + statRows.length, 3);

  // Make Dashboard the active opening sheet
  wb.views = [{ x: 0, y: 0, width: 0, height: 0, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const filename = `menulink-orders-${rest?.slug ?? "report"}-${from === to ? from : `${from}_to_${to}`}`;
  return workbookResponse(wb, filename);
}
