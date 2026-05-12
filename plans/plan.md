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

### 14. ✅ DONE — Date-stitching ingest for rolling-snapshot CSVs
- **Status:** Shipped (backend commit `17a91b2`). Both `ingest_paid_hours()` and `ingest_production()` now process files newest→oldest with per-date stitching, plus incremental mode pre-loads dates from the existing mart to skip them entirely.
- **Outcome:** Most workcells now match Excel exactly; a small residual 1–10% mismatch remains on some cells (see task #15).
- **Not done yet:** Unit tests for the date-set arithmetic. Worth adding before any further changes to ingest.

### 15. 🟡 Investigate residual 1–10% input-hour mismatches vs Excel
- **Repo:** `C:/Users/4033375/Projects/OLE ANALYZER/ole-backend/`
- **Symptom:** After date-stitching, most (workcell, week) cells match Excel exactly. A handful still drift by 1–10% on input hours. Output is generally fine.
- **Hypotheses to investigate (in priority order):**
  1. **Excel filter vs ingest filter mismatch** — Excel user may be filtering by raw `WorkCell` name (e.g. "Arista PCA") while dashboard rolls multiple raw names into the canonical (`ARISTA NETWORKS PCA`). Verify with `diagnose_shift.py` on a mismatched cell — Layer 1 (raw CSV) should match Excel if filters align.
  2. **Shift number anomalies** — rows with `Shift = 0` or NaN. Currently filtered to `int` and zero-shifts presumably drop. Check via `diagnose_shift.py` Layer 1 vs Layer 2 — if Layer 1 has more rows than Layer 2 for the same (workcell, date), shift conversion may be losing rows.
  3. **Encoding fallback dropping rows** — `pd.read_csv` tries UTF-8 then Windows-1252. If neither fits a row, pandas may skip silently. Check ingest log for any encoding errors per file.
  4. **`value_type` whitespace variants** — `.fillna("").str.strip().str.upper()` — what about non-breaking spaces, tabs? Unlikely but possible.
  5. **Sub-workcell aliasing in paid hours** — paid hours rows have `sub_workcell`, but unlike production we don't filter by `scan_stage`. Could be including SubWorkcell rows that the user's Excel filter excludes.
  6. **Date timezone drift** — `_parse_date` uses `pd.Timestamp(value)`. If a CSV has time-zoned timestamps, a shift could land on a different calendar day. Check via diagnostic.
- **Diagnostic playbook:**
  1. Get a specific mismatch from the user: `workcell, date, shift, excel_value, dashboard_value`
  2. Run `python diagnose_shift.py "WORKCELL" YYYY-MM-DD SHIFT`
  3. Compare Layer 1 sum vs Excel (should match if Excel filter aligns)
  4. Compare Layer 1 vs Layer 2 (ingest discrepancy)
  5. Compare Layer 2 vs Layer 3 (compute discrepancy)
- **Effort:** Small to Medium depending on root cause
- **When to do:** When the user has a fresh mismatch case to investigate. No urgency for now — 90%+ accuracy is already useful.

### 16. 🟢 Add unit tests for ingest pipeline
- **Repo:** `C:/Users/4033375/Projects/OLE ANALYZER/ole-backend/`
- **Why:** The ingest pipeline has now been heavily modified (date-stitching, exclude_dates, incremental mode, workcell normalization). One date-arithmetic bug could silently lose entire days of data, with no test to catch it.
- **Suggested coverage:**
  - Synthetic CSVs with known overlapping rolling windows → assert exact row counts per date after stitching
  - Workcell normalization with typo variants → assert canonical names
  - Active-workcell filter → assert unconfigured workcells are dropped
  - Incremental mode with `exclude_dates` populated → assert no re-reads of mart dates
  - Full mode → asserts state file gets written / overwritten
- **Effort:** Medium — needs pytest setup if not already present, plus synthetic fixture CSVs
- **Value:** Confidence to make future ingest changes without fear

### 17. 🟢 Date-handling standardization (backend ↔ frontend)
- **Files:** `src/lib/shared/dateUtils.ts`, backend `pipeline/ingest.py::_parse_date`
- **Issue:** The user mentioned earlier wanting consistent date handling across both sides. Currently:
  - Backend uses `pd.Timestamp(value)` (timezone-dependent)
  - Frontend uses string splitting on `'T'` (timezone-agnostic)
  - API responses normalize via `normalizeDates()` in `oleApi.ts` (strips time portion)
- **Risk:** A timestamp like `"2026-05-08T23:00:00+00:00"` parsed on a UTC+8 machine becomes `2026-05-09 07:00:00`, shifting the date by a day.
- **Fix:** Pin both sides to "date is a calendar day in plant-local time, never converted to UTC." Backend should explicitly drop tz with `.dt.tz_localize(None)` or use string parsing like the frontend.
- **Effort:** Small — backend change; verify no regressions in shift assignment
- **Value:** Eliminates potential off-by-one-day silent bugs (which would explain some of the input-hour mismatches in task #15)

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
