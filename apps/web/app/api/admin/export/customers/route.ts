/**
 * GET /api/admin/export/customers
 *
 * Tier-2 Excel workbook covering ALL customers (no date filter — customers are
 * lifetime entities). Dashboard sheet has segment KPIs with color coding,
 * Detail sheet has full RFM + LTV table with data-bar on lifetime value.
 *
 * Auth: requireOwner.
 */
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import {
  newWorkbook, setupSheet, placeBrandedHeader, placeKpiCard, placeTableHeader,
  addDataBar, stripeRows, workbookResponse, PALETTE, FMT, FONTS, BORDERS,
} from "@/lib/excel-tier2";

export const dynamic = "force-dynamic";

const SEGMENT_COLOR: Record<string, string> = {
  Champion: PALETTE.amber,    // gold for top tier
  Loyal:    PALETTE.green,
  "At-Risk":PALETTE.amber,    // amber warning — distinct via label
  Lost:     PALETTE.rose,
  New:      PALETTE.sky,
  Prospect: PALETTE.graySec,
};

export async function GET() {
  const me = await requireOwner();
  const sb = createClient();

  const { data: rest } = await sb
    .from("restaurants")
    .select("name, slug")
    .eq("id", me.restaurant_id)
    .single();

  // Pull RFM + LTV joined by customer_id, sorted by lifetime spend desc
  const [{ data: rfm }, { data: ltv }] = await Promise.all([
    sb.from("v_customer_rfm").select("*").eq("restaurant_id", me.restaurant_id),
    sb.from("v_customer_ltv").select("customer_id, lifetime_value, avg_order_value, orders_count, first_order_at, last_order_at").eq("restaurant_id", me.restaurant_id),
  ]);

  const ltvByCust = new Map((ltv ?? []).map((r: any) => [r.customer_id, r]));
  const rows = (rfm ?? []).map((r: any) => {
    const l = ltvByCust.get(r.customer_id) as any;
    return {
      customer_id: r.customer_id,
      name: r.name ?? "",
      phone: r.phone ?? "",
      segment: r.segment ?? "Prospect",
      frequency: r.frequency ?? 0,
      monetary: Number(r.monetary ?? 0),
      recency_days: r.recency_days,
      avg_order_value: Number(l?.avg_order_value ?? 0),
      lifetime_value: Number(l?.lifetime_value ?? r.monetary ?? 0),
      first_order_at: l?.first_order_at ? new Date(l.first_order_at) : null,
      last_order_at:  r.last_order_at   ? new Date(r.last_order_at)   : null,
    };
  });
  // Sort newest activity first by default
  rows.sort((a, b) => (b.lifetime_value || 0) - (a.lifetime_value || 0));

  const wb = newWorkbook({ creator: "MenuLink", title: "Customers" });
  const restName = rest?.name?.trim() || "MenuLink";

  // === Sheet 1: Dashboard ===
  const dash = wb.addWorksheet("لوحة التحكم", { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(dash, { rtl: true });
  for (let c = 1; c <= 12; c++) dash.getColumn(c).width = 9;

  placeBrandedHeader(dash, {
    title: "تقرير العملاء",
    subtitle: `إجمالي ${rows.length} عميل`,
    restaurantName: restName,
    startCol: 1,
    endCol: 12,
  });

  // Detail sheet name reference for formulas
  const D = "تفاصيل";
  // Detail columns: A=#, B=name, C=phone, D=segment, E=frequency, F=monetary,
  // G=avg_order, H=recency_days, I=lifetime_value, J=first_order, K=last_order

  const cardCols = [1, 5, 9];
  const cardRowH = 4;
  let cardRow = 4;

  type Kpi = { label: string; formula?: string; value?: number; numFmt?: string; bg?: string; sub?: string };
  const kpis: Kpi[] = [
    // Row 1 — totals
    { label: "إجمالي العملاء",  formula: `=COUNTA('${D}'!A5:A100000)`, numFmt: FMT.count },
    { label: "إجمالي الإيرادات", formula: `=SUM('${D}'!F5:F100000)`, numFmt: FMT.sar },
    { label: "متوسط القيمة لكل عميل", formula: `=IFERROR(AVERAGE('${D}'!I5:I100000),0)`, numFmt: FMT.sar },

    // Row 2 — healthy segments (green tones)
    { label: "⭐ Champions",  formula: `=COUNTIF('${D}'!D5:D100000,"Champion")`, numFmt: FMT.count, bg: PALETTE.amber, sub: "الأعلى ولاءً" },
    { label: "💚 Loyal",      formula: `=COUNTIF('${D}'!D5:D100000,"Loyal")`,    numFmt: FMT.count, bg: PALETTE.green, sub: "عملاء دائمون" },
    { label: "🆕 New",        formula: `=COUNTIF('${D}'!D5:D100000,"New")`,      numFmt: FMT.count, bg: PALETTE.sky,   sub: "أول طلب لهم" },

    // Row 3 — risk segments (warning tones)
    { label: "⚠ At-Risk",     formula: `=COUNTIF('${D}'!D5:D100000,"At-Risk")`,  numFmt: FMT.count, bg: PALETTE.amber, sub: "غابوا من ٣١-٦٠ يوم" },
    { label: "🚨 Lost",       formula: `=COUNTIF('${D}'!D5:D100000,"Lost")`,     numFmt: FMT.count, bg: PALETTE.rose,  sub: "أكثر من ٦٠ يوم" },
    { label: "أعلى قيمة",      formula: `=IFERROR(MAX('${D}'!I5:I100000),0)`,    numFmt: FMT.sar,   bg: PALETTE.primary, sub: "أعلى ولاء" },
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
  });
  [4, 8].forEach((c) => (dash.getColumn(c).width = 1.5));

  const metaRow = cardRow + 3 * cardRowH + 2;
  dash.mergeCells(metaRow, 1, metaRow, 12);
  const metaCell = dash.getCell(metaRow, 1);
  metaCell.value = `تم إنشاء التقرير في ${new Date().toLocaleString("ar-SA")} · MenuLink Admin`;
  metaCell.font = FONTS.meta;
  metaCell.alignment = { horizontal: "center" };

  // === Sheet 2: Detail ===
  const det = wb.addWorksheet(D, { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(det, { rtl: true });
  placeBrandedHeader(det, {
    title: "تفاصيل العملاء",
    subtitle: `إجمالي ${rows.length} عميل`,
    restaurantName: restName,
    startCol: 1,
    endCol: 11,
  });

  const cols = [
    { header: "#",            key: "n",         width: 5,  numFmt: FMT.count },
    { header: "الاسم",         key: "name",      width: 24 },
    { header: "الجوال",        key: "phone",     width: 16 },
    { header: "الشريحة",        key: "segment",   width: 14 },
    { header: "عدد الطلبات",    key: "freq",      width: 12, numFmt: FMT.count },
    { header: "إجمالي الإنفاق", key: "monetary",  width: 16, numFmt: FMT.sar },
    { header: "متوسط الطلب",    key: "avg",      width: 14, numFmt: FMT.sar },
    { header: "آخر طلب (أيام)", key: "recency",   width: 14, numFmt: FMT.daysAgo },
    { header: "القيمة مدى الحياة (LTV)", key: "ltv", width: 18, numFmt: FMT.sar },
    { header: "أول طلب",       key: "first",     width: 14, numFmt: FMT.date },
    { header: "آخر طلب",       key: "last",      width: 14, numFmt: FMT.date },
  ];
  placeTableHeader(det, 4, cols);

  rows.forEach((r, i) => {
    const rowNum = 5 + i;
    det.getCell(rowNum, 1).value  = i + 1;
    det.getCell(rowNum, 2).value  = r.name;
    det.getCell(rowNum, 3).value  = r.phone;
    det.getCell(rowNum, 4).value  = r.segment;
    det.getCell(rowNum, 5).value  = r.frequency;
    det.getCell(rowNum, 6).value  = r.monetary;
    det.getCell(rowNum, 7).value  = r.avg_order_value;
    det.getCell(rowNum, 8).value  = r.recency_days;
    det.getCell(rowNum, 9).value  = r.lifetime_value;
    det.getCell(rowNum, 10).value = r.first_order_at;
    det.getCell(rowNum, 11).value = r.last_order_at;

    // Color the segment cell by segment
    const segColor = SEGMENT_COLOR[r.segment];
    if (segColor) {
      det.getCell(rowNum, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: segColor } };
      det.getCell(rowNum, 4).font = { ...FONTS.body, bold: true, color: { argb: PALETTE.textOnDark } };
      det.getCell(rowNum, 4).alignment = { horizontal: "center", vertical: "middle" };
    }

    det.getRow(rowNum).font = { ...FONTS.body, ...det.getRow(rowNum).font };
    det.getRow(rowNum).alignment = { vertical: "middle" };
  });

  const lastDetailRow = 4 + rows.length;
  if (rows.length > 0) {
    stripeRows(det, 4, lastDetailRow, 11);
    // Don't stripe over the colored segment column — re-apply segment colors after stripe
    rows.forEach((r, i) => {
      const segColor = SEGMENT_COLOR[r.segment];
      if (segColor) {
        const cell = det.getCell(5 + i, 4);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: segColor } };
        cell.font = { ...FONTS.body, bold: true, color: { argb: PALETTE.textOnDark } };
      }
    });

    // Data bar on LTV column (I) and on monetary (F) for visual ranking
    addDataBar(det, `I5:I${lastDetailRow}`, PALETTE.primary);
    addDataBar(det, `F5:F${lastDetailRow}`, PALETTE.green);

    // Footer totals
    const footRow = lastDetailRow + 1;
    det.getCell(footRow, 4).value = "الإجمالي";
    det.getCell(footRow, 4).font = { ...FONTS.thHead, color: { argb: PALETTE.primary } };
    det.getCell(footRow, 4).alignment = { horizontal: "left", vertical: "middle" };
    det.getCell(footRow, 5).value = { formula: `SUM(E5:E${lastDetailRow})` };
    det.getCell(footRow, 6).value = { formula: `SUM(F5:F${lastDetailRow})` };
    det.getCell(footRow, 9).value = { formula: `SUM(I5:I${lastDetailRow})` };
    [5, 6, 9].forEach((c) => {
      det.getCell(footRow, c).font  = { ...FONTS.thHead, color: { argb: PALETTE.primary } };
      det.getCell(footRow, c).border = { top: { style: "medium", color: { argb: PALETTE.primary } } };
    });
    det.getCell(footRow, 5).numFmt = FMT.count;
    det.getCell(footRow, 6).numFmt = FMT.sar;
    det.getCell(footRow, 9).numFmt = FMT.sar;
  } else {
    det.mergeCells(5, 1, 5, 11);
    const empty = det.getCell(5, 1);
    empty.value = "لا يوجد عملاء بعد";
    empty.font = { ...FONTS.body, italic: true, color: { argb: PALETTE.graySec } };
    empty.alignment = { horizontal: "center", vertical: "middle" };
  }

  // === Sheet 3: Summary (segment distribution) ===
  const sum = wb.addWorksheet("الشرائح", { views: [{ rightToLeft: true, showGridLines: false }] });
  setupSheet(sum, { rtl: true });
  placeBrandedHeader(sum, {
    title: "توزيع الشرائح",
    subtitle: "حسب نموذج RFM (Recency · Frequency · Monetary)",
    restaurantName: restName,
    startCol: 1,
    endCol: 6,
  });
  sum.getCell(4, 1).value = "الشريحة";
  placeTableHeader(sum, 5, [
    { header: "الشريحة",   key: "seg",   width: 18 },
    { header: "العدد",     key: "count", width: 12, numFmt: FMT.count },
    { header: "النسبة",    key: "pct",   width: 12, numFmt: FMT.pct },
    { header: "إجمالي الإنفاق", key: "sumMon", width: 18, numFmt: FMT.sar },
    { header: "متوسط الإنفاق",   key: "avgMon", width: 18, numFmt: FMT.sar },
    { header: "الإجراء المقترح", key: "action", width: 30 },
  ]);
  const segRows: { seg: string; action: string; color: string }[] = [
    { seg: "Champion",  action: "حافظ عليهم بمزايا VIP / مفاجآت شخصية",          color: PALETTE.amber },
    { seg: "Loyal",     action: "كافئ التكرار · برنامج نقاط / دعوة لمنتجات جديدة", color: PALETTE.green },
    { seg: "New",       action: "اشكرهم على أول طلب · شجع الطلب الثاني خلال أسبوع", color: PALETTE.sky },
    { seg: "At-Risk",   action: "🚨 أرسل عرض خاص الآن — يستحقون التذكير",          color: PALETTE.amber },
    { seg: "Lost",      action: "حملة استرجاع: خصم كبير · اتصال شخصي",            color: PALETTE.rose },
    { seg: "Prospect",  action: "تابع تفاعلهم — قد يتحولوا إلى New",              color: PALETTE.graySec },
  ];
  segRows.forEach((s, i) => {
    const r = 6 + i;
    sum.getCell(r, 1).value = s.seg;
    sum.getCell(r, 2).value = { formula: `COUNTIF('${D}'!D5:D100000,"${s.seg}")` };
    sum.getCell(r, 3).value = { formula: `IFERROR(COUNTIF('${D}'!D5:D100000,"${s.seg}")/COUNTA('${D}'!A5:A100000),0)` };
    sum.getCell(r, 4).value = { formula: `SUMIF('${D}'!D5:D100000,"${s.seg}",'${D}'!F5:F100000)` };
    sum.getCell(r, 5).value = { formula: `IFERROR(AVERAGEIF('${D}'!D5:D100000,"${s.seg}",'${D}'!F5:F100000),0)` };
    sum.getCell(r, 6).value = s.action;
    sum.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.color } };
    sum.getCell(r, 1).font = { ...FONTS.body, bold: true, color: { argb: PALETTE.textOnDark } };
    sum.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };
    sum.getCell(r, 2).numFmt = FMT.count;
    sum.getCell(r, 3).numFmt = FMT.pct;
    sum.getCell(r, 4).numFmt = FMT.sar;
    sum.getCell(r, 5).numFmt = FMT.sar;
    sum.getRow(r).height = 24;
  });
  stripeRows(sum, 5, 5 + segRows.length, 6);

  const filename = `menulink-customers-${rest?.slug ?? "report"}-${new Date().toISOString().slice(0, 10)}`;
  return workbookResponse(wb, filename);
}
