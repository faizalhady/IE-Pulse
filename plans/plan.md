ou already have a thorough refactor plan written. Here's the summary:

5 phases, pure extraction — no logic changes anywhere:

Phase: 1
What: Extract constants (oleChartStyles, oleTableLayouts, dateUtils, oleConstants additions)
Risk: Zero — copy-paste moves
────────────────────────────────────────
Phase: 2
What: Extract types + calculations (oleTypes, oleCalculations)
Risk: Very low
────────────────────────────────────────
Phase: 3
What: Extract hooks (useEscapeKey, useOleDateFilter)
Risk: Low
────────────────────────────────────────
Phase: 4
What: Extract components (Pagination, ExpandModal, ChartCard, TrendModal)
Risk: Low
────────────────────────────────────────
Phase: 5
What: Move existing files to new paths (useOleData, useAnalysisData, oleConstants, oleApi)
Risk: Low — just import updates

Why this order is safe: Each phase only extracts something already working. You import it in the same commit it's
created. The app stays green at every step.

Before we start Phase 1, let me check which source files actually exist so I'm not working from assumptions:

Searched for 2 patterns (ctrl+o to expand)

● Good — all the key files are confirmed present. The refactor plan you wrote is solid and matches reality. Here's a
clear summary of what gets refactored and why:

---

What's broken right now (before refactor):

- TT/TT_AREA tooltip style objects copy-pasted into 4 different page files
- useEffect escape-key listener written identically in 4 places
- WeekRow type declared twice
- OLE % formula inlined in 3+ places
- aggregateFromWeekly() near-duplicated across OLEHome4 and OLEWorkcell4
- fmtWeekLabel / week-pad logic with 3 different implementations
- toYmd / fromYmd duplicated between FourQGenerator and oleConstants
- TrendModal JSX (~100 lines) near-identical in 2 pages
- ExpandModal + ChartCard JSX inlined 6+ times in OLEWoWAnalysis
- WorkcellBadge re-declared inline in SMHStatus (already exists as a component)
- Pagination inlined in SMHStatus
- OLE-specific hooks/lib files sitting in the root hooks/ and lib/ folders

---

5 phases, safest-first order:

1. Phase 1 — Pull constants out (oleChartStyles.ts, oleTableLayouts.ts, dateUtils.ts, additions to oleConstants.ts) —
   zero logic change
2. Phase 2 — Pull types + pure functions out (oleTypes.ts, oleCalculations.ts)
3. Phase 3 — Pull hooks out (useEscapeKey.ts, useOleDateFilter.ts)
4. Phase 4 — Pull components out (Pagination, ExpandModal, ChartCard, TrendModal)
5. Phase 5 — Move existing files to new paths + update all imports

---

Ready to start Phase 1 now? I'll read OLEHome4, OLEWorkcell4, OLEWoWAnalysis, FourQGenerator, and oleConstants first
to extract the exact constants before writing anything.
