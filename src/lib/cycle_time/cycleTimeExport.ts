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
      const eff = s.eff != null && s.eff > 0 ? (s.eff > 1 ? s.eff / 100 : s.eff) : EXPORT_EFFICIENCY;
      const yieldRate = s.fpy != null && s.fpy > 0 ? s.fpy / 100 : 1;
      return (3600 / ct) * eff * yieldRate;
    }
  }
}

/**
 * Combine a logical process — all steps sharing a display label (e.g. the four
 * "SUB MA 1 - …" sub-ops) — into one value per metric:
 *   manual/imt/machine/total_ct → summed across the steps
 *   uph                         → 3600 / (Σ CT) × eff × (Π FPY)  (yield compounds)
 */
function combinedMetricValue(metric: FlowExportMetric, steps: CycleTimeAssemblyBuildStep[]): number | null {
  if (metric === 'uph') {
    let ct = 0;
    let fpyRate = 1;
    let eff: number | null = null;
    for (const s of steps) {
      ct += ctSeconds(s);
      if (s.fpy != null && s.fpy > 0) fpyRate *= s.fpy / 100;
      if (eff == null && s.eff != null) eff = s.eff;
    }
    if (!(ct > 0)) return null;
    const effRate = eff != null && eff > 0 ? (eff > 1 ? eff / 100 : eff) : EXPORT_EFFICIENCY;
    return (3600 / ct) * effRate * fpyRate;
  }
  // Linear metrics: sum the per-step values.
  let sum = 0;
  let any = false;
  for (const s of steps) {
    const v = metricValue(metric, s);
    if (v != null) { sum += v; any = true; }
  }
  return any ? sum : null;
}

/** Keep only the part before a separator dash (hyphen "-", en-dash "–", or
 *  em-dash "—") that has whitespace on at least one side — handles inconsistent
 *  spacing ("HLA 1– X" / "HLA 2 –X" / "BIRTH 1 - X") while preserving genuine
 *  hyphenated names like "HI-PORT". Mirrors stepLabel() in the Flow page. */
function trimStep(step: string): string {
  const i = step.search(/\s+[-–—]|[-–—]\s+/);
  return i >= 0 ? step.slice(0, i).trim() : step;
}

// Worksheet tab colours per workcenter — match the FE WC_DOT palette
// (SMT emerald-500, TH sky-500, BE violet-500).
const WC_TAB_COLOR: Record<string, string> = {
  SMT: 'FF10B981',
  TH:  'FF0EA5E9',
  BE:  'FF8B5CF6',
};
const WC_TAB_DEFAULT = 'FF6B7280';
const STAGE_ORDER = ['SMT', 'TH', 'BE'];
const stageRank = (wc: string) => {
  const i = STAGE_ORDER.indexOf(wc);
  return i < 0 ? STAGE_ORDER.length : i;
};

/** Excel-safe, unique worksheet name: strip illegal chars (\ / ? * [ ] :),
 *  cap at 31, and disambiguate collisions with a numeric suffix. */
function safeSheetName(base: string, used: Set<string>): string {
  let name = base.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  if (used.has(name.toLowerCase())) {
    let i = 2;
    let candidate: string;
    do {
      const suffix = ` (${i})`;
      candidate = name.slice(0, 31 - suffix.length) + suffix;
      i++;
    } while (used.has(candidate.toLowerCase()));
    name = candidate;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Run `task` over `items` with bounded concurrency. Stops launching new tasks
 *  once `signal` is aborted (cooperative cancellation). */
async function pooledMap<T, R>(
  items: T[], limit: number, task: (item: T) => Promise<R>, signal?: AbortSignal,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      if (signal?.aborted) return;
      const i = next++;
      out[i] = await task(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** True when an error is an abort (user cancelled). */
function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

interface FlowExportOpts {
  customer: string;
  /** Assembly numbers to export (current workcell, after any active filters). */
  assemblies: string[];
  /** Selected metrics — exported in canonical order regardless of pick order. */
  metrics: FlowExportMetric[];
  /** Workcenters to include (e.g. ['SMT','TH','BE']); steps in others are dropped. */
  stages: string[];
  /** Optional progress callback (assemblies fetched / total). */
  onProgress?: (done: number, total: number) => void;
  /** Abort signal — cancels in-flight fetches and skips the file build. */
  signal?: AbortSignal;
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
  customer, assemblies, metrics, stages, onProgress, signal,
}: FlowExportOpts): Promise<void> {
  if (!assemblies.length || !metrics.length || !stages.length) {
    console.warn('exportFlowMetricsXlsx: nothing to export');
    return;
  }

  const showSmh = metrics.includes('smh');
  const procMetrics = PER_PROCESS_METRICS.filter((m) => metrics.includes(m.key));
  // SMH-only export still needs a value to show; nothing per-process to spread.
  const hasProcMetrics = procMetrics.length > 0;
  const stageSet = new Set(stages.map((s) => s.toUpperCase()));

  // Fetch every assembly's process detail, then keep only the selected
  // workcenters. Assemblies with no remaining steps are dropped.
  let done = 0;
  const fetched = await pooledMap(assemblies, 8, async (assembly) => {
    try {
      const repr = representativeSteps(await cycleTimeApi.assemblyBuilds.list(customer, assembly, undefined, signal));
      const steps = repr.filter((s) => stageSet.has(String(s.workcenter ?? '').toUpperCase()));
      return { assembly, steps };
    } catch (e) {
      if (!isAbort(e)) console.warn(`export: failed to fetch ${assembly}`, e);
      return { assembly, steps: [] as CycleTimeAssemblyBuildStep[] };
    } finally {
      onProgress?.(++done, assemblies.length);
    }
  }, signal);

  // Cancelled mid-fetch — don't build or download a partial file.
  if (signal?.aborted) return;

  const perAssembly = fetched.filter((a) => a.steps.length > 0);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();

  // Layout constants shared by every sub-workcenter sheet.
  const leadCount = 1 + (showSmh ? 1 : 0);          // Assembly (+ SMH)
  const perProc = procMetrics.length;
  const HEAD1_SHADE = ['FF1F2937', 'FF2D3B4E'];
  const HEAD2_SHADE = ['FF374151', 'FF44546A'];
  const DATA_SHADE: (string | null)[] = [null, 'FFEAF1F8']; // plain / soft blue-grey
  const fillOf = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

  // Thin grid border on every cell — Excel hides its default gridlines under a
  // fill, so shaded blocks look borderless without this.
  const thin = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
  const cellBorder = { top: thin, left: thin, bottom: thin, right: thin };
  const borderRow = (row: import('exceljs').Row, nCols: number) => {
    for (let c = 1; c <= nCols; c++) row.getCell(c).border = cellBorder;
  };

  /** Build one worksheet for a single sub-workcenter from its scoped rows.
   *  Rows are already scoped to one line, so process names are unique and
   *  ordering by step_order is the line's true flow (no cross-line scramble). */
  function buildSheet(
    sheetName: string,
    rows: { assembly: string; steps: CycleTimeAssemblyBuildStep[] }[],
    tabColor?: string,
  ) {
    // Column identity = process label: steps sharing a label (e.g. the four
    // "SUB MA 1 - …" sub-ops) are ONE column — their metrics are summed and UPH
    // recomputed from the total, matching the FE compact view. Columns ordered
    // by each label's earliest step.
    const colByLabel = new Map<string, number>();
    for (const { steps } of rows) {
      for (const s of steps) {
        const label = trimStep(s.step);
        const ord = s.step_order ?? Number.MAX_SAFE_INTEGER;
        const cur = colByLabel.get(label);
        if (cur == null || ord < cur) colByLabel.set(label, ord);
      }
    }
    const processes = [...colByLabel.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([label]) => label);

    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: leadCount, ySplit: 2 }],
      properties: tabColor ? { tabColor: { argb: tabColor } } : undefined,
    });

    const widths = [22, ...(showSmh ? [11] : [])];
    if (hasProcMetrics) for (let i = 0; i < processes.length * perProc; i++) widths.push(11);
    ws.columns = widths.map((w) => ({ width: w }));

    // Header row 1: Assembly | SMH (these lead cells are merged down over both
    // header rows, so the LABEL must live on row 1 — the merge keeps the
    // top-left cell's value) + process group names (merged across metric blocks).
    const r1: (string | number)[] = ['Assembly', ...(showSmh ? ['SMH'] : [])];
    if (hasProcMetrics) for (const p of processes) { r1.push(p); for (let i = 1; i < perProc; i++) r1.push(''); }
    const headerRow1 = ws.addRow(r1);
    headerRow1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow1.height = 20;

    // Header row 2: lead cells blank (covered by the merge) + metric labels.
    const r2: (string | number)[] = ['', ...(showSmh ? [''] : [])];
    if (hasProcMetrics) for (let p = 0; p < processes.length; p++) for (const m of procMetrics) r2.push(m.header);
    const headerRow2 = ws.addRow(r2);
    headerRow2.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow2.height = 18;

    // Merge process-name cells (row 1) and tint both header rows per block.
    if (hasProcMetrics) {
      processes.forEach((_, pi) => {
        const start = leadCount + pi * perProc + 1;
        if (perProc > 1) ws.mergeCells(1, start, 1, start + perProc - 1);
        headerRow1.getCell(start).fill = fillOf(HEAD1_SHADE[pi % 2]);
        for (let i = 0; i < perProc; i++) headerRow2.getCell(start + i).fill = fillOf(HEAD2_SHADE[pi % 2]);
      });
    }
    ws.mergeCells(1, 1, 2, 1);
    if (showSmh) ws.mergeCells(1, 2, 2, 2);

    const totalCols = leadCount + (hasProcMetrics ? processes.length * perProc : 0);
    borderRow(headerRow1, totalCols);
    borderRow(headerRow2, totalCols);

    // Data rows: one per assembly.
    for (const { assembly, steps } of rows) {
      // Group the assembly's steps by label so same-name sub-ops combine.
      const byLabel = new Map<string, CycleTimeAssemblyBuildStep[]>();
      for (const s of steps) {
        const label = trimStep(s.step);
        const arr = byLabel.get(label);
        if (arr) arr.push(s); else byLabel.set(label, [s]);
      }

      const smhTotal = showSmh
        ? steps.reduce((sum, s) => sum + (metricValue('smh', s) ?? 0), 0)
        : null;

      const cells: (string | number)[] = [assembly];
      if (showSmh) cells.push(smhTotal == null ? '' : Number(smhTotal.toFixed(2)));
      if (hasProcMetrics) {
        for (const label of processes) {
          const grp = byLabel.get(label);
          for (const m of procMetrics) {
            if (!grp) { cells.push(''); continue; }
            const v = combinedMetricValue(m.key, grp);
            cells.push(v == null ? '' : Number(v.toFixed(m.key === 'uph' ? 0 : 2)));
          }
        }
      }

      const r = ws.addRow(cells);
      r.font = { name: 'Calibri', size: 10 };
      r.alignment = { vertical: 'middle' };
      if (showSmh) { const c = r.getCell(2); c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'center' }; }
      if (hasProcMetrics) {
        for (let p = 0; p < processes.length; p++) {
          const shade = DATA_SHADE[p % 2];
          procMetrics.forEach((m, mi) => {
            const col = leadCount + p * perProc + mi + 1;
            const c = r.getCell(col);
            c.numFmt = m.key === 'uph' ? '#,##0' : '#,##0.00';
            c.alignment = { horizontal: 'center' };
            if (shade) c.fill = fillOf(shade);
          });
        }
      }
      borderRow(r, totalCols);
    }
  }

  // One sheet per SUB-WORKCENTER (line). Collect each line's workcenter +
  // earliest step order, then emit sheets grouped SMT → TH → BE and within
  // each stage by flow order. Sheet name = "<sub_workcenter> (<workcenter>)",
  // tab coloured by workcenter.
  const lines = new Map<string, { wc: string; minOrder: number }>();
  for (const { steps } of perAssembly) {
    for (const s of steps) {
      const swc = s.sub_workcenter;
      if (!swc) continue;
      const wc = String(s.workcenter ?? '').toUpperCase();
      const ord = s.step_order ?? Number.MAX_SAFE_INTEGER;
      const cur = lines.get(swc);
      if (!cur) lines.set(swc, { wc, minOrder: ord });
      else if (ord < cur.minOrder) cur.minOrder = ord;
    }
  }
  const orderedLines = [...lines.entries()].sort(
    (a, b) =>
      stageRank(a[1].wc) - stageRank(b[1].wc)
      || a[1].minOrder - b[1].minOrder
      || a[0].localeCompare(b[0]),
  );

  const usedNames = new Set<string>();
  for (const [swc, { wc }] of orderedLines) {
    const scoped = perAssembly
      .map((a) => ({
        assembly: a.assembly,
        steps: a.steps.filter((s) => s.sub_workcenter === swc),
      }))
      .filter((a) => a.steps.length > 0);
    if (!scoped.length) continue;
    const name = safeSheetName(`${swc} (${wc})`, usedNames);
    buildSheet(name, scoped, WC_TAB_COLOR[wc] ?? WC_TAB_DEFAULT);
  }
  if (wb.worksheets.length === 0) buildSheet('No data', []);

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
