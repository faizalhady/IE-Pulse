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
  /** Distinct (assembly, revision) pairs — an assembly with 3 revisions counts as 3. */
  revisions: number;
  /** Active assembly count from IEDB /api/Assemblies/active. Null until the
   *  backend assembly-status step runs (see CYCLE_TIME_ASSEMBLY_STATUS_PLAN.md). */
  active?: number | null;
  /** Inactive assembly count from IEDB /api/Assemblies/inactive. Null until wired. */
  inactive?: number | null;
  updated_on: string | null;
}

/**
 * Per-customer status from the IEDB CustomerStatus report. Counts are at the
 * assembly level (NoOfAssemblies / NoOfAssembliesWithData / Complete %) plus a
 * breakdown of how the underlying cycle-time steps were measured —
 * StopWatch (timed), Most (predetermined MOST standard) or Estimate (engineer
 * estimate). Called directly against the IEDB API, keyed by "Customer / Division".
 */
export interface CycleTimeCustomerStatus {
  CustomerDivision: string;
  NoOfAssemblies: number;
  NoOfAssembliesWithData: number;
  /** Coverage percentage (assemblies with data ÷ total), 0–100. */
  Complete: number;
  /** # steps measured by stopwatch. */
  StopWatch: number;
  /** # steps from a MOST predetermined-time standard. */
  Most: number;
  /** # steps from an engineer estimate. */
  Estimate: number;
  /** Estimate share of measured steps, 0–100. */
  EstimatePercentage: number;
  Site: string;
}

/** One assembly in a customer's catalogue that has no cycle-time data yet. */
export interface CycleTimeNoDataAssembly {
  Assembly: string;
  AssemblyName: string;
  AssemblyRevision: string | null;
  AssemblyDescription: string | null;
  CustomerFamily: string | null;
  UpdatedOn: string | null;
}

/** Response of /no-data-assemblies — counts + the list of no-data assemblies. */
export interface CycleTimeNoDataAssemblies {
  customer: string;
  total: number;
  with_data: number;
  no_data: number;
  assemblies: CycleTimeNoDataAssembly[];
}

/** One runner: units built (historical) or demand (projection/planner). */
export interface CycleTimeRunner {
  rank: number;
  customer: string;
  assembly: string;
  units: number;
  jobs: number;
  last_completed: string | null;
  /** Demand modes only: earliest job start / latest planned finish. */
  first_start?: string | null;
  planned_finish?: string | null;
}
export interface CycleTimeRunners {
  /** When the runners mart was last built (parquet mtime). */
  as_of: string | null;
  count: number;
  runners: CycleTimeRunner[];
}

/** Per-customer set of assemblies that have cycle-time data (from assembly_summary
 *  — the same source the Cycle Time tab renders). Used for the Has-data/No-data badge. */
export interface CycleTimeAssemblyCatalog {
  customer: string;
  with_data: string[];
}

/** One runner within a plant (plant dashboard). */
export interface CycleTimePlantRunner {
  rank: number;
  customer: string;
  assembly: string;
  /** Dominant plant for this assembly (present in the Overall section). */
  plant: string | null;
  units: number;
  jobs: number;
  /** Historical: most-recent build date. */
  last_completed: string | null;
  /** Projection: earliest job start (when the demand begins). */
  first_start?: string | null;
  /** Projection: latest job end (when the demand is all due done). */
  planned_finish?: string | null;
  has_data: boolean;
}
/** A plant column: KPI totals + its top runners. */
export interface CycleTimePlant {
  plant: string;
  total_units: number;
  runner_count: number;
  with_data: number;
  no_data: number;
  runners: CycleTimePlantRunner[];
}
export interface CycleTimePlantRunners {
  as_of: string | null;
  /** All plants combined (Overall Penang). */
  overall: CycleTimePlant;
  /** Region rollups (Batu Kawan, Penang Island) — `plant` field holds the region name. */
  regions: CycleTimePlant[];
  plants: CycleTimePlant[];
}

/** Dominant plant per customer (from the MES buildplan). */
export interface CycleTimeCustomerPlant {
  customer: string;
  plant: string | null;
  units: number;
}
export interface CycleTimeCustomerPlants {
  count: number;
  plants: CycleTimeCustomerPlant[];
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
  /** Standard Manufacturing Hour — operator content per unit (seconds):
   *  Σ (IMT + Hand) × (S%/100) over the primary routing, averaged across the
   *  assembly's priority-1 revisions. Null when no priority-1 build exists. */
  smh: number | null;
  /** Average line efficiency across the assembly's lines (from eff_by_line).
   *  Null until the efficiency pull has run. */
  eff: number | null;
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
  /** Group standard (GRP) for the step. */
  grp: number | null;
  /** Capacity (CAP) for the step. */
  cap: number | null;
  /** Sample size (N) for the step. Displayed cycle time = seconds × n. */
  n: number | null;
  /** Sampling percentage (S%, 1–100). */
  sampling: number | null;
  /** Time components from the IEDB step editor. */
  lct: number | null;
  mach: number | null;
  imt: number | null;
  hand: number | null;
  pb: number | null;
  hc: number | null;
  /** First Pass Yield (FPY, 0–100) for the step. Drives UPH. */
  fpy: number | null;
  /** Line efficiency (from eff_by_line), used in UPH. Null until built →
   *  the FE falls back to the 85% default. */
  eff: number | null;
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
  customerStatus: {
    /** Per-customer assembly coverage + measurement-method breakdown. Proxied
     *  through the CT backend (/customer-status), which holds the IEDB OAuth
     *  credentials — the browser can't call IEDB directly (401 + CORS). */
    list: (site = 'pen') =>
      get<CycleTimeCustomerStatus[]>('/customer-status', { site }),
  },
  noDataAssemblies: {
    /** Assemblies for one customer that have NO cycle-time data yet. Computed
     *  live from IEDB /api/Assemblies (fast — not the heavy raw ingest). */
    list: (customer: string, signal?: AbortSignal) =>
      get<CycleTimeNoDataAssemblies>('/no-data-assemblies', { customer }, signal),
  },
  runners: {
    /** Runner ranking for one workcell. mode: historical (units built, 24mo) |
     *  projection (MES demand, ~4wk) | planner (Excel demand, ~13wk). */
    list: (customer: string, order: 'top' | 'bottom' = 'top', limit?: number,
           mode: 'historical' | 'projection' | 'planner' = 'historical') =>
      get<CycleTimeRunners>('/runners', { customer, order, limit, mode }),
  },
  customerPlants: {
    /** Dominant plant per customer, from the MES buildplan. */
    list: () => get<CycleTimeCustomerPlants>('/customer-plants'),
  },
  plantRunners: {
    /** Top runners per plant. mode: historical (units built, 24mo) | projection (MES demand, ~4wk) | planner (Excel demand, ~13wk). */
    list: (top = 50, plants = 3, mode: 'historical' | 'projection' | 'planner' = 'historical') =>
      get<CycleTimePlantRunners>('/plant-runners', { top, plants, mode }),
  },
  assemblyCatalog: {
    /** IEDB with-data / no-data assembly name sets for one customer (3-badge). */
    list: (customer: string) => get<CycleTimeAssemblyCatalog>('/assembly-catalog', { customer }),
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
     *  FE groups into builds. Pass `signal` to abort an in-flight request. */
    list: (customer: string, assembly: string, sub_workcenter?: string, signal?: AbortSignal) =>
      get<CycleTimeAssemblyBuildStep[]>('/assembly-builds', { customer, assembly, sub_workcenter }, signal),
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

/**
 * Match a workcell/customer name to its IEDB CustomerStatus row. The report keys
 * rows by "CUSTOMER / DIVISION*" — we compare the leading customer segment,
 * normalized (lowercase, alnum only). Prefers an exact match, else a prefix
 * match either way. Returns null when nothing matches. Shared by the league
 * table and the dedicated workcell page so both resolve identically.
 */
export function matchCustomerStatus(
  rows: CycleTimeCustomerStatus[],
  customer: string,
): CycleTimeCustomerStatus | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const k = norm(customer);
  if (!k) return null;
  let prefix: CycleTimeCustomerStatus | null = null;
  for (const r of rows) {
    const key = norm((r.CustomerDivision ?? '').split('/')[0] ?? '');
    if (!key) continue;
    if (key === k) return r;
    if (!prefix && (k.startsWith(key) || key.startsWith(k))) prefix = r;
  }
  return prefix;
}

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
