# IE-Pulse Refactoring Plan

## Goal
Transform the codebase from a rushed, monolithic structure into a modular, scalable architecture where each app module owns its scaffolding and shared utilities live in a common layer.

---

## Directory Structure (Target State)

```
src/
├── hooks/
│   ├── shared/                    ← hooks any future app can use
│   │   └── useEscapeKey.ts        ← NEW: extracted from 4 pages
│   └── ole/                       ← OLE-specific hooks
│       ├── useOleData.ts          ← MOVE from src/hooks/
│       ├── useAnalysisData.ts     ← MOVE from src/hooks/
│       └── useOleDateFilter.ts    ← NEW: extracted from OLEHome4 + OLEWorkcell4
│
├── lib/
│   ├── shared/                    ← utilities any future app can use
│   │   └── dateUtils.ts           ← NEW: toYmd, fromYmd, fmtDate (generic)
│   └── ole/                       ← OLE-specific lib
│       ├── oleConstants.ts        ← MOVE from src/lib/ (+ add formatWeekLabel)
│       ├── oleApi.ts              ← MOVE from src/lib/
│       ├── oleTypes.ts            ← NEW: WeekRow, WorkcellAggregate, shared types
│       ├── oleCalculations.ts     ← NEW: calculateOLE, aggregateByWeek, aggregateByWorkcell
│       ├── oleChartStyles.ts      ← NEW: Recharts tooltip/cursor style objects
│       └── oleTableLayouts.ts     ← NEW: grid templates, table typography constants
│
├── components/
│   ├── shared/                    ← components any future app can use
│   │   └── Pagination.tsx         ← NEW: generic table pagination
│   ├── ole/                       ← OLE-specific components (already exists, expand it)
│   │   ├── WorkcellBadge.tsx      ← already here, stays
│   │   ├── TrendModal.tsx         ← NEW: extracted from OLEHome4 + OLEWorkcell4
│   │   ├── ExpandModal.tsx        ← NEW: extracted from OLEWoWAnalysis (inlined 6+ times)
│   │   └── ChartCard.tsx          ← NEW: chart wrapper with expand button (inlined 6+ times)
│   └── layout/                    ← app-level layout, stays
│       └── Sidebar.tsx
│
└── pages/                         ← routing layer, untouched throughout this refactor
    └── ole/
```

**The rule going forward:**
- Only OLE uses it → `src/hooks/ole/` / `src/lib/ole/` / `src/components/ole/`
- Any future app could use it → `src/hooks/shared/` / `src/lib/shared/` / `src/components/shared/`
- New app added (e.g. PPQT, Downtime) → `src/hooks/ppqt/` / `src/lib/ppqt/` / `src/components/ppqt/`

---

## What Gets Fixed

### Duplicated logic across pages

| Problem | Affected Files | Fix |
|---|---|---|
| `TT` / `TT_AREA` tooltip style objects copy-pasted | OLEHome4, OLEWorkcell4, OLEWoWAnalysis, FourQGenerator | → `oleChartStyles.ts` |
| `useEffect` escape-key modal close, identical in 4 places | OLEHome4, OLEWorkcell4, OLEWoWAnalysis, FourQGenerator | → `useEscapeKey.ts` |
| `WeekRow` type declared twice | OLEHome4, OLEWorkcell4 | → `oleTypes.ts` |
| `aggregateFromWeekly()` / `aggregateWcWeekly()` near-identical | OLEHome4, OLEWorkcell4 | → `oleCalculations.ts` |
| Week aggregation `useMemo` block identical | OLEHome4, OLEWorkcell4 | → `oleCalculations.ts` |
| OLE % formula inline in 3+ places | OLEHome4, OLEWorkcell4, useAnalysisData | → `oleCalculations.ts` |
| Workcell logo key-matching logic (`toLowerCase().replace...`) | OLEHome4, OLEWorkcell4, SMHStatus | → `oleConstants.ts` utility fn |
| `fmtWeekLabel` / `apiLabelToWW` / week pad logic, 3 implementations | FourQGenerator, useAnalysisData, OLEHome4 | → `oleConstants.ts` `formatWeekLabel()` |
| Date utilities `toYmd` / `fromYmd` duplicated | FourQGenerator vs `fmtDate` in oleConstants | → `lib/shared/dateUtils.ts` |
| TrendModal JSX (~100 LOC) near-identical | OLEHome4, OLEWorkcell4 | → `components/ole/TrendModal.tsx` |
| ExpandModal JSX inlined 6+ times | OLEWoWAnalysis | → `components/ole/ExpandModal.tsx` |
| ChartCard JSX inlined 6+ times | OLEWoWAnalysis | → `components/ole/ChartCard.tsx` |
| WorkcellBadge re-declared inline | SMHStatus (already exists in components/ole/) | → import existing |
| Pagination JSX inlined | SMHStatus | → `components/shared/Pagination.tsx` |

### Hardcoded constants to extract

| Constant | Currently In | Move To |
|---|---|---|
| Grid template strings (`LABOR_GT`, `PROD_GT`, summary table GT) | OLEWorkcell4, OLEHome4 | `lib/ole/oleTableLayouts.ts` |
| Table typography (`TH = 'text-[10px]'`, `TD = 'text-xs'`, `ROW_H = 52`) | OLEWorkcell4 | `lib/ole/oleTableLayouts.ts` |
| Modal dimensions (`72vw/68vh`, `74vw/72vh`) | OLEHome4, OLEWorkcell4, FourQGenerator, OLEWoWAnalysis | `lib/ole/oleChartStyles.ts` |
| OLE threshold `45` magic number (warning floor) | OLEHome4, OLEWorkcell4 inline | `lib/ole/oleConstants.ts` as `OLE_WARNING = 45` |
| Status badge / color lookups defined locally | SMHStatus, FourQGenerator | Remove local; import from `oleConstants.ts` |

---

## Execution Phases

### Phase 1 — Pure constant extractions (zero risk, no logic change)

These are copy-paste moves. Nothing breaks. Each can be verified in isolation.

1. **`src/lib/ole/oleChartStyles.ts`** — move all `TT`, `TT_AREA`, `TT_PROPS`, modal dimension objects out of pages
2. **`src/lib/ole/oleTableLayouts.ts`** — move `LABOR_GT`, `PROD_GT`, `TH`, `TD`, `ROW_H`, summary grid template strings
3. **`src/lib/shared/dateUtils.ts`** — move `toYmd`, `fromYmd` from FourQGenerator; move `fmtDate` from oleConstants
4. **`src/lib/ole/oleConstants.ts`** — add `formatWeekLabel(isoWeek: number)` and `OLE_WARNING = 45`; consolidate the 3 week-label implementations; add `getWorkcellLogo(name)` utility to kill the 3 inline copies

**Update imports** in all affected pages after each file is created.

---

### Phase 2 — Type and calculation utilities

5. **`src/lib/ole/oleTypes.ts`** — extract `WeekRow`, `WorkcellAggregate`, any other types declared more than once
6. **`src/lib/ole/oleCalculations.ts`** — extract:
   - `calculateOLE(outputSmh, inputHours)` — the 3 inline OLE % formulas
   - `aggregateByWeek(rows)` — the 2 near-identical week-grouping `useMemo` blocks
   - `aggregateByWorkcell(rows)` — the 2 near-identical workcell-grouping functions

**Update imports** in OLEHome4, OLEWorkcell4, useAnalysisData.

---

### Phase 3 — Hook extractions

7. **`src/hooks/shared/useEscapeKey.ts`**
   ```ts
   export function useEscapeKey(callback: () => void, enabled = true): void
   ```
   Replace the 4 identical `useEffect` blocks in OLEHome4, OLEWorkcell4, OLEWoWAnalysis, FourQGenerator.

8. **`src/hooks/ole/useOleDateFilter.ts`**
   ```ts
   export function useOleDateFilter() {
     // selectedWeek, dateFrom, dateTo state
     // selectWeek, handleDateFrom, handleDateTo, reset handlers
     // returns all state + handlers
   }
   ```
   Replace the identical date/week filter state in OLEHome4 and OLEWorkcell4.

---

### Phase 4 — Component extractions

9. **`src/components/shared/Pagination.tsx`** — generic: `{ page, totalPages, onPageChange }`; remove inline from SMHStatus
10. **`src/components/ole/ExpandModal.tsx`** — props: `{ open, onClose, title, children }`; remove 6+ inline instances from OLEWoWAnalysis
11. **`src/components/ole/ChartCard.tsx`** — props: `{ title, onExpand, children }`; remove 6+ inline instances from OLEWoWAnalysis
12. **`src/components/ole/TrendModal.tsx`** — props: `{ open, onClose, title, data, selectedWeek }`; removes ~100 LOC of duplication between OLEHome4 and OLEWorkcell4
13. **`src/components/ole/OleFilterBar.tsx`** *(added during Phase 3)* — props: `{ weeks, filter (useOleDateFilter return), idPrefix, before?, onClear? }`. Owns the Week `<Select>` (incl. All Weeks / Custom / week list), From + To `<DatePickerField>`s, and the Clear button. The `before` slot lets the page inject its own Plant/Workcell select. Removes ~30 LOC of identical JSX from OLEHome4 + OLEWorkcell4.

---

### Phase 5 — File migrations (import path updates)

Move existing files to new homes. Update every import across the codebase.

| From | To |
|---|---|
| `src/hooks/useOleData.ts` | `src/hooks/ole/useOleData.ts` |
| `src/hooks/useAnalysisData.ts` | `src/hooks/ole/useAnalysisData.ts` |
| `src/lib/oleConstants.ts` | `src/lib/ole/oleConstants.ts` |
| `src/lib/oleApi.ts` | `src/lib/ole/oleApi.ts` |

Also clean up in this phase:
- `SMHStatus.tsx`: remove inline `WorkcellBadge` definition → import from `src/components/ole/WorkcellBadge.tsx`
- `SMHStatus.tsx` / `FourQGenerator.tsx`: remove locally defined status badge maps → import from `oleConstants.ts`
- `useAnalysisData.ts`: remove `apiLabelToWW()` → use `formatWeekLabel()` from oleConstants

---

## Summary

| Metric | Before | After |
|---|---|---|
| Lines in page files | ~2,800 | ~2,300 (est. -500) |
| Duplicated logic instances | 18+ | 0 |
| Files with inline tooltip objects | 4 | 0 |
| Files with inline escape-key useEffect | 4 | 0 |
| Inline component re-declarations | 6+ | 0 |
| OLE-specific files in root hooks/ lib/ | 4 | 0 |

**Risk: very low.** Every phase is pure extraction — no logic changes. Each phase can be built, imported, and verified before moving to the next.
