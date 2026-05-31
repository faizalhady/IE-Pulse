# IE Pulse — Frontend CLAUDE.md
# C:\Users\4033375\Projects\PRODUCTION DASHBOARD\IE-Pulse\

## What This Is
This is the **IE Pulse frontend** — a multi-app React/TypeScript SPA for Jabil Penang's
Industrial Engineering team. It is a single codebase that builds into multiple standalone
apps via Vite mode flags.

The paired backend lives at:
  C:\Users\4033375\Projects\OLE ANALYZER\ole-backend\

---

## Stack
- React 18 + TypeScript + Vite 8
- react-router-dom v6 — routing
- @tanstack/react-query — all server state / data fetching
- Tailwind CSS + shadcn/ui (Radix primitives) — all UI components
- recharts — charts and data visualisation
- lucide-react — icons
- zod + react-hook-form — form validation
- date-fns — date utilities
- exceljs — Excel export
- pdfjs-dist — PDF viewing
- maplibre-gl — floor map rendering
- Playwright — E2E tests / vitest — unit tests

---

## Repo Structure

```
IE-Pulse/
│
├── src/
│   ├── App.tsx              # Router root — all routes registered here
│   ├── main.tsx             # Entry point
│   │
│   ├── config/
│   │   └── apps.ts          # MASTER APP REGISTRY — every app defined here
│   │                        # AppId, AppConfig, NavItem types
│   │                        # APPS array — add new apps here
│   │
│   ├── pages/               # One folder per module
│   │   ├── ole/             ✅ live — OLE dashboard, reports, analysis, SMH, downtime
│   │   ├── cycletime/       ✅ live — cycle time overview and table
│   │   ├── ppqt/            ✅ live — capacity analysis, workcell profiles
│   │   ├── iebaseline/      ✅ live (playaround/learning module)
│   │   ├── fsms/            ✅ live — floor space management
│   │   ├── ebuild/          ✅ live — build plan
│   │   ├── ipk/             🔲 empty — needs implementation
│   │   ├── lbr/             🔲 empty — needs implementation
│   │   ├── Index.tsx        # Home
│   │   ├── Login.tsx
│   │   ├── GlobalOverview.tsx
│   │   ├── Plants.tsx
│   │   ├── WorkcellView.tsx
│   │   ├── WorkcellsTable.tsx
│   │   ├── FloorMap.tsx
│   │   ├── MapPage.tsx
│   │   ├── BayDetail.tsx
│   │   ├── KioskMode.tsx
│   │   ├── Reports.tsx
│   │   ├── Documents.tsx
│   │   ├── Settings.tsx
│   │   └── NotFound.tsx
│   │
│   ├── components/
│   │   ├── layout/          # Sidebar, nav shell
│   │   ├── shared/          # Shared components across modules
│   │   ├── dashboard/       # Dashboard-level components
│   │   ├── ole/             # OLE-specific components
│   │   └── ui/              # shadcn/ui primitives (don't edit directly)
│   │
│   ├── hooks/
│   │   ├── ole/             # useOleData, useAnalysisData, useOleDateFilter
│   │   ├── cycle_time/      # useCycleTimeData
│   │   └── shared/          # Shared hooks
│   │
│   ├── context/
│   │   └── AppContext.tsx    # Active app state, app switcher context
│   │
│   ├── lib/
│   │   └── buildContext.ts  # BUILD_BASENAME + includesApp() helper
│   │
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types
│   │
│   └── config/
│       └── apps.ts          # App registry (see above)
│
├── .env.<appname>           # Per-app env files (one per build mode)
├── vite.config.ts           # Vite config — reads mode to set basename + included apps
├── tailwind.config.ts
└── package.json
```

---

## App Registry (src/config/apps.ts)

Every module is registered in `APPS: AppConfig[]`. Each entry has:
- `id: AppId` — unique string key used everywhere
- `label` — display name
- `description`
- `icon` — lucide-react icon
- `color` / `iconBg` — tailwind classes for theming
- `basename` — deployment URL prefix (e.g. `/ietools/ole`)
- `category` — group in the app switcher
- `navItems` — sidebar navigation items with labels, routes, icons

**To add a new module:** add an entry to `APPS`, add routes in `App.tsx`, create the page folder.

---

## Modules — Status & Purpose

| App ID       | Status      | Pages folder          | Purpose |
|--------------|-------------|----------------------|---------|
| `ole`        | ✅ Live      | pages/ole/            | OLE dashboard, reports, 4Q generator, analysis, SMH, downtime |
| `cycle-time` | ✅ Live      | pages/cycletime/      | Cycle time data from IEDB3.0 |
| `ppqt`       | ✅ Live      | pages/ppqt/           | Capacity analysis, takt time, workcell profiles |
| `iebaseline` | ✅ Live      | pages/iebaseline/     | IE learning/reference module (playaround) |
| `fsms`       | ✅ Live      | pages/fsms/           | Floor space management, layout editor |
| `ebuild`     | ✅ Live      | pages/ebuild/         | Build plan management |
| `lbr`        | 🔲 Empty    | pages/lbr/            | Line Balance Rate — no pages yet |
| `ipk`        | 🔲 Empty    | pages/ipk/            | In-Process Kanban — no pages yet |
| `pulse`      | ✅ Live      | pages/ (root level)   | Global overview, plants, workcell views |

---

## Multi-App Build System

The repo builds into separate deployable apps via Vite modes:

```
npm run build:ole        → builds OLE app only  (mode: ole)
npm run build:pulse      → builds Pulse app     (mode: pulse)
npm run build:cycletime  → builds Cycle Time    (mode: cycle-time)
npm run build:iebaseline → builds IE Baseline   (mode: iebaseline)
npm run build:ppqt       → ...
npm run build:fsms       → ...
npm run build:ebuild     → ...
```

Each mode has a corresponding `.env.<mode>` file that sets:
- `VITE_APP_ID` — which app is active
- `VITE_BASE_URL` — the basename for deployment

`includesApp(id)` in `lib/buildContext.ts` controls which routes render in each build.
Routes are conditionally included in App.tsx using `{includesApp('ole') && <> ... </>}`.

---

## Data Fetching Pattern

All API calls use `@tanstack/react-query`.

Hook files live in `src/hooks/<module>/`:
```typescript
// Example pattern from useOleData.ts
export function useOleData() {
  return useQuery({
    queryKey: ['ole-data'],
    queryFn: () => fetch(`${API_BASE}/api/ole/data`).then(r => r.json()),
  });
}
```

Backend base URL comes from the env file via `import.meta.env.VITE_API_URL`.

---

## Component Conventions

- All UI primitives from shadcn/ui (`src/components/ui/`) — don't rebuild what's there
- Module-specific components → `src/components/<module>/`
- Shared components → `src/components/shared/`
- Icons → lucide-react only
- Tailwind for all styling — no CSS modules, no inline styles
- Types → define in `src/types/index.ts` or local `types.ts` inside the module folder

---

## IPK Frontend — What To Build

Pages to create in `src/pages/ipk/`:
```
IPKHome.tsx              — landing page, workcell selector
IPKUpload.tsx            — Excel file upload wizard
IPKRun.tsx               — trigger run + progress indicator
IPKDashboard.tsx         — summary: IPK units + trolleys + variance per process group
IPKResultTable.tsx       — full per-product × per-group result grid
IPKMatrix.tsx            — IPK Matrix (demand tier vs trolleys)
IPKHistory.tsx           — past runs + trend charts
```

Hooks to create in `src/hooks/ipk/`:
```
useIPKRuns.ts            — list and poll run status
useIPKResults.ts         — fetch results for a run
useIPKSummary.ts         — fetch summary per process group
useIPKMatrix.ts          — fetch matrix table
```

Nav items to add to `apps.ts` (currently empty):
```typescript
navItems: [
  { label: 'Dashboard',  to: '/ipk',           icon: LayoutDashboard },
  { label: 'Upload',     to: '/ipk/upload',     icon: Upload },
  { label: 'History',    to: '/ipk/history',    icon: History },
  { label: 'Matrix',     to: '/ipk/matrix',     icon: TableProperties },
]
```

Routes to add in `App.tsx`:
```tsx
{includesApp('ipk') && <>
  <Route path="/ipk"          element={<IPKHome />} />
  <Route path="/ipk/upload"   element={<IPKUpload />} />
  <Route path="/ipk/run/:id"  element={<IPKRun />} />
  <Route path="/ipk/history"  element={<IPKHistory />} />
  <Route path="/ipk/matrix"   element={<IPKMatrix />} />
</>}
```

---

## Key Conventions

- No module touches another module's files
- shadcn/ui components in src/components/ui/ are generated — don't hand-edit
- All routes are prefixed with the module ID (e.g. /ipk/..., /ole/..., /ppqt/...)
- useQuery keys follow pattern: ['<module>-<resource>', ...params]
- No Redux — all state via react-query (server) + useState/useContext (local)

---

## Architecture Docs (Notion)
https://www.notion.so/IPK-371fc83bd2fc8081aa67c99c5b6c04d3

---

## What To Work On Next (IPK)
- [ ] Add nav items for IPK in src/config/apps.ts
- [ ] Create src/pages/ipk/ folder and starter pages
- [ ] Add IPK routes in src/App.tsx
- [ ] Create src/hooks/ipk/ data fetching hooks
- [ ] Wire up to backend /api/ipk/* endpoints
