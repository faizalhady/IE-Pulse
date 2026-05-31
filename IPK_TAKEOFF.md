# IPK Frontend — Claude Code Takeoff Brief (FINAL)
# Read this AFTER reading CLAUDE.md

---

## Before You Write Anything

Read these files first — match their patterns exactly:
  src/config/apps.ts
  src/App.tsx
  src/pages/ppqt/PPQTHome.tsx              — two-column layout, sticky header, cards
  src/pages/cycletime/CycleTimeHome.tsx    — header, tab bar, download dropdown
  src/pages/ole/OLEDashboard.tsx           — sticky header, tabs, summary table, pagination
  src/hooks/ole/useOleData.ts              — useQuery hook pattern
  src/lib/ipk/ipkConstants.ts             — create this first (status logic, badge classes)

Do NOT invent new UI conventions. Match what exists.

---

## What IPK Is

IPK is a CALCULATION TOOL first, a dashboard second.

The engineer uses it to:
1. Run a simulation — given demand and cycle times, how much WIP buffer is needed?
2. Convert that WIP to trolleys
3. Compare trolleys needed vs trolleys on the floor
4. Export the result for procurement justification

There are 3 ways to run a simulation:
  A. Upload an Excel file (existing process — CT Matrix, Trolley Matrix, Loading Plan)
  B. Step-by-step wizard (guided form input)
  C. Config panel + instant results (calculator mode)

All 3 exist. All use mock data. All produce the same results view.

---

## Complete Page & Route Map

```
/ipk                              IPKHome          — workcell selector + portfolio overview
/ipk/:workcell                    IPKDashboard     — main hub for a workcell (tabbed)
/ipk/:workcell/simulate           IPKSimulate      — THE TOOL: 3 modes to run a simulation
/ipk/:workcell/results/:runId     IPKResults       — full results with expandable rows
/ipk/:workcell/history            IPKHistory       — past runs + trend chart
/ipk/:workcell/matrix             IPKMatrix        — demand vs trolleys lookup table
/ipk/:workcell/config             IPKConfig        — workcell settings (process groups, trolley types)
```

---

## Nav Items (src/config/apps.ts)

```typescript
{ label: 'Home',      to: '/ipk',                    icon: LayoutDashboard },
{ label: 'Simulate',  to: '/ipk/:workcell/simulate',  icon: Play },
{ label: 'History',   to: '/ipk/:workcell/history',   icon: History },
{ label: 'Matrix',    to: '/ipk/:workcell/matrix',    icon: TableProperties },
{ label: 'Config',    to: '/ipk/:workcell/config',    icon: Settings2 },
```

Note: workcell param in nav items shows only after a workcell is selected.
Before selection, nav only shows Home. After selection, all nav items appear.

---

## Routes (src/App.tsx)

```tsx
{includesApp('ipk') && <>
  <Route path="/ipk"                              element={<IPKHome />} />
  <Route path="/ipk/:workcell"                    element={<IPKDashboard />} />
  <Route path="/ipk/:workcell/simulate"           element={<IPKSimulate />} />
  <Route path="/ipk/:workcell/results/:runId"     element={<IPKResults />} />
  <Route path="/ipk/:workcell/history"            element={<IPKHistory />} />
  <Route path="/ipk/:workcell/matrix"             element={<IPKMatrix />} />
  <Route path="/ipk/:workcell/config"             element={<IPKConfig />} />
</>}
```

---

## Page Specs

---

### PAGE 1: IPKHome.tsx  (/ipk)

Two-column layout — mirrors PPQTHome.tsx exactly.

STICKY HEADER:
  - Title: "IPK" with Kanban icon (emerald-500)
  - Subtitle: "In-Process Kanban Simulation · {n} workcells"
  - Period selector (Select — Monthly / Weekly)
  - Refresh button

LEFT COLUMN (300px):
  Card 1 — Portfolio Hero:
    - Big number: total variance across all workcells (red if positive)
    - Subtext: "trolleys short across portfolio"
    - Bar: proportion of workcells healthy vs not
    - Grid below: Total Workcells | Total Process Groups | Last Run

  Card 2 — Workcells by Status:
    - Critical (variance > 5) — red
    - Warning (variance 1–5) — amber
    - Healthy (variance ≤ 0) — emerald
    - Never Run — muted
    - Each row: label + mini bar + count

  Card 3 — Quick Stats:
    - Total Trolleys Required (sum across all WCs)
    - Total on Floor (sum across all WCs)
    - Most Recent Run (date)

RIGHT COLUMN (flex-1):
  Section 1 — "Needs Attention" list:
    - Workcells with variance > 0 OR never run
    - Each row: workcell name, division, variance number, status badge, chevron
    - Click → navigate to /ipk/:workcell

  Section 2 — All Workcells table:
    - Columns: # | Workcell | Division | Last Run | Period Groups | Trolleys Required | On Floor | Variance | Status | Action
    - Action: "Run Simulation" button → navigate to /ipk/:workcell/simulate
    - Click row → /ipk/:workcell
    - Status badge from ipkConstants

---

### PAGE 2: IPKDashboard.tsx  (/ipk/:workcell)

The hub page for a workcell. NOT a deep analysis page — it's a landing with quick overview
and navigation cards to the actual tool pages.

STICKY HEADER:
  - Back link to /ipk
  - Workcell name + division
  - Last run date + period
  - "Run New Simulation" button (primary) → /ipk/:workcell/simulate
  - Export button

STAT CARDS ROW (4 cards):
  - Total Trolleys Required
  - Trolleys on Floor
  - Variance (red if positive, green if zero/negative)
  - Process Groups

QUICK SUMMARY TABLE (last run results — read only):
  Same columns as IPKResults summary table.
  No inline editing here — this is read-only overview.
  "View Full Results" link at bottom → /ipk/:workcell/results/latest

NAVIGATION CARDS GRID (2x2):
  Each card is a large clickable card with icon, title, description, and arrow.
  - 🧮 Run Simulation → /ipk/:workcell/simulate
      "Upload Excel, use the wizard, or configure manually"
  - 📋 Full Results → /ipk/:workcell/results/latest
      "Expandable breakdown with full calculation steps"
  - 📈 Run History → /ipk/:workcell/history
      "Past simulations and trolley trend over time"
  - 🔢 IPK Matrix → /ipk/:workcell/matrix
      "Demand tier vs trolleys lookup table"

---

### PAGE 3: IPKSimulate.tsx  (/ipk/:workcell/simulate)  ← THE TOOL

This is the main tool page. Three tabs at the top for the 3 input modes.
All tabs produce the same result and navigate to IPKResults on completion.

STICKY HEADER:
  - Back link to /ipk/:workcell
  - Title: "Run IPK Simulation — {workcell}"
  - Subtitle: "Choose how you want to provide input data"

TAB BAR (3 tabs):
  Tab A: Upload Excel
  Tab B: Step-by-Step Wizard
  Tab C: Manual Config (calculator mode)

---

#### TAB A — Upload Excel

Layout: centered upload zone on screen.

Components:
  - Large drag-and-drop zone (dashed border, Upload icon, "Drop your IPK Excel file here")
  - "or browse files" link
  - Below zone: 5 file slots showing which source files are expected:
      ✅ / ⬜  Cycle Time Matrix
      ✅ / ⬜  Available Machine Matrix
      ✅ / ⬜  Trolley Type Matrix
      ✅ / ⬜  Process Grouping
      ✅ / ⬜  Loading Plan
  - Each slot: icon, name, "Upload" button, shows filename when uploaded
  - Can upload all 5 as one Excel (multi-sheet) or 5 separate files
  - "Run Simulation" button (disabled until at least CT Matrix + Loading Plan uploaded)
  - On click: mock loading spinner (1.5s) → navigate to /ipk/:workcell/results/run-latest

---

#### TAB B — Step-by-Step Wizard

4 steps with a step indicator at the top (Step 1 / 2 / 3 / 4).

Step 1 — Workcell Settings:
  - Days per period (number input, default 20)
  - Hours per shift (number input, default 10.5)
  - Number of shifts (select: 1 / 2 / 3)
  - Period type (select: Monthly / Weekly)
  - Non-occupancy buffer (number input %, default 15)
  - Next button

Step 2 — Process Groups:
  - Table of process groups: Group Name | Processes in Group | Calc Type | Upstream Group
  - "Add Process Group" button → adds a new row
  - Each row editable inline (group name, calc type dropdown: normal / double_pass / batch)
  - Mock data pre-filled with BD PCA process groups
  - Next button / Back button

Step 3 — Loading Plan:
  - Table: Assembly PN | Model Description | Loading Qty | Lot Size
  - "Add Product" button → adds row
  - Mock data pre-filled
  - Period label input (e.g. "Jun 2024")
  - Next / Back

Step 4 — Review & Run:
  - Summary of all inputs: {n} process groups, {n} products, period, workcell settings
  - Warning if any required fields are empty
  - "Run Simulation" button (primary, large)
  - On click: mock loading with progress bar (shows "Calculating UPH..." → "Computing IPK..." → "Converting to Trolleys..." → "Done")
  - On complete: navigate to /ipk/:workcell/results/run-wizard

---

#### TAB C — Manual Config (Calculator Mode)

Single page — left config panel (400px) + right live results panel.
Results update live as the engineer changes inputs (client-side calculation, no API call).

LEFT PANEL — Inputs:
  Section: Settings
    - Days per period, Hours per shift, Shifts, Buffer %

  Section: Process Groups (collapsible list)
    - Each group: name, bottleneck CT (sec), FPY, Efficiency, Qty Equipment, Changeover time
    - "Add Group" button

  Section: Demand
    - Total loading qty (single number for now)
    - Boards per trolley (used for conversion)

  "Save & Export Results" button at bottom

RIGHT PANEL — Live Results:
  Updates instantly as inputs change (pure client-side JS calculation).

  Header: "Live IPK Results" with a green pulsing dot when inputs change

  For each process group → result card:
    - Process group name
    - Effective UPH: {n}
    - IPK (units): {n}
    - WIP + buffer: {n}
    - Trolleys needed: {n} (big, bold)
    - Mini formula breakdown:
        3600 / {CT} × {FPY} × {EFF} × {Conv%} = {UPH}
        ({UPH_up} - {UPH_down}) × ({Qty} / {UPH_up}) = {IPK}

  Total at bottom:
    - Total trolleys required: {n} (large)
    - "Save as Run" button → saves to mock history, navigates to results page

---

### PAGE 4: IPKResults.tsx  (/ipk/:workcell/results/:runId)

The full results page after any simulation mode completes.

STICKY HEADER:
  - Back link to /ipk/:workcell
  - Title: "IPK Results — {workcell}"
  - Run info: {period} · {date} · {source: Excel / Wizard / Manual}
  - Export button (exceljs download)
  - "Run New Simulation" button

STAT CARDS (4):
  - Total IPK Units | Total Trolleys Required | Trolleys on Floor | Variance

SUMMARY TABLE (main content):
  One row per process group. Columns:
  | Expand | # | Process Group | Loading Qty | Eff. UPH | IPK Units | WIP+Buffer | IPK Trolleys | In/Out | Reject | On-Hold | Total Required | Actual on Floor | Variance |

  - In/Out, Reject, On-Hold, Actual on Floor: INLINE EDITABLE
  - Total Required and Variance: auto-computed client-side
  - Variance: red bg if positive, green bg if zero/negative
  - Expand chevron (leftmost column): click to expand row

  EXPANDED ROW (accordion below the row):
    Shows the full calculation step by step in a clean formula layout:

    ┌─────────────────────────────────────────────────────────┐
    │  Calculation Breakdown — SMT Bot                         │
    │                                                          │
    │  Step 1 — Effective UPH                                  │
    │  (3600 / 102 sec) × 0.99 × 0.85 × 94.2% × 1 = 27.9    │
    │   raw UPH   FPY    EFF   Conv%   Machines                │
    │                                                          │
    │  Step 2 — IPK                                            │
    │  (27.9 - 19.4) × (2800 / 27.9) = 854 units              │
    │   UPH↑  UPH↓      Loading / UPH↑                        │
    │                                                          │
    │  Step 3 — WIP + 15% Buffer                              │
    │  FLOOR(854 × 1.15) = 982 units                           │
    │                                                          │
    │  Step 4 — Trolleys                                       │
    │  CEIL(982 / 120 boards) = 9 trolleys                     │
    └─────────────────────────────────────────────────────────┘

  TOTALS ROW (bottom, bold):
    Sum of all numeric columns. Variance total colored.

---

### PAGE 5: IPKHistory.tsx  (/ipk/:workcell/history)

STICKY HEADER:
  - Back link to /ipk/:workcell
  - Title: "Run History — {workcell}"
  - "New Simulation" button

CHART (recharts LineChart):
  - X-axis: period labels (Jan, Feb, Mar...)
  - Y-axis: trolley count
  - Two lines: Total Required (emerald) and On Floor (muted)
  - Dots on each data point, hover tooltip showing all values
  - Dark theme, matches OLE analysis chart style

HISTORY TABLE:
  Columns: # | Date | Period | Source | Process Groups | Total Required | On Floor | Variance | Status | Actions
  Source: badge showing "Excel" / "Wizard" / "Manual"
  Actions: "View Results" button → /ipk/:workcell/results/:runId
  Variance: colored
  Pagination: same pattern as OLEDashboard

---

### PAGE 6: IPKMatrix.tsx  (/ipk/:workcell/matrix)

STICKY HEADER:
  - Title: "IPK Matrix — {workcell}"
  - Subtitle: "Trolleys needed per process group at each demand level"
  - Info tooltip explaining what the matrix is

MATRIX TABLE:
  Rows: demand tiers (1000, 1500, 2000, 2500, 3000 units)
  Columns: process groups (SMT Bot, SMT Top, Wash Top 1, LF Wave Top...)
  Cells: trolley count, colored by value:
    - 1–3: text-muted-foreground (low)
    - 4–8: text-foreground
    - 9–15: text-amber-400
    - 16+: text-red-400
  Row header: demand tier (bold)
  Column header: process group name (vertical or wrapped)
  Highlighted row: current demand level (based on latest run)

BELOW TABLE:
  Caption: "Generated from {n} simulation runs. Refresh by running more simulations."
  "Run Simulation" button → /ipk/:workcell/simulate

---

### PAGE 7: IPKConfig.tsx  (/ipk/:workcell/config)

STICKY HEADER:
  - Title: "Configuration — {workcell}"
  - Save button (disabled until changes made)

SECTION 1 — Workcell Settings:
  Card with form fields:
  - Workcell name (read-only)
  - Customer / Division
  - Days per period
  - Hours per shift
  - Number of shifts
  - Non-occupancy buffer %
  - Period type (Monthly / Weekly)

SECTION 2 — Process Groups:
  Table with inline editing:
  Columns: # | Group Name | Calc Type | Upstream Group | Processes | Actions
  - Calc Type dropdown: normal / double_pass / piece_to_batch / batch_to_piece / batch_to_batch / two_line_input
  - Each row: edit inline, delete button
  - "Add Process Group" button below table
  - Drag handle to reorder (sequence matters for IPK calculation)

SECTION 3 — Trolley Types:
  Table: Assembly PN | Trolley Type | Cavities | Boards/Cavity | Boards/Trolley
  - Boards/Trolley: computed (Cavities × Boards/Cavity), shown in muted text
  - Inline editable
  - "Add" button

SECTION 4 — Danger Zone:
  Card with red border:
  - "Clear all run history" button (disabled for now — placeholder)
  - "Reset config to defaults" button (disabled)

---

## Mock Data — src/pages/ipk/mockIpkData.ts

```typescript
// Workcells
export const MOCK_WORKCELLS = [
  { id: 'bd-pca',    name: 'BD PCA',    division: 'Becton Dickinson', lastRun: '2024-06-15', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 12, totalRequired: 87, onFloor: 79, variance: 8,  status: 'critical'  },
  { id: 'lamres-be', name: 'LAMRES BE', division: 'Lam Research',     lastRun: '2024-06-10', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 9,  totalRequired: 41, onFloor: 43, variance: -2, status: 'healthy'   },
  { id: 'arista',    name: 'Arista PCA',division: 'Arista Networks',  lastRun: null,         period: null,       periodType: 'weekly',  processGroupCount: 0,  totalRequired: 0,  onFloor: 0,  variance: 0,  status: 'never_run' },
  { id: 'imed',      name: 'IMED PCA',  division: 'ICU Medical',      lastRun: '2024-06-01', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 7,  totalRequired: 32, onFloor: 30, variance: 2,  status: 'warning'   },
]

// Summary rows (one per process group)
export interface IPKSummaryRow {
  processGroup: string
  loadingQty: number
  effectiveUph: number
  ipkUnits: number
  wipWithBuffer: number
  ipkTrolleys: number
  inOutTrolleys: number
  rejectTrolleys: number
  onHoldTrolleys: number
  totalRequired: number       // computed
  actualOnFloor: number
  variance: number            // computed
  // for expanded breakdown
  bottleneckCtSec: number
  fpy: number
  efficiency: number
  conversionPct: number
  qtyEquipment: number
  uphUpstream: number
  uphDownstream: number
  boardsPerTrolley: number
}

export const MOCK_SUMMARY_ROWS: IPKSummaryRow[] = [
  { processGroup: 'SMT Bot',          loadingQty: 2800, effectiveUph: 35.1, ipkUnits: 184,  wipWithBuffer: 211, ipkTrolleys: 8,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 12, actualOnFloor: 10, variance: 2,  bottleneckCtSec: 102, fpy: 0.99, efficiency: 0.85, conversionPct: 0.94, qtyEquipment: 1, uphUpstream: 35.1, uphDownstream: 27.4, boardsPerTrolley: 20 },
  { processGroup: 'SMT Top',          loadingQty: 2800, effectiveUph: 35.1, ipkUnits: 184,  wipWithBuffer: 211, ipkTrolleys: 8,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 12, actualOnFloor: 12, variance: 0,  bottleneckCtSec: 102, fpy: 0.99, efficiency: 0.85, conversionPct: 0.94, qtyEquipment: 1, uphUpstream: 35.1, uphDownstream: 27.4, boardsPerTrolley: 20 },
  { processGroup: 'Wash Top 1',       loadingQty: 2800, effectiveUph: 63.3, ipkUnits: 42,   wipWithBuffer: 48,  ipkTrolleys: 3,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 4,  actualOnFloor: 2,  variance: 2,  bottleneckCtSec: 56,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 63.3, uphDownstream: 28.4, boardsPerTrolley: 20 },
  { processGroup: 'LF Wave Top',      loadingQty: 2800, effectiveUph: 28.4, ipkUnits: 310,  wipWithBuffer: 357, ipkTrolleys: 12, inOutTrolleys: 2, rejectTrolleys: 2, onHoldTrolleys: 1, totalRequired: 17, actualOnFloor: 15, variance: 2,  bottleneckCtSec: 126, fpy: 0.95, efficiency: 0.85, conversionPct: 0.92, qtyEquipment: 1, uphUpstream: 28.4, uphDownstream: 22.1, boardsPerTrolley: 20 },
  { processGroup: 'Wash Bot 2',       loadingQty: 2800, effectiveUph: 63.3, ipkUnits: 38,   wipWithBuffer: 44,  ipkTrolleys: 2,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 3,  actualOnFloor: 4,  variance: -1, bottleneckCtSec: 56,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 63.3, uphDownstream: 30.2, boardsPerTrolley: 20 },
  { processGroup: 'Xray',             loadingQty: 2800, effectiveUph: 83.0, ipkUnits: 22,   wipWithBuffer: 25,  ipkTrolleys: 1,  inOutTrolleys: 0, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 1,  actualOnFloor: 1,  variance: 0,  bottleneckCtSec: 43,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 83.0, uphDownstream: 45.0, boardsPerTrolley: 20 },
  { processGroup: 'LF Wave Bot',      loadingQty: 2800, effectiveUph: 30.2, ipkUnits: 288,  wipWithBuffer: 331, ipkTrolleys: 11, inOutTrolleys: 2, rejectTrolleys: 2, onHoldTrolleys: 1, totalRequired: 16, actualOnFloor: 14, variance: 2,  bottleneckCtSec: 119, fpy: 0.95, efficiency: 0.85, conversionPct: 0.92, qtyEquipment: 1, uphUpstream: 30.2, uphDownstream: 22.1, boardsPerTrolley: 20 },
  { processGroup: 'Router',           loadingQty: 2800, effectiveUph: 45.0, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 1,  actualOnFloor: 2,  variance: -1, bottleneckCtSec: 80,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 45.0, uphDownstream: 45.0, boardsPerTrolley: 20 },
  { processGroup: 'Backend MA',       loadingQty: 2800, effectiveUph: 22.1, ipkUnits: 95,   wipWithBuffer: 109, ipkTrolleys: 4,  inOutTrolleys: 1, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 7,  actualOnFloor: 5,  variance: 2,  bottleneckCtSec: 163, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 22.1, uphDownstream: 18.5, boardsPerTrolley: 20 },
  { processGroup: 'ICT',              loadingQty: 2800, effectiveUph: 18.5, ipkUnits: 60,   wipWithBuffer: 69,  ipkTrolleys: 3,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 4,  actualOnFloor: 3,  variance: 1,  bottleneckCtSec: 194, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 18.5, uphDownstream: 14.2, boardsPerTrolley: 20 },
  { processGroup: 'FVT',              loadingQty: 2800, effectiveUph: 14.2, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 1, rejectTrolleys: 1, onHoldTrolleys: 0, totalRequired: 2,  actualOnFloor: 2,  variance: 0,  bottleneckCtSec: 253, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 14.2, uphDownstream: 12.0, boardsPerTrolley: 20 },
  { processGroup: 'FNI / OBA / Pack', loadingQty: 2800, effectiveUph: 12.0, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 4,  actualOnFloor: 3,  variance: 1,  bottleneckCtSec: 300, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 12.0, uphDownstream: 12.0, boardsPerTrolley: 20 },
]

export const MOCK_HISTORY = [
  { id: 'run-006', date: '2024-06-15', period: 'Jun 2024', source: 'Excel',  processGroups: 12, totalRequired: 87, onFloor: 79, variance: 8  },
  { id: 'run-005', date: '2024-05-18', period: 'May 2024', source: 'Wizard', processGroups: 12, totalRequired: 79, onFloor: 79, variance: 0  },
  { id: 'run-004', date: '2024-04-14', period: 'Apr 2024', source: 'Excel',  processGroups: 12, totalRequired: 83, onFloor: 75, variance: 8  },
  { id: 'run-003', date: '2024-03-16', period: 'Mar 2024', source: 'Manual', processGroups: 12, totalRequired: 71, onFloor: 75, variance: -4 },
  { id: 'run-002', date: '2024-02-17', period: 'Feb 2024', source: 'Excel',  processGroups: 12, totalRequired: 68, onFloor: 70, variance: -2 },
  { id: 'run-001', date: '2024-01-20', period: 'Jan 2024', source: 'Excel',  processGroups: 12, totalRequired: 65, onFloor: 60, variance: 5  },
]

export const MOCK_MATRIX = {
  demandTiers:   [1000, 1500, 2000, 2500, 3000],
  processGroups: ['SMT Bot', 'SMT Top', 'Wash Top 1', 'LF Wave Top', 'Wash Bot 2', 'LF Wave Bot', 'Backend MA', 'ICT'],
  values: [
    [3,  3,  1, 5,  1, 4,  2, 1],
    [5,  5,  2, 7,  2, 6,  3, 2],
    [6,  6,  2, 9,  2, 8,  4, 2],
    [8,  8,  3, 11, 3, 10, 5, 3],
    [10, 10, 4, 13, 4, 12, 6, 3],
  ],
}

export const MOCK_PROCESS_GROUPS = [
  { id: 'pg-1',  name: 'SMT Bot',          calcType: 'normal',      upstreamGroup: null,   processes: ['Solder Print Bot', 'Koh Young Bot', 'SMT Bot', 'Reflow Bot'] },
  { id: 'pg-2',  name: 'SMT Top',          calcType: 'double_pass', upstreamGroup: 'pg-1', processes: ['Solder Print Top', 'Koh Young Top', 'SMT Top', 'Reflow Top'] },
  { id: 'pg-3',  name: 'Wash Top 1',       calcType: 'normal',      upstreamGroup: 'pg-2', processes: ['Wash 1'] },
  { id: 'pg-4',  name: 'LF Wave Top',      calcType: 'normal',      upstreamGroup: 'pg-3', processes: ['Manual Insert', 'Wave', 'PWTU', 'TSTH'] },
  { id: 'pg-5',  name: 'Wash Bot 2',       calcType: 'normal',      upstreamGroup: 'pg-4', processes: ['Wash 2'] },
  { id: 'pg-6',  name: 'Xray',             calcType: 'normal',      upstreamGroup: 'pg-5', processes: ['Xray'] },
  { id: 'pg-7',  name: 'LF Wave Bot',      calcType: 'normal',      upstreamGroup: 'pg-6', processes: ['Manual Insert Bot', 'Wave Bot', 'PWTU Bot'] },
  { id: 'pg-8',  name: 'Router',           calcType: 'normal',      upstreamGroup: 'pg-7', processes: ['Router'] },
  { id: 'pg-9',  name: 'Backend MA',       calcType: 'normal',      upstreamGroup: 'pg-8', processes: ['BE Manual Assembly'] },
  { id: 'pg-10', name: 'ICT',              calcType: 'normal',      upstreamGroup: 'pg-9', processes: ['Genrad ICT', 'HP3070'] },
  { id: 'pg-11', name: 'FVT',              calcType: 'normal',      upstreamGroup: 'pg-10',processes: ['FVT'] },
  { id: 'pg-12', name: 'FNI / OBA / Pack', calcType: 'normal',      upstreamGroup: 'pg-11',processes: ['FNI', 'OBA', 'Packout'] },
]
```

---

## Hooks — src/hooks/ipk/

```
useIPKWorkcells.ts       returns MOCK_WORKCELLS
useIPKSummary.ts         takes workcell: string, returns MOCK_SUMMARY_ROWS
useIPKHistory.ts         takes workcell: string, returns MOCK_HISTORY
useIPKMatrix.ts          takes workcell: string, returns MOCK_MATRIX
useIPKProcessGroups.ts   takes workcell: string, returns MOCK_PROCESS_GROUPS
```

All use useQuery. All structured for easy real-API swap (comment shows future endpoint).

---

## Status Constants — src/lib/ipk/ipkConstants.ts (CREATE FIRST)

```typescript
export type IPKStatus = 'critical' | 'warning' | 'healthy' | 'never_run'

export function getIPKStatus(variance: number, hasRun: boolean): IPKStatus {
  if (!hasRun) return 'never_run'
  if (variance > 5) return 'critical'
  if (variance > 0) return 'warning'
  return 'healthy'
}

export const IPK_STATUS_BADGE: Record<IPKStatus, string> = {
  critical:  'bg-red-500/15 text-red-400 border-red-500/30',
  warning:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  healthy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  never_run: 'bg-muted text-muted-foreground border-border',
}

export const IPK_STATUS_LABEL: Record<IPKStatus, string> = {
  critical:  'Critical',
  warning:   'Warning',
  healthy:   'Healthy',
  never_run: 'Not Run',
}

export const IPK_VARIANCE_CLASS = (v: number) =>
  v > 0 ? 'text-red-400 bg-red-500/10' : v < 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground'
```

---

## Inline Editable Cell Pattern (use in IPKResults)

```tsx
function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(String(value))
  if (!editing) return (
    <button onClick={() => { setLocal(String(value)); setEditing(true) }}
      className="w-full text-center font-mono text-sm hover:bg-muted/60 rounded px-2 py-1 transition-colors">
      {value}
    </button>
  )
  return (
    <Input autoFocus type="number" value={local}
      className="h-7 w-16 text-center text-xs font-mono"
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { onChange(Number(local) || 0); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(Number(local) || 0); setEditing(false) } }} />
  )
}
```

---

## Excel Export (in IPKResults)

Use exceljs. Client-side only.

Sheet 1 "IPK Summary": all summary table columns
  - Variance column: red fill if positive, green fill if zero/negative
  - Total Required: bold
  - Totals row at bottom: bold

Sheet 2 "Run Info": Workcell | Period | Date Generated | Source | Total Required | Variance

Sheet 3 "Calculation Detail": per-row breakdown data (CT, UPH, IPK steps)

Button: DropdownMenu with "Download as XLSX" — same as CycleTimeHome pattern.

---

## Build Order

1.  src/lib/ipk/ipkConstants.ts
2.  src/pages/ipk/mockIpkData.ts
3.  src/hooks/ipk/ (all 5 hooks)
4.  src/config/apps.ts — add IPK nav items
5.  src/pages/ipk/IPKHome.tsx
6.  src/App.tsx — add all IPK routes
7.  src/pages/ipk/IPKDashboard.tsx
8.  src/pages/ipk/IPKSimulate.tsx — Tab A (Upload) first
9.  src/pages/ipk/IPKSimulate.tsx — Tab B (Wizard)
10. src/pages/ipk/IPKSimulate.tsx — Tab C (Calculator/Manual)
11. src/pages/ipk/IPKResults.tsx — summary table + inline editing
12. src/pages/ipk/IPKResults.tsx — expandable breakdown rows
13. src/pages/ipk/IPKHistory.tsx — table + recharts line chart
14. src/pages/ipk/IPKMatrix.tsx
15. src/pages/ipk/IPKConfig.tsx
16. Excel export in IPKResults.tsx

---

## Hard Rules

- shadcn/ui only — Button, Input, Select, Table, DropdownMenu, Tabs, Accordion from @/components/ui
- Tailwind only — no CSS modules, no inline styles
- lucide-react only — use Kanban as the IPK module icon
- recharts — dark theme, emerald lines, match OLE chart style
- cn() from @/lib/utils — always for conditional classNames
- Sticky headers — z-20 bg-background border-b border-border (same as OLE + PPQT)
- Table rows — h-14 hover:bg-muted/40 border-b border-border last:border-0
- Table headers — bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider
- Cards — rounded-xl border border-border bg-card overflow-hidden
- Card section headers — px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider
- Status badges — always from IPK_STATUS_BADGE in ipkConstants.ts
- Variance coloring — always from IPK_VARIANCE_CLASS in ipkConstants.ts
