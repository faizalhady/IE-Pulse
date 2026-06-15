# FSMS v2 — Initial Development Plan (IE Pulse)

> Temporary planning doc for the initial FSMS v2 build. Drives the first Claude Code
> sessions. Once the module is scaffolded, the durable reference is `docs/FSMS_BUILD.md`.
> Deep domain reference (legacy system): Notion "FSMS — Technical Documentation Hub".

---

## 0. TL;DR

We are rebuilding the FSMS **reporting + approval + upload** system as new surfaces
**inside the existing IE Pulse `fsms` module** (not a new module). The legacy
standalone Next.js app (`FSMS.SouthAsia.PEN`) has good data-flow bones but bad UX and
serious security holes — we keep its behaviour, not its mistakes.

Approach: **front end first, on mock data, against typed contracts** (`src/types/fsms.ts`).
The backend (FastAPI + DB) is wired later; the contracts insulate the FE so swapping
mock → real API is a wiring change, not a rebuild.

---

## 1. Scope & boundaries

### We are NOT creating a new module
FSMS is already registered (`src/config/apps.ts`, `.env.fsms`, `build:fsms`). The folder
`src/pages/fsms/` already exists with two pages:

- `BayManagement.tsx` — bay records (dimensions, RM cost rates, personnel) via `/api/fsms/bays`
- `LayoutEditor.tsx` — floor-plan zone editor (SQLite + sessionStorage)

These are the **physical/spatial** side of floor space and they STAY. v2 adds the
**analytics + workflow** side as new surfaces in the same module.

### ⚠️ Two floor-space data models now coexist (decision needed later)
- **Existing IE Pulse model:** bays/zones, `workcell`, `plant`, `floor`, `rate_per_sqm`,
  `monthly_cost` (RM). Operational bay/layout management.
- **Legacy FSMS model (what we port):** `profit_center`, `SMT`/`DF`/`Temporary` types,
  sqft allocations, fiscal-year revenue (USD), the approval pipeline.

For now they live side by side as different tabs. **Open question:** do bays map onto
CONSO areas, or stay independent? Defer until both are visible.

---

## 2. Strategy (confirmed)

1. **Contract-first.** Every screen is coded against typed contracts in `src/types/fsms.ts`,
   modelled relationally (IDs + references + enums) per the legacy Postgres schema.
2. **FE-first.** Build the full front end for all surfaces on mock data, so the whole app
   is visible early. Then wire the backend.
3. **Deferred DB decision.** IE Pulse currently uses local parquet/SQLite. Reporting reads
   are fine on that. The **gated approval engine wants PostgreSQL** (atomic promote,
   advisory lock, triggers, `pg_notify` — see §4). Decide at backend-wiring time whether
   FSMS brings Postgres in, or re-implements the engine in the FastAPI layer.
4. **UX is a first-class goal.** The legacy is 11+ disconnected pages with no IA. v2 is
   compact and tab-driven (use `UnderlineTabs` from `components/shared`). Uploads are guided
   (preview + validate before commit), no tutorial needed.

---

## 3. The domain (grounded in the legacy `FSMS-DDL.sql`)

Four data flows:

| Flow | Source file | Gated? | Lands in |
|---|---|---|---|
| **CONSO** (actual floor space) | big `.xlsx`, Details + Summary sheets | ✅ 4-role approval | staged → `fs_details`, `fs_details_value`, `fs_forecast` |
| **PRISM** (forward forecast) | one sheet per future month | ❌ direct | `prism_forecast` |
| **Revenue** (TM1_FINANCE) | small `.xlsx`, `ALL CUSTOMERS` anchor | ❌ direct | `revenue_month_metrics` |
| **BU pipeline** (prospective space) | created in-app | ✅ staged workflow | `business_unit_entries` |

Enums (verbatim from DDL): `batch_status` (Pending/Approved/Rejected/Superseded),
`approval_decision` (Approved/Rejected), `user_role` (11 values), `bu_entry_status`
(Draft/Pending/PendingSiteSME/PendingAcknowledgment/Approved/Rejected), plus the
free-text `smt_stage`/`df_stage` (draft → pending_sme → pending_site_sme →
pending_acknowledgment → approved).

The CONSO engine (DB-resident, the part we must reproduce faithfully):
`fs_promote_batch` (atomic upsert + supersede under `pg_advisory_xact_lock`),
`fs_auto_promote_if_ready` (promotes when all 4 roles approved),
`fs_validate_approval` (role check; SuperAdmin bypass; reject needs comment),
`fs_apply_reject_status`, `fs_reset_batch`, `fs_auto_approve_stale_batches` (>3 days),
`notify_batch_approved` (`pg_notify`).

### Known issues to FIX in v2 (do NOT copy)
1. **Auth: JWT is decoded, never verified** — forge-able cookie. v2 must verify signatures.
2. **Dead middleware** — page-level RBAC never runs (`proxy.ts` not `middleware.ts`).
3. **Client-supplied role** trusted on approve; only the DB trigger backstops it.
4. **Bespoke/inconsistent route gating** — centralise on one guard + `roles.ts` maps.
5. **`fs_promote_batch` ON CONFLICT grain mismatch** — table UK is now
   `(period_date, plant, type, bay, area)` (5 cols) but the function's `ON CONFLICT`
   targets only 4, and `fs_auto_promote_if_ready` swallows ALL exceptions → a promote can
   fail silently. v2 must fix the grain deliberately and never swallow promote errors.

---

## 4. Surfaces (the seven + the existing two)

| # | Surface (route) | Tabs / sections | Primary contract | Complexity | FE↔BE coupling | Phase |
|---|---|---|---|---|---|---|
| — | Plants / Floor Map / Layout / Bays | (existing — keep) | existing `Bay`/`Zone` | — | — | live |
| 1 | **Dashboard** `/fsms/dashboard` | Overview · Trends · By customer · By area · Revenue/sqft | `DashboardKpis`, `ForecastVsActualRow`, `ConsoSummaryRow`, `RevenueRow` | Low (read-only) | Loose | 1 |
| 2 | **Uploads** `/fsms/uploads` | CONSO · Revenue · PRISM · Rate (guided) | `UploadPreview`, `ImportBatch` | Medium | Medium | 1 |
| 3 | **Approvals** `/fsms/approvals` | Batch list + status-timeline detail | `ImportBatch`, `BatchApproval`, `RequiredApprover` | High | Very tight (engine) | 1 |
| 4 | **Documents** `/fsms/documents` | Library + upload + buy-off | `DocumentRecord` (new design) | High | Tight | 1 |
| 5 | **Users & roles** `/fsms/users` | Members + role assignment | `User`, `UserRole`, `roles.ts` maps | Medium | Tight (auth) | 1 |
| 6 | **Settings** `/fsms/settings` | Rates · Announcement banner | `RateSetting`, `AppSetting` | Low/Med | Medium | 1 |
| 7 | **BU pipeline** `/fsms/business-unit` | Requests · SME review · Site-SME assign | `BusinessUnitEntry` (rich) | High | Very tight | **2 (proposed)** |

> Proposal: Phase 1 = CONSO approvals + documents + reporting + uploads + roles/settings.
> BU pipeline → Phase 2 (it's a second state machine + 3 role views). Confirm.

---

## 5. Build order

### Phase A — Front end on mocks (do this first, all surfaces)
0. **Foundation:** contracts (`src/types/fsms.ts`), `src/lib/fsms/fsmsConstants.ts`
   (status badges, thresholds), mock data (`src/mocks/fsms/`), routes in `App.tsx`,
   extend `apps.ts` navItems. Establish the tab shell with `UnderlineTabs`.
1. **Dashboard** — build one tab fully (mock → hook → page) to set the pattern, then the rest.
2. **Uploads** — guided upload UX with mock parse/preview.
3. **Approvals** — the status-timeline (linear + parallel modes; off-ramp states).
4. **Documents** — new buy-off surface.
5. **Users & roles**, **Settings**.
6. **BU pipeline** (if Phase 1) — else defer.

### Phase B — Backend wiring (de-risked order, later)
DB decision → reporting reads → direct imports (revenue/PRISM/rate) → roles/auth (verify
JWT, central guard) → CONSO engine (port promote/triggers, fix the grain bug, no silent
swallow) → BU → documents.

---

## 6. Contracts to define (`src/types/fsms.ts`)

Entities (relational, from DDL): `User`, `UserRole`, `ImportBatch`, `BatchApproval`,
`RequiredApprover`, `FsDetail`, `FsDetailValue`, `FsForecast`, `PrismForecast`,
`RevenueMonthMetric`, `RateSetting`, `BusinessUnitEntry`, `AppSetting`, `DocumentRecord` (new).
Enums: `BatchStatus`, `ApprovalDecision`, `UserRole` (11), `BuEntryStatus`, `BuTypeStage`,
`SpaceType` (`SMT`|`DF`|`Temporary - SMT`|`Temporary - DF`), `Plant` (`P1`|`P2`|`BK`).
Report/response shapes (from the DB functions): `ConsoSummaryRow` (from
`get_conso_summary_json`), `ForecastVsActualRow` (from `get_forecast_vs_actual_multi`),
`DashboardKpis`, `RevenueRow` (revenue + carry-forward `is_forecast` flag), `UploadPreview`.

---

## 7. IE Pulse conventions (follow exactly — read existing modules first)

- **Pages:** `src/pages/fsms/` (no cross-module imports).
- **Hooks:** `src/hooks/fsms/` — one file per entity, react-query, `queryKey: ['fsms-<resource>', ...]`,
  base URL `import.meta.env.VITE_API_URL`.
- **Constants:** `src/lib/fsms/fsmsConstants.ts` — status badges + `getXStatus()` (never inline).
- **Types:** `src/types/fsms.ts`.
- **Mocks:** `src/mocks/fsms/`.
- **UI:** shadcn/ui + Tailwind + lucide-react + recharts only; `cn()` for classNames;
  `UnderlineTabs` for tabs (ref `PPQT2AWorkcell.tsx`); sticky-header + card classes per CLAUDE.md §8.
- **Routes:** add to `src/App.tsx` wrapped in `{includesApp('fsms') && <>...</>}`; basename `/ietools/`.
- **Registry:** extend the `fsms` entry's `navItems` in `apps.ts` (Dashboard, Uploads, Approvals, etc.).

---

## 8. Open decisions

1. **BU pipeline — Phase 1 or 2?** (recommend 2)
2. **DB for the engine** — Postgres in IE Pulse vs FastAPI-layer re-implementation. (defer to Phase B)
3. **Bay/cost model vs CONSO sqft model** — reconcile or keep independent? (defer)
4. **"Document buy-off" scope** — generalise the approval pattern vs a fresh doc-management feature.

---

## 9. Immediate next steps

1. Write `src/types/fsms.ts` (the contracts).
2. Write `docs/FSMS_BUILD.md` (durable module doc).
3. Scaffold the Dashboard surface first (tab shell + Overview tab on mock data).
