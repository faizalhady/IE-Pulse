/**
 * FSMS v2 — Data Contracts
 * ========================
 * The single source of truth for the *shape* of all FSMS data that crosses the
 * front end ⇄ back end boundary. The FE codes against these types; mock data
 * honours them today, FastAPI honours them later. Swapping mock → real API is a
 * wiring change, not a rewrite.
 *
 * Modelled relationally (IDs + references + enums) per the legacy Postgres schema
 * (`FSMS.SouthAsia.PEN/FSMS-DDL.sql`) so the contract matches the eventual DB.
 *
 * Naming: snake_case to match the existing IE Pulse FSMS API (`Bay` in
 * BayManagement.tsx) and the eventual FastAPI/Pydantic serialization — keeps the
 * contract free of a mapping layer. Dates are ISO strings (normalise via the
 * platform `normalizeDates()` helper before comparison).
 *
 * Two layers below:
 *   • STORAGE ENTITIES   — relational tables (what the DB persists).
 *   • REPORTING VIEW-MODELS — read-only projections returned per dashboard surface.
 *
 * See: plans/fsms-v2-initial-development.md · docs/FSMS_BUILD.md · Notion "FSMS Hub".
 */

// ─── Enums & unions (verbatim from the DB enums) ────────────────────────────────

export type BatchStatus = 'Pending' | 'Approved' | 'Rejected' | 'Superseded';

export type ApprovalDecision = 'Approved' | 'Rejected';

export type UserRole =
  | 'Guest'
  | 'PIC-P1'
  | 'PIC-P2'
  | 'PIC-BK'
  | 'Finance-PIC'
  | 'Developer'
  | 'OPS'
  | 'SuperAdmin'
  | 'BusinessUnit'
  | 'entitySME'
  | 'siteSME';

export type BuEntryStatus =
  | 'Draft'
  | 'Pending'
  | 'PendingSiteSME'
  | 'PendingAcknowledgment'
  | 'Approved'
  | 'Rejected';

/** Per-type (SMT / DF) stage on a BU entry; null = N/A for that type. */
export type BuTypeStage =
  | 'draft'
  | 'pending_sme'
  | 'pending_site_sme'
  | 'pending_acknowledgment'
  | 'approved';

/** Space category on CONSO detail rows. */
export type SpaceType = 'SMT' | 'DF' | 'Temporary - SMT' | 'Temporary - DF';

/** Forecast / rate types are only SMT or DF. */
export type ForecastType = 'SMT' | 'DF';
export type RateType = 'SMT' | 'DF';

/** Plants in the legacy CONSO domain (the bay model additionally uses P3). */
export type Plant = 'P1' | 'P2' | 'BK';

export type RevenueStatus = 'Actual' | 'Forecast';

/** The four required CONSO approver roles. */
export const REQUIRED_APPROVER_ROLES: UserRole[] = ['PIC-P1', 'PIC-P2', 'PIC-BK', 'Finance-PIC'];

// ════════════════════════════════════════════════════════════════════════════
// STORAGE ENTITIES
// ════════════════════════════════════════════════════════════════════════════

// ─── Auth: users & roles (relational, many-to-many) ─────────────────────────────

export interface User {
  nameid: string;            // PK — external identity id
  unique_name: string | null;
  email: string | null;
  iss?: string | null;       // token issuer
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Convenience: roles joined by the API for the Users surface. */
  roles?: UserRoleAssignment[];
}

export interface UserRoleAssignment {
  nameid: string;            // FK → users.nameid
  role: UserRole;
  granted_at?: string | null;
  granted_by?: string | null;
  revoked_at?: string | null;
  revoked_by?: string | null;
}

// ─── CONSO pipeline: batches, approvals, live data ──────────────────────────────

/** A single Excel cell comment carried as jsonb in the DB. */
export interface FsNote {
  text: string;
  [k: string]: unknown;
}

export interface ImportBatch {
  id: string;                // bigserial as string (JS-safe)
  filename: string;
  period_at: string;
  period_date: string;       // reporting period (1st of month)
  uploader_id: string;       // FK → users.nameid
  plants: string[];
  status: BatchStatus;
  status_at: string;
  created_at?: string;
  notify_sent_at?: string | null;
  /** Convenience for the approval-timeline detail view. */
  approvals?: BatchApproval[];
  required_approvers?: RequiredApprover[];
}

export interface BatchApproval {
  batch_id: string;
  approver_id: string;       // FK → users.nameid
  role: UserRole;
  decision: ApprovalDecision;
  decided_at: string;
  comment?: string | null;   // required when decision = 'Rejected'
}

export interface RequiredApprover {
  batch_id: string;
  nameid: string;
  role: UserRole;            // never 'Guest'
}

/** Live floor-space header row (post-promotion). */
export interface FsDetail {
  id: string;
  period_at: string;
  period_date: string;
  bay: string;
  type: SpaceType;
  plant: Plant | string;
  area: string;              // defaults to '' — part of the unique grain
  total_used?: number | null;
  total_available?: number | null;
  surplus_0301?: number | null;
}

/** Per-customer sqft allocation, child of FsDetail (cascade). */
export interface FsDetailValue {
  id: string;
  row_id: string;            // FK → fs_details.id
  profit_center: string;     // e.g. '0301ARISTA'
  customer_name: string;
  value?: number | null;     // sqft
  notes?: FsNote[];
}

/** Planned space from the CONSO Summary sheet. */
export interface FsForecast {
  id: string;
  period_date: string;
  profit_center: string;
  type: ForecastType;
  forecast_value: number;
  notes?: FsNote[];
}

// ─── Direct imports (no approval gate) ──────────────────────────────────────────

/** PRISM forward forecast — distinct from fs_forecast. */
export interface PrismForecast {
  id: string;
  customer: string;
  type: ForecastType;
  plant: Plant | string;
  area?: string | null;
  profit_center?: string | null;
  period_date: string;
  fiscal_year: number;
  calendar_month: number;    // 1-12
  forecast_value: number;
}

/** Monthly revenue per profit centre, from TM1_FINANCE (storage row). */
export interface RevenueMonthMetric {
  id: string;
  profit_center: string;     // e.g. '0301GOPRO_'
  customer?: string | null;
  division?: string | null;
  month_label: string;       // e.g. 'Sep FY 25'
  fiscal_year: number;
  fiscal_month_index: number; // 1=Sep … 12=Aug
  calendar_month: number;     // 1-12
  revenue_usd?: number | null;
  revenue_status?: RevenueStatus | null;
}

/** $/sqft rate effective from a given month (1st of month). */
export interface RateSetting {
  id: string;
  rate_type: RateType;
  effective_date: string;
  rate_value: number;        // USD per sqft
}

// ─── BU pipeline (rich — full shape from the DDL) ───────────────────────────────

export interface BusinessUnitEntry {
  id: string;
  market_segment?: string | null;
  quote_month?: string | null;          // 'Quoted' | 'Quote in progress' etc.
  customer_name?: string | null;
  product_description?: string | null;
  complexity?: string | null;
  jabil_pic?: string | null;
  annual_revenue?: number | null;
  space_smt?: number | null;            // requested SMT sqft
  space_backend?: number | null;        // requested DF/backend sqft
  machines?: string | null;             // 'N/A' | 'Yes' | 'TBD'
  estimated_start?: string | null;
  confidence?: number | null;           // 0-100
  remarks?: string | null;
  space_lock?: string | null;           // PRISM space lock: 'Y' | 'N'
  status: BuEntryStatus;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Independent per-type progression
  smt_stage?: BuTypeStage | null;
  df_stage?: BuTypeStage | null;
  smt_rejection_reason?: string | null;
  df_rejection_reason?: string | null;
  // Site-SME physical assignments (separate per type)
  sme_smt_plant?: string | null;
  sme_smt_location?: string | null;
  sme_df_plant?: string | null;
  sme_df_location?: string | null;
  sme_space_smt?: number | null;        // SME-validated SMT sqft
  sme_space_backend?: number | null;    // SME-validated DF sqft
  sme_updated_at?: string | null;
  sme_updated_by_nameid?: string | null;
  // Soft delete
  is_voided?: boolean;
  voided_at?: string | null;
  voided_by_nameid?: string | null;
  void_reason?: string | null;
}

// ─── App settings (announcement / marquee banner) ───────────────────────────────

export interface AppSetting {
  id: string;
  setting_key: string;
  message?: string | null;
  is_active?: boolean;
  scroll_speed?: number;
}

// ─── Documents (NEW — provisional; buy-off feature is being designed fresh) ─────

export type DocumentBuyoffStatus = 'Pending' | 'Approved' | 'Rejected';

export interface DocumentRecord {
  id: string;
  title: string;
  category?: string | null;
  file_name: string;
  file_size?: number | null;
  uploaded_by: string;       // FK → users.nameid
  uploaded_at: string;
  status: DocumentBuyoffStatus;
  approvals?: DocumentApproval[];
}

export interface DocumentApproval {
  document_id: string;
  approver_id: string;
  decision: ApprovalDecision;
  decided_at: string;
  comment?: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// REPORTING VIEW-MODELS (dashboard surfaces)
// Computed / aggregated projections returned by the reporting endpoints — one
// cluster per surface. Read-only; distinct from the storage entities above.
// ════════════════════════════════════════════════════════════════════════════

// ─── Home: plant utilisation (latest CONSO month, excludes Temporary) ───────────

export interface PlantUtilizationRow {
  plant: string;
  area: string;
  label: string;             // area if present, else plant
  total_available: number;   // MFG space (sqft)
  utilization_space: number; // Σ fs_details_value.value
  surplus: number;
  utilization_pct: number;   // utilization_space ÷ total_available × 100
}

export interface PlantUtilizationResponse {
  conso_month: string;       // e.g. 'March 2026'
  conso_date: string;        // 'YYYY-MM-DD'
  plants: string[];
  data: Record<string, PlantUtilizationRow[]>;  // keyed by plant
}

// ─── Analysis: capacity-planning rows (Utilization vs PRISM vs PRISM+BU) ────────
// One row per (plant, area, period). Drives the per-plant composed charts plus
// the over-capacity and 90%-target overlays. snake_case; the legacy API returned
// Plant/Area/Remark in PascalCase.

export interface SpaceAnalysisRow {
  plant: string;
  area: string;
  period: string;            // X-axis label (quarter e.g. 'Q1 FY26' or month)
  // SMT band
  smt_total_available: number | null;
  smt_utilization: number | null;
  smt_surplus: number | null;
  smt_ltp_prism: number | null;        // PRISM long-term-plan demand
  smt_ltp_bu: number | null;           // Business-Unit forecast demand
  smt_prism_balance: number | null;    // PRISM − utilization
  smt_combined_balance: number | null; // (PRISM + BU) − utilization
  // DF band
  df_total_available: number | null;
  df_utilization: number | null;
  df_surplus: number | null;
  df_ltp_prism: number | null;
  df_ltp_bu: number | null;
  df_prism_balance: number | null;
  df_combined_balance: number | null;
  // Overall
  overall_ltp_prism: number | null;
  remark: string;
}

// ─── Summary Space Directory (plant-dynamic; supports P3+) ──────────────────────

export interface PlantCell {
  plant: string;             // 'P1' | 'P2' | 'BK' | 'P3' …
  smt: number;
  df: number;
  smt_comment?: string | null;
  df_comment?: string | null;
}

export interface ConsoSummaryRow {
  date: string;
  profit_center: string;
  customer_name: string;
  customer_location: string;        // dominant plant(s), e.g. 'P1/P2'
  by_plant: PlantCell[];            // per-plant SMT/DF actuals (dynamic)
  forecast_smt: number;
  forecast_df: number;
  actual_smt: number;
  actual_df: number;
  variance_smt: number;             // forecast − actual
  variance_df: number;
  forecast_smt_comment?: string | null;
  forecast_df_comment?: string | null;
  actual_smt_comment?: string | null;
  actual_df_comment?: string | null;
  variance_smt_comment?: string | null;
  variance_df_comment?: string | null;
}

export interface PlantSurplus {
  plant: string;
  smt: number;
  df: number;
}

/** surplus_0301 grouped by plant/type — synthesised into the '0301SURPLS' row. */
export interface SurplusSummary {
  date: string;
  plants: string[];
  by_plant: PlantSurplus[];
}

/** KPI card on the Summary directory. */
export interface SummaryKpis {
  rate_smt: number | null;
  rate_df: number | null;
  rate_error?: string;
  permanent: number;
  total_available: number;
  utilization: number;       // permanent ÷ total_available × 100
}

// ─── Workcell Space Directory ───────────────────────────────────────────────────

/** KPI section cards. */
export interface DashboardKpis {
  forecast: number;
  permanent: number;         // Σ value, excludes Temporary
  overall: number;           // Σ value, all types (permanent + temporary)
  temporary: number;         // Σ value, Temporary only
  surplus: number;
  total_available: number;
  utilization: number;       // permanent ÷ forecast × 100
  rate_smt: number | null;
  rate_df: number | null;
  rate_error?: string;
}

/** Variance (forecast-vs-actual) table row. */
export interface ForecastVsActualRow {
  customer: string;
  mth: string;               // 'YYYY-MM'
  qtr: string;               // e.g. "Q2'25"
  forecast_sqft: number;
  actual_sqft: number;
  variance: number;          // forecast − actual
  temporary_sqft: number;    // portion of actual that is Temporary
}

/** Monthly actual-vs-forecast trend point. */
export interface TrendPoint {
  mth: string;               // 'YYYY-MM'
  actual: number;
  forecast: number;
}

/** Per-bay area detail (Σ permanent sqft by bay). */
export interface AreaScopeRow {
  plant: string;
  area: string;
  bay: string;
  sqft: number;
  temp_sqft: number;
  total_available: number;
  period_date: string;       // 'YYYY-MM-DD'
}

export interface AreaDetails {
  rows: AreaScopeRow[];
  top_bays: string[];        // top-8 bay names by sqft
}

// ─── Plant Space Directory (revenue / sqft) ─────────────────────────────────────

/** Revenue row with CONSO sqft joined + carry-forward/backward flags. */
export interface RevenueMetricRow {
  id: string;
  profit_center: string;
  customer: string;
  division: string | null;
  month_label: string;       // e.g. 'Sep FY 25'
  fiscal_year: number;
  fiscal_month_index: number; // 1=Sep … 12=Aug
  calendar_month: number;     // 1-12
  revenue_usd: number | null;
  actual_sqft: number | null;
  rev_per_sqft: number | null;   // revenue_usd ÷ actual_sqft (null if sqft = 0)
  month_date: string;        // 'YYYY-MM-DD'
  is_forecast: boolean;      // true when sqft carried from another month
  source_month: string | null;   // 'YYYY-MM-DD' month the sqft came from
}

/** Per-division revenue summary + Golden Line benchmark. */
export interface GoldenLineSummary {
  division: string;
  total_revenue: number;
  total_actual_sqft: number;
  avg_rev_per_sqft: number;
  profit_center_count: number;
  month_count: number;
  golden_line: number | null;    // (Σ(rev/sqft) ÷ months) ÷ workcells
}

// ─── Guided uploads ─────────────────────────────────────────────────────────────

export type UploadKind = 'CONSO' | 'REVENUE' | 'PRISM' | 'RATE';

export type UploadIssueLevel = 'error' | 'warning';

export interface UploadIssue {
  level: UploadIssueLevel;
  message: string;
}

/** Result of parsing/validating an upload BEFORE committing — drives the guided preview. */
export interface UploadPreview {
  kind: UploadKind;
  file_name: string;
  period_date?: string | null;     // inferred from filename (CONSO)
  detected_sheets?: string[];
  row_count?: number;
  rows_to_stage?: number;
  issues: UploadIssue[];           // blocking errors + non-blocking warnings
  ok: boolean;                     // safe to commit
}

// ─── UI helper: approval timeline step (derived, FE-only) ───────────────────────

export type TimelineState = 'done' | 'current' | 'waiting' | 'rejected' | 'skipped';

export interface TimelineStep {
  label: string;
  state: TimelineState;
  actor?: string;        // who acted (e.g. 'PIC-P2' or 'System Auto-Approve')
  at?: string;           // when
  comment?: string;      // rejection reason etc.
}
