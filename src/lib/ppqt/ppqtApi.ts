/**
 * ppqtApi.ts — typed client for the PPQT backend (EM-IE80-00003-B model)
 *
 * Calls go to /ietools/ppqt/api/* which Vite proxies → http://localhost:8000
 * /api/ppqt/* in dev (nginx does the same in prod).
 *
 * One PPQT workbook = one workcell. Visible "PPQT …" sheets = Area × Period;
 * "Exe Summaries" = the DL report. Formulas: IE-Pulse-Backend
 * modules/ppqt/compute.py, spec: docs/PPQT_LAMRES_DIFF.md.
 */

const BASE = '/ietools/ppqt/api';
const enc = encodeURIComponent;

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '' && v !== false)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const res = await fetch(`${BASE}${path}${qs}`);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail ?? ''; } catch { /* plain text */ }
    throw new Error(detail || `PPQT API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`PPQT API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface PPQTArea { code: string; label: string }

export interface PPQTWorkcellRow {
  workcell: string;
  areas: string[];
  periods: string[];
  latest: string | null;
  volume: number;
  dl_required: number;
  actual_dl: number;
  dl_variance: number;
  bays_short: number;
  equipment_short: number;
  nva_ratio: number | null;
  ingested_at: string | null;
  file: string | null;
}

export interface PPQTFile {
  file: string; workcell: string; areas: string; periods: string; sheets: number;
  file_mtime: string; ingested_at: string;
}

export interface PPQTMeta {
  workcell: string;
  areas: PPQTArea[];
  periods: string[];
  latest: string | null;
  files: PPQTFile[];
}

/** One Exe Summaries row for one period. */
export interface PPQTBay {
  area: string;
  area_code: string | null;
  is_overhead: boolean;
  bay: string;
  type: string;
  dl_per_line: number;
  crew: number;
  line_req: number;
  npi: number;
  ttl_req: number;
  available: number;
  variance: number;
  dl_required: number;
  source: 'computed' | 'sheet';
  station: string | null;
  wct: number | null;
  takt: number | null;
  demand_through: number | null;
  sheet_line_req: number;
  sheet_dl_required: number;
}

export interface PPQTPeriodSummary {
  period: string;
  period_date: string | null;
  weeks: number;
  pca_vol: number;
  hla_vol: number;
  /** pca_vol + hla_vol — the period's demand, the driver of every number below. */
  total_demand: number;
  demand_by_area: { area_code: string; total_demand: number }[];
  dl_required: number;
  actual_dl: number;
  dl_variance: number;
  nva_dl: number;
  non_mfg_dl: number;
  nva_total: number;
  nva_ratio: number | null;
  inline_va: number;
  nva_target: number;
  nva_allow: number;
  nva_excess: number;
  bays_short: number;
  bays_total: number;
  equipment_short: number;
  dl_by_area: { area: string; dl_required: number }[];
  bays: PPQTBay[];
}

export interface PPQTSummary { workcell: string; areas: PPQTArea[]; periods: PPQTPeriodSummary[] }

export interface PPQTStation {
  station: string;
  header: string;
  seq: number;
  line_group: string;
  group_no: number;
  is_bottleneck: boolean;
  demand_through: number;
  sum_dem_ct: number;
  hours_per_day: number;
  days: number;
  co_per_day: number;
  co_min: number;
  daily_avail_min: number;
  avail_sec: number;
  wct: number;
  takt: number;
  need: number;
  fpy: number;
  eff: number;
  allowance: number;
  need_allow: number;
  ttl_req: number;
  eq_avail: number | null;
  available: number | null;
  variance: number | null;
  util: number | null;
  is_bay: boolean;
  bay: string | null;
  type: string | null;
  crew: number | null;
  npi: number;
  dl_required: number | null;
  sheet_need_allow: number;
  sheet_demand_through: number;
  delta_vs_sheet: number;
  issues: string | null;
  // BOTTLENECK rows only — the CTI / PFTR block
  cti_avail_hrs?: number;
  cti_avail_allow_hrs?: number;
  cti_required_hrs?: number;
  cti_co_time_hrs?: number;
  cti_possible_co?: number;
  cti_co_per_day?: number;
  cti_models?: number;
  cti_days?: number;
  pftr?: number;
}

export interface PPQTLineGroup { group_no: number; line_group: string }

export interface PPQTStationsResp {
  workcell: string; area: string; period: string; count: number;
  totals: { total_demand: number; assemblies: number; with_demand: number; demand_x_lead_hrs: number };
  line_groups: PPQTLineGroup[];
  stations: PPQTStation[];
}

export interface PPQTStationAssembly {
  sheet_row: number; assembly: string; model: string; demand: number; ct_sec: number; load_sec: number; share: number;
}
export interface PPQTStationAssembliesResp {
  station: string; total_load_sec: number; assemblies: number; rows: PPQTStationAssembly[];
}

export interface PPQTAssemblyRow {
  assembly: string;
  family: string;
  model: string;
  sheet_row: number;
  demand: number;
  lead_time_sec: number;
  bottleneck_sec: number;
  bottleneck_station: string | null;
  demand_x_lead: number;
  cts: Record<string, number>;
  group_bottleneck: Record<string, number>;
}
export interface PPQTAssembliesResp {
  workcell: string; area: string; period: string;
  stations: { station: string; header: string; group_no: number; line_group: string }[];
  groups: PPQTLineGroup[];
  count: number; total: number;
  rows: PPQTAssemblyRow[];
}

export interface PPQTPeriodMeta {
  period: string; period_date: string | null; weeks: number; pca_vol: number; hla_vol: number;
  actual_dl: number; nva_dl: number; non_mfg_dl: number; nva_target: number;
}
export interface PPQTStationInput {
  area: string; period: string; station: string; header: string; seq: number; line_group: string; group_no: number;
  is_bottleneck: boolean; hours_per_day: number; days: number; co_per_day: number; co_min: number; fpy: number; eff: number;
  eq_avail: number; sheet_need_allow: number; sheet_demand_through: number; issues: string;
}
export interface PPQTBayInput {
  period: string; area: string; area_code: string | null; is_overhead: boolean; bay: string; type: string; seq: number;
  dl_per_line: number; crew: number; npi: number; available: number;
  sheet_line_req: number; sheet_ttl_req: number; sheet_variance: number; sheet_dl_required: number;
}
export interface PPQTInputs {
  workcell: string; areas: PPQTArea[]; periods: PPQTPeriodMeta[]; stations: PPQTStationInput[]; bays: PPQTBayInput[];
}

// ─── 4Q report ───────────────────────────────────────────────────────────────
// One call per report. Q1/Q2/Q4 all come from here; Q3 is the saved plan.

export interface PPQT4QCapacity {
  /** Resource-units, not %. va + changeover + allowance + npi + spare = available. */
  va: number; changeover: number; allowance: number; npi: number; spare: number; available: number;
}
export interface PPQT4QPeriod {
  period: string;
  total_demand: number;
  dl_required: number;
  actual_dl: number;
  dl_variance: number;
  nva_total: number;
  bays_short: number;
  bays_total: number;
  equipment_short: number;
  /** Q1's indicator: actual DL / required DL x 100. Target 100. */
  coverage_pct: number | null;
  resource_req: number;
  resource_avail: number;
  capacity: PPQT4QCapacity;
  capacity_pct: Omit<PPQT4QCapacity, 'available'>;
}
export interface PPQT4QShort {
  workcell: string; area: string; area_code: string; bay: string; station: string | null;
  short: number; dl_short: number; months: number; worst: number; worst_period: string;
  short_avg: number; dl_short_avg: number;
}
export interface PPQT4QDrill {
  workcell: string; bay: string; area: string; period: string; station: string;
  total_load_sec: number; rows: PPQTStationAssembly[];
}
export interface PPQT4Q {
  workcells: string[]; areas: PPQTArea[]; periods: PPQT4QPeriod[];
  shortfall: PPQT4QShort[]; drill: PPQT4QDrill[];
}

export interface PPQTHealth {
  status: 'ok' | 'degraded';
  marts: Record<string, { exists: boolean; path: string }>;
  raw_dir: string;
  workbooks: string[];
}

// ─── Client ──────────────────────────────────────────────────────────────────

export const ppqtApi = {
  health: () => get<PPQTHealth>('/health'),
  workcells: () => get<{ count: number; workcells: PPQTWorkcellRow[] }>('/workcells'),
  meta: (wc: string) => get<PPQTMeta>(`/${enc(wc)}`),
  summary: (wc: string) => get<PPQTSummary>(`/${enc(wc)}/summary`),
  stations: (wc: string, area: string, period: string) =>
    get<PPQTStationsResp>(`/${enc(wc)}/stations`, { area, period }),
  stationAssemblies: (wc: string, area: string, period: string, station: string, top = 25) =>
    get<PPQTStationAssembliesResp>(`/${enc(wc)}/stations/${enc(station)}`, { area, period, top }),
  assemblies: (wc: string, area: string, period: string, all = false) =>
    get<PPQTAssembliesResp>(`/${enc(wc)}/assemblies`, { area, period, all }),
  inputs: (wc: string) => get<PPQTInputs>(`/${enc(wc)}/inputs`),
  // Repeated `workcell` params, so the query is built here rather than through
  // get()'s Record — a record cannot hold the same key twice.
  fourq: (workcells: string[]) => get<PPQT4Q>(`/4q?${workcells.map(w => `workcell=${enc(w)}`).join('&')}`),
  refresh: () => post<{ status: string }>('/refresh'),
};
