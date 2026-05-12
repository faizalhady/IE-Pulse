# IE-Pulse — Post-Refactor Cleanup Plan

Codebase audit performed after the 6-phase OLE refactor (see `refactor-completed.md`). Tasks ordered by risk-adjusted value.

---

## 🔴 Quick wins (do these next — small, isolated, unambiguous)

### 1. Delete stale scratch file
- **File:** `src/test_claude_write.ts` (0 bytes, looks like an accidental commit)
- **Effort:** Trivial
- **Action:** `git rm src/test_claude_write.ts`

### 2. Deduplicate `use-toast`
- **Files:**
  - `src/components/ui/use-toast.ts` — 4-line re-export shim, delete it
  - `src/components/ui/toaster.tsx` — update import to `@/hooks/use-toast` directly
- **Effort:** Small
- **Value:** Removes a confusing duplicate path; the `ui/` folder is meant for Shadcn primitives, not app hooks.

### 3. Phase 7 — deferred OLE cleanups (from original refactor plan)
- **`src/pages/ole/OLESmh.tsx`:**
  - Remove inline `WorkcellBadge` definition → import from `@/components/ole/WorkcellBadge`
  - Remove local `WORKCELL_LOGOS` map → import from `@/lib/ole/oleConstants`
  - Remove local `STATUS_BADGE` / `STATUS_LABEL` maps → import from `@/lib/ole/oleConstants` (use `SMH_STATUS_BADGE`)
- **`src/pages/ole/OLE4QReport.tsx`:** Remove local status-badge maps → import from `@/lib/ole/oleConstants`
- **`src/hooks/ole/useAnalysisData.ts`:** Replace `apiLabelToWW()` → use `formatWeekLabel()` from `@/lib/ole/oleConstants`
- **Effort:** Small (mechanical swaps, identical to Phases 1-4 patterns)

### 4. Fix `OleWorkcellReport.tsx` `s` typo
- **File:** `src/pages/ole/OleWorkcellReport.tsx` ~line 145
- **Issue:** `data: ShiftDrawerData; s` — stray `s` creates a required prop that no caller passes
- **Effort:** Trivial — delete the stray `s`
- **Result:** Clears 1 pre-existing TS error

### 5. Fix `OLESmh.tsx` `useSmhStatus()` call
- **File:** `src/pages/ole/OLESmh.tsx` ~line 91
- **Issue:** `useSmhStatus({ workcell: workcellParam })` — hook signature expects 0 args
- **Effort:** Small — either update the hook to accept the arg, or remove the arg if filtering happens elsewhere
- **Result:** Clears 1 pre-existing TS error

### 6. Add `.claude/` to `.gitignore`
- **File:** `.gitignore`
- **Issue:** `.claude/settings.local.json` is user-local Claude Code state — shouldn't be tracked or shown in `git status`
- **Effort:** Trivial

---

## 🟡 Worth doing soon (medium effort, clear value)

### 7. Fix `Bay` / `Workcell` / `Machine` type definitions
- **File:** `src/types/index.ts`
- **Issue:** ~20 TS errors stem from mock data and consuming components disagreeing about which fields exist (`id`, `name`, `model`, `overallWip`, `pendingWip`, etc.)
- **Affected callers:** `src/mocks/data.ts`, `src/components/dashboard/{BayCard,MachineDrawer}.tsx`, `src/pages/{GlobalOverview,Reports,BayDetail}.tsx`
- **Effort:** Medium — decide which side is canonical (mock or API), align the other
- **Value:** Unblocks strict type checking; clarifies data contract

### 8. Audit unused imports in dashboard pages
- **Files:** `src/pages/{BayDetail,GlobalOverview,Plants,Reports,WorkcellsTable}.tsx`
- **Issue:** May import OLE/components they never render (e.g., `BayDetail` imports `OLEHome1`, `OLEWorkcell`, etc.)
- **Effort:** Medium — careful audit per file
- **Value:** Smaller bundle, clearer intent

### 9. Fix or delete `OLEAnalysisTab.tsx` broken imports
- **File:** `src/pages/ole/tabs/OLEAnalysisTab.tsx`
- **Issue:** Imports `./OLEFilters`, `./tabs/OLEPredictiveBacktesting`, `./tabs/OLEWorkcellTab` — wrong relative paths (double `tabs/`), file is broken
- **Effort:** Small — fix paths OR delete if dead
- **Note:** Not wired to any route; safe to delete if unused

---

## 🟢 Needs decisions first (product / architecture calls)

### 10. Decide fate of inactive module folders
- **Folders:** `src/pages/iebaseline/` (5 files), `src/pages/fsms/` (2 files), `src/pages/ebuild/` (1 file)
- **Status:** All commented out of `src/App.tsx`
- **Options:**
  - Keep as-is (matches OLE deprecated-pages policy)
  - Move into `src/pages/legacy/` to signal intent
  - Delete if truly unused
- **Decision needed:** Will any of these be revived? If yes → keep. If no → delete or move.

### 11. Extract a shared HTTP client
- **Files:** `src/lib/api.ts` (MES, 189 lines) and `src/lib/ole/oleApi.ts` (OLE, 273 lines)
- **Issue:** Both define their own fetch + error handling
- **Proposed:** `src/lib/shared/httpClient.ts` — both APIs inherit
- **Effort:** Medium
- **Value:** Single place for auth/logging/retry concerns; worthwhile if more apps (PPQT, Downtime) come online; skip if not

### 12. Unify `src/data/` vs `src/mocks/`
- **Files:**
  - `src/data/bay.ts` — used by `FloorMap.tsx`
  - `src/data/ole/downtime-data.ts`
  - `src/mocks/data.ts` — used by 5 pages
- **Issue:** Two different folder conventions for what appear to be the same concept (seed/fallback data)
- **Decision needed:** Pick one (`data/` or `mocks/`), consolidate

### 13. Refactor `src/components/ui/map.tsx`
- **Issue:** 10× `eslint-disable react-hooks/exhaustive-deps` — complex effect logic
- **Effort:** Medium (requires deep understanding of map lifecycle)
- **Value:** Better maintainability; enable exhaustive-deps rule globally
- **Recommendation:** Only do this if you're already working in that file for another reason

---

## 🟦 Backend pipeline (separate repo: `ole-backend`)

### 14. 🟡 Date-stitching ingest for rolling-snapshot CSVs
- **Repo:** `C:/Users/4033375/Projects/OLE ANALYZER/ole-backend/`
- **Files:** `pipeline/ingest.py` — `ingest_paid_hours()` and `ingest_production()`
- **Current approach:** Read EVERY row from EVERY CSV file → concat → `df.drop_duplicates()` (all columns). Works for byte-identical replicas but lets through cases where a row differs in a "noise" column (e.g. `cv`, `category` updated between files) → silent over-counting of input hours.
- **Symptom:** ASP +12 hrs, IMED -1 hr, occasional 1–10% input-hour mismatch vs Excel.
- **Proposed approach (date-stitching):**
  ```
  Files sorted NEWEST → OLDEST:
  newest file       → take ALL rows (it's the freshest snapshot)
  next older file   → take only rows for dates NOT in any newer file
  next older file   → ...same...
  oldest file       → contributes only its oldest dates
  ```
  Per-file logic:
  1. Sort source files newest → oldest by filename date suffix
  2. Maintain a `seen_dates` set
  3. For each file: identify its unique `Startdate` values, subtract `seen_dates`, keep only rows for the leftover dates, then add those dates to `seen_dates`
  4. Skip files that contribute zero new dates
- **Benefits over current:**
  - **Faster** — skip rows we'll never use (today's ingest loads 1.3M rows; this would load maybe 100K)
  - **Memory-efficient** — per-date stored only once
  - **Handles revisions gracefully** — newer file silently wins for overlapping dates
  - **Likely fixes the residual 1–10% input-hour inaccuracies** (no leak path through "noise columns")
- **Effort:** Medium — touches two ingest functions, deserves unit tests for date-set arithmetic
- **Apply to:** both `ingest_paid_hours()` AND `ingest_production()` for consistency
- **Risk:** Date-extraction bug could lose data → add tests with synthetic overlapping-window CSVs before rolling out
- **When to do:** AFTER current immediate accuracy fixes are confirmed stable. Likely a Session 4 task.

---

## Recommended execution order

1. **Session 1 (1–2 hours):** Tasks 1–6 — all 🔴 quick wins. Mechanical, isolated, no decisions needed.
2. **Pause for product decision** on tasks 10 (inactive modules) and 12 (data/mocks unification).
3. **Session 2 (3–4 hours):** Tasks 7–9 — the 🟡 dashboard cleanup.
4. **Session 3 (optional):** Tasks 11, 13 — only if value is clear after sessions 1–2.

---

## Verification per task

Same playbook as the OLE refactor:
1. `npx tsc --noEmit -p tsconfig.app.json` — confirm no new errors
2. Hit affected routes in dev server
3. Commit per logical group with clear `refactor(...)` / `chore(...)` / `fix(...)` scope
