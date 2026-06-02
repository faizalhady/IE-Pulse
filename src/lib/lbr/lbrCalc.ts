/**
 * lbrCalc.ts
 * ───────────
 * Pure client-side Line Balance Rate calculation. Used by the Simulate tab to
 * recompute metrics live as work elements move between stations, and as the
 * self-consistent baseline for delta comparisons.
 *
 * The 4 critical rules (from docs/LBR_BUILD.md §1.5):
 *   1. machine-only stations are EXCLUDED from n_o and tcto
 *   2. UNLESS a machine is the overall bottleneck → it counts toward
 *      t_bottleneck only (still excluded from n_o / tcto)
 *   3. shared operators count as ONE station (one entry in the array)
 *   4. parallel stations divide CT (encoded in the station's cycleTimeSec)
 *
 * Formulas:
 *   t_bottleneck = MAX(station CT) across ALL stations  (rule 2 falls out of this)
 *   n_o          = count of non-machine stations
 *   tcto         = SUM(CT) of non-machine stations
 *   lbr%         = tcto / (t_bottleneck × n_o) × 100
 *   lbl          = (t_bottleneck × n_o) − tcto
 *   uph          = 3600 / t_bottleneck
 *   upph         = uph / operators
 *   vs_takt%     = t_bottleneck / takt × 100
 */

import type { LBRStation, LBRMetrics } from '@/pages/lbr/types';

/** Recompute a station's cycle time as the sum of its work-element times. */
export function stationCt(station: LBRStation): number {
  return station.elements.reduce((s, e) => s + e.timeSec, 0);
}

/** Recompute all station cycle times from their elements + flag the bottleneck. */
export function recomputeStations(stations: LBRStation[]): LBRStation[] {
  const withCt = stations.map(s => ({ ...s, cycleTimeSec: stationCt(s) }));
  const maxCt = withCt.reduce((m, s) => Math.max(m, s.cycleTimeSec), 0);
  return withCt.map(s => ({ ...s, isBottleneck: s.cycleTimeSec === maxCt && maxCt > 0 }));
}

/**
 * Compute LBR metrics for a set of stations.
 * @param operators total headcount (for UPPH; shared stations may hold >1 person)
 * @param takt      seconds per unit (constant for the playbook)
 */
export function computeLbrMetrics(
  stations: LBRStation[],
  operators: number,
  takt: number,
): LBRMetrics {
  const cts = stations.map(stationCt);
  const tBottleneck = cts.reduce((m, c) => Math.max(m, c), 0);

  const operatorStations = stations.filter(s => s.type !== 'machine_only');
  const nO = operatorStations.length;
  const tcto = operatorStations.reduce((s, st) => s + stationCt(st), 0);

  const denom = tBottleneck * nO;
  const lbr = denom > 0 ? (tcto / denom) * 100 : 0;
  const lbl = denom - tcto;
  const uph = tBottleneck > 0 ? 3600 / tBottleneck : 0;
  const upph = operators > 0 ? uph / operators : 0;
  const vsTakt = takt > 0 ? (tBottleneck / takt) * 100 : 0;

  const bottleneckIdx = cts.indexOf(tBottleneck);
  const bottleneckStation = bottleneckIdx >= 0 ? stations[bottleneckIdx].id : '—';

  return {
    lbr: Number(lbr.toFixed(1)),
    lbl: Number(lbl.toFixed(1)),
    uph: Number(uph.toFixed(1)),
    upph: Number(upph.toFixed(1)),
    tBottleneckSec: Number(tBottleneck.toFixed(1)),
    tctoSec: Number(tcto.toFixed(1)),
    nO,
    bottleneckStation,
    vsTaktPct: Number(vsTakt.toFixed(1)),
  };
}
