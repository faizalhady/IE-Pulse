/**
 * cycleTimeExport.ts — XLSX export for the Cycle Time pivoted table.
 *
 * Mirrors the on-screen layout: metadata cols on the left + dynamic alias
 * columns to the right, with raw cycle-time seconds as cell values (so the
 * user can do their own math in Excel).
 *
 * Uses a dynamic import for exceljs to keep it out of the main bundle.
 */

import {
  CycleTimeAliasMap,
  CycleTimeAssemblyBuildStep,
  CycleTimePivotedRow,
  cycleTimeApi,
  processColumnsOf,
} from './cycleTimeApi';

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

// ═══════════════════════════════════════════════════════════════════════════
// Flow-metrics export — one row per (assembly × revision × sub-workcenter ×
// process), with the metrics the user picked in the Export dialog.
// ═══════════════════════════════════════════════════════════════════════════

/** Default line efficiency for UPH until real efficiency data is wired in.
 *  Keep in sync with DEFAULT_EFFICIENCY in CycleTimeAssemblyFlow.tsx. */
const EXPORT_EFFICIENCY = 0.85;

export type FlowExportMetric = 'smh' | 'manual' | 'imt' | 'machine' | 'total_ct' | 'uph';

/** Per-process metrics (repeat under every process column group, in this order).
 *  SMH is NOT here — it's an assembly-level total shown once (see below). */
const PER_PROCESS_METRICS: { key: Exclude<FlowExportMetric, 'smh'>; header: string }[] = [
  { key: 'manual',   header: 'Manual' },
  { key: 'imt',      header: 'IMT' },
  { key: 'machine',  header: 'Machine' },
  { key: 'total_ct', header: 'Total CT' },
  { key: 'uph',      header: 'UPH' },
];

/** Cycle time per the IE formula — mirrors computeCycleTime in the Flow page. */
function ctSeconds(s: CycleTimeAssemblyBuildStep): number {
  const m = s.mach ?? 0;
  const h = s.hand ?? 0;
  const c = s.cap && s.cap > 0 ? s.cap : 1;
  const n = s.n && s.n > 0 ? s.n : 1;
  const ss = s.sampling && s.sampling > 0 ? s.sampling : 100;
  return (m + h * c) / ((c * n) * (ss / 100));
}

/** Compute one metric's value for a step. Null → blank cell. */
function metricValue(metric: FlowExportMetric, s: CycleTimeAssemblyBuildStep): number | null {
  const imt = s.imt ?? 0;
  const hand = s.hand ?? 0;
  const ss = s.sampling != null && s.sampling > 0 ? s.sampling : 100;
  switch (metric) {
    case 'manual':  return hand;
    case 'imt':     return imt;
    case 'machine': return s.mach ?? 0;
    case 'smh':     return (imt + hand) * (ss / 100);
    case 'total_ct': return ctSeconds(s);
    case 'uph': {
      const ct = ctSeconds(s);
      if (!(ct > 0)) return null;
      const yieldRate = s.fpy != null && s.fpy > 0 ? s.fpy / 100 : 1;
      return (3600 / ct) * EXPORT_EFFICIENCY * yieldRate;
    }
  }
}

/** Drop the alias suffix after " - " (e.g. "BIRTH 1 - LABELING" → "BIRTH 1"). */
function trimStep(step: string): string {
  const i = step.indexOf(' - ');
  return i >= 0 ? step.slice(0, i).trim() : step;
}

/** Run `task` over `items` with bounded concurrency. */
async function pooledMap<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await task(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

interface FlowExportOpts {
  customer: string;
  /** Assembly numbers to export (current workcell, after any active filters). */
  assemblies: string[];
  /** Selected metrics — exported in canonical order regardless of pick order. */
  metrics: FlowExportMetric[];
  /** Optional progress callback (assemblies fetched / total). */
  onProgress?: (done: number, total: number) => void;
}

/** Pick the representative routing for an assembly row: the latest revision of
 *  the primary (priority-1) routing. Falls back to all steps if no priority-1. */
function representativeSteps(steps: CycleTimeAssemblyBuildStep[]): CycleTimeAssemblyBuildStep[] {
  const p1 = steps.filter((s) => s.priority === 1);
  const pool = p1.length ? p1 : steps;
  if (!pool.length) return [];
  const revs = [...new Set(pool.map((s) => s.revision))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const latest = revs[revs.length - 1];
  return pool.filter((s) => s.revision === latest);
}

/**
 * Export per-process metrics for a whole workcell to XLSX in the WIDE layout
 * (processes horizontal — matches docs/Book2.xlsx):
 *
 *   row 1: process names (merged across each process's metric block)
 *   row 2: Assembly | [SMH] | repeating per-process metric labels
 *   rows : one per assembly — SMH (assembly total) + each process's metrics
 *
 * Columns = the union of processes across the workcell, in flow order. Each
 * assembly fills the processes it routes through; the rest stay blank.
 * Fetches /assembly-builds per assembly (bounded concurrency).
 */
export async function exportFlowMetricsXlsx({
  customer, assemblies, metrics, onProgress,
}: FlowExportOpts): Promise<void> {
  if (!assemblies.length || !metrics.length) {
    console.warn('exportFlowMetricsXlsx: nothing to export');
    return;
  }

  const showSmh = metrics.includes('smh');
  const procMetrics = PER_PROCESS_METRICS.filter((m) => metrics.includes(m.key));
  // SMH-only export still needs a value to show; nothing per-process to spread.
  const hasProcMetrics = procMetrics.length > 0;

  // Fetch every assembly's process detail.
  let done = 0;
  const perAssembly = await pooledMap(assemblies, 8, async (assembly) => {
    try {
      const steps = representativeSteps(await cycleTimeApi.assemblyBuilds.list(customer, assembly));
      return { assembly, steps };
    } catch (e) {
      console.warn(`export: failed to fetch ${assembly}`, e);
      return { assembly, steps: [] as CycleTimeAssemblyBuildStep[] };
    } finally {
      onProgress?.(++done, assemblies.length);
    }
  });

  // Build the process column order = union of process labels across the
  // workcell, ordered by their typical step sequence.
  const procOrder = new Map<string, number>(); // label → min step_order seen
  for (const { steps } of perAssembly) {
    for (const s of steps) {
      const label = trimStep(s.step);
      const ord = s.step_order ?? Number.MAX_SAFE_INTEGER;
      const cur = procOrder.get(label);
      if (cur == null || ord < cur) procOrder.set(label, ord);
    }
  }
  const processes = [...procOrder.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();
  const ws = wb.addWorksheet('Cycle Time Metrics', {
    views: [{ state: 'frozen', xSplit: showSmh ? 2 : 1, ySplit: 2 }],
  });

  // ── Column layout: Assembly | [SMH] | (process × metric)… ──
  const leadCount = 1 + (showSmh ? 1 : 0);          // Assembly (+ SMH)
  const perProc = procMetrics.length;
  const widths = [22, ...(showSmh ? [11] : [])];
  if (hasProcMetrics) for (let i = 0; i < processes.length * perProc; i++) widths.push(11);
  ws.columns = widths.map((w) => ({ width: w }));

  // ── Header row 1: process group names (merged across their metric block) ──
  const r1: (string | number)[] = ['', ...(showSmh ? [''] : [])];
  if (hasProcMetrics) for (const p of processes) { r1.push(p); for (let i = 1; i < perProc; i++) r1.push(''); }
  const headerRow1 = ws.addRow(r1);
  headerRow1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow1.height = 20;

  // ── Header row 2: Assembly | SMH | repeating metric labels ──
  const r2: (string | number)[] = ['Assembly', ...(showSmh ? ['SMH'] : [])];
  if (hasProcMetrics) for (let p = 0; p < processes.length; p++) for (const m of procMetrics) r2.push(m.header);
  const headerRow2 = ws.addRow(r2);
  headerRow2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
  headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow2.height = 18;

  // Alternating shades per process block (even / odd) so each block reads as a
  // distinct vertical band. Darker tints for the two header rows, a soft fill
  // for the data cells.
  const HEAD1_SHADE = ['FF1F2937', 'FF2D3B4E'];
  const HEAD2_SHADE = ['FF374151', 'FF44546A'];
  const DATA_SHADE: (string | null)[] = [null, 'FFEAF1F8']; // plain / soft blue-grey
  const fillOf = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

  // Merge each process group's name across its metric columns (row 1) and tint
  // both header rows per block.
  if (hasProcMetrics) {
    processes.forEach((_, pi) => {
      const start = leadCount + pi * perProc + 1;
      if (perProc > 1) ws.mergeCells(1, start, 1, start + perProc - 1);
      headerRow1.getCell(start).fill = fillOf(HEAD1_SHADE[pi % 2]);
      for (let i = 0; i < perProc; i++) headerRow2.getCell(start + i).fill = fillOf(HEAD2_SHADE[pi % 2]);
    });
  }
  // Merge the Assembly / SMH lead cells vertically across the two header rows.
  ws.mergeCells(1, 1, 2, 1);
  if (showSmh) ws.mergeCells(1, 2, 2, 2);

  // ── Data rows: one per assembly ──
  for (const { assembly, steps } of perAssembly) {
    const byProc = new Map<string, CycleTimeAssemblyBuildStep>();
    for (const s of steps) byProc.set(trimStep(s.step), s); // last wins on collision

    const smhTotal = showSmh
      ? steps.reduce((sum, s) => {
          const v = metricValue('smh', s);
          return sum + (v ?? 0);
        }, 0)
      : null;

    const cells: (string | number)[] = [assembly];
    if (showSmh) cells.push(smhTotal == null ? '' : Number(smhTotal.toFixed(2)));
    if (hasProcMetrics) {
      for (const p of processes) {
        const s = byProc.get(p);
        for (const m of procMetrics) {
          if (!s) { cells.push(''); continue; }
          const v = metricValue(m.key, s);
          cells.push(v == null ? '' : Number(v.toFixed(m.key === 'uph' ? 0 : 2)));
        }
      }
    }

    const r = ws.addRow(cells);
    r.font = { name: 'Calibri', size: 10 };
    r.alignment = { vertical: 'middle' };
    // Number formats for the value columns.
    if (showSmh) { const c = r.getCell(2); c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right' }; }
    if (hasProcMetrics) {
      for (let p = 0; p < processes.length; p++) {
        const shade = DATA_SHADE[p % 2];
        procMetrics.forEach((m, mi) => {
          const col = leadCount + p * perProc + mi + 1;
          const c = r.getCell(col);
          c.numFmt = m.key === 'uph' ? '#,##0' : '#,##0.00';
          c.alignment = { horizontal: 'right' };
          if (shade) c.fill = fillOf(shade);
        });
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  link.download = `cycle-time-metrics_${customer}_${ts}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
