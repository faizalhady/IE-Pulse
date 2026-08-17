/**
 * types.ts — VA / NVA module domain types.
 *
 * Source of truth is the IE "KPI Tracker VA NVA" workbook:
 *   Sheet1 → one row per workcell, VA direct-labour sizing vs NVA actuals
 *   Sheet2 → lean maturity target bands
 *
 * Column map (Sheet1 → field):
 *   B WC                        → workcell
 *   C DL SIZING (Roundup #)     → vaSizingRound
 *   D DL SIZING (Decimal)       → vaSizingDecimal
 *   E ACTUAL                    → vaActual
 *   F Crew                      → crew
 *   K NVA ACTUAL PPQT           → nvaPpqt
 *   L NVA ACTUAL MFG            → nvaMfg
 *   H/I/M/P/Q                   → all derived, see lib/va_nva/vanvaCalc.ts
 */

/** How a row participates in plant totals.
 *  - workcell : a normal customer workcell, counted once
 *  - parent   : a rollup row whose children are also listed (counted, children skipped)
 *  - child    : a breakdown row under a parent (NOT counted — the sheet double-counts these)
 *  - aggregate: a plan/summary row that is not a customer (excluded from totals) */
export type VaNvaRole = 'workcell' | 'parent' | 'child' | 'aggregate';

export type VaNvaStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/** Sheet2 lean maturity ladder. */
export type MaturityStageKey = 'baseline' | 'short_term' | 'mid_term' | 'long_term';

/** A raw row exactly as it appears in the workbook. Nulls are blank cells. */
export interface VaNvaRow {
  id: string;
  workcell: string;
  role: VaNvaRole;
  /** id of the parent row when role === 'child'. */
  parentId?: string;
  vaSizingRound: number | null;
  vaSizingDecimal: number | null;
  vaActual: number | null;
  crew: number | null;
  nvaPpqt: number | null;
  nvaMfg: number | null;
  /** Data-quality note surfaced in the UI so the caveat travels with the row. */
  note?: string;
}

/** A row plus everything derived from it at a given NVA target. */
export interface VaNvaMetrics extends VaNvaRow {
  /** H = C + L — total DL including NVA. */
  overallRound: number | null;
  /** I = D + L. */
  overallDecimal: number | null;
  /** M = L / H, as 0–1. Null when the row has no NVA MFG figure (the sheet
   *  shows a misleading 0% for these). */
  nvaRatio: number | null;
  vaRatio: number | null;
  /** P = H × target. */
  nvaTarget: number | null;
  /** Q = L − P. Positive = DL to cut, negative = already under target. */
  toReduce: number | null;
  /** E − C. Positive = more heads on the floor than the sizing calls for. */
  sizingGap: number | null;
  /** K − L. The workbook collects PPQT NVA but never uses it; this makes the
   *  gap between the two NVA sources visible. */
  ppqtVsMfg: number | null;
  status: VaNvaStatus;
  stage: MaturityStageKey | null;
}

/** Plant-level rollup over the rows that count (workcell + parent). */
export interface VaNvaTotals {
  workcells: number;
  vaSizing: number;
  vaActual: number;
  nvaMfg: number;
  nvaPpqt: number;
  overall: number;
  nvaRatio: number;
  vaRatio: number;
  nvaTarget: number;
  toReduce: number;
  aboveTarget: number;
}

/** One uploaded workbook. The FE keeps a list so a user can compare periods. */
export interface VaNvaDataset {
  id: string;
  filename: string;
  periodLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  rowCount: number;
  active: boolean;
  rows: VaNvaRow[];
}
