/**
 * oleApi.ts — typed client for the OLE Analyzer backend
 *
 * All calls go to /ole-api/* which Vite proxies → http://localhost:8000 in dev.
 *
 * Usage:
 *   import { oleApi } from '@/lib/ole/oleApi';
 *   const summary = await oleApi.ole.summary();
 */

// const BASE = '/ole-api';
const BASE = '/ietools/ole/api';

// Strip timestamp from date strings: '2026-04-04T00:00:00' → '2026-04-04'
// Required for correct string comparison in date filters (dateTo <= r.date)
function normalizeDates<T>(data: T): T {
  if (Array.isArray(data)) return data.map(normalizeDates) as T;
  if (data && typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        out[k] = v.slice(0, 10);
      } else {
        out[k] = normalizeDates(v);
      }
    }
    return out as T;
  }
  return data;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`OLE API ${path} → ${res.status}`);
  const json = await res.json();
  return normalizeDates<T>(json);
}

// ─── Response shapes (mirrors FastAPI responses) ──────────────────────────────

export interface OleWorkcellConfig {
  workcell: string;
  scan_stage: string;
  stage_label: string;
  smh_column: string;
  plant: string;
}

export interface OleResult {
  workcell: string;
  date: string;
  shift: number;
  stage_label: string;
  scan_stage: string;
  assembly_count: number;
  total_qty: number;
  effective_output_smh: number;
  qty_missing_smh: number;
  assemblies_missing_smh: number;
  hc_direct: number;
  tph_direct: number;
  total_input_hours: number;
  va_hours: number;
  nva_hours: number;
  va_count: number;
  nva_count: number;
  ole_pct: number | null;
  data_quality: 'OK' | 'PARTIAL_SMH' | 'NO_INPUT_HOURS' | 'NO_OUTPUT_SMH';
  smh_coverage_pct: number | null;
}

export interface OleSummary {
  workcell: string;
  stage_label: string;
  scan_stage: string;
  total_shifts: number;
  avg_ole_pct: number | null;
  min_ole_pct: number | null;
  max_ole_pct: number | null;
  latest_date: string;
  total_qty: number;
  total_output_smh: number;
  total_input_hours: number;
  avg_hc_direct: number;
  flagged_shifts: number;
}

export interface OleProduction {
  site: string;
  workcell: string;
  sub_workcell: string;
  assembly: string;
  qty: number;
  date: string;
  shift: number;
}

export interface OlePaidHours {
  site: string;
  cost_center: string;
  workcell: string;
  sub_workcell: string;
  thc_direct: number;
  tph_direct: number;
  total_input_hours: number;
  date: string;
  shift: number;
  value_type: string;
  position: string;
  name: string;
  category: string;
}

export interface SmhLookup {
  workcell: string;
  assembly: string;
  smh_value: number;
  scan_stage: string;
  stage_label: string;
  last_updated: string;
}

export interface SmhStatus {
  workcell: string;
  assembly: string;
  smh_value: number;
  total_qty_produced: number;
  first_seen_date: string;
  last_seen_date: string;
  active_days: number;
  smh_status: 'OK' | 'MISSING_SMH' | 'NOT_IN_SMH_DB';
}

export interface OleWeeklyResult {
  workcell: string;
  iso_year: number;
  iso_week: number;
  week_label: string;
  week_start_date: string;
  week_end_date: string;
  stage_label: string;
  scan_stage: string;
  total_qty: number;
  shift_count: number;
  total_output_smh: number;
  total_input_hours: number;
  avg_hc_direct: number;
  total_va_hours: number;
  total_nva_hours: number;
  total_va_count: number;
  total_nva_count: number;
  ole_pct: number | null;
  ole_pct_avg_shifts: number | null;
  shifts_ok: number;
  shifts_flagged: number;
  smh_coverage_pct: number | null;
}

export interface OleHealth {
  status: string;
  mart_ready: boolean;
  timestamp: string;
  mart_files: Record<string, boolean>;
}

export interface ShiftOperator {
  date: string;
  shift: number;
  position: string;
  value_type: string;
  total_input_hours: number;
  thc_direct: number;
  tph_direct: number;
  sub_workcell: string;
  category: string;
}

export interface MhDistributionRow {
  workcell: string;
  date: string;
  shift: number;
  nva_hours: number;
  lunch_hours: number;
  mfg_dt_hours: number;
  downtime_hours: number;
  mfg_lost_hours: number;
  mfg_lost_raw_hours: number;
  total_paid_hours: number;
  effective_output_smh: number;
}

export interface IndirectLaborRow {
  entity: string;
  date: string;
  shift: number;
  headcount: number;
  total_hc_direct: number;
  total_input_hours: number;
  va_hours: number;
  nva_hours: number;
  plant: string;
  label: string;
}

export interface IndirectLaborEntity {
  entity: string;
  label: string;
  plant: string;
}

export interface OlePredictionResult {
  week_label: string;
  actual: number | null;
  arima: number | null;
  hw: number | null;
  projected: boolean;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const oleApi = {
  health: {
    check: () => get<OleHealth>('/health'),
  },

  workcells: {
    list: () => get<OleWorkcellConfig[]>('/workcells'),
  },

  ole: {
    /** Full OLE results — filterable by workcell, date range, shift */
    list: (params?: { workcell?: string; date_from?: string; date_to?: string; shift?: number }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      if (params?.shift) p.set('shift', String(params.shift));
      return get<OleResult[]>(`/ole${p.toString() ? `?${p}` : ''}`);
    },

    /** Per-workcell OLE summary */
    summary: (params?: { date_from?: string; date_to?: string; plant?: string }) => {
      const p = new URLSearchParams();
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      if (params?.plant) p.set('plant', params.plant);
      return get<OleSummary[]>(`/ole/summary${p.toString() ? `?${p}` : ''}`);
    },
    /** Weekly OLE aggregates — projection engine input */
    weekly: (params?: { workcell?: string; sample_from?: string; sample_to?: string; plant?: string }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.sample_from) p.set('sample_from', params.sample_from);
      if (params?.sample_to) p.set('sample_to', params.sample_to);
      if (params?.plant) p.set('plant', params.plant);
      return get<OleWeeklyResult[]>(`/ole/weekly${p.toString() ? `?${p}` : ''}`);
    },

    /** Advanced forecasting using ARIMA and Holt-Winters */
    predict: (params: { workcell: string; projection_weeks?: number }) => {
      const p = new URLSearchParams();
      p.set('workcell', params.workcell);
      if (params.projection_weeks !== undefined) p.set('projection_weeks', String(params.projection_weeks));
      return get<OlePredictionResult[]>(`/ole/predict?${p}`);
    },

    /** Pareto of workcells by input man-hours with OLE % */
    pareto: (queryString?: string) =>
      get<any[]>(`/ole/pareto${queryString ? `?${queryString}` : ''}`),

    /** Man-hours distribution breakdown for donut chart */
    mhBreakdown: (params?: { workcell?: string; date_from?: string; date_to?: string; plant?: string }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      if (params?.plant) p.set('plant', params.plant);
      return get<{ total_input_hours: number; slices: { name: string; value: number; color: string }[] }>(`/ole/mh-breakdown${p.toString() ? `?${p}` : ''}`);
    },
  },

  production: {
    list: (params?: { workcell?: string; date_from?: string; date_to?: string }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      return get<OleProduction[]>(`/production${p.toString() ? `?${p}` : ''}`);
    },
  },

  paidHours: {
    list: (params?: { workcell?: string; date_from?: string; date_to?: string }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      return get<OlePaidHours[]>(`/paid-hours${p.toString() ? `?${p}` : ''}`);
    },
  },

  smh: {
    list: (params?: { workcell?: string; assembly?: string }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.assembly) p.set('assembly', params.assembly);
      return get<SmhLookup[]>(`/smh${p.toString() ? `?${p}` : ''}`);
    },

    status: (params?: { workcell?: string; status?: SmhStatus['smh_status'] }) => {
      const p = new URLSearchParams();
      if (params?.workcell) p.set('workcell', params.workcell);
      if (params?.status) p.set('status', params.status);
      return get<SmhStatus[]>(`/smh-status${p.toString() ? `?${p}` : ''}`);
    },
  },

  shiftOperators: {
    list: (params: { workcell: string; date?: string; shift?: number; date_from?: string; date_to?: string }) => {
      const p = new URLSearchParams();
      p.set('workcell', params.workcell);
      if (params.date)      p.set('date',      params.date);
      if (params.shift)     p.set('shift',     String(params.shift));
      if (params.date_from) p.set('date_from', params.date_from);
      if (params.date_to)   p.set('date_to',   params.date_to);
      return get<ShiftOperator[]>(`/shift-operators?${p}`);
    },
  },

  mhDistribution: {
    list: (params?: { workcell?: string; plant?: string; date_from?: string; date_to?: string; shift?: number }) => {
      const p = new URLSearchParams();
      if (params?.workcell)  p.set('workcell',  params.workcell);
      if (params?.plant)     p.set('plant',     params.plant);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to)   p.set('date_to',   params.date_to);
      if (params?.shift)     p.set('shift',     String(params.shift));
      return get<MhDistributionRow[]>(`/mh-distribution${p.toString() ? `?${p}` : ''}`);
    },
  },

  indirectLabor: {
    list: (params?: { entity?: string; plant?: string; date_from?: string; date_to?: string; shift?: number }) => {
      const p = new URLSearchParams();
      if (params?.entity) p.set('entity', params.entity);
      if (params?.plant) p.set('plant', params.plant);
      if (params?.date_from) p.set('date_from', params.date_from);
      if (params?.date_to) p.set('date_to', params.date_to);
      if (params?.shift) p.set('shift', String(params.shift));
      return get<IndirectLaborRow[]>(`/indirect-labor${p.toString() ? `?${p}` : ''}`);
    },
    entities: () => get<IndirectLaborEntity[]>('/indirect-labor/entities'),
  },

  refresh: {
    run: () =>
      fetch(`${BASE}/refresh`, { method: 'POST' }).then(r => r.json()),
  },
};
