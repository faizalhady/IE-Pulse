# Cycle Time — Action Items

Legend: ✅ done · 🔲 todo · ⏸ deferred

---

## Item 1 — Reuse old "incompletion" logic on a different page  🔲
- Old approach = derived from cycle-time data itself, not the CustomerStatus API.
- `/coverage`: `COUNT(DISTINCT assembly)` over `raw.parquet` = assemblies with data.
- ✅ Already surfaced as the "Completion % (old)" column on the Incompletion Report
  (old = coverage ÷ config `assembly_count`), shown next to "Completion % (API)".
- 🔲 Still TODO: dedicated page if we want more than the comparison column.

## Item 2 — Incompletion report  🔲 (basic version ✅)
- ✅ Sidebar page "Incompletion Report" — workcell list + completion % (API vs old).
- ✅ Click workcell → detail page lists assemblies with NO data (live from IEDB
  `/no-data-assemblies`, computed as full catalogue − hasRawData=true).
- ✅ Column sorting on both tables + the detail table.
- ✅ **Assembly catalogue stored** — `assembly_catalog.parquet`: one row per
  (customer, assembly) for the FULL IEDB catalogue + `has_data` flag (350,511 rows,
  33 customers, ~160s). Dedicated table (NOT appended to assembly_summary, which is
  with-data only + rebuilt from raw). `/no-data-assemblies` now reads this parquet
  (instant) with a live-IEDB fallback. Rebuild: `POST /api/cycle-time/catalog/refresh`
  (+ `/catalog/status`). This kills the slow live-IEDB badge call on the detail page.
- 🔲 Filters by plant / workcell / customer.
- 🔲 Precise definition of "incomplete" (has some data but missing steps) — still TBD.
- 🔲 Wire the daily catalog refresh into a schedule.

## Item 3 — eBuild (MES buildplan) in ole-backend  ✅
- ✅ `GET /api/ebuild/buildplan?from&to` — runs stored proc `SP_GET_SY_SMT_BUILDPLAN`
  via pyodbc. Tested live. This is the MES "what was actually built" source.
- This UNBLOCKS runner ranking (see Item 4), which was deferred for lack of volume data.

## Item 4 — Runner ranking (top/bottom runners)  ✅
Data source = eBuild buildplan (Item 3).
- ✅ **4a/4c. Mart + endpoint** — `build_runners_mart(24)` pulls 24 mo, aggregates
  SUM(UnitsCompleted) per (Customer + SMT_Assembly) → `data/mart/ebuild/runners.parquet`
  (26,223 rows, ~86s). `GET /api/ebuild/runners?customer=&order=&limit=` ranks it.
  Simplified vs plan: full refresh (proc returns current state), NO incremental
  upsert needed since a 24-mo pull is cheap.
- ✅ **4b. Refresh** — `POST /api/ebuild/refresh?months=24` (background) + `/refresh/status`.
  🔲 Actual daily schedule not wired yet (call refresh from whatever runs cycle-time's).
- ✅ **4d. Incompletion detail page** — now lists the workcell's assemblies ranked
  by units built (24 mo), each badged has-data / no-data. Runner endpoint re-exported
  at `/api/cycle-time/runners` so the FE proxy reaches it.

### Known limitation (fast-match, accepted)
- Badge join = normalised name (MES `SMT_Assembly` ↔ IEDB `AssemblyName`), ~73% match.
  Unmatched names (e.g. `-SMT` suffix, missing `GE` prefix, trailing spaces) are
  treated as "has data". 🔲 Refine matching later (was the "clean" option B).

---

## Decisions (settled)
- Runner metric = **UnitsCompleted** (actual built). ✓
- Granularity = **SMT_Assembly + Customer** (report is per-workcell = per-customer). ✓
- Rolling window = **24 months** (~2 min to pull; live query viable). ✓

## Item 5 — Plant column on the workcell league table  ✅
- Plant is NOT in IEDB. Sourced from the **MES buildplan** `Plant` column instead.
- Only 4 of 41 customers build in >1 plant → use **dominant plant** (most units).
- ✅ `customer_plant.parquet` written during the runner refresh; `/api/ebuild/customer-plants`
  (+ `/api/cycle-time/customer-plants` re-export). League table shows a sortable **Plant** column.
- Join MES↔config customer names is normalised (trim / uppercase / `_`→space); ~39/41 match.
  Skydio (no data yet) + Tellabs (EOL) don't appear in MES — expected.

## Item 9 — Plant supervision override + DYSON EOL + Projection runners  ✅ (2026-07-09)
- **Plant override:** `MICRON SIG`, `LAMGB`, `LAMMEC` → forced Plant 1 (physically BK,
  P1 supervision). `_apply_ct_rules()` in `ebuild.py` (used by both marts).
- **DYSON removed** (EOL): dropped from `CT_CUSTOMERS`, excluded in `build_runners_mart`,
  purged from all cycle-time + eBuild marts.
- **Projection runner list** (near-term demand): `build_projection_runners_mart(weeks=4)`
  → `projection_runners.parquet` (units = `SUM(Quantity)`, filter `Active=True & Quantity>0`).
  Endpoint `/plant-runners?mode=historical|projection`; FE Historical/Projection toggle.
  Horizon capped ~4wk (MES only populates the plan that far — verified). Blend list +
  long-horizon demand deferred until planners' DB. See vault `eBuild Plan — Procedure`.

## Item 8 — Plant Runner Dashboard  ✅ (FE built this session)
Page: `src/pages/cycletime/PlantRunnerDashboard.tsx` · route `/cycle-time/plant-runners`
· sidebar "Plant Runners". Data: `/api/cycle-time/plant-runners?top=100&plants=3`
(re-export of eBuild `plant_runners.parquet`).

### Three collapsible layers (all expanded by default)
1. **Overall Penang** — all plants combined (size tier `lg`, taller rows/bigger font).
2. **Region** — Batu Kawan (JBK) vs Penang Island (Plant 1 + JPE). Backend `_REGIONS`
   in `ebuild.py` aggregates each region's plants (size `md`).
3. **By Plant** — JBK / Plant 1 / Plant 2, one card each (size `sm`, smallest font).
- 3 font-size tiers via `SIZE` map (lg→md→sm). Cards in a layer equal-height
  (`h-full` + `max-h-[75vh]`, list scrolls).

### Features
- **Workcell no-data summary** in each card header (`WorkcellNoDataBars`): top-5
  workcells by **COUNT of no-data models** within that card's top-N (name · red
  bar · % · count). e.g. "21 of top 100", DYSON 86% · 18.
- **Table cols**: # (true units-rank) · Assembly/Workcell · [Plant] · Jobs ·
  Last built · Units · Data badge. Jobs/Last built/Units/Data are **sortable**
  (3-stage). NOTE: sorts within the shown top-100-by-units — NOT a re-fetched
  top-100-by-jobs (backend still ranks by units).
- **Row click** → workcell page **Report tab** with `?assembly=<name>` → the
  Report panel (`WorkcellIncompletionPanel`) has a **search bar pre-filled** with
  that assembly (search overrides the top-N cap).
- **Export to XLSX** (top-right, `exportPlantRunnersXlsx`): 3 sheets (Overall /
  By Region / By Plant), each = that layer's top-100 **no-data only** runners.
- Plant code display map: `JPE`→Plant 2, `JBK`→Batu Kawan.

### Top-runner metric — decided
- Primary = **units** (SUM UnitsCompleted, 24mo). Kept as-is.
- 🔲 **Recency-aware** ranking still recommended (a flat 24-mo sum ranks EOL models
  high). Options: weight recent months, or rank by last 6–12 mo. Deferred.
- Jobs "view" handled by the sortable Jobs column (no separate backend metric).

## Item 6 — Fill no-data assemblies with cycle time derived from MES floor scans  🔲 (research)
Goal: for assemblies IEDB has NO time study for, synthesise a cycle time from
*actual production floor scans* instead of leaving them blank.

### The idea (rough, agreed)
- Floor culture: operators batch-run many serials, then scan each unit's process
  completion at the end → per-serial timestamps are noisy/clustered.
- So DON'T trust unit-level deltas. Instead average: **total units scanned ÷
  total elapsed time** for a (process) window → UPH per unit → invert to cycle
  time (sec/unit = 3600 / UPH). Per process, then sum for assembly total.

### Data-source reality (traced 2026-07-06)
- **IEDB** (current CT source, `GetDetailRawProcessData`) = only assemblies that
  already have data. It's the gap we're filling, not the fill source.
- **eBuild SQL** (`ebuild.py`, `SP_GET_SY_SMT_BUILDPLAN`, LIVE) = per-JOB grain:
  UnitsCompleted (real) + CompletedDateTime, but NO start time and NO per-process
  scans. Can't give step-to-step CT. At best a crude whole-line UPH if a job
  start ts existed. → insufficient alone.
- **MESWebApi** = REST over the MES **JEMS** DB (157 methods). This is the
  serial/step scan source. Method catalogue scraped from
  `ole-backend/docs/MES/MESWebApi.pdf` (2026-07-06).

### MESWebApi — the scan methods (discovery ✅)
| Method | Grain | Time fields | Bulk | Use |
|---|---|---|---|---|
| **`Wip/WipScanData`** | scan event (unit×step) | `ComlpetionTime` (sic) | ✅ time window | **primary** — Assembly, Revision, Route, Step, Equipment, Customer, Division, ProcessLoop, TestStatus, WipId. The "scan on process completion" feed. |
| `Test/ListTestDataWithinTime` | serial×step | Start + Stop | ✅ 30-min window | test steps only; real dwell |
| `Wip/ListWipRouteStepBySerial` / `…ById` | 1 serial full route | Start+End/step | ❌ per-serial | precise; spot-check only |
| `Wip/GetWipBirthAndCurrentInfo` | 1 serial | BirthDate+LastScan | ❌ per-serial | whole-unit dwell |

### Live connection — PROVEN ✅ (2026-07-06)
- Base URL = `https://mypenm0soap03.corp.jabil.org/meswebapi` (resolves 10.121.30.149).
  (`AZAPSEPENTRM41` in the PDF was the test host — ignore.)
- Routing = `{base}/{Controller}/{Method}`, **POST**, JSON body (NO `/api/` prefix).
- Auth = header **`APIKey: f7433d13-2d4c-4702-98bf-d3715c55d8a8`** — WORKS (no
  401/403; reads hit the SQL proc directly). Corp SSL cert → `verify=False`.
- **`Wip/ListWipRouteStepBySerial` {"Serial": "<sn>"}** returns per-step rows:
  RouteText, StepText, Equipment, **StartTime, EndTime** (ISO8601, mixed .fff /
  no-frac → parse `format='ISO8601'`), OpStatusText, Start/EndUserID_ID.
  Verified: serial E50806012101079262600135 → 19 steps, per-step dwell computed.
- **Dwell = EndTime−StartTime = station touch time** (Movement In→Out). Sum ~71
  min vs 8.9h birth→ship flow (rest is inter-station queue, correctly excluded).
  Instant single-scan steps (Assemble, some QC) read 0 dwell — calibration nuance.

### Derivation — SETTLED by 2h live test (2026-07-06). MODEL-BASED.
Tested 3 methods on a 2h pull (74,612 scans, 31,207 units, 942 models, 32 custs):
| Method | Source | Works for | Verdict |
|---|---|---|---|
| **Throughput UPH** = units clearing a step ÷ window hrs | WipScanData alone | ALL models w/ volume | ✅ **PRIMARY** — robust to batch-scan (counts completions) |
| Step-to-step flow delta (median gap of consecutive step completions) | WipScanData alone | any model | ⚠️ includes queue = flow time, not CT |
| Touch-time dwell = End−Start per step | ListWipRouteStepById/BySerial | occupancy steps only | ❌ =0 for SMT single-scan models |

**Key finding:** dwell (End−Start) is REAL for manual/big-instrument steps
(KEYSIGHT HLA: LINK 22min, QC 17min) but ~0 for SMT single-scan steps (Masimo
25959-AB: sum of per-step dwell = 0.8 min — useless). So touch-time only works
for labor-heavy models; **throughput UPH is the only universal method.**

**MODEL-BASED RECIPE (primary):**
  1. Harvest WipScanData over representative windows (full shift/several days), accumulate.
  2. Group by (Customer, Assembly, Revision) = MODEL.
  3. Effective CT = 3600 ÷ output-UPH; output-UPH = distinct units clearing FINAL
     step (PACKOUT) ÷ production hrs. Optional per-step CT = 3600/UPH_step.
  4. Cross-ref IEDB no-data model list → fill cells, badge "MES-derived (throughput)".
  5. Calibrate on models that DO have IEDB CT; tune window + step choice.
  6. Optional overlay: manual/HLA models (dwell>0) → ListWipRouteStepById touch time.
- WipScanData→WipId; per-unit precision uses **`ListWipRouteStepById {wipId}`**
  (WipScanData gives WipId, NOT SerialNumber; the ...BySerial variant needs a serial).
- Sample numbers: Masimo 25959-AB = 47 UPH → ~77 s/unit; LIFE360 975-10156 = 100 UPH → 36 s/unit.

### WipScanData call contract — CONFIRMED LIVE (2026-07-06)
- POST `/Wip/WipScanData`. **No serial param.** Body:
  `{StartDateTime, EndDateTime, RouteStep:[], StepInstance:[], LangId:"0"}`.
- Dates = **UTC**, exact `yyyy-MM-ddTHH:mm:ss.fffZ` (millis + Z mandatory).
  Penang floor is UTC+8 → subtract 8h from local.
- `RouteStep`/`StepInstance` = String ARRAYS (empty `[]` = all; `''` throws).
  They filter by **Step NAME / StepInstance NAME** (text, e.g. "PACKOUT") — NOT
  by StepId/RouteId (numeric → 0 rows).
- **NO Customer/Assembly/Workcell/Route filter param.** Target those CLIENT-SIDE:
  every row carries Customer, Division, Assembly, Revision, Route, RouteId,
  ManufacturingArea, Step, StepInstance, CompletionTime, WipId, TestStatus.
  Route ≈ workcell (e.g. "ARISTA HLA ROUTE" → ARISTANETWORKS).
- Volume: a 30-min window = ~20k rows, 30 customers, 82 routes, 519 assemblies,
  23 step types. No window-size error at 30 min. Empty result = one all-null row.
- ⚠️ Calibration nuances: (a) 0-dwell instant-scan steps → treat as ~0 touch or
  use station-to-station gap; (b) dwell includes queue (Movement In = arrival,
  not work-start) → median over many serials mitigates.

## Item 6b — TARGET ARCHITECTURE: Cycle Time Catalog (revised 2026-07-08)
**Objective:** for EVERY model, the typical process route A→Z (excluding rework/
special steps), with a cycle time valued on each process. Complete, no silent gaps.

### What we proved (2-week harvest, 10.16M scans, done 2026-07-08)
Three measurement methods exist. They measure DIFFERENT things — the catalog needs
the right one per step-type, not one number:

| Method | Source | Measures | Verdict |
|---|---|---|---|
| **Takt / throughput** = units ÷ span → 3600/UPH | WipScanData | LINE output rate | ⚠️ ~flat (~22s) across ALL steps on a balanced line — it's the model takt, NOT per-station. Same 55k units × same 2wk ⇒ same rate everywhere. |
| **Touch time** = EndTime − StartTime | **ById** | REAL per-station processing | ✅ **PRIMARY per-step CT** for TEST/INSPECTION steps. ResMed: FVT 114s, ICT 68s, XRAY 24s, QC 13s, AOI 6s. Differentiates stations. |
| **Lead time** = gap between consecutive step completions | WipScanData | queue + process | ⚠️ inflated by wait (AOI TOP 2815s = queue, not work). Good for finding bottlenecks. |

**Touch time is the breakthrough.** ById `EndTime−StartTime` is real for every
test/inspection step even on SMT models — supersedes the 07-06 note that dwell was
"0 for SMT models" (that was only true for the SMT/manual point-scan steps, not the
testers). This is the true per-station CT throughput could never give.

### Coverage by step-type (what MES CAN and CAN'T give)
- ✅ **Test/inspection** (AOI, XRAY, ICT, FVT, QC) → touch time from **ById**.
- ✅ **Model line rate** → takt from WipScanData throughput.
- ❌ **SMT front-end** (SCR, SMT, REFLOW, SOLDERING, BIRTH) → StartTime==EndTime
     (single event scan) in ById AND zero rows in WipScanData → **duration is
     nowhere in these MES endpoints. Needs SMT machine logs.** The one real gap.
- ❌ **Manual** (Assemble, MI, MSOLDER) → often single-scan (0 dwell) → takt/lead only.

### Architecture — sources & where each is needed
  1. SKELETON (A→Z, per model) — **`Wip/ListWipRouteStepById`** on finished units.
     - NOT `ListRouteStep`: `WipScanData.RouteId ≠ ListRouteStep.FactoryMARoute_ID`
       (different ID spaces) AND a model spans MULTIPLE routes (ResMed touches its
       own route + shared test cell + exception route). A finished unit's ById is
       the only source that stitches the true cross-route A→Z path.
     - Order = ONE representative (most-complete) finished unit's own StartTime order,
       deduped on RouteStep_ID (keep first pass). Single unit ⇒ no batch-interleave
       (the median-of-many-units ordering bug, fixed in build_catalog_sample_v2).
     - EXCLUDE specials: StepText ∈ {REWORK, Diag, SCRAP, MRB}.
  2. TOUCH TIME (per test/inspection step) — **ById** dwell, median over N units.
  3. TAKT (model rate) — WipScanData throughput (2-week harvest already pooled).
  4. JOIN — **ById `RouteStep_ID` == WipScanData `StepInstanceId`**. Group at
     **StepInstance** level (NOT Step — "QC" lumps AVI/FNI/OQA/TSTH).
  5. COMPLETENESS — every mainline step gets EITHER a touch time (testers) OR takt
     (rate) OR an explicit "SMT machine-log only" flag. No silent blanks; log which.
  6. OFFICIAL NAMES — `Route/ListRouteStep {factory:"P1"}` `StepText` for the human
     label + to confirm the uncertain codes (TSTH, PWTU, CWAVE, CWASH).

**Harvest window:** takt/lead need ≥ model flow time (~9 days) → the **2-week**
WipScanData harvest (done). Touch time is per-unit from ById (window-proof) — a
handful of finished units per model suffices. Harvest MUST stay resumable/
checkpointed (see [[feedback_resumable_ingestion]]) — current harvester writes one
parquet per 30-min slice, skips completed slices on re-run.

### Deliverables to date (`ole-backend/docs/MES/`)
- `cycle_time_catalog_2wk.xlsx` — 2-week catalog, takt+lead per step (current best).
- `cycle_time_catalog_sample_v2.xlsx` — fixed-ordering skeleton PoC (12h).
- `wipscan_raw_sample.xlsx` — 400 raw WipScanData rows (field reference).
- 🔲 NEXT: rebuild catalog with **ById touch time** as the primary per-step CT
  column (better than the flat takt) — proposed, not yet built.

### Build scope (when green-lit)
- 🔲 MES client (mirror `modules/cycle_time/client.py`): WipScanData + ById + ListRouteStep.
- 🔲 ById skeleton + touch-time builder → per-model route mart (ordered, specials flagged).
- 🔲 2-week resumable WipScanData harvester → takt mart (checkpoint per window ✅ prototyped).
- 🔲 Join → per-model catalog mart: model → step order → {touch time | takt | SMT-gap flag}.
- 🔲 Validate touch time vs IEDB CT (ground truth) — tune.
- 🔲 SMT front-end: separate track — locate SMT machine-log source (not in these endpoints).
- 🔲 Endpoint + FE fill no-data cells (badge: MES-touch / MES-takt / IEDB-measured).

## Item 7 — Cycle Time data sync + update pipeline  🔲 (mostly ✅, KEYSIGHT pending)
Getting our `raw.parquet` to 1:1 with IEDB, and safe recurring updates. Full flow
+ flowchart documented in vault: `Cycle Time — Module.md`.

### ✅ Done
- **Safe `run_backfill`** — add-only upsert per customer (fetch ALL, no date filter):
  adds missing, keeps stale, never prunes, never touches other workcells. Proven safe.
- **`--overlap-days N` flag** (default **7**; was hardcoded 1). Longer = re-fetch more,
  harmless (upsert dedups). One-off catch-up used 30.
- **`--backfill` CLI mode** (`refresh.py`). Requires `--only`.
- **Chaining** — cycle-time `refresh` (API worker + CLI) now runs all 4 steps
  (ingest→transform→eff→assembly_summary) AND rebuilds the eBuild runner mart, so
  Incompletion Report + Plant dashboard never drift. (API `/refresh` was only doing 2.)
- **Discrepancy audited ALL 41 workcells** (fast `TotalCount` method).
- **Session-end sync state:** **40 of 41 at (or ~at) 1:1**. Backfilled this session:
  Medtronic, ILLUMINA, Nokia Optics, Tellabs, BD, GOPRO, HMB, TMO, Masimo,
  BECKMAN COULTER, ASP, ResMed, LTX, ENDURANCE, Motorola, FORTALEZA, LIFE360,
  TERRA SANA, ARISTA_NETWORKS_GLACIER, ARISTANETWORKS (+291 missing; kept its 726
  stale — user chose add-only). Every backfill verified "non-target CHANGED: NONE".
  Marts rebuilt (pivoted, assembly_summary, runners). `raw.parquet` ≈ 4.44M rows,
  35 customers-with-data.
- **ARISTANETWORKS finding:** upsert never prunes → it kept **726 stale rows**
  (21 EOL assemblies IEDB dropped). True 1:1 for a churny customer needs a
  delete+reinsert "replace" mode we did NOT build (deferred; add-only is fine).
- **Root cause of gaps:** global `updatedOn` watermark ahead of per-customer data →
  old missed rows fall in a permanent blind spot (only backfill heals). See
  [[feedback_resumable_ingestion]].

### 🔲 Pending at session end
- **KEYSIGHT — the only real unsynced workcell** 🚨 (~1M rows behind; ~4.4M total).
  ~48k `updatedOn`/day churn (30-day delta = 1.45M rows = 2,905 pages ≈ ~20h).
  Likely IEDB **re-stamping timestamps**, not real edits. Do NOT run its backfill
  until ingestion is resumable. → (a) check churn real vs re-stamp; (b) exclude
  from daily incremental; (c) own slower/overnight cadence.
- **Make ingestion resumable** (checkpoint + resume from last page) — REQUIRED before
  any big KEYSIGHT pull. Currently fetch-all-in-memory-then-write, so a stop = restart
  from page 1. [[feedback_resumable_ingestion]].
- **Register the daily scheduled task** (`scripts/setup_scheduled_tasks.ps1` already
  extended with `IEPulse-CycleTime-Ingest` @ 02:00; NOT yet registered) — tune to
  `--exclude KEYSIGHT`. Needs corp-VPN at run time.
- **Manual runs first:** user wants to run `refresh` by hand for a few days before
  scheduling. Command: `python -m modules.cycle_time.pipeline.refresh -v`
  (7-day overlap default; add `--overlap-days 30` for a wider catch-up).

### Files touched (backend, this session)
- `modules/cycle_time/pipeline/ingest.py` — `run_backfill()`, `_DEFAULT_OVERLAP_DAYS=7`,
  `overlap_days` param threaded through `run`/`_run_incremental`/`_apply_overlap`.
- `modules/cycle_time/pipeline/refresh.py` — `--backfill`/`--overlap-days`/`-v` flags;
  chained `build_runners_mart(24)` after assembly_summary.
- `api/routers/cycle_time.py` — `_run_ct_pipeline` now runs all 4 steps + chains runner mart.
- `api/routers/ebuild.py` — `_REGIONS`, `_agg_with_plant`, region section in `/plant-runners`.
- `scripts/setup_scheduled_tasks.ps1` — generalised + added `IEPulse-CycleTime-Ingest`.

## Open decisions (Item 2)
- Precise definition of "incomplete" vs "no data at all".
- Customer→plant is now from MES (Item 5). Full customer↔workcell catalog (from IEDB
  `mpt/v2/Customers`, which has a Workcell field) still optional/TBD.
