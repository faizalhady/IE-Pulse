/**
 * CycleTimeExplorer.tsx
 * ─────────────────────
 * Shared interactive body for the Cycle Time pages: source toggle (DB|Live),
 * Table / Breakdown tabs, the filter bar, and the table/breakdown views.
 *
 * Rendered by:
 *   - CycleTimeHome      — generic header, customer picked from the filter bar
 *   - CycleTimeWorkcell  — branded header, customer locked from the route
 *
 * The only differences between those two pages are (a) the left side of the
 * header and (b) whether the customer is locked — both passed in as props.
 *
 * Two data sources, toggleable in the header:
 *   DB    — fast read from local parquet mart (default)
 *   Live  — paginated proxy directly to IEDB, infinite scroll
 */

import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, Download, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCycleTimeAliases,
  useCycleTimeDataPage,
  useCycleTimeLive,
} from '@/hooks/cycle_time/useCycleTimeData';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
import { exportCycleTimeXlsx } from '@/lib/cycle_time/cycleTimeExport';

import CycleTimeAssemblyDrawer, { DrawerBuildRef } from './CycleTimeAssemblyDrawer';
import CycleTimeAssemblyFlow from './CycleTimeAssemblyFlow';
import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';
import CycleTimeTable from './CycleTimeTable';

type Source = 'db' | 'live';
type View = 'table' | 'flow';
const LIVE_PAGE_SIZE = 500;
const DB_PAGE_SIZE = 300;

interface CycleTimeExplorerProps {
  /** Left side of the sticky header — a title or a workcell brand block. */
  headerLeft: ReactNode;
  /** Contextual aside (e.g. the workcell assemblies card) shown at the far
   *  right of the filter row. */
  aside?: ReactNode;
  /**
   * When set, the customer is fixed from the route (workcell page): the filter
   * bar hides its customer Select and data is always scoped here. When omitted,
   * the customer comes from the filter bar (Overview page).
   */
  lockedCustomer?: string;
  /**
   * Whether to offer the Breakdown view. When false (the Data page) the tab bar
   * is dropped entirely and only the table renders. Defaults to true.
   */
  enableBreakdown?: boolean;
}

export default function CycleTimeExplorer({
  headerLeft,
  aside,
  lockedCustomer,
  enableBreakdown = true,
}: CycleTimeExplorerProps) {
  // Source toggle is hidden — DB mode only. (Live remains reachable via ?source=live.)
  const [params] = useSearchParams();
  const source: Source = (params.get('source') as Source) === 'live' ? 'live' : 'db';

  const [filters] = useCycleTimeFilters();
  const [exporting, setExporting] = useState(false);
  // Table-tab drawer: which assembly + which build (row) to pre-select.
  const [drawer, setDrawer] = useState<{ assembly: string; build: DrawerBuildRef } | null>(null);
  // Tabs are hidden for now: the workcell explorer shows the Assemblies (flow)
  // view — its Detail|Matrix toggle lives in the flow's own filter row; the
  // Data page (breakdown disabled) shows the wide table.
  const activeView: View = enableBreakdown ? 'flow' : 'table';

  // Active customer: route-locked (workcell page) or picked in the filter bar.
  const customer = lockedCustomer ?? (filters.customer || undefined);

  // DB mode — one page at a time (classic prev/next pagination).
  const [page, setPage] = useState(1);
  const dbFilters = {
    customer,
    sub_workcenter: filters.sub_workcenter || undefined,
    assembly:       filters.assembly || undefined,
  };
  // Reset to page 1 whenever the filter scope changes.
  useEffect(() => { setPage(1); }, [customer, filters.sub_workcenter, filters.assembly]);

  const dbQ = useCycleTimeDataPage(source === 'db' ? dbFilters : { customer: undefined }, page, DB_PAGE_SIZE);

  // Live mode — infinite-scroll pages straight from IEDB.
  const liveQ = useCycleTimeLive(
    source === 'live' ? customer : undefined,
    LIVE_PAGE_SIZE,
    filters.sub_workcenter || undefined,
  );

  // Alias map: DB mode reads from /aliases endpoint; live mode uses the
  // server-built map embedded in each /live page response.
  const dbAliasMapQ = useCycleTimeAliases(source === 'db' ? customer : undefined);

  // ── Unified view-model: DB = paged page, Live = infinite scroll ─────────────
  const isLive = source === 'live';
  const rows         = isLive ? liveQ.rows       : dbQ.data?.rows;
  const aliasMap     = isLive ? liveQ.aliasMap   : dbAliasMapQ.data;
  const tableLoading = isLive ? liveQ.isLoading  : dbQ.isLoading;
  const tableError   = (isLive ? liveQ.error     : dbQ.error) as Error | null;
  const totalKnown   = isLive ? liveQ.totalCount : (dbQ.data?.total ?? 0);

  // Live → infinite scroll / load-more. DB → page controls.
  const hasMore      = isLive ? Boolean(liveQ.hasNextPage)       : false;
  const fetchingMore = isLive ? Boolean(liveQ.isFetchingNextPage) : false;
  const onScrollEnd  = isLive ? () => liveQ.fetchNextPage()       : undefined;
  const pagination   = isLive
    ? undefined
    : {
        page:    dbQ.data?.page ?? page,
        pages:   dbQ.data?.pages ?? 1,
        loading: dbQ.isFetching,
        onPage:  setPage,
      };

  // Line options come from the alias map (complete, not just the current page).
  const lines = useMemo(() => {
    const set = new Set<string>();
    Object.values(aliasMap ?? {}).forEach((info) => info.lines.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [aliasMap]);

  const hasRows = (rows?.length ?? 0) > 0;

  async function handleExportXlsx() {
    if (!customer || exporting) return;
    setExporting(true);
    try {
      // The table only holds the pages scrolled so far — pull the full dataset
      // (one-shot, unpaginated) so the export is complete, not just what's loaded.
      const fullRows = await cycleTimeApi.data.list({
        customer,
        sub_workcenter: filters.sub_workcenter || undefined,
        assembly:       filters.assembly || undefined,
      });
      await exportCycleTimeXlsx({ rows: fullRows, customer, aliasMap });
    } catch (e) {
      console.error('XLSX export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── Header (aside / coverage card pinned far right, both tabs) ── */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        {headerLeft}
        {aside}
      </div>

      {/* Tabs hidden for now — workcell opens directly into the Assemblies view. */}

      {/* ─── Filters (table tab only — Assemblies carries its own row) ──── */}
      {activeView === 'table' && (
        <CycleTimeFilters
          availableLines={lines}
          lockedCustomer={lockedCustomer}
          rightSlot={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={!hasRows || exporting}>
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download
                  <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportXlsx} disabled={!hasRows || exporting}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Download as XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      )}

      {/* ─── Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {activeView === 'flow' ? (
          <CycleTimeAssemblyFlow lockedCustomer={customer} />
        ) : (
          <CycleTimeTable
            rows={rows}
            loading={tableLoading}
            error={tableError}
            aliasMap={aliasMap}
            onScrollEnd={onScrollEnd}
            hasMore={hasMore}
            fetchingMore={fetchingMore}
            totalKnown={totalKnown}
            pagination={pagination}
            onRowClick={(row) =>
              setDrawer({
                assembly: row.assembly,
                build: { revision: row.revision, line: row.sub_workcenter },
              })
            }
          />
        )}
      </div>

      {/* Table-tab drawer — opens on the clicked build. */}
      <CycleTimeAssemblyDrawer
        customer={customer}
        assembly={drawer?.assembly ?? null}
        initialBuild={drawer?.build}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
