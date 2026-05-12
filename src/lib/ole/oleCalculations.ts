/**
 * oleCalculations.ts
 * ──────────────────
 * Pure aggregation / formula helpers for OLE data.
 * No React, no side effects — safe to import anywhere.
 */

import type { OleWeeklyResult } from '@/lib/ole/oleApi';
import { formatWeekLabel } from '@/lib/ole/oleConstants';
import type {
  AggregateTotals,
  WeeklyTrendPoint,
  WorkcellAggregate,
} from './oleTypes';

/** OLE % = (output SMH / input hours) * 100. Safe against div-by-zero. */
export function calculateOLE(outputSmh: number, inputHours: number): number {
  return inputHours > 0 ? (outputSmh / inputHours) * 100 : 0;
}

/** OLE % rounded to 2 decimal places (matches weekly-trend rounding behavior). */
export function calculateOLERounded(outputSmh: number, inputHours: number): number {
  return inputHours > 0 ? Math.round((outputSmh / inputHours) * 10000) / 100 : 0;
}

/**
 * Group weekly rows by workcell, summing totals.
 * Matches the old `aggregateFromWeekly()` in OlePlantReport.
 */
export function aggregateByWorkcell(rows: OleWeeklyResult[]): WorkcellAggregate[] {
  const map: Record<string, WorkcellAggregate> = {};
  rows.forEach(r => {
    if (!map[r.workcell]) {
      map[r.workcell] = {
        workcell: r.workcell,
        total_output_smh: 0,
        total_input_hours: 0,
        total_qty: 0,
        total_shifts: 0,
        flagged_shifts: 0,
      };
    }
    const m = map[r.workcell];
    m.total_output_smh += r.total_output_smh;
    m.total_input_hours += r.total_input_hours;
    m.total_qty += r.total_qty;
    m.total_shifts += r.shift_count;
    m.flagged_shifts += r.shifts_flagged;
  });
  return Object.values(map);
}

/**
 * Sum weekly rows into a single totals object (with OLE %).
 * Matches the old `aggregateWcWeekly()` in OleWorkcellReport.
 */
export function aggregateTotals(rows: OleWeeklyResult[]): AggregateTotals {
  const out = rows.reduce((s, r) => s + r.total_output_smh, 0);
  const inp = rows.reduce((s, r) => s + r.total_input_hours, 0);
  return {
    ole_pct: calculateOLE(out, inp),
    total_output_smh: out,
    total_input_hours: inp,
    total_qty: rows.reduce((s, r) => s + r.total_qty, 0),
    total_shifts: rows.reduce((s, r) => s + r.shift_count, 0),
    flagged_shifts: rows.reduce((s, r) => s + r.shifts_flagged, 0),
  };
}

/**
 * Group weekly rows by week_label, summing smh/hrs and computing OLE.
 * Returns chart-ready points sorted by iso_week ascending.
 * Matches the `siteWeeklyFull` useMemo blocks in OlePlantReport.
 */
export function aggregateByWeek(rows: OleWeeklyResult[]): WeeklyTrendPoint[] {
  const byWeek: Record<string, { smh: number; hrs: number; week: number }> = {};
  rows.forEach(r => {
    if (!byWeek[r.week_label]) {
      byWeek[r.week_label] = { smh: 0, hrs: 0, week: r.iso_week };
    }
    byWeek[r.week_label].smh += r.total_output_smh;
    byWeek[r.week_label].hrs += r.total_input_hours;
  });
  return Object.values(byWeek)
    .sort((a, b) => a.week - b.week)
    .map(w => ({
      w: formatWeekLabel(w.week),
      isoWeek: w.week,
      ole: calculateOLERounded(w.smh, w.hrs),
      smh: w.smh,
      hrs: w.hrs,
    }));
}
