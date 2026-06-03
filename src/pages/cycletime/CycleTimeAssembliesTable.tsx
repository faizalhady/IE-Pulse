/**
 * CycleTimeAssembliesTable.tsx
 * ────────────────────────────
 * Reusable "Cycle Time by Assembly" table — one accordion row per unique
 * assembly; expanding a row lazy-loads its per-build process tables.
 *
 * Used in two places:
 *   • CycleTimeAssemblies     — standalone page, customer picked in the filter bar.
 *   • CycleTimeExplorer       — the workcell page's Breakdown tab, with the
 *                               customer LOCKED from the route (so the filter bar
 *                               shows only the assembly search + line select).
 *
 * Pass `lockedCustomer` for the locked (workcell) mode; omit it for the picker.
 *
 * PERFORMANCE MODEL:
 *   • List comes from /assembly-list — ONE cheap grouped scan of raw per
 *     (customer, line). Search/sort/pagination are client-side (no refetch).
 *   • Per-build detail comes from /assembly-builds — raw scoped to ONE assembly,
 *     fetched lazily on expand (and reading the same file the list warmed).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCycleTimeAliases,
  useCycleTimeAssemblyBuilds,
  useCycleTimeAssemblyList,
} from '@/hooks/cycle_time/useCycleTimeData';
import {
  CycleTimeAliasMap,
  CycleTimeAssemblyListRow,
  cycleTimeApi,
  formatBuildDuration,
  formatCycleHMS,
  formatCycleSecondsLabel,
} from '@/lib/cycle_time/cycleTimeApi';
import { exportCycleTimeXlsx } from '@/lib/cycle_time/cycleTimeExport';
import { cn } from '@/lib/utils';

import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';

/** Workcenter display order + colours (SMT → TH → BE = the build flow). Shared
 *  shape with CycleTimeAssemblyDrawer. */
const WORKCENTERS: { code: string; label: string; rank: number; dot: string; text: string; chip: string }[] = [
  { code: 'SMT', label: 'SMT',          rank: 0, dot: 'bg-emerald-500', text: 'text-emerald-400', chip: 'border-emerald-500/30 bg-emerald-500/10' },
  { code: 'TH',  label: 'Through Hole', rank: 1, dot: 'bg-sky-500',     text: 'text-sky-400',     chip: 'border-sky-500/30 bg-sky-500/10' },
  { code: 'BE',  label: 'Backend',      rank: 2, dot: 'bg-violet-500',  text: 'text-violet-400',  chip: 'border-violet-500/30 bg-violet-500/10' },
];
const wcMeta = (code: string) =>
  WORKCENTERS.find((w) => w.code === code) ?? { code, label: code || 'Other', rank: 9, dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', chip: 'border-border bg-muted/30' };

/** One build = one (revision, line, workcenter), distilled to its process steps. */
interface Build {
  revision: string;
  line: string;
  workcenter: string;
  total: number;
  steps: { name: string; seconds: number }[];
}

// Collapsed-row grid — header and body share this template.
// chevron · # · Assembly · Family · Stages (identity footprint) · Builds
const GRID = '28px 44px minmax(220px,1.6fr) minmax(160px,1fr) 132px 72px';

// Sticky-header height (px) — the open row pins just below it.
const HEADER_H = 34;

/**
 * Numeric-cell typography — SCOPED TO THIS TABLE ONLY (no global font change).
 * Bolder + 1px larger, with unambiguous digits (0 never reads as 8). System
 * fonts → renders even if Google Fonts is blocked on the corporate network.
 */
const NUM = 'ct-num font-semibold text-[12px]';

const PAGE_SIZE = 50;

type SortKey = 'assembly' | 'builds';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

/** Which build stages (SMT/TH/BE) an assembly runs through — an identity
 *  footprint from the list endpoint, shown as badges (not a time value). */
function stagesOf(a: CycleTimeAssemblyListRow) {
  return WORKCENTERS.filter((w) =>
    w.code === 'SMT' ? a.has_smt : w.code === 'TH' ? a.has_th : a.has_be,
  );
}

interface Props {
  /** When set, the customer is fixed (workcell Breakdown tab): the filter bar
   *  hides its customer Select. When omitted, the customer is picked in the
   *  filter bar (standalone Assemblies page). */
  lockedCustomer?: string;
}

export default function CycleTimeAssembliesTable({ lockedCustomer }: Props) {
  const [filters] = useCycleTimeFilters();
  const customer = lockedCustomer ?? (filters.customer || undefined);
  const line = filters.sub_workcenter || undefined;
  const search = filters.assembly.trim().toLowerCase();

  // ── List source: ONE cheap grouped scan per (customer, line). Reads raw, so
  //    it also warms the file the lazy per-assembly detail reads.
  //    Search/sort/pagination are client-side, so they never trigger a refetch.
  const aggQ = useCycleTimeAssemblyList(customer, line);
  const { data: aliasMap } = useCycleTimeAliases(customer);

  const [sort, setSort] = useState<Sort>({ key: 'assembly', dir: 'asc' });
  const [open, setOpen] = useState<string | null>(null); // single open row
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Line options for the filter bar — from the alias map (complete, not paged).
  const lines = useMemo(() => {
    const set = new Set<string>();
    Object.values(aliasMap ?? {}).forEach((info) => info.lines.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [aliasMap]);

  const filtered = useMemo<CycleTimeAssemblyListRow[]>(() => {
    const all = aggQ.data ?? [];
    return search ? all.filter((a) => a.assembly.toLowerCase().includes(search)) : all;
  }, [aggQ.data, search]);

  const sorted = useMemo(() => {
    const val = (a: CycleTimeAssemblyListRow): string | number | null => {
      switch (sort.key) {
        case 'assembly': return a.assembly;
        case 'builds':   return a.builds;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  // Pagination (client-side over the list). Reset to page 1 when the set or
  // ordering changes so we never land on an out-of-range page.
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [customer, line, search, sort]);
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  const hasRows = (aggQ.data?.length ?? 0) > 0;
  const loading = aggQ.isLoading;

  function toggle(name: string) {
    setOpen((prev) => (prev === name ? null : name));
  }
  function onSort(key: SortKey) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'assembly' ? 'asc' : 'desc' }));
  }

  async function handleExportXlsx() {
    if (!customer || exporting) return;
    setExporting(true);
    try {
      const fullRows = await cycleTimeApi.data.list({ customer, sub_workcenter: line, assembly: filters.assembly || undefined });
      await exportCycleTimeXlsx({ rows: fullRows, customer, aliasMap });
    } catch (e) {
      console.error('XLSX export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── Filters (assembly + line; customer Select hidden when locked) ── */}
      <CycleTimeFilters
        availableLines={lines}
        lockedCustomer={lockedCustomer}
        rightSlot={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!hasRows || exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
                <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportXlsx} disabled={!hasRows || exporting}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* ─── Body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <AssemblyList
          rows={pageRows}
          customer={customer}
          line={line}
          aliasMap={aliasMap}
          loading={loading}
          error={(aggQ.error as Error | null) ?? null}
          hasCustomer={Boolean(customer)}
          open={open}
          onToggle={toggle}
          sort={sort}
          onSort={onSort}
          pagination={{
            page: safePage,
            pages,
            total: sorted.length,
            pageStart: sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1,
            pageEnd: Math.min(safePage * PAGE_SIZE, sorted.length),
            loading: aggQ.isFetching,
            onPage: setPage,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

interface Pagination {
  page: number;
  pages: number;
  total: number;
  pageStart: number;
  pageEnd: number;
  loading: boolean;
  onPage: (p: number) => void;
}

interface ListProps {
  rows: CycleTimeAssemblyListRow[];
  customer: string | undefined;
  line: string | undefined;
  aliasMap?: CycleTimeAliasMap;
  loading: boolean;
  error: Error | null;
  hasCustomer: boolean;
  open: string | null;
  onToggle: (name: string) => void;
  sort: Sort;
  onSort: (key: SortKey) => void;
  pagination: Pagination;
}

function AssemblyList({
  rows, customer, line, aliasMap, loading, error, hasCustomer, open, onToggle, sort, onSort, pagination,
}: ListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRowRef = useRef<HTMLDivElement>(null);

  // When a row opens, bring it to the top of the scroll area (just under the
  // sticky header) so the now-pinned summary row is immediately in view.
  useEffect(() => {
    if (!open) return;
    const sc = scrollRef.current;
    const row = openRowRef.current;
    if (!sc || !row) return;
    const top = row.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - HEADER_H;
    sc.scrollTo({ top, behavior: 'smooth' });
  }, [open]);

  if (error) {
    return <div className="flex h-96 items-center justify-center text-sm text-destructive">{error.message}</div>;
  }
  if (!hasCustomer) {
    return <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">Pick a workcell to see assemblies.</div>;
  }
  if (loading) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (pagination.total === 0) {
    return <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">No assemblies match these filters.</div>;
  }

  return (
    <div
      className="mx-4 my-3 flex flex-col overflow-hidden rounded-xl border border-border bg-card"
      style={{ height: 'calc(100vh - 220px)' }}
    >
      {/* Scrollable rows */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Sticky column header */}
        <div
          className="sticky top-0 z-20 grid items-center bg-muted text-[9px] font-semibold uppercase tracking-wider text-muted-foreground [&>div]:px-2"
          style={{ gridTemplateColumns: GRID, height: HEADER_H }}
        >
          <div />
          <div className="text-center">#</div>
          <SortHead label="Assembly" k="assembly" sort={sort} onSort={onSort} />
          <div>Family</div>
          <div>Stages</div>
          <SortHead label="Builds" k="builds" sort={sort} onSort={onSort} align="right" />
        </div>

        {rows.map((a, idx) => {
          const isOpen = open === a.assembly;
          const rowNo = (pagination.page - 1) * PAGE_SIZE + idx + 1;
          const stages = stagesOf(a);
          return (
            <div
              key={a.assembly}
              ref={isOpen ? openRowRef : undefined}
              className="border-b border-border last:border-0"
            >
              {/* Collapsed summary row. When open it pins to the top of the
                  scroll area (just under the column header) so a long expanded
                  panel can always be closed by clicking it again. */}
              <button
                type="button"
                onClick={() => onToggle(a.assembly)}
                className={cn(
                  'grid w-full items-center text-left text-[11px] transition-colors hover:bg-muted/40 [&>div]:px-2 [&>div]:py-2',
                  isOpen
                    ? 'sticky z-10 border-b border-border bg-background shadow-sm'
                    : 'bg-transparent',
                )}
                style={{ gridTemplateColumns: GRID, ...(isOpen ? { top: HEADER_H } : {}) }}
              >
                <div className="flex items-center justify-center text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(NUM, 'text-center text-muted-foreground')}>{rowNo}</div>
                <div className="ct-num min-w-0 truncate text-[12px] font-bold text-foreground" title={a.assembly}>{a.assembly}</div>
                <div className="min-w-0 truncate text-muted-foreground" title={a.family ?? undefined}>{a.family ?? '—'}</div>
                <div className="flex flex-wrap items-center gap-1">
                  {stages.length === 0
                    ? <span className="text-muted-foreground/50">—</span>
                    : stages.map((w) => (
                        <span
                          key={w.code}
                          title={w.label}
                          className={cn('rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-none', w.chip, w.text)}
                        >
                          {w.code}
                        </span>
                      ))}
                </div>
                <div className={cn(NUM, 'text-right text-muted-foreground')}>{a.builds}</div>
              </button>

              {/* Expanded panel — per-build tables, fetched lazily on open. */}
              {isOpen && (
                <div className="border-t border-border bg-muted/10 px-2 py-3">
                  <AssemblyDetail customer={customer} line={line} assembly={a.assembly} aliasMap={aliasMap} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Footer / page browser (mirrors the workcell table) ─────────── */}
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <span>
          {pagination.pageStart.toLocaleString()}–{pagination.pageEnd.toLocaleString()}{' '}
          <span className="text-muted-foreground/60">of {pagination.total.toLocaleString()}</span> assemblies
          {sort && <> · sorted by <span className="font-medium text-foreground">{sort.key.toUpperCase()}</span> {sort.dir}</>}
        </span>
        <div className="flex items-center gap-2">
          {pagination.loading && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
          <button
            type="button"
            onClick={() => pagination.onPage(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </button>
          <span className="tabular-nums">
            Page <span className="font-medium text-foreground">{pagination.page}</span> of {pagination.pages.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => pagination.onPage(Math.min(pagination.pages, pagination.page + 1))}
            disabled={pagination.page >= pagination.pages}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-40"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Lazily-loaded per-assembly detail — fetches the lightweight /assembly-builds
 * endpoint (raw, scoped to ONE assembly) only when its row is expanded, then
 * groups the long rows into builds (SMT → TH → BE), each rendered as its own
 * compact process table. This is what keeps the expand fast.
 */
function AssemblyDetail({
  customer, line, assembly, aliasMap,
}: { customer: string | undefined; line: string | undefined; assembly: string; aliasMap?: CycleTimeAliasMap }) {
  const q = useCycleTimeAssemblyBuilds(customer, assembly, line);

  const builds = useMemo<Build[]>(() => {
    const rows = q.data ?? [];
    if (rows.length === 0) return [];
    // Group long rows into builds — one per (revision, line, workcenter).
    const map = new Map<string, Build>();
    for (const r of rows) {
      const key = `${r.revision}|${r.sub_workcenter}|${r.workcenter}`;
      let b = map.get(key);
      if (!b) {
        b = { revision: r.revision, line: r.sub_workcenter, workcenter: String(r.workcenter ?? ''), total: 0, steps: [] };
        map.set(key, b);
      }
      if (typeof r.seconds === 'number' && !Number.isNaN(r.seconds)) {
        b.steps.push({ name: r.step, seconds: r.seconds });
        b.total += r.seconds;
      }
    }
    const out = Array.from(map.values()).filter((b) => b.steps.length > 0);
    out.forEach((b) => b.steps.sort((x, y) => y.seconds - x.seconds)); // bottleneck first
    // SMT → TH → BE, then longest first.
    out.sort((a, b) => {
      const r = wcMeta(a.workcenter).rank - wcMeta(b.workcenter).rank;
      return r !== 0 ? r : b.total - a.total;
    });
    return out;
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading builds…
      </div>
    );
  }
  if (q.error) {
    return <div className="py-3 text-[11px] text-destructive">Couldn’t load builds: {(q.error as Error).message}</div>;
  }
  if (builds.length === 0) {
    return <div className="py-3 text-[11px] text-muted-foreground">No per-process detail available for this assembly.</div>;
  }
  return (
    <div className="space-y-3">
      {builds.map((b, i) => (
        <BuildTable key={`${b.revision}|${b.line}|${i}`} build={b} aliasMap={aliasMap} />
      ))}
    </div>
  );
}

/** One build rendered as a compact table: process columns as header, cycle-time
 *  values beneath, with a running Total at the end. */
function BuildTable({ build, aliasMap }: { build: Build; aliasMap?: CycleTimeAliasMap }) {
  const wc = wcMeta(build.workcenter);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Build header strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold', wc.chip, wc.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', wc.dot)} /> {wc.label}
        </span>
        <span className="truncate text-[11px] font-medium text-foreground" title={build.line}>{build.line}</span>
        <span className="text-[10px] text-muted-foreground">rev {build.revision || '—'}</span>
        <span className="text-[10px] text-muted-foreground">{build.steps.length} steps</span>
        <span className={cn(NUM, 'ml-auto font-bold text-foreground')} title={formatCycleHMS(build.total)}>
          {formatBuildDuration(build.total)}
        </span>
      </div>

      {/* Process columns → values */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
              {build.steps.map((s) => {
                const info = aliasMap?.[s.name];
                const tip = info?.processes?.length ? `Alias: ${s.name}\nProcess: ${info.processes.join(', ')}` : s.name;
                return (
                  <th key={s.name} title={tip} className="whitespace-nowrap border-r border-border px-2.5 py-1.5 text-right font-semibold last:border-r-0">
                    {s.name}
                  </th>
                );
              })}
              <th className="whitespace-nowrap border-l border-border bg-muted/60 px-2.5 py-1.5 text-right font-semibold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {build.steps.map((s, i) => {
                const isMax = build.steps.every((o) => s.seconds >= o.seconds) && build.steps.length > 1;
                return (
                  <td
                    key={s.name}
                    title={formatCycleHMS(s.seconds)}
                    className={cn(
                      NUM,
                      'whitespace-nowrap border-r border-t border-border px-2.5 py-1.5 text-right last:border-r-0',
                      isMax ? 'font-bold text-amber-400' : 'text-foreground',
                      i % 2 ? 'bg-muted/10' : '',
                    )}
                  >
                    {formatCycleSecondsLabel(s.seconds)}
                  </td>
                );
              })}
              <td className={cn(NUM, 'whitespace-nowrap border-l border-t border-border bg-muted/40 px-2.5 py-1.5 text-right font-bold text-foreground')}>
                {formatCycleSecondsLabel(build.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHead({
  label, k, sort, onSort, align = 'left',
}: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort.key === k;
  return (
    <div
      onClick={() => onSort(k)}
      className={cn('flex cursor-pointer select-none items-center gap-1 hover:text-foreground', align === 'right' ? 'justify-end' : '')}
    >
      <span>{label}</span>
      <ChevronDown
        className={cn(
          'h-3 w-3 transition-all',
          active ? 'text-foreground' : 'opacity-30',
          active && sort.dir === 'asc' ? 'rotate-180' : '',
        )}
      />
    </div>
  );
}
