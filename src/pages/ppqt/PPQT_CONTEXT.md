# PPQT Module — Context Primer for Claude Code

**Read this before touching anything in `src/pages/ppqt/`.**

This document is the single source of truth for what PPQT is, what its variables mean, what the formulas do, and what the current build looks like. Everything below was learned through deep analysis of the Wabtec customer Excel file and the training material PowerPoint. If you're about to write code, edit a page, or change the data model — read this first. It will save you hours.

---

## Table of Contents

1. [What PPQT Is and Why It Exists](#1-what-ppqt-is-and-why-it-exists)
2. [The One Question PPQT Answers](#2-the-one-question-ppqt-answers)
3. [The Hierarchical Data Model](#3-the-hierarchical-data-model)
4. [Data Layer Cadence — Critical Concept](#4-data-layer-cadence--critical-concept)
5. [The Core Formulas with Worked Examples](#5-the-core-formulas-with-worked-examples)
6. [Full Variables Glossary](#6-full-variables-glossary)
7. [The Wabtec Excel Sheet Architecture](#7-the-wabtec-excel-sheet-architecture)
8. [Current Build State](#8-current-build-state)
9. [UX Philosophy — Do Not Violate](#9-ux-philosophy--do-not-violate)
10. [The Diagnostic Chain — The Killer Demo](#10-the-diagnostic-chain--the-killer-demo)
11. [Phase Roadmap](#11-phase-roadmap)
12. [Anti-patterns — What NOT to Do](#12-anti-patterns--what-not-to-do)
13. [Reference Files and Locations](#13-reference-files-and-locations)
14. [Acronym Glossary](#14-acronym-glossary)

---

## 1. What PPQT Is and Why It Exists

**PPQT** = **P**roduct · **P**rocess · **Q**uantity of demand · **T**ime.

It is a **capacity sizing tool** used by Industrial Engineers (IEs) in an Electronics Manufacturing Services (EMS) factory. It answers the question: *"Given the demand I need to produce this period, and the equipment I have, do I have enough capacity at every process step?"*

It lives as a **sub-module under IE-Pulse** — the umbrella production-dashboard app. PPQT does not stand alone; it inherits IE-Pulse's navigation patterns, sidebar, header, theme.

### Who uses PPQT
- **Industrial Engineers** (primary) — run the analysis, identify bottlenecks, request CT studies
- **Manufacturing Engineering** — review equipment capacity, plan upgrades
- **Planners / Supply Chain** — feed in demand, see what's feasible
- **Operations leadership** — read the verdict, approve hiring / equipment investment

### When PPQT is run
**Every period (typically monthly)**, plus ad-hoc whenever:
- Demand revision arrives (MPS, SCR, CTB updates)
- New product introduction
- Equipment change (machine added / removed / upgraded)
- CT study completion (a new measurement replaces an Estimate)

---

## 2. The One Question PPQT Answers

For every `(Sub-workcenter, Process, Period)` triple:

> **Resources Needed vs Resources Available — am I short, on-target, or over-equipped?**

Everything else in the module is in service of this question. The capacity table is its primary artifact. Every other page in the hierarchy either widens the lens (portfolio rollup) or narrows it (which assembly is causing the shortage).

---

## 3. The Hierarchical Data Model

The data has **5 layers**, not 4 — Customer is a separate layer in principle, but in this factory each workcell is dedicated to one customer, so we collapse Customer ↔ Workcell into a single navigable layer:

```
   Customer ≈ Workcell  →  Sub-workcenter      →  Process     →  Assembly × Revision
   (Wabtec / WABTEC)       (WAB SMT P1A-1 B5a)    (SCR BOT 1)    (17FB130C6 / N)

   "The customer this        "The physical            "One step       "One product
    line serves"              production line"          on the line"   on the line"
```

### Cardinality

| Layer | Typical count | Example |
|---|---|---|
| Workcell | 5–20 per factory | WABTEC, KEYSIGHT, COLLINS, DYSON, RESMED |
| Sub-workcenter per workcell | 1–4 | SMT line, TH line, BE line |
| Process per sub-workcenter | 2–13 | Label, SCR BOT, SPI, P&P TOP, Reflow TOP, AOI TOP… |
| Assembly per workcell | 5–30 | 17FB130C6, 17FB130A2, 17FB130D1… |
| CT records | N(assemblies) × N(processes) per workcell | ~100 per workcell |

### Why each layer is its own page (Fotmob philosophy)

Each layer answers a unique question. If a layer can't articulate a distinct question, it doesn't earn its own page.

| Layer | The IE's question on this page |
|---|---|
| **Dashboard** (portfolio) | *Where should I focus today across all customers?* |
| **Workcells list** | *Show me all customers — which need attention?* |
| **Workcell profile** | *Which of this customer's lines need help?* |
| **Sub-workcenter profile** | *Which processes on this line are bottlenecks?* |
| **Process detail** | *Which assemblies are driving this process's load?* |
| **Assembly @ Process** | *Is this assembly's CT trustworthy at this process?* |

---

## 4. Data Layer Cadence — Critical Concept

PPQT data lives in **four cadence layers**. This drives EVERY UI decision about the Config / edit experience, and it's the easiest thing to get wrong.

| Layer | What's in it | Changes how often | Who edits |
|---|---|---|---|
| **Master data** | Workcell, Sub-workcenter, Process names, Sequence, GRP | Yearly or less (reorgs, new customer onboarding) | Manufacturing Engineering / Management |
| **Engineering data** | Mach / IMT / Hand CTs per assembly per process, Cap, EQ, HC, S%, FPY, Efficiency | Monthly to yearly (Rev changes, machine upgrades, re-studied CTs) | Industrial Engineer |
| **Demand data** | Per-assembly demand, shift hours, working days, changeover qty/time | **Every period** (monthly, mid-period revisions) | Planner / Supply Chain |
| **Calculated** | Adjusted CTs, WCT, Takt, Resources Needed, Gap, Util, Status | **Every recalc** | Auto-computed |

**Implication for Config page design:** Don't build "one Config page." Build four flows, one per cadence layer, each with appropriate authority gating.

---

## 5. The Core Formulas with Worked Examples

### 5.1 Adjusted Cycle Times

Raw CT components from a time study get adjusted for scrap and parallel machines before they enter any aggregation:

```
Mach_adj  =  Mach / Cap  ×  (S% / 100)
IMT_adj   =  IMT          ×  (S% / 100)
Hand_adj  =  Hand         ×  (S% / 100)

Total_adj_CT  =  Mach_adj + IMT_adj + Hand_adj
```

**Why `/ Cap` on Mach only?** Machine time can run in parallel — if you have 2 machines, total machine time per unit halves. IMT and Hand are operator activities; an operator can't be in two places at once.

**Worked example** — assembly 17FB130C6 at SCR BOT 1:

```
Mach = 45 s, IMT = 8 s, Hand = 0 s, Cap = 1, S% = 99

Mach_adj  = 45 / 1 × 0.99 = 44.55 s
IMT_adj   = 8 × 0.99      =  7.92 s
Hand_adj  = 0 × 0.99      =  0.00 s
Total_adj = 52.47 s
```

### 5.2 Weighted Cycle Time (WCT)

The demand-weighted average CT at one process across all assemblies that route through it:

```
                  Σ (Demand_assembly × CT_assembly_at_process)
WCT_process  =  ───────────────────────────────────────────────
                  Σ Demand_assembly      (only assemblies with CT > 0)
```

**Key subtlety:** the `SUMIF(CT > 0, Demand)` in the denominator. Assemblies that **don't route through this process** must be excluded from both numerator AND denominator, otherwise the average is wrong.

**Worked example** — SCR BOT 1 with 3 assemblies running:

| Assembly | Demand | CT_adj | Demand × CT |
|---|---|---|---|
| 17FB130C6 | 545 | 52.5 | 28,613 |
| 17FB130A2 | 446 | 48.0 | 21,408 |
| 17FB130D1 | 347 | 41.5 | 14,401 |
| **Total** | **1,338** | | **64,422** |

```
WCT = 64,422 / 1,338 = 48.1 s
```

### 5.3 Takt Time

The pace at which you must produce one unit to satisfy demand within the available period:

```
Available_time_per_period  =  (Shift_hrs × 60 − CO_qty × CO_time)  ×  Days × 60
                              ─────────────────────────────────────────────────
                              (sec available per day, accounting for changeovers)


Takt  =  Available_time_per_period  /  Total_Demand
```

**Worked example** — Wabtec defaults for May 2026:

```
Shift_hrs = 21, CO_qty = 4, CO_time = 20 min, Days = 26
Total_Demand = 2,480 units/month

Daily_sec = (21 × 60 − 4 × 20) × 60 = (1,260 − 80) × 60 = 70,800 sec
Period_sec = 70,800 × 26 = 1,840,800 sec

Takt = 1,840,800 / 2,480 = 742 sec per unit
```

(In the mock data we normalize Takt to ~44 sec for visual demonstration; in reality it varies by demand.)

### 5.4 Resources Needed — THE OUTPUT

This is what every other formula feeds into. **Memorize this:**

```
                              WCT
Resources_Needed = ROUNDUP( ───────────────────────────────── , 0 )
                            Takt × (FPY/100) × (Eff/100)
```

**Why divide by FPY × Eff?** Because if 1% of units fail FPY, you must produce more raw units to ship the demanded quantity. Same with efficiency — operators don't work 100% of paid time. Both shrink your effective capacity.

**Why ROUNDUP?** Because you can't have 1.4 machines. You either have 1 or 2.

**Worked example:**

```
WCT = 48.1 s, Takt = 44.1 s, FPY = 99%, Eff = 85%

Raw_ratio = 48.1 / 44.1 / 0.99 / 0.85 = 48.1 / 37.10 = 1.297

Resources_Needed = ROUNDUP(1.297) = 2 machines
```

### 5.5 Gap, Utilization, Status

```
Gap  =  Resources_Needed − Eq_Available

Utilization  =  (WCT / Takt / FPY / Eff)  ×  (1 / Eq_Available)  ×  100

Status  =  bottleneck   if Util > 100
        =  warning      if Util ∈ [90, 100]
        =  healthy      if Util ∈ [70, 90)
        =  idle         if Util < 70
```

In the codebase these thresholds live in `src/lib/ppqt/ppqtConstants.ts` (`UTIL_BOTTLENECK = 100`, `UTIL_WARNING = 90`, `UTIL_HEALTHY = 70`). Use `getPPQTStatus(util)` everywhere — never inline the comparison.

### 5.6 IPK (Inverse Productivity per Kanban)

Used for changeover impact analysis. Not currently in the build but lives in the source Excel:

```
IPK  =  (UPH₁ − UPH₂)  ×  (Lot / UPH₁)
```

Where UPH₁ is units-per-hour at start-of-shift and UPH₂ is units-per-hour during continuous run. Captures the productivity drag of setup time.

---

## 6. Full Variables Glossary

### 6.1 Master data — semi-permanent identity

| Var | Type | Definition | Example |
|---|---|---|---|
| `Customer` | string | The end-customer this workcell builds for | "WABTEC" |
| `Workcell` | string | The umbrella production area | "WABTEC" |
| `Division` | string | Business division category | "Locomotive Electronics" |
| `Sub-workcenter` | string | A specific physical line | "WAB SMT P1A-1 B5a" |
| `Area` | enum | SMT \| TH \| BE | "SMT" |
| `Process` | string | A named step in the production flow | "SCR BOT 1" |
| `Sequence` | int | Physical flow order within sub-workcenter, 1..N | 2 |
| `GRP` | string | Process grouping for aggregation | "Solder paste" |
| `Alias` | string | Alternative process identifier | varies |

### 6.2 Engineering data — measured / configured, changes occasionally

| Var | Unit | Definition | Where it comes from |
|---|---|---|---|
| `Mach` | sec | Machine-on time per unit (operator-free) | Time study (MOST / SW / Est) |
| `IMT` | sec | Interaction time — operator AT the machine per unit | Time study |
| `Hand` | sec | Pure hand time per unit (no machine) | Time study |
| `Cap` | count | Number of parallel machines available for this step | SBWC sheet |
| `EQ` | count | Equipment Available, looked up by `Process + Sub-workcenter` | SBWC sheet |
| `HC` | count | Headcount allocated to this process | SBWC sheet |
| `S%` | % (0–100) | Scrap-survival rate (e.g., 99 = 99% pass) | Engineering standard |
| `FPY` | % (0–100) | First Pass Yield at this process / line | Quality system |
| `Efficiency` | % (0–100) | Effective work rate vs paid time | Corporate standard (typically 85) |
| `CT Source` | enum | MOST \| SW \| Est | Time study record |
| `Study Date` | ISO date | When the CT was last formally measured | Time study record |

### 6.3 Demand data — changes every period

| Var | Unit | Definition |
|---|---|---|
| `Demand` | units | Quantity of one assembly required this period |
| `Total Demand` | units | Σ Demand across all assemblies routing through a process |
| `Shift_hrs` | hr | Working hours per shift × shifts/day (often 3 × 7 = 21) |
| `Days` | days | Working days in the analysis period |
| `CO_qty` | count | Number of changeovers per day |
| `CO_time` | min | Minutes per changeover |
| `Period` | string | Analysis window label, e.g., "May 2026" |

### 6.4 Calculated / derived — recomputed every analysis

| Var | Unit | Formula reference |
|---|---|---|
| `Mach_adj`, `IMT_adj`, `Hand_adj` | sec | §5.1 |
| `Total_adj_CT` | sec | sum of the above |
| `WCT` | sec | §5.2 |
| `Takt` | sec | §5.3 |
| `Available_time` | sec | §5.3 |
| `Resources_Needed` | count | §5.4 |
| `Gap` | count | §5.5 |
| `Utilization` | % | §5.5 |
| `Status` | enum | §5.5 |

### 6.5 The Wabtec default parameters (memorize these)

```
Shift_hrs       = 21       (3 shifts × 7 hours)
Working days    = 26       (one month, 6-day work week)
CO_qty          = 4        per day
CO_time         = 20       min per changeover
FPY             = 99       %
Efficiency      = 85       %
S%              = 99       %  (default per assembly)
Takt baseline   = 44.1     sec (varies by period demand)
```

---

## 7. The Wabtec Excel Sheet Architecture

The source file is `PPQT_Wabtec_customer.xlsx` (in `/mnt/project/` or the project's data folder). Nine sheets, four roles:

| Sheet | Role | Equivalent in our app |
|---|---|---|
| **IEDB** | Master CT database — one row per (Assembly × Process × Sub-workcenter) with Mach / IMT / Hand / Cap / S% | `MOCK_ASSEMBLY_CTS` |
| **SBWC** | Sub-workcenter setup — EQ counts, HC, shift params per (Process × Sub-workcenter) | `MOCK_SUBWORKCENTERS` + per-process `eqAvail` |
| **DMAN** | Demand entry per period per assembly | `MOCK_ASSEMBLIES.demand` |
| **DASH** | Calculated output — WCT, Takt, Eq, Need, Gap, Util per process | `MOCK_PROCESSES` (calculated fields) |
| **SMT / TH / BE** | Per-area filtered views of DASH | filtered views in the UI by `process.area` |
| **FCHART** | Visualizations (charts) of DASH | the bars / sparklines on each page |
| **Link** | Cross-sheet VLOOKUP references | implicit in our relational mock data |

**Critical formulas in the source XLSX:**

- IEDB row composite key: `=Assembly & Rev & SubWorkcenter & LEFT(Alias, 3)` — this is what makes a CT row unique
- DASH row 29 (Weighted CT): `=SUMPRODUCT((CT_range > 0) × Demand_range × CT_range) / SUMIF(CT_range, ">0", Demand_range)`
- DASH row 30 (Takt): `=((Shift_hrs × 60 − CO_qty × CO_time) × Days × 60) / Total_Demand`
- DASH Resources Needed: `=ROUNDUP(WCT / Takt / FPY / Eff, 0)`

---

## 8. Current Build State

### Stack
- **Project**: IE-Pulse (umbrella app) — `C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse`
- **Module location**: `src/pages/ppqt/`
- **Stack**: Vite + React + TypeScript + React Router v6 + TanStack Query + Tailwind + shadcn/ui + Lucide icons
- **Base URL**: `/ietools/`
- **Module env**: `.env.ppqt` sets `VITE_APP_ID=ppqt`

### Files

```
src/pages/ppqt/
├── types.ts                         # Hierarchical type definitions
├── mockPpqtData.ts                  # Programmatic mock for 5 workcells
├── PPQTHome.tsx                     # Layer 0 — Dashboard (portfolio)
├── PPQTWorkcells.tsx                # Layer 1 — Workcells card grid
├── PPQTWorkcellProfile.tsx          # Layer 2 — Workcell (sub-workcenter list)
├── PPQTSubWorkcenterProfile.tsx     # Layer 3 — Sub-workcenter (CAPACITY TABLE)
├── PPQTProcessDetail.tsx            # Layer 4 — Process (assembly contribution)
├── PPQTAssemblyDetail.tsx           # Layer 5 — Assembly @ Process (CT composition)
├── PPQTBreadcrumb.tsx               # Shared breadcrumb with logo persistence
├── PPQTCapacityTable.tsx            # The core capacity table component
├── PPQTUtilisationBar.tsx           # Dual-color util bar with overflow cap
├── PPQTFilters.tsx                  # LEGACY — no longer imported, safe to delete
├── PPQTConfig.tsx                   # Phase 2 stub
└── PPQT_CONTEXT.md                  # ← this file

src/lib/ppqt/
└── ppqtConstants.ts                 # Status thresholds, badge classes, helpers
```

### Routes (in `src/App.tsx`)

```
/ppqt                                                                   → PPQTHome
/ppqt/workcell                                                          → PPQTWorkcells
/ppqt/workcell/:workcell                                                → PPQTWorkcellProfile
/ppqt/workcell/:workcell/swc/:subWorkcenter                             → PPQTSubWorkcenterProfile
/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process               → PPQTProcessDetail
/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process/asm/:assembly → PPQTAssemblyDetail
/ppqt/config                                                            → PPQTConfig (stub)
```

### Sidebar nav (in `src/config/apps.ts`)

Only **three** items visible in the sidebar — deeper pages are reached via drill-in:
1. Dashboard (`/ppqt`)
2. Workcells (`/ppqt/workcell`)
3. Config (`/ppqt/config`)

### Mock data structure

Five workcells fully generated programmatically in `mockPpqtData.ts`:

| Workcell | Division | Demand | Sub-workcenters | Profile |
|---|---|---|---|---|
| WABTEC | Locomotive Electronics | 2,480 | 3 (SMT, TH, BE) | Mixed util — showcase |
| KEYSIGHT | Test & Measurement | 1,820 | 2 (SMT, BE) | Healthy |
| COLLINS | Avionics | 980 | 2 (TH, BE) | Mild bottleneck (ICT 118%) |
| DYSON | Home Appliances | 3,420 | 3 (SMT-1, SMT-2, BE) | Heavy bottleneck (SCR BOT 145%) |
| RESMED | Medical Devices | 1,240 | 1 (SMT) | Idle |

Generated total: ~50 processes, ~33 assemblies, ~330 CT records.

### Shared types (in `types.ts`)

```typescript
PPQTWorkcell        // Layer 1 — id, customer, division, aggregated stats
PPQTSubWorkcenter   // Layer 2 — workcellId, area, shift params, aggregated stats
PPQTProcess         // Layer 3 — subWorkcenterId, name, sequence, calculated metrics
PPQTAssembly        // Layer 4 (along with rev) — workcellId, partNumber, rev, demand
PPQTAssemblyCT      // CT bridge — assemblyId × processId, raw + adjusted, source, study date
```

---

## 9. UX Philosophy — Do Not Violate

This module is part of **IE-Pulse**, which is a multi-module app. The user explicitly requires every module to feel like the same app. Three rules govern this:

### Rule 1: Fotmob-style hierarchical navigation
Each layer of the data dimension gets its own page. Going deeper teaches you more, like `Country → League → Team → Player`. Don't merge layers onto one page just because "they're related."

### Rule 2: Each page answers ONE question
If you're tempted to add a second concern to a page, that concern probably belongs at a different layer. Resist filter-creep. Sub-workcenter is the only page with non-trivial filters (search + status).

### Rule 3: Match OLE module conventions exactly
- **Sticky header**: `sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border`
- **Two-column body**: `w-[300px] flex-shrink-0` left + `flex-1 min-w-0` right
- **Hero card**: `rounded-xl border border-border bg-card overflow-hidden` with `p-5`, hero number `text-5xl font-mono font-black tabular-nums`, status badge top-right
- **Card chrome**: `rounded-xl border border-border bg-card overflow-hidden`, header strip `px-4 py-2.5 border-b border-border` with `text-[10px] font-semibold uppercase tracking-wider`
- **Workcell logo as profile picture**: pulled from `WORKCELL_LOGOS` in `src/lib/ole/oleConstants.ts`, rendered in a `w-20 h-10 rounded-lg border border-border bg-white` container with `<img className="object-contain p-1">`
- **Logo persists** at all deeper layers (Sub-workcenter, Process, Assembly) — Fotmob team-crest treatment, anchors the customer identity
- **Back-link**: `← Back` (from PPQTBreadcrumb's `backHref`)
- **Drill-in interaction**: `hover:bg-muted/30 cursor-pointer` rows, optional chevron right
- **Status badges**: always via `PPQT_STATUS_BADGE[status]` and `PPQT_STATUS_LABEL[status]` from `ppqtConstants.ts` — never inline

### Reference patterns
- Plant Report layout reference → `src/pages/ole/OlePlantReport.tsx`
- Workcell Report layout reference → `src/pages/ole/OleWorkcellReport.tsx`
- Existing OLE table pattern → grid-based with `style={{ gridTemplateColumns: ... }}`, NOT HTML tables

### Reuse what already exists
Before building a new primitive, check for an existing one:
- `KpiTile` from `components/dashboard/`
- `WorkcellBadge` from `components/ole/`
- `WORKCELL_LOGOS` map from `lib/ole/oleConstants.ts`
- shadcn/ui primitives — Input, Select, Button, Card, Tooltip
- Tailwind tokens (`text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`)

---

## 10. The Diagnostic Chain — The Killer Demo

This 5-step drill-down is what makes PPQT valuable. Memorize it; design every change to preserve or improve it.

```
1. /ppqt
   "DYSON is at 112% util, 3 bottlenecks. Top of the attention list."

2. /ppqt/workcell/DYSON
   "Of Dyson's three lines, SMT-1 is at 145%, SMT-2 at 96%, BE-1 at 92%."

3. /ppqt/workcell/DYSON/swc/dys-smt-1
   "On SMT-1, SCR BOT 1 is the worst at 145%, AOI TOP at 132%."

4. /ppqt/workcell/DYSON/swc/dys-smt-1/proc/dys-smt-1__scr-bot-1
   "Assembly V15-MTR drives 60% of the WCT here."

5. /ppqt/workcell/DYSON/swc/dys-smt-1/proc/dys-smt-1__scr-bot-1/asm/v15-mtr-c
   "CT Source: Estimate. Last studied: Never.
    The bottleneck isn't capacity — it's a stale CT estimate.
    IE action: flag for MOST study."
```

The **final insight** is the value. PPQT's job isn't just to flag capacity gaps — it's to identify *what kind* of gap it is: real capacity shortage vs. data-quality artifact. The estimate-flagging UX on the Assembly Detail page is the most important call-to-action in the module.

---

## 11. Phase Roadmap

| Phase | Status | Scope |
|---|---|---|
| **Phase 1 — Read-only hierarchy** | ✅ DONE | Mock data, 5 pages, full drill-down |
| **Phase 2 — Config editors** | NEXT | Four sub-sections matching the four data cadence layers: master data (admin), IEDB / CT entry (IE), demand entry (planner), equipment config (Mfg Eng). Each with its own auth gating. |
| **Phase 3 — Simulator** | Future | "What-if" demand changes. Drag a slider on assembly demand, see Resources Needed update live. Shift-scenario planner. Multi-workcell comparison. This is probably the highest-ROI feature in the roadmap. |
| **Phase 4 — DL Sizing layer** | Future | Direct Labor calculator. Converts Mach/IMT/Hand triples into actual headcount per process. NVA% validation (≤20%). Revenue alignment. |
| **Phase 5 — Operations** | Future | Alerts, CT freshness tracking, PPQT period-over-period history, SAP / MPS demand integration, audit log. |

---

## 12. Anti-patterns — What NOT to Do

These are the temptations to resist. Each has been considered and rejected for explicit reasons.

| Don't | Why |
|---|---|
| ❌ Put the capacity table on the Workcell Profile page | The capacity table is **per sub-workcenter**, not per workcell. A workcell with 3 sub-workcenters has 3 different capacity tables. Don't merge. |
| ❌ Reintroduce SMT / TH / BE area filter pills | Sub-workcenter IS the area selector now. The pills were a band-aid for cramming three sub-workcenters onto one page. The URL hierarchy replaces them. |
| ❌ Reintroduce the workcell dropdown on profile pages | The URL `/ppqt/workcell/WABTEC` IS the selection. A dropdown is redundant and breaks browser back-button semantics. |
| ❌ Add filters to the Dashboard or Workcells list | Both are portfolio-scoped. Period is the only filter that makes sense, and it's already in the sticky header. |
| ❌ Use HTML `<table>` elements | Use grid-based layouts with `gridTemplateColumns` — that's the existing OLE convention. |
| ❌ Inline status/area/CT-source colors | Always use the badge maps in `ppqtConstants.ts`. Adding a new status color means adding it there first. |
| ❌ Compute `getPPQTStatus` thresholds inline | Use `getPPQTStatus(util)` from `ppqtConstants.ts`. Threshold changes happen in one place. |
| ❌ Hardcode workcell logos | Use `WORKCELL_LOGOS` from `oleConstants.ts` with the slug-normalize lookup pattern. |
| ❌ Drop the workcell logo at deeper layers | The logo persists at Sub-workcenter, Process, and Assembly pages. It's the customer identity anchor. |
| ❌ Allow real deletion of master data in the UI | Workcells, sub-workcenters, processes get **inactivated**, not deleted. PPQT history depends on these references. |
| ❌ Mix the four data cadence layers into one Config page | They have different users, different edit frequencies, different authority. Four sub-pages, not one. |
| ❌ Skip the breadcrumb on deep pages | Every deep page must show `Dashboard / Workcells / WABTEC / WAB SMT P1A-1 / SCR BOT 1 / 17FB130C6` with each segment clickable. |
| ❌ Use the `MOCK_PPQT_WORKCELL_ROWS` symbol | That was the old flat data shape. It no longer exists. Use `MOCK_WORKCELLS` from `mockPpqtData.ts`. |

---

## 13. Reference Files and Locations

### In the codebase
| Path | What |
|---|---|
| `src/pages/ppqt/` | All PPQT page components |
| `src/pages/ppqt/types.ts` | Hierarchical type definitions |
| `src/pages/ppqt/mockPpqtData.ts` | Programmatic mock data + lookup helpers |
| `src/lib/ppqt/ppqtConstants.ts` | Badge classes, status thresholds, helpers |
| `src/config/apps.ts` | Sidebar nav config (3 items) |
| `src/App.tsx` | Routes (7 PPQT routes) |
| `src/pages/ole/OlePlantReport.tsx` | Visual reference for Dashboard-style layouts |
| `src/pages/ole/OleWorkcellReport.tsx` | Visual reference for profile-style layouts |
| `src/lib/ole/oleConstants.ts` | `WORKCELL_LOGOS` map (reused for logo lookup) |
| `.env.ppqt` | Module env: `VITE_APP_ID=ppqt` |

### Outside the codebase
| Path | What |
|---|---|
| `C:\Users\4033375\Projects\PPQT\` | Source XLSX, training PPTX, project docs |
| `PPQT_Wabtec_customer.xlsx` | Reference customer file (Wabtec) |
| `Training_Package_-_6_0_PPQT___DL_Sizing__22_Oct_24_.pptx` | Training material |
| Notion: PPQT module hub | Living documentation — formulas, sheet architecture, DL sizing, variables reference |

### Build context
- **Project root**: `C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse`
- **PPQT module**: `src/pages/ppqt/`
- **Build env var**: `VITE_APP_ID=ppqt` (in `.env.ppqt`)
- **Base URL**: `/ietools/`

---

## 14. Acronym Glossary

| Acronym | Meaning |
|---|---|
| **PPQT** | Product · Process · Quantity (of demand) · Time |
| **IE** | Industrial Engineer |
| **EMS** | Electronics Manufacturing Services |
| **CT** | Cycle Time |
| **WCT** | Weighted Cycle Time |
| **MOST** | Maynard Operation Sequence Technique — the most rigorous CT study method |
| **SW** | Stopwatch — informal CT study |
| **Est** | Estimate — no formal study (data quality risk flag) |
| **FPY** | First Pass Yield (% units passing first inspection) |
| **Eff** | Efficiency (effective work rate, typically 85%) |
| **CO** | Changeover (setup time between product runs) |
| **EQ** | Equipment Available |
| **HC** | Headcount |
| **Cap** | Parallel machine count for one process step |
| **S%** | Scrap-survival rate (yield retention factor) |
| **IPK** | Inverse Productivity per Kanban — captures setup productivity drag |
| **SMT** | Surface Mount Technology (area: pick-and-place, reflow, AOI) |
| **TH** | Through-Hole (area: ICT, FCT) |
| **BE** | Back-End (area: visual inspection, pack & label) |
| **DL** | Direct Labor (the headcount working on products) |
| **NVA** | Non-Value-Added (work that doesn't transform the product) |
| **MPS** | Master Production Schedule (top-level demand plan) |
| **SCR** | Supply Chain Review (demand revision meeting) |
| **CTB** | Commit-to-Build (firm demand commit) |
| **SBWC** | Sub-Workcenter (the physical line entity) |
| **IEDB** | Industrial Engineering Database (master CT records) |
| **DMAN** | Demand sheet |
| **DASH** | Dashboard sheet (calculated outputs) |

---

## Closing note to the next Claude instance

When you sit down to work on PPQT, your first questions are:

1. **What layer of the hierarchy does this change affect?** If you can't name it (Dashboard / Workcell / Sub-workcenter / Process / Assembly), the change might not belong here.
2. **Which data cadence layer is changing?** Master / Engineering / Demand / Calculated. Each has different users and different validation needs.
3. **Does this match the OLE conventions?** If it doesn't, the user will reject it. The IE-Pulse standardization mandate is absolute — every module must feel like the same app.
4. **Does this preserve the diagnostic chain?** The 5-step drill-down in §10 is the demo. If your change makes any of those 5 steps harder, reconsider.
5. **Have you read this whole file?** If you skipped sections, go back. PPQT has more business logic than its surface area suggests, and most pitfalls come from missing that context.

Good luck. The data model is sound, the patterns are established, the next phase is Config editors. Build carefully.
