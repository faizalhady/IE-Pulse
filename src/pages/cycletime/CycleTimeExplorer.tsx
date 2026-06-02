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

import { ReactNode, useMemo, useState } from 'react';
import {
  Boxes, ChevronDown, Download, FileSpreadsheet, Loader2, Rows3,
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
  useCycleTimeDataInfinite,
  useCycleTimeLive,
} from '@/hooks/cycle_time/useCycleTimeData';
import { cycleTimeApi } from '@/lib/cycle_time/cycleTimeApi';
import { exportCycleTimeXlsx } from '@/lib/cycle_time/cycleTimeExport';

import CycleTimeAssemblyDrawer, { DrawerBuildRef } from './CycleTimeAssemblyDrawer';
import CycleTimeBreakdownB from './CycleTimeBreakdownB';
import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';
import CycleTimeTable from './CycleTimeTable';

type Source = 'db' | 'live';
type View = 'table' | 'breakdown';
const LIVE_PAGE_SIZE = 500;

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
  const [view, setView] = useState<View>('table');
  // Table-tab drawer: which assembly + which build (row) to pre-select.
  const [drawer, setDrawer] = useState<{ assembly: string; build: DrawerBuildRef } | null>(null);
  // With breakdown disabled (Data page) the table is the only view.
  const activeView: View = enableBreakdown ? view : 'table';

  // Active customer: route-locked (workcell page) or picked in the filter bar.
  const customer = lockedCustomer ?? (filters.customer || undefined);

  // DB mode — server-paginated pivoted rows, infinite scroll (first page fast).
  const dbQ = useCycleTimeDataInfinite(
    source === 'db'
      ? {
          customer,
          sub_workcenter: filters.sub_workcenter || undefined,
          assembly:       filters.assembly || undefined,
        }
      : { customer: undefined }, // skip fetch in live mode
  );

  // Live mode — infinite-scroll pages straight from IEDB.
  const liveQ = useCycleTimeLive(
    source === 'live' ? customer : undefined,
    LIVE_PAGE_SIZE,
    filters.sub_workcenter || undefined,
  );

  // Alias map: DB mode reads from /aliases endpoint; live mode uses the
  // server-built map embedded in each /live page response.
  const dbAliasMapQ = useCycleTimeAliases(source === 'db' ? customer : undefined);

  // Both modes are infinite queries with the same shape — pick the active one.
  const activeQ = source === 'live' ? liveQ : dbQ;
  const rows         = activeQ.rows;
  const aliasMap     = source === 'live' ? liveQ.aliasMap : dbAliasMapQ.data;
  const tableLoading = activeQ.isLoading;
  const tableError   = activeQ.error as Error | null;
  const totalKnown   = activeQ.totalCount;
  const hasMore      = Boolean(activeQ.hasNextPage);
  const fetchingMore = Boolean(activeQ.isFetchingNextPage);
  const onScrollEnd  = () => activeQ.fetchNextPage();

  // Lines available for the Line filter — derived from currently loaded rows.
  const lines = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => set.add(r.sub_workcenter));
    return Array.from(set).sort();
  }, [rows]);

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

      {/* ─── View tabs (omitted entirely when breakdown is disabled) ──── */}
      {enableBreakdown && (
        <div className="flex items-center gap-4 border-b border-border px-6">
          <TabButton active={view === 'table'}     onClick={() => setView('table')}     icon={Rows3} label="Table" />
          <TabButton active={view === 'breakdown'} onClick={() => setView('breakdown')} icon={Boxes} label="Breakdown" />
        </div>
      )}

      {/* ─── Filters (table tab only — Breakdown carries its own row) ──── */}
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
        {activeView === 'breakdown' ? (
          <CycleTimeBreakdownB customer={customer} />
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

/** Underline-style view tab. */
function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Rows3;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-emerald-500 text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
