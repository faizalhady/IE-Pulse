/**
 * CycleTimeHome.tsx
 * ─────────────────
 * Cycle Time module landing page.
 *
 * Two data sources, toggleable in the header:
 *   DB    — fast read from local parquet mart (default)
 *   Live  — paginated proxy directly to IEDB, infinite scroll
 */

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown, Clock, Database, Download, FileSpreadsheet,
  LayoutGrid, Loader2, Rows3, Wifi,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCycleTimeAliases,
  useCycleTimeData,
  useCycleTimeLive,
  useInvalidateOnRefreshComplete,
} from '@/hooks/cycle_time/useCycleTimeData';
import { exportCycleTimeXlsx } from '@/lib/cycle_time/cycleTimeExport';

import CycleTimeBreakdown from './CycleTimeBreakdown';
import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';
import CycleTimeTable from './CycleTimeTable';

type Source = 'db' | 'live';
type View = 'table' | 'breakdown';
const LIVE_PAGE_SIZE = 500;

export default function CycleTimeHome() {
  useInvalidateOnRefreshComplete();

  const [params, setParams] = useSearchParams();
  const source: Source = (params.get('source') as Source) === 'live' ? 'live' : 'db';
  const setSource = (next: Source) => {
    const out = new URLSearchParams(params);
    if (next === 'db') out.delete('source'); else out.set('source', next);
    setParams(out, { replace: true });
  };

  const [filters, setFilters] = useCycleTimeFilters();
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<View>('table');

  // DB mode — full pivoted dataset for the picked customer (cached).
  const dbQ = useCycleTimeData(
    source === 'db'
      ? {
          customer:       filters.customer || undefined,
          sub_workcenter: filters.sub_workcenter || undefined,
          assembly:       filters.assembly || undefined,
        }
      : { customer: undefined }, // skip fetch in live mode
  );

  // Live mode — infinite-scroll pages straight from IEDB.
  const liveQ = useCycleTimeLive(
    source === 'live' ? filters.customer || undefined : undefined,
    LIVE_PAGE_SIZE,
    filters.sub_workcenter || undefined,
  );

  // Alias map: DB mode reads from /aliases endpoint; live mode uses the
  // server-built map embedded in each /live page response.
  const dbAliasMapQ = useCycleTimeAliases(
    source === 'db' ? filters.customer || undefined : undefined,
  );

  // Unified view-model for the table.
  const rows         = source === 'live' ? liveQ.rows     : dbQ.data;
  const aliasMap     = source === 'live' ? liveQ.aliasMap : dbAliasMapQ.data;
  const tableLoading = source === 'live' ? liveQ.isLoading : dbQ.isFetching;
  const tableError   = (source === 'live' ? liveQ.error    : dbQ.error) as Error | null;
  const totalKnown   = source === 'live' ? liveQ.totalCount : undefined;
  const hasMore      = source === 'live' ? Boolean(liveQ.hasNextPage)       : false;
  const fetchingMore = source === 'live' ? Boolean(liveQ.isFetchingNextPage) : false;
  const onScrollEnd  = source === 'live' ? () => liveQ.fetchNextPage()       : undefined;

  // Lines available for the Line filter — derived from currently loaded rows.
  const lines = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => set.add(r.sub_workcenter));
    return Array.from(set).sort();
  }, [rows]);

  const hasRows = (rows?.length ?? 0) > 0;

  async function handleExportXlsx() {
    if (!hasRows || exporting) return;
    setExporting(true);
    try {
      await exportCycleTimeXlsx({
        rows: rows ?? [],
        customer: filters.customer,
        aliasMap: aliasMap,
      });
    } catch (e) {
      console.error('XLSX export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5 text-emerald-500" /> Cycle Time
        </h1>

        <div className="flex items-center gap-3">
          {/* DB|Live + Download are table-only controls. */}
          {view === 'table' && (<>
          {/* Source toggle */}
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSource('db')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 font-medium transition-colors ${
                source === 'db'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Read from the local parquet mart (fast, snapshot)"
            >
              <Database className="h-3 w-3" /> DB
            </button>
            <button
              type="button"
              onClick={() => setSource('live')}
              className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 font-medium transition-colors ${
                source === 'live'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Live proxy to IEDB (always-fresh, paginated)"
            >
              <Wifi className="h-3 w-3" /> Live
            </button>
          </div>

          {/* Download */}
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
          </>)}
        </div>
      </div>

      {/* ─── View tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-b border-border px-6">
        <TabButton active={view === 'table'}     onClick={() => setView('table')}     icon={Rows3}      label="Table" />
        <TabButton active={view === 'breakdown'} onClick={() => setView('breakdown')} icon={LayoutGrid} label="Breakdown" />
      </div>

      {/* ─── Filters (shared customer selector) ─────────────────────── */}
      <CycleTimeFilters availableLines={lines} rowCount={rows?.length ?? 0} />

      {/* ─── Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {view === 'breakdown' ? (
          <CycleTimeBreakdown
            customer={filters.customer || undefined}
            onOpenAssembly={(assembly, line) => {
              setFilters({ assembly, sub_workcenter: line });
              setView('table');
            }}
          />
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
          />
        )}
      </div>
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
