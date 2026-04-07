#!/usr/bin/env bash
set -e

# ── Ensure we're on the api branch ───────────────────────────────────────────
git checkout -B api

# ── 1. API client + types ─────────────────────────────────────────────────────
git add src/lib/api.ts
git commit -m "feat(api): add MES hub client with typed endpoints

- ApiAssembly, ApiWorkcell, ApiWorkcellBay, ApiProductionSummary types
- api.assemblies.list(), api.workcells.*, api.production.*, api.locations.*"

# ── 2. Data hooks ─────────────────────────────────────────────────────────────
git add src/hooks/useMesData.ts
git commit -m "feat(hooks): add useMesData polling hooks for MES API

- useWorkcells, useWorkcellBays, useWorkcellSummary, useWorkcellsByPlant
- useProductionSummary (no polling), useProductionLatest, useProductionByBay
- useAssemblies (fetch once, no polling)
- usePolling generic hook with interval=0 support for one-shot fetches"

# ── 3. Stub out broken legacy hooks ──────────────────────────────────────────
git add src/hooks/useBay.ts src/hooks/useMachines.ts src/hooks/useSSE.ts
git commit -m "fix(hooks): replace broken legacy hooks with safe stubs

- useBay/useBays re-export from useMesData
- useMachines returns empty safe shape (replaced by generateMachines)
- useSSE returns empty safe shape (replaced by direct mock lookup)"

# ── 4. Mock data generators exported ─────────────────────────────────────────
git add src/mocks/data.ts
git commit -m "feat(mocks): export seeded generators for deterministic mock data

- generateMachines(seed), generateHourlyData(seed), generateDowntimeLog(seed)
- seededRand() for stable per-bay data across renders
- operators[] exported for use in BayDetail"

# ── 5. Vite proxy config ──────────────────────────────────────────────────────
git add vite.config.ts
git commit -m "chore(vite): add /api proxy to MES hub (localhost:3000)"

# ── 6. WorkcellsTable — live API ──────────────────────────────────────────────
git add src/pages/WorkcellsTable.tsx
git commit -m "feat(workcells-table): wire to live API data

- useWorkcells + useProductionSummary replace mock buildRows()
- Derive rows from production summary (workcells with no data are skipped)
- Plant filter pills: All / P1 / P2 / Batu Kawan / Chuping
- ?plant= URL param pre-selects filter on arrival from Plants page
- Output column replaces WIP/Downtime (no API equivalent yet)
- Bay status pills capped at 5
- No polling on production/summary (fetch once)
- Refresh button, loading skeleton, WifiOff error indicator"

# ── 7. WorkcellView — live API + tabs ─────────────────────────────────────────
git add src/pages/WorkcellView.tsx
git commit -m "feat(workcell-view): live API data + Bays/All Assemblies tabs

- Bays tab: live production summary rows per bay, list + cards view
- All Assemblies tab: useAssemblies() fetches /assemblies?workcell_id=
- Search box on both tabs
- Bay rows clickable → /bay/WORKCELL__BAY (compound param)
- last_updated_mes formatted as YYYY-MM-DD
- Loading skeleton, empty states, Refresh button"

# ── 8. BayDetail — hybrid API + mock ─────────────────────────────────────────
git add src/pages/BayDetail.tsx
git commit -m "feat(bay-detail): hybrid real API + seeded mock data

- Parses WORKCELL__BAY compound URL param
- Real from API: productivity, plan/cumm/delta, overallWip, pendingWip
- Seeded mock: machines (18), hourlyData (12h), downtimeLog, operator
- Breadcrumb links back to workcell via encodeURIComponent
- All tabs (Overview, Downtime, History, Machines) fully populated"

# ── 9. GlobalOverview — keep mock, fix crash ─────────────────────────────────
git add src/pages/GlobalOverview.tsx
git commit -m "fix(global-overview): use mock data directly, remove broken useBays hook

- Imports bays/workcells from mocks/data directly
- Removes useBays() call that caused null.length crash"

# ── 10. KioskMode — fix + dark/light toggle ───────────────────────────────────
git add src/pages/KioskMode.tsx
git commit -m "fix(kiosk): replace broken useSSE with mock data + add dark/light toggle

- Looks up bay by id from mock bays array, fallback to bays[0]
- Self-contained dark/light toggle (Sun/Moon icon in header)
- All colours theme-aware via dark boolean flag"

# ── 11. Plants — plantCode + nav params ──────────────────────────────────────
git add src/pages/Plants.tsx
git commit -m "feat(plants): add plantCode field and pass ?plant= param to workcells

- Each plant has plantCode: P1 / P2 / BK / P3
- Map popup and sidebar card Details buttons navigate to /workcells?plant=CODE
- Layout dropdown picker for Plant 1 (multi-layout)
- Other plants show No Layouts Available empty state"

# ── 12. Sidebar — dynamic workcell list ──────────────────────────────────────
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): dynamic workcell sub-list from API + collapsible dropdown

- useWorkcells + useProductionSummary power the sub-list
- Only shows workcells with production data (same filter as WorkcellsTable)
- Workcells row: click label → /workcells, click chevron → toggle dropdown
- Collapsed state: plain SidebarLink (no Collapsible wrapper, icon centred)
- Tooltip on all collapsed icons
- Loading skeleton while API resolves"

echo ""
echo "All commits done on branch 'api'."
git log --oneline -13
echo ""
echo "To push:  git push origin api"
