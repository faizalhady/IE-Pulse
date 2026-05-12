# IE-Pulse Refactor — Completed (6 phases)

Companion to `refactor.md` (the original plan). This file documents what actually shipped, in order, so future-you can see exactly what changed and why.

## Goal

Transform the codebase from a rushed monolithic structure into a modular, scalable architecture where each app module owns its scaffolding and shared utilities live in a common layer. Zero behavior change, zero new TS errors at every phase boundary.

---

## Phase 1 — Pure constant extractions

Pulled inline constants out of page files into dedicated modules so they stop being copy-pasted.

**Files created**
- `src/lib/ole/oleChartStyles.ts` — Recharts tooltip / cursor style objects (`TT`, `TT_AREA`, `CURSOR_PRIMARY`) and modal dimension presets (`MODAL_DIM`, `MODAL_DIM_LG`).
- `src/lib/ole/oleTableLayouts.ts` — Grid template strings and table typography (`TH`, `TD`, `ROW_H`, `LABOR_GT`, `PROD_GT`).
- `src/lib/shared/dateUtils.ts` — `toYmd`, `fromYmd`, `fmtDate` (generic, not OLE-specific).

**Files updated**
- `src/lib/oleConstants.ts` — Added `OLE_WARNING = 45`, `formatWeekLabel()`, `getWorkcellLogo()`. Re-exported `fmtDate` from `dateUtils` to keep existing imports working.
- `OLEHome4.tsx`, `OLEWorkcell4.tsx` — Removed inline `TT`, `TT_AREA`, and (in WC4) the table-layout constants. Now imported.

---

## Phase 2 — Type and calculation utilities

Extracted shared types and pure aggregation functions.

**Files created**
- `src/lib/ole/oleTypes.ts` — `WeekRow`, `WorkcellAggregate`, `AggregateTotals`, `WeeklyTrendPoint`.
- `src/lib/ole/oleCalculations.ts` — `calculateOLE()`, `calculateOLERounded()`, `aggregateByWorkcell()`, `aggregateTotals()`, `aggregateByWeek()`. All pure functions, no React.

**Files updated**
- `OLEHome4.tsx` — Replaced inline `WeekRow`, inline `aggregateFromWeekly()`, two duplicated `siteWeekly` `useMemo` blocks, inline OLE % formulas, inline `WW${...padStart}` patterns, and magic `45` numbers — all swapped for the new helpers + `formatWeekLabel` + `OLE_WARNING`.
- `OLEWorkcell4.tsx` — Same kind of swap: inline `WeekRow`, `aggregateWcWeekly()` → `aggregateTotals()`, formula + label + `45` updates.

Net impact: ~70 lines of duplicated logic removed from page files.

---

## Phase 3 — Hook extractions

Centralized two patterns that were duplicated across 3–4 pages.

**Files created**
- `src/hooks/shared/useEscapeKey.ts` — `useEscapeKey(callback, enabled?)` — subscribes to `keydown` while `enabled`, fires `callback` on Escape.
- `src/hooks/ole/useOleDateFilter.ts` — Bundles the (selectedWeek, dateFrom, dateTo) state trio + handlers (`selectWeek`, `handleDateFrom`, `handleDateTo`, `reset`).

**Files updated**
- `OLEHome4.tsx`, `OLEWorkcell4.tsx` — Filter state + handlers swapped for `useOleDateFilter()`. Escape `useEffect` swapped for `useEscapeKey()`.
- `OLEWoWAnalysis.tsx` — Escape `useEffect` swapped for `useEscapeKey()`.

3 of 3 identical escape-key blocks unified.

---

## Phase 4 — Component extractions

Pulled 5 reusable JSX blocks out of the page files. Split into 4a (TrendModal + OleFilterBar) and 4b (ExpandModal + ChartCard + Pagination) for safer testing.

**Files created**
- `src/components/ole/TrendModal.tsx` — Two side-by-side area charts (Output SMH + Input Hours). Props: `{ open, onClose, title, data, selectedWeek, yScale?, referenceLineOpacity? }`. Uses `useId()` so multiple instances on one page don't clash on gradient ids.
- `src/components/ole/OleFilterBar.tsx` — Filter strip: Week select, From/To date pickers, Clear button. Props: `{ weeks, selectedWeek, dateFrom, dateTo, selectWeek, handleDateFrom, handleDateTo, reset, idPrefix, before?, onClear?, showClear? }`. The `before` slot lets each page inject its own Plant or Workcell select.
- `src/components/ole/ExpandModal.tsx` — Large modal (74vw × 72vh) used by ChartCard.
- `src/components/ole/ChartCard.tsx` — Card with an Eye-icon expand button; owns its own open/close state.
- `src/components/shared/Pagination.tsx` — Generic page-control strip; renders nothing when only 1 page.

**Files updated**
- `OLEHome4.tsx`, `OLEWorkcell4.tsx` — Inline TrendModal (~75 lines each) + inline filter strip (~40 lines) removed, replaced with imports.
- `OLEWoWAnalysis.tsx` — Inline `ExpandModal`, `ChartCard`, unused `CARD`/`TITLE` consts and `Eye`/`X`/`useCallback`/`useEscapeKey` imports removed.
- `SMHStatus.tsx` — Inline `Pagination` removed.

Net impact: ~220 lines of duplicated/inlined JSX removed from page files.

### Bug fixes caught during Phase 4

- **`OLEWorkcell4` week dropdown** — Pre-existing bug where the "All Weeks" option disappeared from the dropdown once a week was selected. Fixed.
- **"Custom" indicator on week dropdown** — When the user picked a date range without selecting a week, the dropdown showed "All Weeks" (misleading). Now shows "Custom" in this state on both pages.

---

## Phase 5 — File migrations

Moved the four legacy hook/lib files into their `ole/` subfolders so the target directory structure was complete. All file moves used `git mv` to preserve history.

**Files moved**

| From | To |
|---|---|
| `src/hooks/useOleData.ts` | `src/hooks/ole/useOleData.ts` |
| `src/hooks/useAnalysisData.ts` | `src/hooks/ole/useAnalysisData.ts` |
| `src/lib/oleConstants.ts` | `src/lib/ole/oleConstants.ts` |
| `src/lib/oleApi.ts` | `src/lib/ole/oleApi.ts` |

**Internal imports patched**
- `oleConstants.ts`: relative `'./shared/dateUtils'` → `'../shared/dateUtils'` (one level deeper now).
- `useOleData.ts`: `'@/lib/oleApi'` + `'@/lib/oleConstants'` → `@/lib/ole/...`
- `useAnalysisData.ts`: `'@/lib/oleConstants'` → `'@/lib/ole/oleConstants'`

**Codebase sweep**
- 29 caller files updated in a single `sed` pass — replaced all four old `@/...` paths with their new `@/.../ole/...` equivalents.

---

## Phase 6 — Page renames + route change

Renamed the 5 active page files so the name describes the page, not its build history (no more `4` suffix). All deprecated pages (`OLEHome1`/`2`/`3`/`5`, `OLEReport`, `OLEOverview`, `OLEDashboard`, `OLEAnalysis`, `OLEWorkcell`, `OLEWorkcellDetail`, `OLEProjection`, `OLEPredictiveBacktesting`, etc.) were left untouched per standing instruction.

**Renames (via `git mv`)**

| Old | New | Default export | Route |
|---|---|---|---|
| `OLEHome4.tsx` | `OlePlantReport.tsx` | `OlePlantReport` | `/report` |
| `OLEWorkcell4.tsx` | `OleWorkcellReport.tsx` | `OleWorkcellReport` | `/report/wc/:workcell` |
| `OLEWoWAnalysis.tsx` | `OleWowAnalysis.tsx` | `OleWowAnalysis` | `/analysis` |
| `SMHStatus.tsx` | `OLESmh.tsx` | `OLESmh` | `/smh-status` → `/smh` |
| `FourQGenerator.tsx` | `OLE4QReport.tsx` | `OLE4QReport` | `/4q` |

**Other updates**
- `src/App.tsx` — 5 import lines + 5 `<Route element={...}>` swaps + route `/smh-status` → `/smh`.
- `src/config/apps.ts` — Sidebar nav link "Standard Man-Hour" updated to `/smh` (would have broken the nav otherwise).
- Doc comments in `TrendModal.tsx`, `OleFilterBar.tsx`, `oleCalculations.ts` — Updated to reference new page names.

---

## Final directory structure

```
src/
├── hooks/
│   ├── shared/
│   │   └── useEscapeKey.ts          ← NEW
│   └── ole/
│       ├── useOleData.ts            ← MOVED
│       ├── useAnalysisData.ts       ← MOVED
│       └── useOleDateFilter.ts      ← NEW
│
├── lib/
│   ├── shared/
│   │   └── dateUtils.ts             ← NEW
│   └── ole/
│       ├── oleConstants.ts          ← MOVED (+ added OLE_WARNING, formatWeekLabel, getWorkcellLogo)
│       ├── oleApi.ts                ← MOVED
│       ├── oleTypes.ts              ← NEW
│       ├── oleCalculations.ts       ← NEW
│       ├── oleChartStyles.ts        ← NEW
│       └── oleTableLayouts.ts       ← NEW
│
├── components/
│   ├── shared/
│   │   └── Pagination.tsx           ← NEW
│   ├── ole/
│   │   ├── WorkcellBadge.tsx        ← already here, stays
│   │   ├── TrendModal.tsx           ← NEW
│   │   ├── ExpandModal.tsx          ← NEW
│   │   ├── ChartCard.tsx            ← NEW
│   │   └── OleFilterBar.tsx         ← NEW
│   └── layout/                       ← unchanged
│
└── pages/ole/
    ├── OlePlantReport.tsx           ← was OLEHome4
    ├── OleWorkcellReport.tsx        ← was OLEWorkcell4
    ├── OleWowAnalysis.tsx           ← was OLEWoWAnalysis
    ├── OLESmh.tsx                   ← was SMHStatus
    ├── OLE4QReport.tsx              ← was FourQGenerator
    └── (deprecated pages stay as-is)
```

**The rule going forward** (from the original plan):
- Only OLE uses it → `src/{hooks,lib,components}/ole/`
- Any future app could use it → `src/{hooks,lib,components}/shared/`
- New app added (e.g. PPQT) → `src/{hooks,lib,components}/ppqt/`

---

## Summary of duplication removed

| Problem | Before | After |
|---|---|---|
| Tooltip style objects inlined | 4 pages | 1 module |
| Escape-key `useEffect` inlined | 3 modals | 1 hook |
| `WeekRow` type declared | twice | once |
| Aggregation functions duplicated | yes | `aggregateBy*` in calculations |
| OLE % formula inlined | 3+ places | `calculateOLE()` |
| Workcell logo key-matching inlined | 3 places | `getWorkcellLogo()` |
| Week-label `WW${...padStart}` patterns | 3 implementations | `formatWeekLabel()` |
| `toYmd` / `fromYmd` date helpers | duplicated | `dateUtils.ts` |
| TrendModal JSX | inlined twice | 1 component |
| ExpandModal + ChartCard JSX | inlined 6+ times | 2 components |
| Filter-bar JSX | inlined twice | 1 component |
| Pagination JSX | inlined | 1 component |
| OLE-specific hooks/lib files | at root | in `ole/` subfolders |
| `45` magic number | scattered | `OLE_WARNING` constant |
| Page filenames carrying version suffix | `*4`, `FourQGenerator` | descriptive names |

---

## Pre-existing issues NOT fixed (intentional)

These existed before the refactor and were left alone to keep each phase's diff clean:

1. **`OleWorkcellReport.tsx` line ~145** — Typo: `data: ShiftDrawerData; s` in the `ShiftDrawer` prop type — creates a required `s` prop that no caller passes. TS error preserved.
2. **`OLESmh.tsx` line ~91** — `useSmhStatus({ workcell: workcellParam })` — the hook signature accepts 0 args, but it's being called with one. TS error preserved.
3. **`OLEAnalysisTab.tsx`** — Broken relative imports (`./OLEFilters`, `./tabs/OLEPredictiveBacktesting`, `./tabs/OLEWorkcellTab`). File is in `src/pages/ole/tabs/` but imports as if it were in `src/pages/ole/`. Deprecated file, not wired to any route.
4. **Various deprecated pages** — `navigate('/ole/smh-status?workcell=...')` calls in `OLEDashboard`, `OLEWorkcell`, `OLEWorkcellDetail`. The `/ole/` prefix doesn't match the BrowserRouter basename, so these were already broken pre-refactor. Deprecated pages left untouched per standing instruction.

---

## Deferred — Phase 7 (call-site cleanups)

The original `refactor.md` Phase 5 also listed three additional cleanups. These each *re-touch* files and risk muddying the mechanical moves, so they're queued for a follow-up phase:

- `OLESmh.tsx`: Replace inline `WorkcellBadge` + local `WORKCELL_LOGOS` map → import from `src/components/ole/WorkcellBadge.tsx` + `oleConstants`.
- `OLESmh.tsx` / `OLE4QReport.tsx`: Replace local status-badge maps → import from `oleConstants`.
- `useAnalysisData.ts`: Replace `apiLabelToWW()` → `formatWeekLabel()`.

---

## Verification at every phase

Each phase ended with:
1. `npx tsc --noEmit -p tsconfig.app.json` — diff against the baseline error set; expected new errors: zero.
2. User-driven dev-server test of every affected OLE route — all 5 active pages, all interactive surfaces.

The full 6-phase refactor passed every checkpoint with zero new TS errors and zero behavior regressions.
