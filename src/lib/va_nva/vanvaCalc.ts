/**
 * vanvaCalc.ts
 * ─────────────
 * Re-implements every formula in the KPI Tracker workbook, parameterised on
 * the NVA target so the whole sheet can be re-run at any % rather than the
 * hardcoded 20%.
 *
 * Workbook formula → function:
 *   H = C + L            → overallRound
 *   I = D + L            → overallDecimal
 *   M = L / H            → nvaRatio
 *   P = H * 0.2          → nvaTarget   (target is a parameter here)
 *   Q = L - P            → toReduce
 *
 * Two deliberate departures from the workbook, both to stop it lying:
 *   • M returns null (not 0) when a row has no NVA MFG figure.
 *   • Plant totals skip role 'child' and role 'aggregate' rows, so the
 *     LAM GAS BOX and KEYSIGHT breakdowns are not counted twice.
 */

import {
  NVA_TARGET, getMaturityStage, getVaNvaStatus,
} from '@/lib/va_nva/vanvaConstants';
import type { VaNvaMetrics, VaNvaRow, VaNvaTotals } from '@/pages/vanva/types';

const add = (a: number | null, b: number | null): number | null =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

/** Derive every computed column for one row at the given NVA target (0–1). */
export function withMetrics(row: VaNvaRow, target: number = NVA_TARGET): VaNvaMetrics {
  const overallRound = add(row.vaSizingRound, row.nvaMfg);
  const overallDecimal = add(row.vaSizingDecimal, row.nvaMfg);

  // Null, not 0: "no NVA recorded" and "zero NVA" are different findings.
  const nvaRatio = row.nvaMfg === null || !overallRound
    ? null
    : row.nvaMfg / overallRound;

  const nvaTarget = overallRound === null ? null : overallRound * target;
  const toReduce = row.nvaMfg === null || nvaTarget === null ? null : row.nvaMfg - nvaTarget;

  return {
    ...row,
    overallRound,
    overallDecimal,
    nvaRatio,
    vaRatio: nvaRatio === null ? null : 1 - nvaRatio,
    nvaTarget,
    toReduce,
    sizingGap: row.vaActual === null || row.vaSizingRound === null
      ? null : row.vaActual - row.vaSizingRound,
    ppqtVsMfg: row.nvaPpqt === null || row.nvaMfg === null
      ? null : row.nvaPpqt - row.nvaMfg,
    status: getVaNvaStatus(nvaRatio),
    stage: getMaturityStage(nvaRatio),
  };
}

export const withMetricsAll = (rows: VaNvaRow[], target: number = NVA_TARGET): VaNvaMetrics[] =>
  rows.map(r => withMetrics(r, target));

/** Rows that count once toward a plant figure. Children roll into their parent;
 *  'aggregate' rows are plan lines, not customers. */
export const countable = <T extends VaNvaRow>(rows: T[]): T[] =>
  rows.filter(r => r.role === 'workcell' || r.role === 'parent');

/** Rows with an NVA figure — the only ones that can be ranked or charted by ratio. */
export const measured = (rows: VaNvaMetrics[]): VaNvaMetrics[] =>
  countable(rows).filter(r => r.nvaRatio !== null);

const sum = (rows: VaNvaMetrics[], pick: (r: VaNvaMetrics) => number | null) =>
  rows.reduce((s, r) => s + (pick(r) ?? 0), 0);

/** Plant rollup. NVA % here is total NVA / total DL, not an average of ratios —
 *  averaging percentages would let a 4-head workcell outweigh a 400-head one. */
export function plantTotals(rows: VaNvaMetrics[], target: number = NVA_TARGET): VaNvaTotals {
  const rs = countable(rows);
  const vaSizing = sum(rs, r => r.vaSizingRound);
  const nvaMfg = sum(rs, r => r.nvaMfg);
  const overall = vaSizing + nvaMfg;
  const nvaRatio = overall ? nvaMfg / overall : 0;
  const nvaTarget = overall * target;
  return {
    workcells: rs.length,
    vaSizing,
    vaActual: sum(rs, r => r.vaActual),
    nvaMfg,
    nvaPpqt: sum(rs, r => r.nvaPpqt),
    overall,
    nvaRatio,
    vaRatio: 1 - nvaRatio,
    nvaTarget,
    toReduce: nvaMfg - nvaTarget,
    aboveTarget: rs.filter(r => r.nvaRatio !== null && r.nvaRatio > target).length,
  };
}

/** Total DL that could be freed if every workcell over target hit it.
 *  Only positive gaps count — a workcell already below target does not
 *  hand its slack to a workcell above it. */
export const reducibleDl = (rows: VaNvaMetrics[]): number =>
  countable(rows).reduce((s, r) => s + Math.max(r.toReduce ?? 0, 0), 0);

/** Sweep the target across a range for the simulation curve. */
export function sweepTarget(
  rows: VaNvaRow[],
  from = 0.05, to = 0.5, step = 0.05,
): { target: number; reducible: number; workcellsAbove: number }[] {
  const out: { target: number; reducible: number; workcellsAbove: number }[] = [];
  // Integer loop, not a float accumulator — 0.05 accumulated 10× drifts.
  const steps = Math.round((to - from) / step);
  for (let i = 0; i <= steps; i++) {
    const target = +(from + i * step).toFixed(4);
    const m = withMetricsAll(rows, target);
    out.push({
      target,
      reducible: +reducibleDl(m).toFixed(1),
      workcellsAbove: countable(m).filter(r => r.nvaRatio !== null && r.nvaRatio > target).length,
    });
  }
  return out;
}

/** Histogram of workcells by NVA band, 10-point buckets. */
export function nvaHistogram(rows: VaNvaMetrics[]): { band: string; count: number; lo: number }[] {
  const buckets = [0, 10, 20, 30, 40, 50];
  const counts = buckets.map(() => 0);
  measured(rows).forEach(r => {
    const p = (r.nvaRatio as number) * 100;
    const idx = Math.min(Math.floor(p / 10), buckets.length - 1);
    counts[idx]++;
  });
  return buckets.map((lo, i) => ({
    band: i === buckets.length - 1 ? `${lo}%+` : `${lo}–${lo + 10}%`,
    count: counts[i],
    lo,
  }));
}

// ─── HC sizing plan ──────────────────────────────────────────────────────────
/**
 * How many DL heads each workcell must lose or gain to sit at the target NVA %.
 *
 * ONE SYMMETRIC RULE, BOTH DIRECTIONS
 *     nvaTarget = overallRound * target
 *     delta     = nvaMfg - nvaTarget
 *   delta > 0  ->  REDUCE  ceil(delta)   the workcell carries too much NVA
 *   delta < 0  ->  ADD     ceil(-delta)  it sits under target and can absorb more
 *
 * WHY THE RESULT IS NOT EXACTLY THE TARGET, ON PURPOSE
 *   `nvaTarget` is a share of TODAY's total, and removing NVA heads shrinks that
 *   total — so a cut computed this way lands above the target, not on it. VA 5 +
 *   NVA 5 cutting 3 leaves 2/7 = 28.6%, not 20%. Landing on the number exactly
 *   would mean holding VA fixed and solving nvaNew = VA * t/(1-t), a bigger cut.
 *   The workbook's version is kept deliberately so this page and the existing
 *   tracker never disagree; `projectedRatio` below reports where it ACTUALLY
 *   lands, so the gap is visible instead of assumed away.
 *
 * ROUNDING
 *   Heads are whole. ceil() on the magnitude, so a reduction is never
 *   under-stated and an addition is never over-promised. Summing the rounded
 *   per-workcell figures therefore drifts from the plant-level number — both are
 *   returned rather than picking one and hiding the difference.
 */
export interface SizingRow {
  id: string;
  workcell: string;
  vaSizing: number;
  nvaMfg: number;
  overall: number;
  nvaRatio: number | null;
  nvaTarget: number;
  /** Signed: positive = reduce, negative = add. Unrounded. */
  delta: number;
  /** Whole heads to remove (0 when the workcell is under target). */
  reduce: number;
  /** Whole heads that could be added (0 when the workcell is over target). */
  add: number;
}

export interface SizingPlan {
  rows: SizingRow[];
  /** Plant as it stands. */
  vaSizing: number;
  nvaMfg: number;
  overall: number;
  nvaRatio: number;
  /** Summed from the ROUNDED per-workcell figures — the actionable number. */
  totalReduce: number;
  totalAdd: number;
  netChange: number;
  /** Where the plant NVA % actually lands after the plan, which is not the
   *  target — see the note above. */
  projectedNva: number;
  projectedOverall: number;
  projectedRatio: number;
  over: number;
  under: number;
}

export function sizingPlan(rows: VaNvaMetrics[], target: number = NVA_TARGET): SizingPlan {
  const rs = countable(rows).filter(r => r.nvaMfg !== null && r.overallRound !== null);
  const out: SizingRow[] = rs.map(r => {
    const overall = r.overallRound as number;
    const nvaMfg = r.nvaMfg as number;
    const nvaTarget = overall * target;
    const delta = nvaMfg - nvaTarget;
    return {
      id: r.id, workcell: r.workcell,
      vaSizing: r.vaSizingRound ?? 0,
      nvaMfg, overall, nvaRatio: r.nvaRatio, nvaTarget, delta,
      reduce: delta > 0 ? Math.ceil(delta) : 0,
      add: delta < 0 ? Math.ceil(-delta) : 0,
    };
  // Worst first by NVA %, not by head gap: the table is read against the
  // target column, and a 400-head workcell 2 points over would otherwise
  // outrank a 10-head one at double the target.
  }).sort((a, b) => (b.nvaRatio ?? -1) - (a.nvaRatio ?? -1));

  const vaSizing = out.reduce((a, r) => a + r.vaSizing, 0);
  const nvaMfg = out.reduce((a, r) => a + r.nvaMfg, 0);
  const overall = vaSizing + nvaMfg;
  const totalReduce = out.reduce((a, r) => a + r.reduce, 0);
  const totalAdd = out.reduce((a, r) => a + r.add, 0);
  const projectedNva = nvaMfg - totalReduce + totalAdd;
  const projectedOverall = vaSizing + projectedNva;

  return {
    rows: out, vaSizing, nvaMfg, overall,
    nvaRatio: overall ? nvaMfg / overall : 0,
    totalReduce, totalAdd, netChange: totalReduce - totalAdd,
    projectedNva, projectedOverall,
    projectedRatio: projectedOverall ? projectedNva / projectedOverall : 0,
    over: out.filter(r => r.reduce > 0).length,
    under: out.filter(r => r.add > 0).length,
  };
}
