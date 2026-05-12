/**
 * useAnalysisData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Data + formula layer for the OLE Analysis page.
 *
 * Live sources (from /api/ole/weekly):
 *   - per-workcell: ole_pct, total_qty, total_input_hours, avg_hc_direct
 *   - site totals derived by aggregating across all workcells per week
 *
 * Manual / future-linked:
 *   - DL headcount (dl) — no API source yet; stored here until eTMS DB link added
 *
 * Formulas:
 *   - buildUnitGap     → curr.totalQty  - prev.totalQty   (per workcell)
 *   - siteGap          → curr.siteQty   - prev.siteQty
 *   - impactScore      → |((inputHrs - qty) / GOAL) / (inputHrs × OLE%)| per WC
 *   - impactShare %    → workcell impact / Σ all impacts × 100
 */

import { useEffect, useMemo, useState } from 'react';
import { TEMP_EXCLUDED_WORKCELLS } from '@/lib/ole/oleConstants';

export const PLANT_OLE_GOAL = 0.61; // 61%
const API_BASE = '/ietools/ole/api';

// ─── DL Weekly — manual until eTMS DB linked ─────────────────────────────────

export interface DLRow { week: string; dl: number }

export const DL_WEEKLY_DATA: DLRow[] = [
  { week: 'WW05', dl: 4199 },
  { week: 'WW06', dl: 4190 },
  { week: 'WW07', dl: 4280 },
  { week: 'WW08', dl: 4200 },
  { week: 'WW09', dl: 4227 },
  { week: 'WW10', dl: 4244 },
  { week: 'WW11', dl: 4313 },
  { week: 'WW12', dl: 4198 },
  { week: 'WW13', dl: 4237 },
  { week: 'WW14', dl: 4318 },
  { week: 'WW15', dl: 4341 },
  { week: 'WW16', dl: 4338 },
  { week: 'WW17', dl: 4369 },
  { week: 'WW18', dl: 4369 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by /api/ole/weekly for one row */
export interface WeeklyApiRow {
  workcell: string;
  iso_year: number;
  iso_week: number;
  week_label: string;       // "2025-W16"
  week_start_date: string;
  total_qty: number;
  total_output_smh: number;
  total_input_hours: number;
  avg_hc_direct: number;
  total_va_hours: number;
  total_nva_hours: number;
  ole_pct: number | null;
  stage_label: string;
}

// ─── Week label conversion ────────────────────────────────────────────────────
// API returns "2025-W16", UI uses "WW16"

export function apiLabelToWW(label: string): string {
  // "2025-W16" → "WW16"  |  "2026-W03" → "WW03"
  const m = label.match(/-W(\d+)$/);
  if (!m) return label;
  return `WW${m[1].padStart(2, '0')}`;
}

export function wwToApiLabel(ww: string, year: number): string {
  // "WW16" → "2025-W16"
  const num = ww.replace('WW', '').replace(/^0/, '');
  return `${year}-W${num.padStart(2, '0')}`;
}

// ─── Formulas ─────────────────────────────────────────────────────────────────

/** Build unit gap: positive = improvement */
export function calcBuildUnitGap(currQty: number, prevQty: number): number {
  return currQty - prevQty;
}

/**
 * Workcell impact score
 * Formula: ((inputHrs - qty) / PLANT_GOAL) / (inputHrs × OLE%)
 * Returns absolute value — sign is directional only (above/below target).
 */
export function calcWorkcellImpact(
  inputHrs: number,
  qty: number,
  olePct: number   // 0–100
): number {
  const ole = olePct / 100;
  const denom = inputHrs * ole;
  if (denom === 0) return 0;
  return Math.abs((inputHrs - qty) / PLANT_OLE_GOAL / denom);
}

/**
 * Convert raw impact scores → % share for the donut chart
 */
export function calcImpactShares(
  scores: Array<{ name: string; raw: number }>
): Array<{ name: string; value: number }> {
  const total = scores.reduce((s, x) => s + x.raw, 0);
  if (total === 0) return scores.map(s => ({ name: s.name, value: 0 }));
  return scores
    .map(s => ({ name: s.name, value: parseFloat(((s.raw / total) * 100).toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

// ─── Week pair helpers ────────────────────────────────────────────────────────

export interface AnalysisWeekPair {
  label: string;
  curr: string;   // "WW16"
  prev: string;   // "WW15"
}

/**
 * Build week pairs from the set of WW labels we have data for.
 * Sorted newest-first.
 */
export function buildWeekPairs(wwLabels: string[]): AnalysisWeekPair[] {
  // Sort numerically: WW05 < WW06 ... < WW53 < WW01 (next year handled by iso_year sort)
  const sorted = [...wwLabels].sort((a, b) => parseInt(a.replace('WW', '')) - parseInt(b.replace('WW', '')));
  const pairs: AnalysisWeekPair[] = [];
  for (let i = sorted.length - 1; i >= 1; i--) {
    pairs.push({
      label: `${sorted[i - 1]} vs ${sorted[i]}`,
      curr: sorted[i],
      prev: sorted[i - 1],
    });
  }
  return pairs;
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useAnalysisData() {
  const [rawRows, setRawRows] = useState<WeeklyApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all weekly data once
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/ole/weekly`)
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((data: WeeklyApiRow[]) => {
        setRawRows(data);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // All unique WW labels present in the data
  const wwLabels = useMemo(() => {
    const seen = new Set<string>();
    rawRows.forEach(r => seen.add(apiLabelToWW(r.week_label)));
    return [...seen].sort((a, b) => parseInt(a.replace('WW', '')) - parseInt(b.replace('WW', '')));
  }, [rawRows]);

  const weekPairs = useMemo(() => buildWeekPairs(wwLabels), [wwLabels]);

  return { rawRows, wwLabels, weekPairs, loading, error };
}

// ─── Derived data for a selected week pair ────────────────────────────────────

export function useAnalysisDerived(
  rawRows: WeeklyApiRow[],
  currWW: string,
  prevWW: string,
) {
  return useMemo(() => {
    if (!rawRows.length) return null;

    // Group rows by WW label
    const byWW = new Map<string, WeeklyApiRow[]>();
    rawRows.forEach(r => {
      const ww = apiLabelToWW(r.week_label);
      if (!byWW.has(ww)) byWW.set(ww, []);
      byWW.get(ww)!.push(r);
    });

    // All unique WW labels sorted
    const allWWs = [...byWW.keys()].sort((a, b) => parseInt(a.replace('WW', '')) - parseInt(b.replace('WW', '')));

    // ── Site-level series (aggregate across all workcells per week) ──
    const buildUnitSeries = allWWs.map(ww => ({
      week: ww,
      units: (byWW.get(ww) ?? []).reduce((s, r) => s + (r.total_qty ?? 0), 0),
    }));

    const inputHrsSeries = allWWs.map(ww => ({
      week: ww,
      hrs: (byWW.get(ww) ?? []).reduce((s, r) => s + (r.total_input_hours ?? 0), 0),
    }));

    // DL series — manual data joined by week label
    const dlMap = new Map(DL_WEEKLY_DATA.map(r => [r.week, r.dl]));
    const dlSeries = allWWs.map(ww => ({ week: ww, dl: dlMap.get(ww) ?? null }));

    // ── Per-workcell rows for curr and prev week ──
    const currRows = byWW.get(currWW) ?? [];
    const prevRows = byWW.get(prevWW) ?? [];

    // Aggregate across stages (SMT/Backend/BoxBuild all have separate rows)
    // Map overwrite would only keep the last stage -- must SUM instead
    function groupByWC(rows: WeeklyApiRow[]) {
      const acc = new Map<string, { total_qty: number; total_input_hours: number; total_output_smh: number }>();
      rows.forEach(r => {
        const prev = acc.get(r.workcell) ?? { total_qty: 0, total_input_hours: 0, total_output_smh: 0 };
        acc.set(r.workcell, {
          total_qty: prev.total_qty + (r.total_qty ?? 0),
          total_input_hours: prev.total_input_hours + (r.total_input_hours ?? 0),
          total_output_smh: prev.total_output_smh + (r.total_output_smh ?? 0),
        });
      });
      const result = new Map<string, { total_qty: number; total_input_hours: number; total_output_smh: number; ole_pct: number | null }>();
      acc.forEach((v, wc) => {
        result.set(wc, { ...v, ole_pct: v.total_input_hours > 0 ? (v.total_output_smh / v.total_input_hours) * 100 : null });
      });
      return result;
    }

    const prevByWC = groupByWC(prevRows);
    const currByWC = groupByWC(currRows);

    // All workcells that have data in either week — excluding temp-disabled workcells
    const allWCs = [...new Set([...prevByWC.keys(), ...currByWC.keys()])]
      .filter(wc => !TEMP_EXCLUDED_WORKCELLS.includes(wc));

    // ── OLE comparison bar chart ──
    const oleCompareSeries = allWCs.map(wc => ({
      name: wc,
      prev: parseFloat((prevByWC.get(wc)?.ole_pct ?? 0).toFixed(1)),
      curr: parseFloat((currByWC.get(wc)?.ole_pct ?? 0).toFixed(1)),
    })).sort((a, b) => b.curr - a.curr);

    // ── Build unit gap per workcell (curr - prev, positive = improvement) ──
    const buildGapSeries = allWCs.map(wc => {
      const c = currByWC.get(wc)?.total_qty ?? 0;
      const p = prevByWC.get(wc)?.total_qty ?? 0;
      return { name: wc, gap: calcBuildUnitGap(c, p), curr_qty: c, prev_qty: p };
    }).sort((a, b) => b.gap - a.gap);

    // Site-level gap
    const siteQtyCurr = currRows.reduce((s, r) => s + (r.total_qty ?? 0), 0);
    const siteQtyPrev = prevRows.reduce((s, r) => s + (r.total_qty ?? 0), 0);
    const siteGap = calcBuildUnitGap(siteQtyCurr, siteQtyPrev);

    // ── Impact shares (donut) — use curr week aggregated per-workcell data ──
    const rawImpacts = allWCs.map(wc => {
      const row = currByWC.get(wc);
      if (!row || !row.ole_pct) return { name: wc, raw: 0 };
      return { name: wc, raw: calcWorkcellImpact(row.total_input_hours, row.total_qty, row.ole_pct) };
    });
    const impactSeries = calcImpactShares(rawImpacts);

    const topImpact = impactSeries[0] ?? null;

    return {
      buildUnitSeries,
      inputHrsSeries,
      dlSeries,
      oleCompareSeries,
      buildGapSeries,
      impactSeries,
      siteGap,
      topImpact,
      siteQtyCurr,
      siteQtyPrev,
    };
  }, [rawRows, currWW, prevWW]);
}
