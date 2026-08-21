/**
 * ppqtApi.ts — typed client for the PPQT backend module
 *
 * All calls go to /ietools/ppqt/api/* which Vite proxies → http://localhost:8000
 * in dev. The backend mounts the router under /api/ppqt/* — the /ietools/ppqt
 * prefix is the FE-side deploy basename that the dev-proxy + prod-rewrite strip.
 *
 * PPQT has no mart of its own — the backend computes capacity on demand by
 * joining cycle_time/raw.parquet (4.4M rows, IEDB) with
 * demand/planner_demand.parquet (planner).
 *
 * PPQT is a MONTHLY analysis — every call takes an optional `month` (YYYY-MM);
 * omitted means the current calendar month.
 *
 * It sizes TWO resources off the same demand and takt (Excel SMT!C40 —
 * "Resources NEEDED (DLs per Shift or Equipment)"):
 *   equipment — full cycle time ÷ FPY ÷ Eff, compared to machines
 *   people    — operator time only (no FPY), compared to headcount per station
 * See modules/ppqt/capacity.py.
 *
 * Usage:
 *   const { workcells } = await ppqtApi.workcells.list();
 *   const cap = await ppqtApi.capacity.get({ workcell: 'WABTEC', eq_avail: 1 });
 */

const BASE = '/ietools/ppqt-legacy/api';

async function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const res = await fetch(`${BASE}${path}${qs}`, { signal });
  if (!res.ok) throw new Error(`PPQT API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Response shapes ─────────────────────────────────────────────────────────

/** A workcell that has both cycle-time data and planner demand. */
export interface PPQTApiWorkcell {
  workcell: string;
  assemblies: number;
  total_demand: number;
}

export type PPQTVerdict = 'short' | 'tight' | 'ok';

/** Which resource is being sized. */
export type PPQTResource = 'equipment' | 'people';

/** One league-table row — capacity rollup for a whole workcell. */
export interface PPQTApiOverviewRow {
  workcell: string;
  resource: PPQTResource;
  totalDemand: number;
  assemblies: number;
  lines: number;
  stepsTotal: number;
  stepsShort: number;
  stepsTight: number;
  machinesShort: number;
  avgUtil: number;
  verdict: PPQTVerdict;
}

/** Shift/capacity parameters the computation ran with. */
export interface PPQTApiParams {
  shift_hours: number;
  working_days: number;
  co_qty: number;
  co_time: number;
  efficiency: number;
  eq_avail: number;
}

/** One process step on one sub-workcenter — the atomic capacity verdict. */
export interface PPQTApiProcess {
  id: string;
  name: string;
  subWorkcenterId: string;
  area: 'SMT' | 'TH' | 'BE';
  sequence: number;
  /** Units of planner demand routing through this step. */
  demandThrough: number;
  assemblyCount: number;
  /** Weighted cycle time (sec) — Σ(demand × CT) / Σ(demand). */
  wct: number;
  /** Takt (sec/unit) — available seconds / demand through. */
  takt: number;
  medianCt: number;
  fpy: number;
  eqAvail: number;
  /** Un-rounded resources needed — resNeeded is this, rounded up. */
  rawNeed: number;
  resNeeded: number;
  gap: number;
  util: number;
  /** True when the per-unit CT is a batch/dwell time (burn-in, ESS, test soak) —
   *  too long to size serially, so it's kept out of the shortfall rollups. */
  dwell: boolean;
}

/** A physical line. */
export interface PPQTApiSubWorkcenter {
  id: string;
  name: string;
  area: 'SMT' | 'TH' | 'BE';
  shiftHours: number;
  workingDays: number;
  changeoverQty: number;
  changeoverTime: number;
  efficiency: number;
  fpy: number;
  totalDemand: number;
  processCount: number;
  bottlenecks: number;
  avgUtil: number;
  machinesShort: number;
  processes: PPQTApiProcess[];
}

export interface PPQTApiCapacity {
  workcell: string;
  /** The demand month this run covers, YYYY-MM. */
  month: string;
  resource: PPQTResource;
  /** Productive seconds in the demand period — (shift×60 − CO)×days×60. */
  available_seconds: number;
  params: PPQTApiParams;
  total_demand: number;
  process_count: number;
  bottlenecks: number;
  machines_short: number;
  avg_util: number;
  sub_workcenters: PPQTApiSubWorkcenter[];
  /** Non-fatal notes, e.g. "no overlapping data for this workcell". */
  warnings: string[];
}

/** One assembly's contribution to a process's weighted cycle time. */
export interface PPQTApiEvidenceRow {
  assembly: string;
  revision: string;
  demand: number;
  ctAdj: number;
  mach: number;
  imt: number;
  hand: number;
  cap: number;
  sampling: number;
  /** demand × ctAdj — seconds of work this assembly puts on the step. */
  load: number;
  loadShare: number;
}

export interface PPQTApiEvidence {
  workcell: string;
  subWorkcenter: string;
  process: string;
  month: string;
  totalLoad: number;
  /** Rows actually returned (capped for display). */
  count: number;
  /** Assemblies routing through this step in total — may exceed `count`. */
  assemblyCount: number;
  /** True when `count < assemblyCount`, i.e. the row list is capped. */
  truncated: boolean;
  /** Σ demand across ALL assemblies, not just the returned rows. */
  demandThruStep: number;
  estCount: number;
  estLoadShare: number;
  assemblies: PPQTApiEvidenceRow[];
}

/** One row of the Excel DASH "TOP Demand" block. */
export interface PPQTApiMatrixRow {
  assembly: string;
  revision: string;
  demand: number;
  /** process name → adjusted CT (sec). Missing key = does not route through. */
  ct: Record<string, number>;
}

export interface PPQTApiMatrix {
  workcell: string;
  subWorkcenter: string;
  month: string;
  count: number;
  assemblies: PPQTApiMatrixRow[];
}

export interface PPQTCapacityQuery {
  workcell: string;
  /** Demand month YYYY-MM. Omit for the current month. */
  month?: string;
  resource?: PPQTResource;
  shift_hours?: number;
  working_days?: number;
  co_qty?: number;
  co_time?: number;
  efficiency?: number;
  eq_avail?: number;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export const ppqtApi = {
  health: {
    get: (signal?: AbortSignal) => get<Record<string, unknown>>('/health', undefined, signal),
  },
  months: {
    list: (signal?: AbortSignal) =>
      get<{ count: number; default: string; months: string[] }>('/months', undefined, signal),
  },
  workcells: {
    list: (month?: string, signal?: AbortSignal) =>
      get<{ month: string; count: number; workcells: PPQTApiWorkcell[] }>(
        '/workcells', { month }, signal,
      ),
  },
  overview: {
    get: (params?: Partial<PPQTApiParams> & { month?: string; resource?: PPQTResource },
          signal?: AbortSignal) =>
      get<{ count: number; month: string; resource: PPQTResource;
            params: PPQTApiParams; workcells: PPQTApiOverviewRow[] }>(
        '/overview', { ...params }, signal,
      ),
  },
  capacity: {
    get: (q: PPQTCapacityQuery, signal?: AbortSignal) =>
      get<PPQTApiCapacity>('/capacity', { ...q }, signal),
  },
  evidence: {
    get: (
      q: { workcell: string; sub_workcenter: string; process: string;
           month?: string; resource?: PPQTResource },
      signal?: AbortSignal,
    ) => get<PPQTApiEvidence>('/evidence', { ...q }, signal),
  },
  matrix: {
    get: (
      q: { workcell: string; sub_workcenter: string; top?: number;
           month?: string; resource?: PPQTResource },
      signal?: AbortSignal,
    ) => get<PPQTApiMatrix>('/matrix', { ...q }, signal),
  },
};
