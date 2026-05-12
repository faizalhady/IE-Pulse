# 🏗️ OLE Analyzer — Backend Architecture & Frontend Mapping

_Reference doc for the OLE Analyzer pipeline + API. Mirrors `plans/refactor-completed.md` in the IE-Pulse repo._

## The big picture

Three pipeline stages then a stateless FastAPI server that queries Parquet via DuckDB.

```
RAW FILES                        PARQUET MARTS              REST API           FRONTEND
PEN_TotalProduction_*.csv    ┐
PEN_PaidHours_Raw_*.csv      ├─► ingest.py    ┐
PEN_TotalPaidHours_*.csv     │                ├─► compute.py        ┐
<WORKCELL>_SMH.xls           ┘                │                     ├─► main.py ──► oleApi.ts ──► pages
                                              ├─► compute_weekly.py ┘   (FastAPI       (frontend
                                                                         + DuckDB)      hooks)
```

**Backend location:** `C:/Users/4033375/Projects/OLE ANALYZER/ole-backend/`
**Frontend client:** `IE-Pulse/src/lib/ole/oleApi.ts`
**Dev proxy:** Vite forwards `/ietools/ole/api` → `http://localhost:8000`

---

## What raw data comes in

| Source | Path | What it has |
|---|---|---|
| **MES production** | `\\penhomev10\OLE\PEN_TotalProduction_*.csv` | Workcell × assembly × date × shift × **qty produced** |
| **eTMS paid hours (per-employee)** | `\\penhomev10\OLE\RawData\PEN_PaidHours_Raw_*.csv` | One row per employee/shift with `TPHDirect`, VA/NVA flag — **single source of truth for input hours** |
| **SMH lookup** | `data/raw/<WORKCELL>_SMH.xls` | Per-workcell standard man-hours per assembly (HTML-formatted XLS) |

Workcells/plants/stages are pinned in `config.py` (the `WORKCELL_CONFIG` dict). Raw workcell name typos get normalized via `_WORKCELL_MAP` in `ingest.py`.

---

## What gets computed

### The OLE formula

Single source of truth lives in `pipeline/compute.py`:

```
OLE % = (Effective Output SMH / Total Input Hours) × 100

  Effective Output SMH = SUM(production.qty × smh_lookup.smh_value)
                          ← LEFT JOIN, so unmatched assemblies count as 0
  Total Input Hours    = SUM(paid_hours.tph_direct)     ← ALL rows (VA+NVA+blank)
                          from raw_paid_hours.parquet only
```

### Data-quality flag (assigned per shift)

- `OK` — everything clean
- `PARTIAL_SMH` — some units produced but no SMH match (most common)
- `NO_OUTPUT_SMH` — production = 0 or every SMH missing
- `NO_INPUT_HOURS` — no employees clocked in (rare)

### Weekly aggregation

`compute_weekly.py` groups shifts by ISO week using **`SUM(output)/SUM(input)`** — *not* average-of-averages — for the forecasting engine.

---

## The 4 Parquet marts

The pipeline produces these and the API reads them.

| Mart file | Source SQL step | What's in it |
|---|---|---|
| `ole_computed.parquet` | compute.py main JOIN | Shift-level OLE rows |
| `ole_weekly.parquet` | compute_weekly.py | Weekly aggregates per workcell |
| `smh_lookup.parquet` | ingest.py | Assembly → SMH value table |
| `smh_assembly_status.parquet` | compute.py diagnostic step | Per-assembly coverage status (OK / MISSING_SMH / NOT_IN_SMH_DB) |

SQLite (`data/operational.db`) holds **mutable** state: supervisor-entered downtime logs and labor-transfer logs.

### Sample rows

**`ole_computed.parquet`** — one shift:

```
workcell:               "ARISTA NETWORKS"
date:                   2026-05-05
shift:                  1                       (1=Normal, 2=Night, 3=Day)
stage_label:            "SMT"
scan_stage:             "SMT"
assembly_count:         4
total_qty:              1850
effective_output_smh:   412.35
qty_missing_smh:        0
assemblies_missing_smh: 0
hc_direct:              12
total_input_hours:      720.50
va_hours:               580.20
nva_hours:              140.30
ole_pct:                57.23
data_quality:           "OK"
smh_coverage_pct:       100.0
```

**`ole_weekly.parquet`** — one workcell's week:

```
workcell:            "ARISTA NETWORKS"
iso_year:            2026
iso_week:            18
week_label:          "2026-W18"
week_start_date:     2026-05-04
week_end_date:       2026-05-10
stage_label:         "SMT"
scan_stage:          "SMT"
total_qty:           11280
shift_count:         14
total_output_smh:    2845.20
total_input_hours:   4915.75
avg_hc_direct:       11.5
total_va_hours:      3820.10
total_nva_hours:     1095.65
ole_pct:             57.88     ← weekly = SUM(output) / SUM(input)
ole_pct_avg_shifts:  56.43     ← average-of-averages (for comparison only)
shifts_ok:           12
shifts_flagged:      2
smh_coverage_pct:    98.5
```

**`smh_lookup.parquet`** — one assembly's SMH lookup:

```
workcell:      "ARISTA NETWORKS"
assembly:      "DCS-7280SR-48C6"
smh_value:     0.2234            ← standard man-hours per unit
scan_stage:    "SMT"
stage_label:   "SMT"
plant:         "Plant 2"
last_updated:  2026-04-15
```

**`smh_assembly_status.parquet`** — diagnostic for one assembly:

```
workcell:           "ARISTA NETWORKS"
assembly:           "DCS-7280SR-48C6"
smh_value:          0.2234
total_qty_produced: 4520
first_seen_date:    2025-09-12
last_seen_date:     2026-05-10
active_days:        87
smh_status:         "OK"        (OK | MISSING_SMH | NOT_IN_SMH_DB)
```

---

## Frontend ↔ Backend mapping

What each call in `oleApi.ts` actually does on the backend:

| Frontend call | Backend endpoint | Backend reads | Purpose |
|---|---|---|---|
| `oleApi.health.check()` | `GET /api/health` | mart file presence check | Pre-render readiness probe |
| `oleApi.workcells.list()` | `GET /api/workcells` | `WORKCELL_CONFIG` dict | Plant/stage labels reference |
| `oleApi.ole.list()` | `GET /api/ole` | `ole_computed.parquet` | Shift-level table (OleWorkcellReport labor tab) |
| `oleApi.ole.summary()` | `GET /api/ole/summary` | `ole_computed.parquet` GROUP BY workcell | Per-workcell aggregates |
| `oleApi.ole.weekly()` | `GET /api/ole/weekly` | `ole_weekly.parquet` | **Powers OlePlantReport + OleWorkcellReport** (the bar charts and trend modals) |
| `oleApi.ole.predict()` | `GET /api/ole/predict` | `ole_weekly.parquet` → ARIMA(1,1,1) + Holt-Winters | OLEProjection / OLEPredictiveBacktesting pages |
| `oleApi.ole.pareto()` | `GET /api/ole/pareto` | `ole_computed.parquet` sorted by hours | Pareto chart |
| `oleApi.ole.mhBreakdown()` | `GET /api/ole/mh-breakdown` | computed mix | Man-hours donut |
| `oleApi.production.list()` | `GET /api/production` | `raw_production.parquet` | OleWorkcellReport production tab |
| `oleApi.paidHours.list()` | `GET /api/paid-hours` | `raw_paid_hours.parquet` | OleWorkcellReport shift drawer |
| `oleApi.smh.list()` | `GET /api/smh` | `smh_lookup.parquet` | OLE4QReport SMH-per-unit column |
| `oleApi.smh.status()` | `GET /api/smh-status` | `smh_assembly_status.parquet` | OLESmh page (assembly coverage table) |
| `oleApi.refresh.run()` | `POST /api/refresh` | runs ingest + compute + weekly synchronously | Manual pipeline refresh button |

---

## Man-hours breakdown — the formula

For the donut chart on `/analysis`:

```
Total Input Hours (denominator from all shifts in date range)
├─ Output SMH         (VA productive time — from ole_computed)
├─ NVA Input          (NVA hours — from raw_paid_hours, value_type='NVA' or blank)
├─ Lunch / Break      (fixed 0.25 hrs per VA employee)
├─ MFG Downtime       (estimated 1.3 hrs per VA employee)
└─ Unexplained Lost Hours  (remainder — can go negative)
```

> ⚠️ The **0.25 hr lunch** and **1.3 hr MFG-DT** rates are hardcoded magic numbers in `api/main.py`. If those rates change in real ops, edit there.

---

## Prediction logic

`/api/ole/predict` runs both ARIMA and Holt-Winters on the weekly OLE series for a workcell:

1. Load weekly OLE data for workcell, drop NaN values
2. Require ≥ 4 weeks of data
3. Detect seasonality: `seasonal_periods = 4` if n ≥ 8 weeks, else None
4. **Backtest:** For each historical week i (i ≥ 3): fit ARIMA(1,1,1) on series[:i], forecast 1 step → `arima_fitted[i]`. Same with ExponentialSmoothing → `hw_fitted[i]`.
5. **Forecast:** Fit on full series, project 3 weeks (max 12). Generate future week labels with ISO year/week wrapping.

Response shape:

```json
[
  { "week_label": "2025-W01", "actual": 75.5, "arima": 74.2, "hw": 75.1, "projected": false },
  { "week_label": "2025-W02", "actual": null,  "arima": 76.3, "hw": 76.8, "projected": true }
]
```

---

## Critical gotchas

1. **`TEMP_EXCLUDED_WORKCELLS = ['BECKMAN COULTER']` is frontend-only.** The backend disabled BC in `config.py`, so it doesn't appear in the marts anyway. If/when BC is re-enabled in backend, you need to remove it from the frontend constant too — otherwise it'll quietly stay hidden.

2. **Magic numbers in mh-breakdown.** 0.25 hr lunch + 1.3 hr MFG-DT per VA employee. Hardcoded in `api/main.py`.

3. **"Unexplained Lost Hours" can be negative.** That's intentional (it's a residual) — but worth knowing when the donut chart shows weird wedges.

4. **SMH file format is rigid.** Column indices (3=SMT, 4=Backend, 5=BoxBuild) are hardcoded in `_parse_smh_xls()`. If the SMH file structure changes, the parser silently extracts zero rows and all shifts flag `NO_OUTPUT_SMH`. Coordinate with the SMH file owner before format changes.

5. **Assembly matching is case-sensitive.** Production assembly numbers must match SMH exactly after cleanup (no fuzzy matching). Mismatches flag `PARTIAL_SMH`.

6. **Date floor.** `DATE_FROM = '2025-01-01'` in config. Historical data before that is excluded from all marts.

---

## File map

```
ole-backend/
├── api/
│   └── main.py              ← FastAPI app, all REST endpoints, SQLite for downtime/transfer logs
├── pipeline/
│   ├── ingest.py            ← Raw CSV/XLS → Parquet (production, paid_hours, smh_lookup)
│   ├── compute.py           ← Main JOIN + OLE formula → ole_computed.parquet
│   ├── compute_weekly.py    ← ISO-week GROUP BY → ole_weekly.parquet
│   └── refresh.py           ← Orchestrator: runs ingest → compute → weekly
├── config.py                ← WORKCELL_CONFIG dict (plant, stage, SMH column per workcell)
├── database.py              ← SQLite connection helpers
├── naming.py                ← Workcell name discovery tool
├── diagnose.py              ← Mart sanity-check tool
└── data/
    ├── raw/                 ← SMH .xls files
    ├── *.parquet            ← The 4 marts
    └── operational.db       ← Downtime + transfer logs (mutable)
```

---

## Stack & framework versions

- **Framework:** FastAPI 0.115.0 + Uvicorn 0.30.6
- **Query engine:** DuckDB (queries Parquet files directly)
- **Operational DB:** SQLite (for downtime + transfer logs)
- **Forecasting:** `statsmodels` (ARIMA + ExponentialSmoothing)
- **CSV/XLS parsing:** pandas + BeautifulSoup (lxml)
