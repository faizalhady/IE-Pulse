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

/** POST with a JSON body. `post` above only carries query params, and a
 *  process decision has to send the MES step name byte-exact — trailing and
 *  double spaces are the evidence, and a query string is the wrong place for
 *  them. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`CycleTime API ${path} → ${res.status} ${detail.slice(0, 200)}`);
  }
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
  /** False = IEDB has never priced this model, so every metric below is null.
   *  These rows used to be absent entirely: the list is built FROM cycle times,
   *  so a model nobody timed had nothing to appear as — and an untimed model is
   *  exactly the one somebody needs to go and time. */
  has_cycle_time?: boolean;
  /** Completion verdict when we have one, else null. */
  verdict?: string | null;
  /** Has the MES comparison run on this model? A verdict without this is a
   *  verdict from code that no longer exists. */
  checked?: boolean;
  /** IEDB's gap: steps with no cycle time + steps not on its route. */
  gap?: number | null;
  /** OUR gap: the naming bridge could not identify the step. Never folded into
   *  `gap` — that would blame IEDB for our own mapping holes. */
  unmapped?: number | null;
  /** Forward demand units. The best default sort: volume is concentrated, so
   *  a broken model nobody builds is not urgent. */
  units?: number | null;
  next_build?: string | null;
  /** The DAY a board of this model was last SCANNED on the line (YYYY-MM-DD),
   *  from the #21 scan cache. Current to today, so `last_scan === today` means
   *  it is on the floor right now. Null when the model has not been scanned
   *  inside the cache window (from 2026-03-31) or its workcell is not cached. */
  last_scan?: string | null;
  /** Fallback: when a JOB last closed, from 24 months of history. Coarser — a
   *  job can close days after the last board walked the line. Used only when
   *  `last_scan` is null. */
  last_build?: string | null;
  in_iedb?: boolean | null;
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

// ─── Completion status (IEDB cycle-time vs MES actual route) ─────────────────

/** One of five completion states for a top-runner model. */
export type CompletionStatus = 'unavailable' | 'no_data' | 'incomplete' | 'complete' | 'unverified' | 'non_mes';

/** Per-model completion summary row. */
export interface CompletionModel {
  customer: string;
  assembly: string;
  status: CompletionStatus;
  /** # IEDB-relevant steps the model actually runs (mapped). */
  expected: number;
  /** # of those that HAVE cycle time in IEDB. */
  present: number;
  /** "; "-joined IEDB aliases the model runs but has no cycle time for. */
  missing: string;
  /** # MES steps not in the mapping (potential mapping gaps). */
  unmapped: number;
  /** Fraction of the model's MES steps the workbook recognises (confidence). */
  coverage: number | null;
  /** # distinct MES steps observed in the window (thin < 3 = low confidence). */
  actual_steps: number;
  /** Per-model Line Balance Rate % (from the IEDB route; only meaningful when complete). */
  lbr?: number | null;
  /** Per-model IPK trolley count (buffers along the route). */
  ipk_trolleys?: number | null;
}

// ─── Demand-scoped completion (the Incompletion Report page) ─────────────────

/** `not_checked` = the completion run has not reached this model yet. It is NOT
 *  a verdict — the model is simply absent from the mart. Shown rather than
 *  hidden, so "missing from the report" can't be mistaken for "no problems". */
/** The verdicts, worst-first, plus `not_checked` for rows the run hasn't reached.
 *  Collapsed from seven on 2026-08-05 — route_gap/no_data/unverified/unavailable
 *  said the same thing four ways. The detail moved to `reason`.
 *
 *  `not_in_mes` is LEGACY and only reaches the UI from an older backend or from
 *  a history week snapshotted before the split. It was one word for two answers:
 *  `not_built` (wait for the scan) and `cannot_check` (no scan will ever come).
 *  `dstatus()` maps it; keep it in the union until prod stops sending it. */
export type DemandCompletionStatus =
  | 'incomplete' | 'no_cycle_time' | 'not_in_iedb' | 'not_built' | 'cannot_check'
  | 'complete' | 'not_checked'
  | 'not_in_mes';

/** Why a status was given — the detail the four statuses fold away. */
export type DemandCompletionReason =
  | 'missing_ct' | 'missing_step' | 'missing_ct+step' | 'unmapped' | 'no_alias'
  | 'absent' | 'absent_unverified' | 'in_iedb_untimed'
  | 'no_production' | 'workcell_not_on_mes' | '';

export interface DemandCompletionModel {
  /** 1-based position by demand units across the WHOLE list, not the filtered view. */
  rank: number;
  plant: string;
  region: string;
  customer: string;
  assembly: string;
  /** Demand units: MES planned + planner forecast, summed. */
  units: number;
  /** Which demand source(s) saw it: "mes", "planner" or "mes+planner". */
  sources: string;
  /** False = checked, but no longer inside the 13-week planner window. Shown
   *  anyway — the verdict is just as real, it simply has no forward demand. */
  has_demand?: boolean;
  /** When the completion run last judged this model. Null for rows graded before
   *  the column existed (2026-08-17) — an unknown date, not a fresh one. */
  graded_on?: string | null;
  status: DemandCompletionStatus;
  /** Has the completion check run on this model. */
  checked?: boolean;
  reason?: DemandCompletionReason | null;
  /** How the verdict was reached: "serial" (#132, strong) | "batch" (#21, weak) | "none". */
  source?: string | null;
  expected?: number | null;
  present?: number | null;
  no_ct?: number | null;
  not_in_iedb?: number | null;
  unmapped?: number | null;
  non_iedb?: number | null;
  actual_steps?: number | null;
  coverage?: number | null;
  /** Next planned start from TODAY onward. Null when nothing upcoming — which for
   *  a model already on the floor means `in_progress`, not "not building". */
  next_build?: string | null;
  /** Latest planned finish — when current demand for it runs out. */
  last_build?: string | null;
  /** No upcoming start, but demand still runs past today — it is building now. */
  in_progress?: boolean | null;
  /** Line Balance Rate %. Null until the route is complete enough to compute. */
  lbr?: number | null;
  /** IPK buffer trolleys needed along the flow. */
  ipk_trolleys?: number | null;
  bottleneck_ct?: number | null;
  station_count?: number | null;
}

export interface DemandCompletionScope {
  /** plant → its workcells. Drives the picker, so the UI never hardcodes plants. */
  plants: Record<string, string[]>;
  /** region → its plant codes (Penang Island = Plant 1 + JPE, Batu Kawan = JBK). */
  regions: Record<string, string[]>;
  workcells: string[];
}

export interface DemandCompletionResponse {
  as_of: string | null;
  /** Models in the demand list before filtering. */
  total: number;
  /** Models after filtering. */
  count: number;
  counts: Record<string, number>;
  /** How many of `total` the completion run has not covered yet. */
  unchecked: number;
  /** Age of every mart behind these verdicts. A stale verdict looks exactly like
   *  a fresh one, so the age is shown rather than assumed. */
  freshness?: CompletionReportFreshness[];
  scope: DemandCompletionScope;
  models: DemandCompletionModel[];
}

// ─── Per-model LBR / IPK breakdown (the drawer proof) ────────────────────────

// ─── BOM — the MES materials behind one model ────────────────────────────────
// Keyed on bom_id server-side, not on the model: MES shares one BOM across an
// assembly's revisions, so `revisions` can list three revisions and one bom_id.
export interface BomMaterial {
  bom_material_id: number | null;
  bom_material: string | null;
  material_id: number | null;
  material: string | null;
  description: string | null;
  qty: number | null;
  bom_level: string | null;
  bom_sort_order: number | null;
  effective_from: string | null;
  effective_to: string | null;
}
export interface BomRevision { revision: string; assembly_id: number | null; bom_id: number | null; }
export interface ModelBom {
  customer: string;
  assembly: string;
  revision: string | null;
  requested_revision: string | null;
  /** false = the revision asked for is not in MES, so `revision` is a fallback. */
  revision_matched: boolean;
  bom_id: number | null;
  /** MES has a BOM for this revision. NOT the same as having its materials:
   *  the mart is pulled planner-first, so a non-planner model is has_bom:true
   *  with in_mart:false. */
  has_bom: boolean;
  /** The materials are in our mart. false + has_bom true = not pulled yet. */
  in_mart: boolean;
  /** The mes_assembly_map bridge carries bom_id at all. false on a freshly
   *  deployed server until the pipelines run — every model reads has_bom:false
   *  in that state, which says nothing about MES. */
  bridge_ready: boolean;
  /** false = the assembly itself was not found in MES. */
  in_mes: boolean;
  materials: BomMaterial[];
  revisions: BomRevision[];
}

export interface LineMetricsStation { step: string; ct: number; is_bottleneck: boolean; }
export interface LineMetricsLine {
  sub_workcenter: string;
  lbr: number | null;
  n0: number;
  bottleneck_step: string;
  bottleneck_ct: number;
  /** The perfectly-levelled operator height (target line on the Yamazumi). */
  balance_line: number | null;
  stations: LineMetricsStation[];
}
export interface LineMetricsBuffer {
  from: string; to: string; up_uph: number; down_uph: number;
  gap: number; ipk_units: number; trolleys: number;
}
/** IPK flow for one line (sub-workcenter): every process with its UPH, buffers between each. */
export interface IpkFlowStation { step: string; uph: number; ct: number; }
export interface IpkLine {
  sub_workcenter: string;
  trolleys: number;
  stations: IpkFlowStation[];
  buffers: LineMetricsBuffer[];
}
export interface LineMetrics {
  customer: string; assembly: string;
  lbr: number | null; n0: number; bottleneck_ct: number; bottleneck_step: string;
  station_count: number; ipk_trolleys: number; loading: number; boards_per_trolley: number;
  lines: LineMetricsLine[];
  ipk_lines: IpkLine[];
  buffers: LineMetricsBuffer[];
}

export interface CompletionSummary {
  as_of: string | null;
  count: number;
  counts: Partial<Record<CompletionStatus, number>>;
  models: CompletionModel[];
}

/** One week on the completion trend. `pct` is by DEMAND UNITS — volume is
 *  concentrated, so counting models flatters the number. `pct_models` is kept
 *  beside it so the two can be shown together rather than argued about. */
export interface CompletionWeek {
  iso_week: string;
  as_of: string | null;
  units: number;
  complete_units: number;
  pct: number | null;
  models: number;
  complete_models: number;
  pct_models: number | null;
}
/** One non-complete bucket. complete + every loss = 100% of demand units. */
export interface CompletionLoss {
  status: string;
  reason: string;
  units: number;
  models: number;
  pct: number | null;
}
export interface CompletionSplit {
  plant?: string;
  workcell?: string;
  units: number;
  complete_units: number;
  pct: number | null;
  models: number;
}
export interface CompletionHistory {
  weeks: CompletionWeek[];
  latest: CompletionWeek | null;
  losses: CompletionLoss[];
  by_plant: CompletionSplit[];
  by_workcell: CompletionSplit[];
}

/** One MES route step (actual), tagged by how it maps to IEDB. */
export interface CompletionMesStep {
  order: number | null;
  step: string;
  alias: string;
  qty: number | null;
  /** v1: present|missing|non_iedb|unmapped. v2 splits `missing` into `no_ct`
   *  (in route, blank CT) and `not_in_iedb` (route lacks the step). */
  status: 'present' | 'missing' | 'no_ct' | 'not_in_iedb' | 'non_iedb' | 'unmapped';
}
/** One IEDB route step (has a cycle time). */
export interface CompletionIedbStep {
  process: string;
  alias: string | null;
  sub_workcenter: string | null;
  /** IEDB step sequence — sort by this so it aligns with the MES route order. */
  order: number | null;
  cycle_time: number | null;
  /** "iedb" = this model's own route. "iedb:<assembly>" = BORROWED — the backend
   *  resolved the model to another assembly's route (suffix match) because this
   *  one has no IEDB rows of its own. Must be shown, never rendered as fact. */
  source?: string | null;
}
/** MES route vs IEDB route for one model (the side-by-side). */
export interface CompletionSteps {
  customer: string;
  assembly: string;
  mes: CompletionMesStep[];
  iedb: CompletionIedbStep[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/* ── Process registry ──────────────────────────────────────────────────────
 * MES and IEDB name the same process differently and neither name is
 * controlled. The registry lines them up per workcell. A residue cannot be
 * derived — matching by name is 38% right, by neighbouring scan 27%, by bay
 * 55% — so those go to the engineer who works the line. */

export interface RegistryWorkcell {
  workcell: string;
  processes: number;
  agreed: number;          // both systems know it
  iedb_only: number;       // IEDB prices it, not seen in the scan window
  gap: number;             // the floor runs it, IEDB never priced it
  questions_total: number;
  questions_left: number;
}

export interface RegistryProcess {
  process_key: string;
  process_family: string;
  process_name: string;
  workcenter: string;
  /** both · iedb_only · mes_only (the gap) · mes_non_iedb (rework/handling) */
  source: string;
  iedb_aliases: string;    // every IEDB spelling, ' | ' separated
  mes_steps: string;       // every MES spelling
  iedb_models: number;
  mes_models: number;
  mes_scans: number;
  review: string;
}

export interface RegistryQuestion {
  workcell: string;
  /** byte-exact, spaces included — it is the key */
  mes_step: string;
  models: number;
  scans: number;
  bay: string;
  /** e.g. "FVT#2(1035) HLA#3(7)" — what was scanned just before, and how often */
  scanned_before: string;
  scanned_after: string;
  candidates: string[];
  suggestion: string;
  /** position+name · position only · name only · nothing */
  confidence: string;
  answered: boolean;
  prior_answer?: string | null;
  prior_alias?: string | null;
  prior_by?: string | null;
}

export interface RegistryStep {
  workcell: string;
  mes_step: string;
  process_key: string;
  answer: string;
  models: number;
  scans: number;
  /** decision = an engineer said so · workbook = the Excel sheet ·
   *  auto = plant-wide id (weakest) · none = nothing maps it */
  source: 'decision' | 'workbook' | 'auto' | 'none';
  iedb_alias: string;
  decided_by: string;
  decided_on: string;
}

export interface RegistrySearch {
  query: string;
  workcells: { workcell: string }[];
  models: { workcell: string; assembly: string; revision: string;
            description: string; has_data: boolean }[];
  processes: { workcell: string; process_key: string; process_name: string;
               source: string; iedb_aliases: string; mes_steps: string;
               mes_scans: number }[];
}

/** The completion report — SAME module the Excel builder uses, so the screen
 *  and the file can never disagree. */
export interface CompletionReportSummary {
  status: string; models: number; planner_units: number; edash_units: number;
  gap_steps: number; unmapped_steps: number; pct: number;
}
export interface CompletionReportFreshness {
  mart: string; built: string | null; days_old: number | null; drives: string;
}
export interface CompletionReportRow {
  assembly: string; status: string; why: string;
  planner_units: number; edash_units: number;
  mes_steps: number | null; matched: number | null;
  /** IEDB's gap: it knows the step, no time entered */
  missing_ct: number | null;
  /** IEDB's gap: the floor ran a step its route lacks */
  not_in_route: number | null;
  /** OUR gap: the naming bridge could not identify the step */
  unmapped: number | null;
  gap: number | null; iedb_route_steps: number | null;
  upcoming_build: string; last_build: string;
}
export interface CompletionReport {
  workcell: string; models: number;
  summary: CompletionReportSummary[];
  freshness: CompletionReportFreshness[];
  rows: CompletionReportRow[];
}

// ─── Model universe — every model, not just the ones in demand ───────────────

/** One workcell's coverage. `models` is the DENOMINATOR the completion mart
 *  cannot supply on its own: it only holds models somebody ran a check on. */
export interface UniverseWorkcell {
  workcell: string;
  /** Home plant — where most of this workcell's demand sits. A few genuinely
   *  run in two (INFINERA is JBK and Plant 1), so this is dominant, not only. */
  plant?: string | null;
  /** Every distinct model, deduped across IEDB + MES + demand. */
  models: number;
  in_iedb: number;
  /** THE THREE BUCKETS — mutually exclusive, exhaustive, and known for 100% of
   *  models because they come from IEDB alone. No MES call, no completion run.
   *  has_ct + no_ct + not_iedb === models, asserted server-side per workcell.
   *
   *  Lead with these. complete/incomplete need the MES comparison and cover
   *  only ~10% of models, so a percentage built on them is a share of what we
   *  happened to check. */
  has_ct: number;
  /** In IEDB, nobody timed it. An IE task: go time it. */
  no_ct: number;
  /** Not in IEDB at all. A data-creation task: create it first. Deliberately
   *  NOT merged with no_ct — different people, different work. */
  not_iedb: number;
  pct_has_ct: number;
  built_24mo: number;
  in_demand: number;
  /** Judged with a status the current code can still read. */
  graded: number;
  ungraded: number;
  pct_graded: number;
  /** Complete as a share of GRADED, not of models — else "3% complete" really
   *  means "97% unchecked", which is a different problem with a different owner. */
  pct_complete_of_graded: number | null;
  complete: number;
  incomplete: number;
  no_cycle_time: number;
  not_in_iedb: number;
  not_built: number;
  cannot_check: number;
  /** IEDB's OWN assembly count for this workcell, from its CustomerStatus report.
   *  DIFFERENT UNIT to `in_iedb`: IEDB counts assembly+revision, we count models
   *  with revisions collapsed — so ours is expected to be smaller. Comparing the
   *  two as if they were the same unit is what made every workcell look short. */
  iedb_assembly_ids?: number | null;
}
/** One model in a workcell's full list. Metrics are null when IEDB never
 *  priced it — null, never zero, because zero reads as "takes no work". */
export interface UniverseModelRow {
  assembly: string;
  verdict: string | null;
  /** Has the completion check run on this model. Separate from `verdict`:
   *  the verdict says what is true, this says whether a check established it. */
  checked?: boolean;
  has_cycle_time: boolean | null;
  in_iedb_catalog: boolean | null;
  in_mes_history: boolean | null;
  in_demand: boolean | null;
  units: number | null;
  next_build: string | null;
  last_build: string | null;
}
export interface UniverseWorkcellModels {
  workcell: string; models: number; rows: UniverseModelRow[];
}

/** One IEDB process, BOTH of its names. The alias is the identifier and what
 *  gets stored; `process` is IEDB's display name and is often the only readable
 *  half — `BIRTH 1` is IEDB's `Label 1`, which no one could see before. Never a
 *  match key (it is free text), but as evidence it is what makes the alias
 *  legible to the person answering. */
export interface RegistryAlias {
  alias: string;
  /** IEDB's display name(s). Several joined by ' / ' when models disagree —
   *  that disagreement is itself worth seeing. */
  process: string;
  models: number;
}

export interface UniverseSummary {
  workcells: UniverseWorkcell[];
  statuses: string[];
  totals: Record<string, number>;
  freshness: CompletionReportFreshness[];
  /** Rows deliberately not counted as models, and why. Surfaced rather than
   *  filtered silently — 1,813 MES job records vanishing with no trace is how a
   *  total becomes unexplainable. */
  excluded: { rows: number; why: Record<string, number> };
}

export type RegistryAnswer = 'mapped' | 'non_iedb' | 'unknown';

/** What the step maps to. Separate from `source`, which says WHO decided it —
 *  "mapped" and "mapped by a plant-wide guess" are not the same fact, and one
 *  badge for both is what let bad auto-mappings look settled. */
export type ProcessStatus = 'mapped' | 'non_iedb' | 'unmapped' | 'unknown';

/** One (workcell, MES step) couple. That IS the mapping grain — inside a
 *  workcell no step name resolves to two IEDB aliases (0 of 9,734), so there is
 *  no model in this key and adding one would multiply the queue by every
 *  assembly for nothing. */
export interface ProcessRow {
  workcell: string;
  /** BYTE-EXACT as MES stores it. Trailing and double spaces are evidence. */
  mes_step: string;
  process_key: string;
  status: ProcessStatus;
  /** The IEDB counterpart. Empty when nothing maps it, or when it is non-IEDB. */
  iedb_alias: string;
  /** decision = an engineer · workbook = the Excel sheet · auto = the raw
   *  bridge · none = nothing maps it. */
  source: 'decision' | 'workbook' | 'auto' | 'none';
  decided_by: string;
  decided_on: string;
  models: number;
  /** MES scan RECORDS. The file's own `scans` column is 0 on all 82,010 rows —
   *  it was never populated — so this is the only real volume signal. */
  rows: number;
  scans: number;
}

export interface ProcessListPage {
  rows: ProcessRow[];
  total: number;
  page: number;
  page_size: number;
  /** Over the filtered set BEFORE paging, so the chips can show how much work
   *  each holds without a second round-trip. */
  counts: { mapped: number; non_iedb: number; unmapped: number };
}

export type ProcessScope = 'scanned' | 'configured';
export type ProcessSort =
  'step' | 'workcell' | 'status' | 'source' | 'maps_to' | 'models' | 'rows' | 'scans';

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatCall { tool: string; args: Record<string, unknown>; ok: boolean; }
export interface ChatAnswer {
  answer: string;
  /** Which tools ran, so the answer can be audited rather than trusted. */
  calls: ChatCall[];
  /** Which mart produced the numbers. Rendered under every answer. */
  sources: string[];
  elapsed_s: number;
  error?: string;
}
export interface ChatHealth { ok: boolean; detail: string; model: string; tools: string[]; }

export const cycleTimeApi = {
  health: {
    get: () => get<CycleTimeHealth>('/health'),
  },
  report: {
    /** The completion report for one workcell. Replaces the per-workcell Excel. */
    get: (workcell: string) => get<CompletionReport>('/report', { workcell }),
  },
  universe: {
    /** Per-workcell coverage: how many models exist vs how many we have judged. */
    summary: () => get<UniverseSummary>('/universe/summary'),
    /** EVERY model one workcell has — not the demand slice, not the judged slice. */
    workcell: (workcell: string) =>
      get<UniverseWorkcellModels>('/universe/workcell', { workcell }),
  },
  registry: {
    /** Every workcell with a registry, most unanswered first. */
    workcells: () => get<RegistryWorkcell[]>('/registry/workcells'),
    /** The browse view — every process, both systems' names. Worst first. */
    processes: (workcell: string) =>
      get<RegistryProcess[]>('/registry/processes', { workcell }),
    /** The queue — steps nothing maps, sorted by scans DESCENDING. Answering
     *  the top 20 covers most of the volume; alphabetical would not. */
    questions: (workcell: string, includeAnswered = false) =>
      get<RegistryQuestion[]>('/registry/questions', {
        workcell, include_answered: includeAnswered ? 'true' : 'false',
      }),
    /** One box, three kinds of answer — workcell, model, process. Nobody
     *  should have to know which one they are looking for before they type. */
    search: (q: string, limit = 8) =>
      get<RegistrySearch>('/registry/search', { q, limit }),
    /** EVERY MES step, mapped or not, with where its mapping came from.
     *  `questions` only serves the unmapped, which left a wrong mapping
     *  permanent — a mapping is a decision, and decisions get revised. */
    steps: (workcell: string, q = '') =>
      get<RegistryStep[]>('/registry/steps', { workcell, q }),
    /** The process list. `scanned` (5,344 couples) is the work list;
     *  `configured` (72,692, of which 67,394 were never scanned) is the whole
     *  route catalogue and is paged for a reason — never ask for it in one go. */
    processList: (p: {
      scope?: ProcessScope; workcell?: string; q?: string; status?: string;
      sort?: ProcessSort; direction?: 'asc' | 'desc'; page?: number; page_size?: number;
    }) => get<ProcessListPage>('/registry/process-list', {
      scope: p.scope ?? 'scanned', workcell: p.workcell ?? '', q: p.q ?? '',
      status: p.status ?? '', sort: p.sort ?? 'rows', direction: p.direction ?? 'desc',
      page: p.page ?? 1, page_size: p.page_size ?? 200,
    }),
    /** This workcell's own IEDB names — the pick-list. Scoped on purpose:
     *  `MA 1` is Mech Assy at ARISTA and Deposition OPT 10 at LAM GAS BOX. */
    aliases: (workcell: string) => get<RegistryAlias[]>('/registry/aliases', { workcell }),
    /** Record one answer. Re-deciding replaces. */
    decide: (body: {
      workcell: string; mes_step: string; answer: RegistryAnswer;
      iedb_alias?: string; evidence?: string;
    }) => postJson<{ workcell: string; mes_step: string; answer: string }>(
      '/registry/decision', body),
    /** Answer many steps at once, all-or-nothing. Four spellings of one step
     *  name are four rows and ONE answer; one at a time is four round-trips
     *  and four chances to typo the alias. */
    decideBulk: (items: {
      workcell: string; mes_step: string; answer: RegistryAnswer;
      iedb_alias?: string; evidence?: string;
    }[]) => postJson<{ saved: number }>('/registry/decisions', { items }),
    /** Write answers to process_decision.csv for the registry generators. */
    export: () => post<{ exported: number }>('/registry/export'),
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
  completion: {
    /** Per-model completion summary (all top-runners), optionally filtered. */
    list: (customer?: string, status?: string) =>
      get<CompletionSummary>('/completion', { customer, status }),
    /** Demand-ranked completion: what we are building and about to build. */
    demand: (params?: { plants?: string; workcells?: string; status?: string; limit?: number }) =>
      get<DemandCompletionResponse>('/completion/demand', params),
    /** Weekly trend + loss breakdown — the 4Q view. */
    history: (params?: { plants?: string; workcells?: string; weeks?: number }) =>
      get<CompletionHistory>('/completion/history', params),
    /** MES actual route vs IEDB route for one model (the side-by-side). */
    steps: (customer: string, assembly: string, signal?: AbortSignal) =>
      get<CompletionSteps>('/completion/steps', { customer, assembly }, signal),
    /** Per-model LBR + IPK breakdown (lines, stations, buffers). */
    lineMetrics: (customer: string, assembly: string, signal?: AbortSignal) =>
      get<LineMetrics>('/completion/line-metrics', { customer, assembly }, signal),
  },
  chat: {
    /** Is the local model up? Cheap — call before showing the composer so a dead
     *  Ollama reads as "not running" instead of a spinner that never resolves. */
    health: () => get<ChatHealth>('/chat/health'),
    /** Ask one question. `history` carries prior turns as plain text only. */
    ask: (question: string, history: { role: string; content: string }[] = []) =>
      postJson<ChatAnswer>('/chat', { question, history }),
  },
  bom: {
    /** MES BOM materials for one model. Omit `revision` for the newest revision
     *  that actually has a BOM. Never 404s — a model with no BOM comes back
     *  `has_bom:false`, which is an answer, not a failure. */
    get: (customer: string, assembly: string, revision?: string, signal?: AbortSignal) =>
      get<ModelBom>('/bom', { customer, assembly, revision }, signal),
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
