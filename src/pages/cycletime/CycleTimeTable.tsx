/**
 * CycleTimeTable.tsx
 * ──────────────────
 * Pivoted Cycle Time table — Image 2 layout.
 *
 * Each row = one (assembly, revision, sub_workcenter). Metadata columns
 * (assembly, revision, sub_workcenter) are frozen on the left; process
 * columns scroll horizontally.
 *
 * Row virtualization via @tanstack/react-virtual — only ~visible rows are
 * rendered to the DOM, so 100k+ rows stay smooth.
 *
 * Optional infinite-scroll: when `onScrollEnd` is provided (live mode), we
 * fire it once the user is within ~10 rows of the bottom of the loaded set.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  CycleTimeAliasMap,
  CycleTimePivotedRow,
  formatCycleHMS,
  formatCycleSecondsLabel,
  processColumnsOf,
} from '@/lib/cycle_time/cycleTimeApi';

interface CycleTimeTableProps {
  rows: CycleTimePivotedRow[] | undefined;
  loading: boolean;
  error: Error | null;
  /** alias → underlying Process code(s). Drives the column-header tooltip. */
  aliasMap?: CycleTimeAliasMap;
  /** Fired when user scrolls near the bottom; live mode wires this to
   *  fetchNextPage. Pass undefined in DB mode. */
  onScrollEnd?: () => void;
  /** Tells the table there's still more data to fetch (live mode). */
  hasMore?: boolean;
  /** Tells the table a next-page fetch is in flight (live mode). */
  fetchingMore?: boolean;
  /** Optional totalCount banner (live mode shows "1,200 of 9,708 loaded"). */
  totalKnown?: number;
  /** Click a row → open the assembly drawer on that build. */
  onRowClick?: (row: CycleTimePivotedRow) => void;
  /** Classic prev/next pagination (DB mode). When set, shows page controls
   *  instead of the live-mode "load more". */
  pagination?: {
    page: number;
    pages: number;
    loading: boolean;
    onPage: (page: number) => void;
  };
}

interface MetaCol {
  key: keyof CycleTimePivotedRow;
  label: string;
  sticky?: boolean;
  width?: string;
  numeric?: boolean;
}
const META_COLS: MetaCol[] = [
  { key: 'assembly',        label: 'Assembly', sticky: true, width: 'min-w-[180px]' },
  { key: 'revision',        label: 'Rev',                    width: 'w-12 min-w-12' },
  { key: 'sub_workcenter',  label: 'Line',                   width: 'min-w-[180px]' },
  { key: 'workcenter_type', label: 'WC Type',                width: 'min-w-[100px]' },
];

const ROW_HEIGHT = 28; // px — matches Tailwind h-7
const HEADER_MIN_HEIGHT = 38; // px — expands when an alias maps to multiple processes
const NUM_COL_W = 44; // px — leading sticky "#" column

type SortState = { col: string; dir: 'asc' | 'desc' } | null;

function compareBy(a: CycleTimePivotedRow, b: CycleTimePivotedRow, col: string, dir: 'asc' | 'desc', numeric: boolean) {
  const av = a[col];
  const bv = b[col];
  const aIsNull = av == null || (typeof av === 'number' && Number.isNaN(av));
  const bIsNull = bv == null || (typeof bv === 'number' && Number.isNaN(bv));
  if (aIsNull && bIsNull) return 0;
  if (aIsNull) return 1;
  if (bIsNull) return -1;
  let cmp: number;
  if (numeric) cmp = (av as number) - (bv as number);
  else         cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}

export default function CycleTimeTable({
  rows, loading, error, aliasMap,
  onScrollEnd, hasMore, fetchingMore, totalKnown, onRowClick, pagination,
}: CycleTimeTableProps) {
  const [sort, setSort] = useState<SortState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const processCols = useMemo(() => (rows ? processColumnsOf(rows) : []), [rows]);

  const displayRows = useMemo(() => {
    if (!rows) return [] as CycleTimePivotedRow[];
    if (!sort) return rows;
    const metaCol = META_COLS.find((c) => c.key === sort.col);
    const numeric = metaCol ? !!metaCol.numeric : processCols.includes(sort.col);
    return [...rows].sort((a, b) => compareBy(a, b, sort.col, sort.dir, numeric));
  }, [rows, sort, processCols]);

  // ─── Virtualizer ───────────────────────────────────────────────────────────
  const virt = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // ─── Infinite scroll trigger (live mode) ───────────────────────────────────
  useEffect(() => {
    if (!onScrollEnd || !hasMore || fetchingMore || displayRows.length === 0) return;
    const items = virt.getVirtualItems();
    if (items.length === 0) return;
    const last = items[items.length - 1];
    // Fire when the last rendered item is within 10 of the loaded tail.
    if (last.index >= displayRows.length - 10) onScrollEnd();
  }, [virt, displayRows.length, hasMore, fetchingMore, onScrollEnd]);

  // Jump back to the top when the page changes (DB pagination).
  useEffect(() => {
    if (pagination) scrollRef.current?.scrollTo({ top: 0 });
  }, [pagination?.page]);

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-destructive">
        {error.message}
      </div>
    );
  }
  if (loading && (!rows || rows.length === 0)) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        Pick a customer to see cycle times.
      </div>
    );
  }

  const onHeaderClick = (col: string) => {
    setSort((cur) => {
      if (!cur || cur.col !== col) return { col, dir: 'asc' };
      if (cur.dir === 'asc') return { col, dir: 'desc' };
      return null;
    });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (!sort || sort.col !== col) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30 group-hover:opacity-60 transition-opacity" />;
    }
    return sort.dir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-foreground" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-foreground" />;
  };

  const totalSize = virt.getTotalSize();
  const virtualItems = virt.getVirtualItems();

  // Column widths for the grid layout (must match header & body).
  // We use CSS grid template columns to avoid <table> + virtualization quirks.
  const gridTemplate =
    `${NUM_COL_W}px ` +
    META_COLS.map((c) => {
      if (c.width?.includes('w-12'))      return '52px';
      if (c.width?.includes('w-16'))      return '60px';
      const m = c.width?.match(/min-w-\[(\d+)px\]/);
      return m ? `${m[1]}px` : 'minmax(120px, 1fr)';
    }).concat(processCols.map(() => '90px')).join(' ');

  return (
    <div className="mx-4 my-3 rounded-xl border border-border bg-card overflow-hidden transition-colors duration-200 flex flex-col"
         style={{ height: 'calc(100vh - 220px)' }}>
      {loading && (
        <div className="pointer-events-none absolute right-7 top-7 z-30 flex items-center gap-2 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" /> Refreshing…
        </div>
      )}

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <div
          className="grid text-[11px] [&>div]:border-r [&>div]:border-border [&>div]:px-2 [&>div]:py-1"
          style={{ gridTemplateColumns: gridTemplate, width: 'max-content', minWidth: '100%' }}
        >
          {/* ─── Header ──────────────────────────────────────────────── */}
          {/* "#" header — sticky top + left. */}
          <div
            className="select-none bg-muted text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 z-30 flex items-center justify-center"
            style={{ minHeight: HEADER_MIN_HEIGHT, gridRow: 1, gridColumn: 1, left: 0 }}
          >
            #
          </div>
          {META_COLS.map((c, idx) => (
            <div
              key={c.key as string}
              onClick={() => onHeaderClick(c.key as string)}
              title={c.label}
              className={`group cursor-pointer select-none bg-muted hover:bg-accent text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 flex items-center overflow-hidden ${
                c.sticky ? 'z-30' : 'z-20'
              }`}
              style={{ minHeight: HEADER_MIN_HEIGHT, gridRow: 1, gridColumn: idx + 2, ...(c.sticky ? { left: NUM_COL_W } : {}) }}
            >
              <span className="truncate">{c.label}</span>
              <SortIcon col={c.key as string} />
            </div>
          ))}
          {processCols.map((p, idx) => {
            // `p` is the column key from the parquet — that's the ALIAS
            // (or the Process code, when alias was null and ingest fell back).
            // Header shows the underlying Process code(s); tooltip shows the Alias.
            const info = aliasMap?.[p];
            // Process labels: one per line when an alias maps to multiple processes.
            const labels = info && info.processes.length ? info.processes : [p];
            const tooltip = info && info.processes.length
              ? `Alias: ${p}\nProcess${info.processes.length > 1 ? 'es' : ''}: ${info.processes.join(', ')}`
              : p;
            return (
              <div
                key={p}
                onClick={() => onHeaderClick(p)}
                title={tooltip}
                className="group cursor-pointer select-none bg-muted hover:bg-accent text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 z-20 text-right font-mono flex items-center justify-end gap-1 overflow-hidden"
                style={{ minHeight: HEADER_MIN_HEIGHT, gridRow: 1, gridColumn: META_COLS.length + idx + 2 }}
              >
                <div className="flex flex-col items-end leading-tight min-w-0 flex-1">
                  {labels.map((label, i) => (
                    <span key={i} className="truncate block max-w-full">
                      {label}
                    </span>
                  ))}
                </div>
                <SortIcon col={p} />
              </div>
            );
          })}

          {/* ─── Body: virtual rows ──────────────────────────────────── */}
          {/* Spacer to give the grid the right total scroll height. */}
          <div
            style={{
              gridColumn: `1 / span ${META_COLS.length + processCols.length + 1}`,
              gridRow: 2,
              height: totalSize,
              position: 'relative',
            }}
          >
            {/* Per-row absolute-positioned wrappers inside the spacer.
                Each row is itself a sub-grid matching the column template. */}
            {virtualItems.map((vi) => {
              const row = displayRows[vi.index];
              return (
                <div
                  key={`${row.assembly}-${row.revision}-${row.sub_workcenter}-${vi.index}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`absolute left-0 right-0 grid hover:bg-muted/40 group [&>div]:border-r [&>div]:border-b [&>div]:border-border [&>div]:px-2 [&>div]:py-1 [&>div]:overflow-hidden [&>div]:text-ellipsis [&>div]:whitespace-nowrap ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: vi.size,
                    gridTemplateColumns: gridTemplate,
                    width: 'max-content',
                    minWidth: '100%',
                  }}
                >
                  {/* "#" — sticky row number. */}
                  <div
                    className="bg-card flex items-center justify-center sticky z-10 tabular-nums text-muted-foreground group-hover:bg-muted"
                    style={{ left: 0 }}
                  >
                    {vi.index + 1}
                  </div>
                  {META_COLS.map((c) => {
                    const val = (row[c.key] as string | null) ?? '—';
                    return (
                      <div
                        key={c.key as string}
                        title={val}
                        className={`bg-card flex items-center ${
                          c.sticky ? 'sticky z-10 font-medium group-hover:bg-muted' : ''
                        }`}
                        style={c.sticky ? { left: NUM_COL_W } : undefined}
                      >
                        {val}
                      </div>
                    );
                  })}
                  {processCols.map((p) => {
                    const v = row[p];
                    const num = typeof v === 'number' ? v : null;
                    return (
                      <div
                        key={p}
                        title={num != null ? formatCycleHMS(num) : undefined}
                        className={`text-right font-mono tabular-nums flex items-center justify-end ${
                          num == null ? 'text-muted-foreground/40' : ''
                        }`}
                      >
                        {formatCycleSecondsLabel(num)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <div className="border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>
          {displayRows.length.toLocaleString()}
          {totalKnown != null && totalKnown > displayRows.length && (
            <> <span className="text-muted-foreground/60">of {totalKnown.toLocaleString()}</span></>
          )}{' '}
          rows · {processCols.length} process columns
          {sort && <> · sorted by <span className="font-medium text-foreground">{sort.col}</span> {sort.dir}</>}
        </span>
        {pagination ? (
          <div className="flex items-center gap-2">
            {pagination.loading && <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />}
            <button
              type="button"
              onClick={() => pagination.onPage(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1 || pagination.loading}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span className="tabular-nums">
              Page <span className="font-medium text-foreground">{pagination.page}</span> of {pagination.pages.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => pagination.onPage(Math.min(pagination.pages, pagination.page + 1))}
              disabled={pagination.page >= pagination.pages || pagination.loading}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        ) : fetchingMore ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading more…
          </span>
        ) : hasMore && onScrollEnd ? (
          <button
            type="button"
            onClick={() => onScrollEnd()}
            className="rounded-md border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
