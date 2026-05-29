/**
 * cycleTimeApi.ts — typed client for the Cycle Time backend module
 *
 * All calls go to /ietools/cycle-time/api/* which Vite proxies → http://localhost:8000
 * in dev. The backend mounts the router under /api/cycle-time/* — the /ietools/cycle-time
 * prefix is the FE-side deploy basename that the dev-proxy + prod-rewrite strip.
 *
 * Usage:
 *   import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
 *   const customers = await cycleTimeApi.customers.list();
 *   const rows      = await cycleTimeApi.data.list({ customer: 'ASP' });
 */

const BASE = '/ietools/cycle-time/api';

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const res = await fetch(`${BASE}${path}${qs}`);
  if (!res.ok) throw new Error(`CycleTime API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const res = await fetch(`${BASE}${path}${qs}`, { method: 'POST' });
  if (!res.ok) throw new Error(`CycleTime API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface CycleTimeHealthMart {
  exists: boolean;
  rows: number | string;
}

export interface CycleTimeHealth {
  status: 'ok' | 'not_ready';
  mart: {
    raw: CycleTimeHealthMart;
    pivoted: CycleTimeHealthMart;
  };
  customers_configured: number;
}

export interface CycleTimeCustomer {
  customer: string;
  division: string;
  customer_id: number;
  assembly_count: number;
}

/**
 * Pivoted row. Metadata columns are typed; process-step columns are dynamic
 * (vary per customer) and reachable via index access `row['Hi-Pot 1']`.
 */
export interface CycleTimePivotedRow {
  customer: string;
  division: string;
  family: string | null;
  assembly: string;
  revision: string;
  workcenter: string;
  workcenter_type: string;
  sub_workcenter: string;
  // Process columns: dynamic, value is seconds or null.
  [processName: string]: string | number | null;
}

export interface CycleTimeRawRow {
  site?: string;
  workcell?: string;
  customer: string;
  division: string;
  family: string | null;
  assembly: string;
  revision: string;
  workcenter: string;
  workcenter_type: string;
  sub_workcenter: string;
  process: string;
  alias: string | null;
  cycle_time_per_process: number | null;
  grp: number | null;
  playbook: string | null;
  hc: number | null;
  updated_on: string | null;
  [extra: string]: unknown;
}

export interface CycleTimeRawPage {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  data: CycleTimeRawRow[];
}

export interface CycleTimeRefreshResponse {
  status: 'accepted';
  message: string;
}

/** alias → underlying process code(s) + the lines on which it appears. */
export interface CycleTimeAliasInfo {
  processes: string[];
  lines: string[];
}
export type CycleTimeAliasMap = Record<string, CycleTimeAliasInfo>;

export interface CycleTimeRefreshStatus {
  state: 'idle' | 'running' | 'success' | 'failed';
  mode: 'full' | 'incremental' | null;
  started_at: string | null;
  finished_at: string | null;
  customers_total: number;
  customers_done: number;
  current_customer: string | null;
  last_error: string | null;
}

// ─── Filters for /data ───────────────────────────────────────────────────────

export interface CycleTimeDataFilters {
  customer?: string;
  assembly?: string;
  revision?: string;
  workcenter?: string;
  sub_workcenter?: string;
  family?: string;
}

export interface CycleTimeRawFilters extends CycleTimeDataFilters {
  process?: string;
  page?: number;
  page_size?: number;
}

// ─── Live mode (paginated proxy to IEDB) ─────────────────────────────────────

export interface CycleTimeLiveFilters {
  customer: string;
  page: number;
  page_size?: number;
  sub_workcenter?: string;
}

export interface CycleTimeLivePage {
  page: number;
  page_size: number;
  total_count: number;
  pages: number;
  has_next: boolean;
  rows: CycleTimePivotedRow[];
  alias_map: CycleTimeAliasMap;
  note: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const cycleTimeApi = {
  health: {
    get: () => get<CycleTimeHealth>('/health'),
  },
  customers: {
    list: () => get<CycleTimeCustomer[]>('/customers'),
  },
  aliases: {
    /** Map of column-header alias → underlying Process code(s) + lines. */
    list: (customer?: string) =>
      get<CycleTimeAliasMap>('/aliases', customer ? { customer } : undefined),
  },
  data: {
    list: (filters: CycleTimeDataFilters = {}) =>
      get<CycleTimePivotedRow[]>('/data', filters),
  },
  raw: {
    list: (filters: CycleTimeRawFilters = {}) =>
      get<CycleTimeRawPage>('/raw', filters),
  },
  live: {
    /** Live IEDB proxy — one IEDB page per call, pivoted on the server. */
    page: (filters: CycleTimeLiveFilters) =>
      get<CycleTimeLivePage>('/live', filters as Record<string, string | number | undefined>),
  },
  refresh: {
    trigger: (mode: 'full' | 'incremental' = 'incremental') =>
      post<CycleTimeRefreshResponse>('/refresh', { mode }),
    status: () => get<CycleTimeRefreshStatus>('/refresh/status'),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Identify which fields on a pivoted row are process columns (not metadata). */
const PIVOT_META_COLS = new Set([
  'customer', 'division', 'family', 'assembly', 'revision',
  'workcenter', 'workcenter_type', 'sub_workcenter',
]);

export function processColumnsOf(rows: CycleTimePivotedRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!PIVOT_META_COLS.has(k)) seen.add(k);
    }
  }
  return Array.from(seen).sort();
}

/** Format a cycle time as raw seconds with a trailing 's' — the main cell display. */
export function formatCycleSecondsLabel(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return '—';
  return `${s.toFixed(2)}s`;
}

/**
 * Format a cycle time (seconds) as "H H MM M SS s" — used in the cell tooltip
 * so the user can see the full hour/minute/second breakdown.
 *  e.g. 19800.21 → "5 H 30 M 00 s"
 *       150     → "0 H 02 M 30 s"
 */
export function formatCycleHMS(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return '—';
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h} H ${String(m).padStart(2, '0')} M ${String(sec).padStart(2, '0')} s`;
}
