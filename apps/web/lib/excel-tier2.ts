/**
 * Tier-2 Excel workbook helpers — shared style system for /admin export endpoints.
 *
 * Modeled on the excel-wizard agent's Tier-2 spec (forest-green executive theme,
 * KPI cards with merged cells, formula-first calculations, RTL for Arabic-primary
 * sheets, data-bar conditional formatting). ExcelJS is the TypeScript equivalent
 * of openpyxl — same feature set, runs in Next.js API routes server-side.
 *
 * IMPORTANT: never hardcode calculated values. All totals/averages/percentages
 * must come from Excel formulas (=SUM, =AVERAGE, =COUNTIF, =A2*0.15, etc.) so
 * users can edit the source rows and watch the totals update in Excel.
 */
import ExcelJS from "exceljs";

// ---- Palette ----------------------------------------------------------------
export const PALETTE = {
  primary:   "FF1B4332",  // forest green — KPI value backgrounds, header bars
  slate:     "FF1E293B",  // slate-900 — section dividers
  amber:     "FFF59E0B",  // amber — warnings, At-Risk highlights
  rose:      "FFBE123C",  // rose — Lost / churned
  sky:       "FF0EA5E9",  // sky — New customers
  green:     "FF16A34A",  // green — Loyal / healthy
  graySec:   "FF374151",  // gray-700 — secondary header text
  textOnDark:"FFFFFFFF",
  textMuted: "FF94A3B8",  // slate-400 — KPI labels
  rowAlt:    "FFF8FAFC",  // alternating row background
  outlineHair:"FFCBD5E1",  // hair borders
  outlineMid:"FF374151",  // medium borders (section dividers)
} as const;

// ---- Number formats ---------------------------------------------------------
export const FMT = {
  sar:        '#,##0.00" ر.س"',
  sarInt:     '#,##0" ر.س"',
  count:      "#,##0",
  pct:        "0.0%",
  date:       "yyyy-mm-dd",
  dateTime:   "yyyy-mm-dd hh:mm",
  daysAgo:    '0" يوم"',
} as const;

// ---- Border styles ----------------------------------------------------------
const thickSide  = { style: "thick"  as const, color: { argb: PALETTE.primary } };
const mediumSide = { style: "medium" as const, color: { argb: PALETTE.outlineMid } };
const hairSide   = { style: "hair"   as const, color: { argb: PALETTE.outlineHair } };

export const BORDERS = {
  outer:   { top: thickSide,  bottom: thickSide,  left: thickSide,  right: thickSide },
  divider: { bottom: mediumSide },
  row:     { bottom: hairSide },
} as const;

// ---- Fonts ------------------------------------------------------------------
export const FONTS = {
  kpiValue:   { name: "Aptos Narrow", size: 28, bold: true, color: { argb: PALETTE.textOnDark } },
  kpiLabel:   { name: "Aptos Narrow", size: 10, color: { argb: PALETTE.textMuted } },
  header:     { name: "Aptos Narrow", size: 18, bold: true, color: { argb: PALETTE.textOnDark } },
  subHeader:  { name: "Aptos Narrow", size: 11, color: { argb: PALETTE.textOnDark } },
  thHead:     { name: "Aptos Narrow", size: 11, bold: true, color: { argb: PALETTE.textOnDark } },
  body:       { name: "Aptos Narrow", size: 11 },
  meta:       { name: "Aptos Narrow", size: 9, color: { argb: PALETTE.graySec }, italic: true },
} as const;

// ---- Workbook + sheet setup -------------------------------------------------
export function newWorkbook(opts: { creator: string; title: string }): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = opts.creator;
  wb.created = new Date();
  wb.title   = opts.title;
  return wb;
}

/** Configure a worksheet for Arabic-primary content (RTL, default font, gridlines). */
export function setupSheet(ws: ExcelJS.Worksheet, opts: { rtl: boolean } = { rtl: true }) {
  ws.views = [{
    rightToLeft: opts.rtl,
    showGridLines: false,
    state: "normal",
  }];
  ws.properties.defaultRowHeight = 22;
}

// ---- KPI card pattern -------------------------------------------------------
/**
 * Place a KPI card at the given anchor cell. The card spans 3 columns × 4 rows:
 *   row N:    big value (merged 3 cols)
 *   row N+1:  big value continues (merged)
 *   row N+2:  label (merged 3 cols)
 *   row N+3:  optional sub-label / delta (merged 3 cols)
 *
 * Uses a formula string when valueFormula is provided; otherwise raw value.
 */
export function placeKpiCard(
  ws: ExcelJS.Worksheet,
  anchor: { row: number; col: number },
  label: string,
  opts: {
    valueFormula?: string;        // e.g., "=SUM(Detail!E:E)" — preferred
    value?: number | string;       // raw value fallback (use sparingly)
    numFmt?: string;
    bgColor?: string;              // override PALETTE.primary for color-coded KPIs
    subLabel?: string;
  } = {}
) {
  const { row, col } = anchor;
  const colLetter = (c: number) => ws.getColumn(c).letter;
  const c1 = colLetter(col);
  const c3 = colLetter(col + 2);

  // Value (merged 3x2)
  ws.mergeCells(`${c1}${row}:${c3}${row + 1}`);
  const valueCell = ws.getCell(`${c1}${row}`);
  if (opts.valueFormula) {
    valueCell.value = { formula: opts.valueFormula };
  } else if (opts.value !== undefined) {
    valueCell.value = opts.value;
  }
  if (opts.numFmt) valueCell.numFmt = opts.numFmt;
  valueCell.font = FONTS.kpiValue;
  valueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: opts.bgColor ?? PALETTE.primary },
  };
  valueCell.alignment = { horizontal: "center", vertical: "middle" };

  // Label (merged 3x1)
  ws.mergeCells(`${c1}${row + 2}:${c3}${row + 2}`);
  const labelCell = ws.getCell(`${c1}${row + 2}`);
  labelCell.value = label;
  labelCell.font = FONTS.kpiLabel;
  labelCell.alignment = { horizontal: "center", vertical: "middle" };

  // Optional sub-label
  if (opts.subLabel) {
    ws.mergeCells(`${c1}${row + 3}:${c3}${row + 3}`);
    const subCell = ws.getCell(`${c1}${row + 3}`);
    subCell.value = opts.subLabel;
    subCell.font = { ...FONTS.kpiLabel, italic: true };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // Set row heights for the card area so it looks like a card
  ws.getRow(row).height     = 30;
  ws.getRow(row + 1).height = 30;
  ws.getRow(row + 2).height = 18;
  if (opts.subLabel) ws.getRow(row + 3).height = 16;
}

// ---- Branded header bar -----------------------------------------------------
/** Place a colored header bar spanning [startCol..endCol] with title + subtitle on the right.
 *  Returns the row index AFTER the header (so callers can stack content beneath). */
export function placeBrandedHeader(
  ws: ExcelJS.Worksheet,
  opts: { title: string; subtitle?: string; restaurantName: string; startCol: number; endCol: number }
): number {
  const { title, subtitle, restaurantName, startCol, endCol } = opts;
  const c1 = ws.getColumn(startCol).letter;
  const cN = ws.getColumn(endCol).letter;

  ws.mergeCells(`${c1}1:${cN}1`);
  const titleCell = ws.getCell(`${c1}1`);
  titleCell.value = `${restaurantName} · ${title}`;
  titleCell.font = FONTS.header;
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.primary } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 38;

  ws.mergeCells(`${c1}2:${cN}2`);
  const subCell = ws.getCell(`${c1}2`);
  const stamp = new Date().toLocaleString("ar-SA", { dateStyle: "long", timeStyle: "short" });
  subCell.value = subtitle ? `${subtitle} · ${stamp}` : stamp;
  subCell.font = FONTS.subHeader;
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.slate } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  return 4; // leave row 3 as a blank spacer; content starts at row 4
}

// ---- Detail-table header row ------------------------------------------------
export function placeTableHeader(
  ws: ExcelJS.Worksheet,
  row: number,
  columns: { header: string; key: string; width?: number; numFmt?: string }[]
) {
  columns.forEach((col, idx) => {
    const cell = ws.getCell(row, idx + 1);
    cell.value = col.header;
    cell.font = FONTS.thHead;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.slate } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDERS.divider;
    ws.getColumn(idx + 1).width = col.width ?? 14;
    if (col.numFmt) {
      // Apply numFmt to the data cells written later — store on column
      ws.getColumn(idx + 1).numFmt = col.numFmt;
    }
  });
  ws.getRow(row).height = 26;
}

// ---- Data bar (visual ranking) ----------------------------------------------
export function addDataBar(
  ws: ExcelJS.Worksheet,
  range: string,
  color: string = PALETTE.primary
) {
  // ExcelJS' DataBarRuleType uses minLength/maxLength + showValue; the actual bar color
  // is set via the rule's `color` runtime-only field which isn't in the TS shape — cast.
  ws.addConditionalFormatting({
    ref: range,
    rules: [{
      type: "dataBar",
      cfvo: [{ type: "min" }, { type: "max" }],
      gradient: true,
      priority: 1,
      ...({ color: { argb: color } } as any),
    }],
  });
}

// ---- Alternating row striping ----------------------------------------------
export function stripeRows(ws: ExcelJS.Worksheet, headerRow: number, lastRow: number, lastCol: number) {
  for (let r = headerRow + 1; r <= lastRow; r++) {
    if ((r - headerRow) % 2 === 0) {
      for (let c = 1; c <= lastCol; c++) {
        const cell = ws.getCell(r, c);
        if (!cell.fill || (cell.fill as any).fgColor === undefined) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.rowAlt } };
        }
      }
    }
    for (let c = 1; c <= lastCol; c++) {
      ws.getCell(r, c).border = BORDERS.row;
    }
  }
}

// ---- Streaming response helper ---------------------------------------------
/** Convert workbook to a Response suitable for Next.js API routes. Sets the right
 *  Content-Type + Content-Disposition headers so the browser downloads it. */
export async function workbookResponse(
  wb: ExcelJS.Workbook,
  filename: string
): Promise<Response> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
