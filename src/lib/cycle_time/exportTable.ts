/**
 * exportTable.ts — one styled XLSX exporter for every Cycle Time table.
 *
 * WHY GENERIC
 *   cycleTimeExport.ts already had three bespoke exporters, each re-deciding the
 *   same header fill, the same border, the same freeze. A fourth table meant a
 *   fourth copy and a fourth chance to drift. This takes a column spec and the
 *   rows the table is ALREADY showing, so what lands in Excel is exactly what
 *   was on screen — filters, search, sort and scope included.
 *
 * WHAT "EXACTLY WHAT WAS ON SCREEN" MEANS
 *   The caller passes its post-filter, post-sort array. Nothing here re-fetches
 *   or re-filters. If the reader narrowed to 12 rows, the file has 12 rows —
 *   an export that quietly returns the unfiltered set is worse than no export,
 *   because it looks right until someone counts.
 *
 * exceljs is dynamically imported so it stays out of the main bundle (~250KB).
 */

interface ExportColumnBase {
  header: string;
  width?: number;
  /** Excel number format, e.g. '#,##0' or '0.0%'. */
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * One column of the sheet.
 *
 * `key` alone must name a REAL field of T. A made-up key used to compile fine
 * and export a silently blank column - `step` instead of `mes_step` shipped a
 * whole empty column that looked like missing data. A synthetic column is still
 * allowed, it just has to say so by supplying `get`.
 */
export type ExportColumn<T> =
  | (ExportColumnBase & { key: Extract<keyof T, string>; get?: (row: T) => unknown })
  | (ExportColumnBase & { key: string; get: (row: T) => unknown });

export interface ExportTableOpts<T> {
  /** Without .xlsx — a timestamp is appended. */
  filename: string;
  sheetName?: string;
  /** Big title in row 1. */
  title: string;
  /** Row 2: what this export is scoped to. Written into the FILE because a
   *  spreadsheet outlives the screen it came from, and "17,038 models" means
   *  nothing six weeks later without "active since Sep 2024, KEYSIGHT". */
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

const INK = {
  title:    'FF0F172A',
  headerBg: 'FF1F2937',
  subBg:    'FFF3F4F6',
  zebra:    'FFF8FAFC',
  rule:     'FFD1D5DB',
} as const;

const BORDER = {
  top:    { style: 'thin' as const, color: { argb: INK.rule } },
  left:   { style: 'thin' as const, color: { argb: INK.rule } },
  bottom: { style: 'thin' as const, color: { argb: INK.rule } },
  right:  { style: 'thin' as const, color: { argb: INK.rule } },
};

/**
 * Rough wall-clock for the export, in ms. Deliberately a little pessimistic:
 * a job that finishes early reads as fast, one that overruns its own estimate
 * reads as broken.
 *
 * Measured on this app's tables: exceljs writes ~8-10k cells per 100ms, plus a
 * fixed ~400ms for the dynamic import and the blob/download hop.
 */
export function estimateExportMs(rowCount: number, colCount: number): number {
  return Math.round(400 + (rowCount * Math.max(colCount, 1)) / 80);
}

/** "instantly" · "about 3 seconds" · "about 1 minute" — for the confirm modal. */
export function humanDuration(ms: number): string {
  if (ms < 1200) return 'instantly';
  if (ms < 60_000) return `about ${Math.round(ms / 1000)} seconds`;
  const m = Math.round(ms / 60_000);
  return `about ${m} minute${m === 1 ? '' : 's'}`;
}

const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');

export async function exportTableXlsx<T>({
  filename, sheetName = 'Data', title, subtitle, columns, rows,
}: ExportTableOpts<T>): Promise<void> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: subtitle ? 4 : 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = columns.map(c => ({ key: c.key, width: c.width ?? 16 }));
  const n = columns.length;

  // ── title ───────────────────────────────────────────────────────────────
  const t = ws.addRow([title]);
  ws.mergeCells(t.number, 1, t.number, n);
  t.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: INK.title } };
  t.getCell(1).alignment = { vertical: 'middle' };
  t.height = 26;

  if (subtitle) {
    const s = ws.addRow([subtitle]);
    ws.mergeCells(s.number, 1, s.number, n);
    s.getCell(1).font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } };
    s.height = 15;
  }

  // Provenance travels with the file. A spreadsheet gets forwarded; without
  // this nobody can tell which day's numbers they are looking at.
  const meta = ws.addRow([`${rows.length.toLocaleString()} rows · exported ${stamp()} · IE Pulse`]);
  ws.mergeCells(meta.number, 1, meta.number, n);
  meta.getCell(1).font = { name: 'Calibri', size: 8, color: { argb: 'FF9CA3AF' } };
  meta.height = 14;

  // ── header ──────────────────────────────────────────────────────────────
  const head = ws.addRow(columns.map(c => c.header));
  head.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK.headerBg } };
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  head.height = 22;
  for (let c = 1; c <= n; c++) head.getCell(c).border = BORDER;
  const headRow = head.number;

  // ── body ────────────────────────────────────────────────────────────────
  rows.forEach((r, i) => {
    const row = ws.addRow(columns.map(c => {
      const v = 'get' in c && c.get ? c.get(r) : (r as Record<string, unknown>)[c.key];
      // undefined leaves a genuinely empty cell; null becomes '' so the column
      // reads as "measured, no value" rather than "not measured".
      return v === undefined ? null : v;
    }));
    row.font = { name: 'Calibri', size: 10 };
    row.height = 16;
    // Zebra: Excel hides its own gridlines under a fill, so every cell also
    // gets the thin rule or the shaded rows look like floating blocks.
    if (i % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK.zebra } };
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      cell.border = BORDER;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.alignment = {
        vertical: 'middle',
        horizontal: c.align ?? (typeof cell.value === 'number' ? 'right' : 'left'),
      };
    });
  });

  // Filter + freeze on the header, so a 17k-row sheet is usable on open
  // instead of something the reader has to set up themselves.
  ws.autoFilter = {
    from: { row: headRow, column: 1 },
    to:   { row: headRow + rows.length, column: n },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${stamp().replace(/[ :]/g, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked on the next tick — revoking synchronously races the download in
  // Safari and the file arrives empty.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
