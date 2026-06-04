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

/** Per-customer data coverage — distinct assemblies with cycle-time data + freshness. */
export interface CycleTimeCoverageRow {
  customer: string;
  assemblies: number;
  updated_on: string | null;
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
  /** Build-level routing rank (min over steps) — 1 = primary route. */
  priority: number | null;
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

/** One page of pivoted rows (DB-mode infinite scroll). */
export interface CycleTimeDataPage {
  page: number;
  page_size: number;
  total: number;
  pages: number;
  has_next: boolean;
  /** The customer's stable process-column set (same on every page). */
  columns: string[];
  rows: CycleTimePivotedRow[];
}

/** Per-assembly aggregate for Breakdown B (server-computed). */
export interface CycleTimeAssemblyAgg {
  assembly: string;
  family: string | null;
  builds: number;
  /** One-unit cycle time, start to finish = rep SMT + rep TH + rep BE. */
  total: number | null;
  /** Cycle time of the representative line per stage (not summed across lines). Additive: smt + th + be = total. */
  smt: number | null;
  th: number | null;
  be: number | null;
  bottleneck: string | null;
}

/** Lightweight per-assembly LIST row — collapsed rows on the Assemblies page. */
export interface CycleTimeAssemblyListRow {
  assembly: string;
  family: string | null;
  builds: number;
  /** Distinct revisions for this assembly (Assemblies table column). */
  revisions: number;
  /** Distinct priority-1 routings (what the Flow tab shows by default). */
  primary_builds: number;
  /** True when the assembly has any priority>1 (alternate) routing. */
  has_alternates: boolean;
  has_smt: boolean;
  has_th: boolean;
  has_be: boolean;
}

/** One long row of per-build process detail (from /assembly-builds). The FE
 *  groups these into builds by revision/line/workcenter. */
export interface CycleTimeAssemblyBuildStep {
  revision: string;
  /** Routing rank — 1 = primary route, 2+ = alternates. */
  priority: number;
  sub_workcenter: string;
  workcenter: string;
  step: string;
  seconds: number | null;
  /** Physical step sequence (IEDB `order`). Sort ascending for the flow. */
  step_order: number | null;
  /** Capacity (CAP) for the step. */
  cap: number | null;
  /** Sample size (N) for the step. Displayed cycle time = seconds × n. */
  n: number | null;
  /** Time components from the IEDB step editor. */
  lct: number | null;
  mach: number | null;
  imt: number | null;
  hand: number | null;
  pb: number | null;
  hc: number | null;
}

export interface CycleTimeRefreshResponse {
  status: 'accepted';
  message: string;
}

/** alias → underlying process code(s) + the lines on which it appears. */
export interface CycleTimeAliasInfo {
  processes: string[];
  lines: string[];
  /** Canonical sequence position (min IEDB `order`) — sorts the wide-table
   *  process columns by physical flow. Null when no order was recorded. */
  order?: number | null;
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

// ─── Workcell profile (analytical breakdown) ─────────────────────────────────
// Every figure is the cycle-time column rolled up: build total = sum of process
// cycle times; line/assembly stats aggregate from there. See /profile endpoint.

export interface CycleTimeProfileBottleneck {
  alias: string;
  process: string | null;
  builds_bottlenecked: number;
  total_builds: number;
  pct: number;
}

export interface CycleTimeProfileSummary {
  assemblies: number;
  lines: number;
  processes: number;
  revisions: number;
  builds: number;
  avg_fpy: number | null;
  updated_on: string | null;
  /** Workcell-wide bottleneck — present but NOT shown in the simple breakdown
   *  (it averages across unlike lines; handled per-line in a later step). */
  bottleneck: CycleTimeProfileBottleneck | null;
}

/** One production line (sub_workcenter) within the workcell. */
export interface CycleTimeProfileLine {
  sub_workcenter: string;
  builds: number;
  assemblies: number;
  avg_build_seconds: number | null;
  /** Average operators (headcount) to build one unit on this line. */
  avg_build_hc: number | null;
}

/** One assembly build, ranked among the longest. */
export interface CycleTimeProfileAssembly {
  assembly: string;
  revision: string;
  sub_workcenter: string;
  total_seconds: number | null;
  n_processes: number;
  total_hc: number | null;
  avg_fpy: number | null;
  bottleneck_alias: string | null;
}

/** Process roll-up (parked in the simple breakdown — averages across lines). */
export interface CycleTimeProfileProcess {
  alias: string;
  process: string | null;
  occurrences: number;
  avg_seconds: number | null;
  total_seconds: number | null;
  avg_hc: number | null;
}

export interface CycleTimeProfileBottleneckRow {
  alias: string;
  process: string | null;
  builds_bottlenecked: number;
  pct: number;
}

export interface CycleTimeProfile {
  customer: string;
  summary: CycleTimeProfileSummary;
  bottleneck_pareto: CycleTimeProfileBottleneckRow[];
  process_pareto: CycleTimeProfileProcess[];
  lines: CycleTimeProfileLine[];
  top_assemblies: CycleTimeProfileAssembly[];
}

export interface CycleTimeProfileOpts {
  pareto_limit?: number;
  top_limit?: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const cycleTimeApi = {
  health: {
    get: () => get<CycleTimeHealth>('/health'),
  },
  customers: {
    list: () => get<CycleTimeCustomer[]>('/customers'),
  },
  coverage: {
    /** Per-customer with-data assembly counts + freshness, in one request. */
    list: () => get<CycleTimeCoverageRow[]>('/coverage'),
  },
  aliases: {
    /** Map of column-header alias → underlying Process code(s) + lines. */
    list: (customer?: string) =>
      get<CycleTimeAliasMap>('/aliases', customer ? { customer } : undefined),
  },
  data: {
    /** Full (unpaginated) array — used by Excel export. */
    list: (filters: CycleTimeDataFilters = {}) =>
      get<CycleTimePivotedRow[]>('/data', filters),
    /** One page of pivoted rows — DB-mode infinite scroll. */
    page: (filters: CycleTimeDataFilters & { page: number; page_size?: number }) =>
      get<CycleTimeDataPage>('/data', filters as Record<string, string | number | undefined>),
  },
  assemblies: {
    /** Per-assembly aggregate for Breakdown B, optionally scoped to one line
     *  and/or a single assembly (drawer header). */
    list: (customer: string, sub_workcenter?: string, assembly?: string) =>
      get<CycleTimeAssemblyAgg[]>('/assemblies', { customer, sub_workcenter, assembly }),
  },
  assemblyList: {
    /** Lightweight collapsed-row list for the Assemblies page (identity + stage
     *  footprint only — no cycle-time math). */
    list: (customer: string, sub_workcenter?: string) =>
      get<CycleTimeAssemblyListRow[]>('/assembly-list', { customer, sub_workcenter }),
  },
  assemblyBuilds: {
    /** Per-build process detail for ONE assembly (expanded row). Long rows the
     *  FE groups into builds. */
    list: (customer: string, assembly: string, sub_workcenter?: string) =>
      get<CycleTimeAssemblyBuildStep[]>('/assembly-builds', { customer, assembly, sub_workcenter }),
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
  profile: {
    /** Workcell analytical breakdown — counts, by-line, by-assembly, Paretos. */
    get: (customer: string, opts: CycleTimeProfileOpts = {}) =>
      get<CycleTimeProfile>('/profile', { customer, ...opts }),
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
  'workcenter', 'workcenter_type', 'sub_workcenter', 'priority',
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

/**
 * Compact build-duration label for the breakdown tables — "14h 45m" / "12m 30s".
 * Build totals are hours-scale, so we drop seconds once we're past a minute.
 */
export function formatBuildDuration(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return '—';
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
