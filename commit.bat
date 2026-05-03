@echo off
cd /d "C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse"

echo === Commit 1: Wire OLEWoWAnalysis route and nav item ===
git add src/App.tsx src/config/apps.ts
git commit -m "feat(routing): add OLEWoWAnalysis and OLEHome1 routes and nav items" ^
  -m "- App.tsx: import OLEWoWAnalysis, OLEHome1; add /ole/analysis and /ole/home1 routes" ^
  -m "- apps.ts: add 'Analysis' (LineChart icon -> /ole/analysis) and 'Home 1' (TrendingUp -> /ole/home1) to OLE Analyzer nav"

echo === Commit 2: 4Q Generator — Q3 auto-compute, backtesting math, Paynter chart ===
git add src/pages/ole/FourQGenerator.tsx
git commit -m "feat(4q): Q3 auto-computed from API, backtesting math, live Paynter chart" ^
  -m "- Remove RawRow manual input type; Q3 now fully derived from mhBreakdown endpoint" ^
  -m "- New Q3Table component: fetches mhBreakdown per actual week, renders Paynter-style table" ^
  -m "- MH_ROWS constant + MhWeekData interface for loss category tracking (NVA, Lunch, MFG DT, Unexplained)" ^
  -m "- Avg of last 4 weeks column in Q3Table" ^
  -m "- Backtesting math: _sma, _wma, _ema, _linReg inline helpers" ^
  -m "- ChartPoint interface, buildChartData with forward projection, calcMae, getBestFormula, injectProjBars" ^
  -m "- FORMULA_COLORS + FORMULA_LABELS for 7 formula keys (sma3, sma5, wma3, ema_fast, ema_slow, cma, linear_reg)" ^
  -m "- Q2Section: compact prop for print preview modal (fills parent height, tighter charts)" ^
  -m "- Preview modal: print-ready 2x2 grid, Q1/Q2/Q3/Q4 each fill exactly half the modal height"

echo === Commit 3: Promote OLEAnalysis into a sub-tab switcher ===
git add src/pages/ole/OLEAnalysis.tsx
git commit -m "refactor(ole): convert OLEAnalysis into sub-tab switcher inside OLEOverview" ^
  -m "- OLEAnalysis.tsx now accepts full filter props from OLEOverview parent" ^
  -m "- Two pill sub-tabs: 'Workcell Analytics' (-> OLEWorkcellTab) and 'Projection' (-> OLEPredictiveBacktesting)" ^
  -m "- OLEFilters rendered within Workcell Analytics sub-tab using passed-in filter state" ^
  -m "- No local filter state; all state owned by OLEOverview"

echo === Commit 4: Integrate Analysis tab into OLEOverview ===
git add src/pages/ole/OLEOverview.tsx
git commit -m "feat(ole-overview): add Analysis as first-class tab in OLEOverview" ^
  -m "- TABS constant extended with { id: 'analysis', label: 'Analysis' }" ^
  -m "- Analysis tab excluded from generic OLEFilters bar (it owns its own filters)" ^
  -m "- OLEAnalysis rendered with full filter prop passthrough from OLEOverview state" ^
  -m "- rowCounts.analysis set to 0 (tab manages its own counts internally)"

echo === Commit 5: Add OLEWoWAnalysis page ===
git add src/pages/ole/OLEWoWAnalysis.tsx
git commit -m "feat(ole): add OLEWoWAnalysis week-over-week analysis page" ^
  -m "- Route: /ole/analysis" ^
  -m "- Week pair selector (shadcn Select) backed by useAnalysisData hook" ^
  -m "- Left panel: 3 area sparklines — Build Units, DL Weekly, Input Working Hours (mock data)" ^
  -m "- Right panel: OLE WoW grouped bar chart, Impact by Workcell pie + legend, Build Unit Gap horizontal bar" ^
  -m "- ExpandModal: Escape-closable, scale+fade animated fullscreen expand per chart card" ^
  -m "- OLE bar labels: prev anchored to end, curr to start — no overlap" ^
  -m "- Gap bar labels: inside bar when space allows, outside when too short" ^
  -m "- All colors use hsl(var(--*)) CSS vars for full dark-mode compatibility"

echo === Commit 6: Add OLEHome1 hierarchy-driven page ===
git add src/pages/ole/OLEHome1.tsx
git commit -m "feat(ole): add OLEHome1 hierarchy-driven OLE storyline page" ^
  -m "- Route: /ole/home1" ^
  -m "- 5-tab layout: Site -> Workcells -> Labor -> Output -> Projection" ^
  -m "- Site tab: 4 KPI cards (OLE, Input Hrs, Units, Shifts) + weekly area chart + Plant 1/2 comparison cards" ^
  -m "- Workcells tab: scorecard table with OLE range bars (min/max from weekly data) and workcell logos" ^
  -m "- Labor tab: shift table with expandable employee sub-rows; grid matches OLEOverview LABOR_GT exactly" ^
  -m "- Output tab: production table with SMH/unit join; grid matches OLEOverview PROD_GT exactly" ^
  -m "- Projection tab: re-uses OLEPredictiveBacktesting component unchanged" ^
  -m "- Shared reusable sub-components: KpiCard, ChartCard, TableHeader, Skeleton, EmptyTable, Pagination" ^
  -m "- All filter state owned at root and passed down — no duplication across tabs" ^
  -m "- Plant split hardcoded as Plant 1 (all except Arista) vs Plant 2 (Arista Networks / HLA)"

echo === All done ===
git log --oneline -7
pause
