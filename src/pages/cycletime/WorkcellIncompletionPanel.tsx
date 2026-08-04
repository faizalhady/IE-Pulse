/**
 * WorkcellIncompletionPanel.tsx
 * ─────────────────────────────
 * Per-workcell incompletion content: assemblies ranked by units built (24 mo,
 * from the eBuild/MES mart), each badged has-data / no-data for cycle time.
 * A high runner with NO cycle-time data is the real problem — it floats to top.
 *
 * Reused by both the standalone Incompletion Report detail page and the
 * "Report" tab on the Cycle Time workcell page — so the content lives here once.
 *
 * Badge join is by normalised assembly name (MES SMT_Assembly ↔ IEDB
 * AssemblyName). Fast approach — ~73% match; unmatched names are treated as
 * "has data" (they're absent from the no-data set).
 */

import { SortHeader } from '@/components/shared/SortHeader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCycleTimeAssemblyCatalog, useCycleTimeCompletion, useCycleTimeRunners } from '@/hooks/cycle_time/useCycleTimeData';
import { useSortable } from '@/hooks/shared/useSortable';
import type { CompletionModel, CycleTimeRunner } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Columns2, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CompletionBadge } from './CompletionBadge';
import { RouteComparisonDrawer } from './RouteComparisonDrawer';
import { useCycleTimeFilters } from './CycleTimeFilters';

/** Completion lookup key — normalise customer (runner is UPPERCASE, completion is config-name). */
const compKey = (customer: string, assembly: string) =>
  customer.toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + assembly;

const TOP_N = 50;
const GRID = '2.5rem minmax(10rem,1fr) 6.5rem 4.5rem 7rem 4rem 4rem 7rem';

const lbrTone = (lbr: number) =>
  lbr >= 85 ? 'text-emerald-600' : lbr >= 70 ? 'text-amber-600' : 'text-red-500';

type RunnerMode = 'historical' | 'projection' | 'planner';
const MODE_LABEL: Record<RunnerMode, string> = {
  historical: 'Historical', projection: 'Projection', planner: 'Planner Demand',
};

type DetailSortKey = 'assembly' | 'units' | 'jobs' | 'last' | 'data';
const detailColumns = (mode: RunnerMode): { label: string; key?: DetailSortKey }[] => [
  { label: '#' },
  { label: 'Assembly', key: 'assembly' },
  { label: mode === 'historical' ? 'Units (24mo)' : 'Demand', key: 'units' },
  { label: 'Jobs', key: 'jobs' },
  { label: mode === 'historical' ? 'Last built' : 'Planned', key: 'last' },
  { label: 'LBR' },
  { label: 'IPK' },
  { label: 'Cycle-time data', key: 'data' },
];

/** Whether a runner has cycle-time data (ground truth = assembly_summary). */
type DataStatus = 'has' | 'no';
/** Row = a runner + its data status. */
type Row = CycleTimeRunner & { status: DataStatus };

const DETAIL_ACCESSORS: Record<DetailSortKey, (r: Row) => string | number | null> = {
  assembly: (r) => r.assembly,
  units: (r) => r.units,
  jobs: (r) => r.jobs,
  last: (r) => r.first_start ?? r.last_completed, // demand modes sort by planned start
  data: (r) => (r.status === 'has' ? 1 : 0),
};

const BADGE: Record<DataStatus, { label: string; cls: string; dot: string }> = {
  has: { label: 'Has data', cls: 'bg-emerald-500/15 text-emerald-600', dot: 'bg-emerald-500' },
  no:  { label: 'No data',  cls: 'bg-red-500/15 text-red-600',         dot: 'bg-red-500' },
};

type DataFilter = 'all' | DataStatus;

const norm = (s: string | null | undefined) => String(s ?? '').trim().toUpperCase();

/** Filter dropdown option — checkmark + optional colour dot + label (matches the
 *  Flow tab's SMT/TH/BE selector). */
function StatusOption({ label, dot, selected, onClick }: { label: string; dot?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <Check className={cn('h-4 w-4 flex-shrink-0 text-emerald-500', selected ? 'opacity-100' : 'opacity-0')} />
      {dot ? <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dot)} /> : <span className="w-2 flex-shrink-0" />}
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

export default function WorkcellIncompletionPanel({ customer }: { customer: string }) {
  const [mode, setMode] = useState<RunnerMode>('planner');
  const isDemand = mode !== 'historical';
  const columns = detailColumns(mode);
  const md = (iso: string | null | undefined) => (iso ? iso.slice(5, 10) : '—'); // MM-DD

  const { data: runners, isLoading: runnersLoading, isError: runnersError } = useCycleTimeRunners(customer, mode);
  const { data: catalog, isLoading: catalogLoading } = useCycleTimeAssemblyCatalog(customer);

  // Completion status (5-state) overlay — one global fetch, keyed by customer+assembly.
  const completion = useCycleTimeCompletion();
  const compMap = useMemo(() => {
    const m = new Map<string, CompletionModel>();
    for (const md of completion.data?.models ?? []) m.set(compKey(md.customer, md.assembly), md);
    return m;
  }, [completion.data]);
  const [compare, setCompare] = useState<{ customer: string; assembly: string; tab: 'route' | 'lbr' | 'ipk' } | null>(null);

  // Assemblies we have cycle-time data for (normalised) — ground truth from
  // assembly_summary (same source as the Cycle Time tab).
  const withDataSet = useMemo(
    () => new Set((catalog?.with_data ?? []).map(norm)),
    [catalog],
  );

  const rows = useMemo<Row[]>(
    () => (runners?.runners ?? []).map((r) => ({
      ...r,
      status: (withDataSet.has(norm(r.assembly)) ? 'has' : 'no') as DataStatus,
    })),
    [runners, withDataSet],
  );

  // Assembly search — shared URL filter (?assembly=), the SAME source the Flow
  // tab reads, so clearing it here also clears it there (single source of truth).
  // Pre-filled from a runner-row click on the Plant Runner dashboard.
  const [filters, setFilters] = useCycleTimeFilters();
  const search = filters.assembly;
  const setSearch = (v: string) => setFilters({ assembly: v });
  const q = norm(search);

  // Badge filter (All / Has data / No data) + assembly search, applied before Top-50.
  const [dataFilter, setDataFilter] = useState<DataFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filtered = useMemo(() => {
    let f = dataFilter === 'all' ? rows : rows.filter((r) => r.status === dataFilter);
    if (q) f = f.filter((r) => norm(r.assembly).includes(q));
    return f;
  }, [rows, dataFilter, q]);

  // Top-50 vs all toggle — "top" always means top by units built, regardless of
  // the sort column. A search overrides the cap so the matched model always shows.
  const [showAll, setShowAll] = useState(false);
  const shown = useMemo(
    () => (showAll || q ? filtered : [...filtered].sort((a, b) => b.units - a.units).slice(0, TOP_N)),
    [filtered, showAll, q],
  );

  const { sorted, sort, toggle } = useSortable(shown, DETAIL_ACCESSORS, { key: 'units', dir: 'desc' });

  const loading = runnersLoading || catalogLoading;
  // Completion-status breakdown (new statuses) over this workcell's runners.
  const statusCounts = useMemo(() => {
    const c = { complete: 0, incomplete: 0, no_data: 0, unverified: 0, na: 0, pending: 0 };
    for (const r of rows) {
      const st = compMap.get(compKey(customer, r.assembly))?.status;
      const b = !st ? 'pending' : st === 'unavailable' ? 'no_data' : st === 'no_data' ? 'incomplete'
        : st === 'non_mes' ? 'na' : st;
      if (b in c) c[b as keyof typeof c]++; else c.pending++;
    }
    return c;
  }, [rows, compMap, customer]);
  const totalRows = rows.length;
  const sPct = (n: number) => (totalRows ? Math.round((n / totalRows) * 100) : 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Historical / Projection / Planner Demand toggle */}
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(['planner', 'historical'] as RunnerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                  mode === m ? 'bg-emerald-500/15 text-emerald-600' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Assembly search (pre-filled from a runner-row click) */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assembly…"
              className="h-8 w-[190px] rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Cycle-time data filter (All / Has data / No data) */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-[150px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {dataFilter === 'all' ? (
                    <span className="text-muted-foreground">Data status</span>
                  ) : (
                    <>
                      <span className={cn('h-2 w-2 rounded-full', BADGE[dataFilter].dot)} />
                      {BADGE[dataFilter].label}
                    </>
                  )}
                </span>
                <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[150px] p-1" align="start">
              <StatusOption label="Default" selected={dataFilter === 'all'} onClick={() => { setDataFilter('all'); setFilterOpen(false); }} />
              <div className="my-1 h-px bg-border" />
              {(['has', 'no'] as const).map((s) => (
                <StatusOption key={s} label={BADGE[s].label} dot={BADGE[s].dot} selected={dataFilter === s} onClick={() => { setDataFilter(s); setFilterOpen(false); }} />
              ))}
            </PopoverContent>
          </Popover>

          {/* Top-50 / All toggle */}
          {filtered.length > TOP_N && (
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              {([['top', `Top ${TOP_N}`, false], ['all', `All (${filtered.length})`, true]] as const).map(([id, label, val]) => (
                <button
                  key={id}
                  onClick={() => setShowAll(val)}
                  className={cn(
                    'px-3 py-1.5 transition-colors',
                    showAll === val ? 'bg-emerald-500/15 text-emerald-600' : 'text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="ml-auto text-xs text-muted-foreground">
          {mode === 'historical' ? 'Assemblies ranked by units built (24 mo)'
            : mode === 'projection' ? 'Assemblies ranked by MES demand (next ~4 wk)'
            : "Assemblies ranked by planners' demand (next ~13 wk)"}{' '}
          {rows.length > 0 && (
            <>
              {' · '}<span className="font-medium text-emerald-600">{statusCounts.complete} ({sPct(statusCounts.complete)}%) complete</span>
              {' · '}<span className="font-medium text-amber-600">{statusCounts.incomplete} ({sPct(statusCounts.incomplete)}%) incomplete</span>
              {' · '}<span className="font-medium text-red-500">{statusCounts.no_data} ({sPct(statusCounts.no_data)}%) no data</span>
              {statusCounts.unverified > 0 && <>{' · '}<span className="font-medium text-muted-foreground">{statusCounts.unverified} unverified</span></>}
              {statusCounts.na > 0 && <>{' · '}<span className="font-medium text-muted-foreground">{statusCounts.na} N/A</span></>}
            </>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="grid bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID }}
        >
          {columns.map((col, i) =>
            col.key ? (
              <SortHeader
                key={i}
                label={col.label}
                active={sort?.key === col.key}
                dir={sort?.dir}
                onClick={() => toggle(col.key!)}
                className="px-3"
              />
            ) : (
              <div key={i} className="px-3 py-2.5">{col.label}</div>
            ),
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : runnersError ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-1">
            <span className="text-red-500">Runner data not available.</span>
            <span>Build the mart: POST /api/ebuild/refresh</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {mode === 'historical'
              ? 'No build history for this workcell in the last 24 months.'
              : `No ${MODE_LABEL[mode].toLowerCase()} data available for this workcell.`}
          </div>
        ) : (
          sorted.map((r, i) => (
            <div
              key={`${r.assembly}-${i}`}
              className={cn(
                'grid items-center h-12 border-b border-border last:border-0 hover:bg-muted/40',
                r.status !== 'has' && r.units > 0 && 'bg-red-500/5',
              )}
              style={{ gridTemplateColumns: GRID }}
            >
              <div className="px-3 text-xs text-muted-foreground tabular-nums">{i + 1}</div>
              <div className="px-3 text-[13px] font-medium text-foreground truncate">{r.assembly}</div>
              <div className="px-3 text-sm ct-num font-semibold tabular-nums text-foreground">{r.units.toLocaleString()}</div>
              <div className="px-3 text-xs text-muted-foreground tabular-nums">{r.jobs.toLocaleString()}</div>
              <div
                className="px-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap"
                title={isDemand ? `Demand starts ${fmtDate(r.first_start ?? null)} · due done ${fmtDate(r.planned_finish ?? null)}` : undefined}
              >
                {isDemand ? `${md(r.first_start)} → ${md(r.planned_finish)}` : fmtDate(r.last_completed)}
              </div>
              {/* LBR + IPK — reliable only for complete models; click opens the breakdown drawer */}
              {(() => {
                const comp = compMap.get(compKey(customer, r.assembly));
                const lbrShow = comp?.lbr != null;                 // any model with CT data (complete or partial)
                const ipkShow = comp?.ipk_trolleys != null;
                return (
                  <>
                    <div className="px-3">
                      {comp ? (
                        <button type="button" onClick={() => setCompare({ customer, assembly: r.assembly, tab: 'lbr' })}
                          className={cn('text-xs tabular-nums underline-offset-2 hover:underline decoration-dotted', lbrShow ? lbrTone(comp.lbr!) : 'text-muted-foreground')}>
                          {lbrShow ? `${comp.lbr}%` : '—'}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                    <div className="px-3">
                      {comp ? (
                        <button type="button" onClick={() => setCompare({ customer, assembly: r.assembly, tab: 'ipk' })}
                          className="text-xs tabular-nums text-foreground underline-offset-2 hover:underline decoration-dotted">
                          {ipkShow ? comp.ipk_trolleys : '—'}
                        </button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </>
                );
              })()}
              <div className="flex items-center gap-1.5 px-3">
                {(() => {
                  const comp = compMap.get(compKey(customer, r.assembly));
                  if (!comp) {
                    // not computed yet (completion mart still rebuilding) — pending, not the old flag
                    return <span className="text-xs text-muted-foreground" title="Completion not computed yet">—</span>;
                  }
                  return (
                    <>
                      <CompletionBadge status={comp.status} />
                      <button
                        type="button"
                        title="Open route / LBR / IPK breakdown"
                        onClick={() => setCompare({ customer, assembly: r.assembly, tab: 'route' })}
                        className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-emerald-600"
                      >
                        <Columns2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>

      {compare && (
        <RouteComparisonDrawer
          customer={compare.customer}
          assembly={compare.assembly}
          tab={compare.tab}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}
