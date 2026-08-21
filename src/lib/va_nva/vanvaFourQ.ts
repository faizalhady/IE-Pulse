/**
 * vanvaFourQ.ts
 * ──────────────
 * The VA/NVA 4Q's numbers, all derived from sizingPlan() so the report and the
 * sizing page can never disagree.
 *
 *   Q1  monthlyTrend        plant NVA % per month, the last 12 ending at the report month
 *   Q2  threeMonthAverage   whole heads to cut per workcell, AVERAGED over the last 3
 *                           of those months — OLE's "avg of the last 4 weeks", in months
 *   Q4  nvaTracker          NVA % per workcell per month, plus the plant row
 *
 * Scope is a list of workcell NAMES (what ScopePicker hands back). Empty = all.
 * A workcell absent from a month counts as 0 heads that month, the same way
 * OLE's average is paid-weighted over real hours rather than an average of
 * percentages.
 */

import { sizingPlan, withMetricsAll } from '@/lib/va_nva/vanvaCalc';
import { NVA_TARGET } from '@/lib/va_nva/vanvaConstants';
import type { VaNvaDataset, VaNvaRow } from '@/pages/vanva/types';

export const Q1_MONTHS = 12;
export const Q2_MONTHS = 3;

/** Datasets up to and including `period`, oldest first, at most `n`. */
export function monthWindow(datasets: VaNvaDataset[], period: string, n = Q1_MONTHS): VaNvaDataset[] {
  return datasets
    .filter(d => d.period <= period)
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-n);
}

const scoped = (rows: VaNvaRow[], picked: string[]) =>
  picked.length ? rows.filter(r => picked.includes(r.workcell)) : rows;

const planFor = (d: VaNvaDataset, target: number, picked: string[]) =>
  sizingPlan(withMetricsAll(scoped(d.rows, picked), target), target);

export interface MonthPoint {
  period: string;
  nvaRatio: number;
  overall: number;
  nvaMfg: number;
  vaSizing: number;
  reduce: number;
  add: number;
}

export function monthlyTrend(
  datasets: VaNvaDataset[], period: string, target = NVA_TARGET, picked: string[] = [],
): MonthPoint[] {
  return monthWindow(datasets, period).map(d => {
    const p = planFor(d, target, picked);
    return {
      period: d.period, nvaRatio: p.nvaRatio, overall: p.overall, nvaMfg: p.nvaMfg,
      vaSizing: p.vaSizing, reduce: p.totalReduce, add: p.totalAdd,
    };
  });
}

export interface WorkcellAvg {
  workcell: string;
  /** Average whole heads to cut per month over the window. */
  reduce: number;
  /** NVA share over the same months, weighted by heads. */
  nvaRatio: number;
  /** How many of the window's months the workcell appeared in. */
  months: number;
}

export function threeMonthAverage(
  datasets: VaNvaDataset[], period: string, target = NVA_TARGET, picked: string[] = [], n = Q2_MONTHS,
): WorkcellAvg[] {
  const months = monthWindow(datasets, period).slice(-n);
  const acc = new Map<string, { reduce: number; nva: number; overall: number; months: number }>();
  for (const d of months) {
    for (const r of planFor(d, target, picked).rows) {
      const a = acc.get(r.workcell) ?? { reduce: 0, nva: 0, overall: 0, months: 0 };
      a.reduce += r.reduce; a.nva += r.nvaMfg; a.overall += r.overall; a.months += 1;
      acc.set(r.workcell, a);
    }
  }
  return [...acc.entries()]
    .map(([workcell, a]) => ({
      workcell,
      reduce: months.length ? a.reduce / months.length : 0,
      nvaRatio: a.overall ? a.nva / a.overall : 0,
      months: a.months,
    }))
    .sort((x, y) => y.reduce - x.reduce);
}

export interface TrackerRow {
  workcell: string;
  /** NVA share per month, aligned with Tracker.periods. Null = not in that month. */
  cells: (number | null)[];
  latest: number | null;
  /** Latest minus previous month, as a ratio. Negative is good. */
  delta: number | null;
}

export interface Tracker {
  periods: string[];
  rows: TrackerRow[];
  plant: TrackerRow;
}

export function nvaTracker(
  datasets: VaNvaDataset[], period: string, target = NVA_TARGET, picked: string[] = [],
): Tracker {
  const months = monthWindow(datasets, period);
  const plans = months.map(d => planFor(d, target, picked));
  const names = new Set<string>();
  plans.forEach(p => p.rows.forEach(r => names.add(r.workcell)));

  const row = (workcell: string, pick: (p: ReturnType<typeof sizingPlan>) => number | null): TrackerRow => {
    const cells = plans.map(pick);
    const latest = cells[cells.length - 1] ?? null;
    const prev = cells[cells.length - 2] ?? null;
    return { workcell, cells, latest, delta: latest != null && prev != null ? latest - prev : null };
  };

  return {
    periods: months.map(d => d.period),
    rows: [...names]
      .map(w => row(w, p => p.rows.find(r => r.workcell === w)?.nvaRatio ?? null))
      .sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1)),
    plant: row('Plant', p => (p.overall ? p.nvaRatio : null)),
  };
}
