/**
 * cycleTimeExport.ts — XLSX export for the Cycle Time pivoted table.
 *
 * Mirrors the on-screen layout: metadata cols on the left + dynamic alias
 * columns to the right, with raw cycle-time seconds as cell values (so the
 * user can do their own math in Excel).
 *
 * Uses a dynamic import for exceljs to keep it out of the main bundle.
 */

import { CycleTimeAliasMap, CycleTimePivotedRow, processColumnsOf } from './cycleTimeApi';

const META_COLS: { key: keyof CycleTimePivotedRow; header: string; width: number }[] = [
  { key: 'customer',        header: 'Customer',       width: 16 },
  { key: 'division',        header: 'Division',       width: 16 },
  { key: 'assembly',        header: 'Assembly',       width: 22 },
  { key: 'revision',        header: 'Rev',            width: 8  },
  { key: 'sub_workcenter',  header: 'Line',           width: 28 },
  { key: 'family',          header: 'Family',         width: 16 },
  { key: 'workcenter',      header: 'WC',             width: 8  },
  { key: 'workcenter_type', header: 'WC Type',        width: 14 },
];

interface ExportOpts {
  rows: CycleTimePivotedRow[];
  customer?: string;
  aliasMap?: CycleTimeAliasMap;
}

export async function exportCycleTimeXlsx({ rows, customer, aliasMap }: ExportOpts): Promise<void> {
  if (!rows.length) {
    console.warn('exportCycleTimeXlsx called with no rows');
    return;
  }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();

  const ws = wb.addWorksheet('Cycle Time', {
    views: [{ state: 'frozen', xSplit: META_COLS.length, ySplit: 2 }],
  });

  const aliasCols = processColumnsOf(rows);

  // ── Column layout ──
  ws.columns = [
    ...META_COLS.map((c) => ({ key: c.key as string, width: c.width })),
    ...aliasCols.map((a) => ({ key: a, width: 12 })),
  ];

  // ── Header row 1: alias name ──
  const headerRow1 = ws.addRow({
    ...Object.fromEntries(META_COLS.map((c) => [c.key as string, c.header])),
    ...Object.fromEntries(aliasCols.map((a) => [a, a])),
  });
  headerRow1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow1.height = 22;

  // ── Header row 2: underlying Process code(s) for each alias ──
  const headerRow2 = ws.addRow({
    ...Object.fromEntries(META_COLS.map((c) => [c.key as string, ''])),
    ...Object.fromEntries(
      aliasCols.map((a) => [a, aliasMap?.[a]?.processes.join(' / ') ?? '']),
    ),
  });
  headerRow2.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF6B7280' } };
  headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow2.height = 16;

  // ── Data rows ──
  for (const row of rows) {
    const flat: Record<string, string | number | null> = {};
    for (const c of META_COLS) flat[c.key as string] = (row[c.key] as string | null) ?? '';
    for (const a of aliasCols) {
      const v = row[a];
      flat[a] = typeof v === 'number' ? Number(v.toFixed(2)) : '';
    }
    const r = ws.addRow(flat);
    r.font = { name: 'Calibri', size: 10 };
    r.alignment = { vertical: 'middle' };
    // Numeric format for alias columns
    aliasCols.forEach((a, i) => {
      const cell = r.getCell(META_COLS.length + 1 + i);
      cell.numFmt = '#,##0.00';
      cell.alignment = { horizontal: 'right' };
    });
  }

  // ── AutoFilter on header row 1 (so users can filter inside Excel) ──
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: META_COLS.length + aliasCols.length },
  };

  // ── Write and trigger download ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  const name = customer ? `cycle-time_${customer}_${ts}.xlsx` : `cycle-time_${ts}.xlsx`;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
