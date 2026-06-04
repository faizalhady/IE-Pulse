/**
 * CycleTimeAssemblyFlow.tsx
 * ─────────────────────────
 * "Flow" tab — shows each assembly's COMPLETE build as one continuous,
 * order-sequenced process flow that can cross multiple lines (sub_workcenters).
 *
 * Unlike the per-line "Assemblies" tab (CycleTimeAssembliesTable), a build here
 * is one routing = (revision, priority): steps are ordered by their physical
 * `step_order` and the line is shown per step, with a "line change → X" divider
 * wherever the unit jumps line. Priority 1 (the primary route) shows by default;
 * a "show alternate routes" toggle reveals priority 2+.
 *
 * Used (customer-locked) as the workcell page's Flow tab and (customer-picked)
 * as the standalone Flow page. Mirrors CycleTimeAssembliesTable's list shell
 * (client-side search/sort/pagination over the cheap /assembly-list scan) but
 * renders a different detail body.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCycleTimeAliases,
  useCycleTimeAssemblyBuilds,
  useCycleTimeAssemblyList,
} from '@/hooks/cycle_time/useCycleTimeData';
import {
  CycleTimeAliasMap,
  CycleTimeAssemblyBuildStep,
  CycleTimeAssemblyListRow,
  formatBuildDuration,
  formatCycleHMS,
  formatCycleSecondsLabel,
} from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';

import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';

/** Workcenter (stage) colours — used as a dot next to the line name. */
const WC_DOT: Record<string, string> = {
  SMT: 'bg-emerald-500',
  TH:  'bg-sky-500',
  BE:  'bg-violet-500',
};
const wcDot = (code: string) => WC_DOT[code] ?? 'bg-muted-foreground/40';

/** Compact numeric cell: integers as-is, decimals to 2 places, null → em-dash. */
const fmtVal = (v: number | null) =>
  v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2);

/** One ordered step in a routing flow. */
interface FlowStep {
  order: number;
  line: string;
  workcenter: string;
  step: string;
  /** Displayed cycle time = raw seconds × N (per IE convention). */
  seconds: number;
  cap: number | null;
  n: number | null;
  lct: number | null;
  mach: number | null;
  imt: number | null;
  hand: number | null;
  pb: number | null;
  hc: number | null;
}
/** One complete routing = (revision, priority). */
interface Routing {
  revision: string;
  priority: number;
  total: number;
  lines: number;        // distinct sub_workcenters crossed
  steps: FlowStep[];    // already sorted by order
}

// chevron · # · Assembly · Revisions · Stages
const GRID = '28px 44px minmax(220px,0.5fr) 100px minmax(160px,1fr)';
const HEADER_H = 34;
const NUM = 'ct-num font-semibold text-[12px]';
const PAGE_SIZE = 50;

type SortKey = 'assembly' | 'revisions';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

function stagesOf(a: CycleTimeAssemblyListRow) {
  const out: { code: string; label: string }[] = [];
  if (a.has_smt) out.push({ code: 'SMT', label: 'SMT' });
  if (a.has_th)  out.push({ code: 'TH',  label: 'Through Hole' });
  if (a.has_be)  out.push({ code: 'BE',  label: 'Backend' });
  return out;
}

interface Props {
  /** When set, the customer is fixed (workcell Flow tab); the filter bar hides
   *  its customer Select. Omit for the standalone Flow page. */
  lockedCustomer?: string;
}

export default function CycleTimeAssemblyFlow({ lockedCustomer }: Props) {
  const [filters] = useCycleTimeFilters();
  const customer = lockedCustomer ?? (filters.customer || undefined);
  const line = filters.sub_workcenter || undefined;
  const search = filters.assembly.trim().toLowerCase();

  const listQ = useCycleTimeAssemblyList(customer, line);
  const { data: aliasMap } = useCycleTimeAliases(customer);

  const [sort, setSort] = useState<Sort>({ key: 'assembly', dir: 'asc' });
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const lines = useMemo(() => {
    const set = new Set<string>();
    Object.values(aliasMap ?? {}).forEach((info) => info.lines.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [aliasMap]);

  const filtered = useMemo<CycleTimeAssemblyListRow[]>(() => {
    const all = listQ.data ?? [];
    return search ? all.filter((a) => a.assembly.toLowerCase().includes(search)) : all;
  }, [listQ.data, search]);

  const sorted = useMemo(() => {
    const val = (a: CycleTimeAssemblyListRow): string | number =>
      sort.key === 'assembly' ? a.assembly : a.revisions;
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [customer, line, search, sort]);
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  const loading = listQ.isLoading;

  function toggle(name: string) {
    setOpen((prev) => (prev === name ? null : name));
  }
  function onSort(key: SortKey) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'assembly' ? 'asc' : 'desc' }));
  }

  return (
    <div className="flex h-full flex-col">
      <CycleTimeFilters availableLines={lines} lockedCustomer={lockedCustomer} />

      <div className="flex-1 min-h-0">
        <FlowList
          rows={pageRows}
          customer={customer}
          line={line}
          aliasMap={aliasMap}
          loading={loading}
          error={(listQ.error as Error | null) ?? null}
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
            loading: listQ.isFetching,
            onPage: setPage,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

interface Pagination {
  page: number; pages: number; total: number;
  pageStart: number; pageEnd: number; loading: boolean;
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

function FlowList({
  rows, customer, line, aliasMap, loading, error, hasCustomer, open, onToggle, sort, onSort, pagination,
}: ListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRowRef = useRef<HTMLDivElement>(null);

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
    return <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">Pick a workcell to see assembly flows.</div>;
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
      style={{ height: 'calc(100vh - 180px)' }}
    >
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div
          className="sticky top-0 z-20 grid items-center bg-muted text-[9px] font-semibold uppercase tracking-wider text-muted-foreground [&>div]:px-2"
          style={{ gridTemplateColumns: GRID, height: HEADER_H }}
        >
          <div />
          <div className="text-center">#</div>
          <SortHead label="Assembly" k="assembly" sort={sort} onSort={onSort} />
          <SortHead label="Revisions" k="revisions" sort={sort} onSort={onSort} align="center" />
          <div className="text-right">Stages</div>
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
              <button
                type="button"
                onClick={() => onToggle(a.assembly)}
                className={cn(
                  'grid w-full items-center text-left text-[11px] transition-colors hover:bg-muted/40 [&>div]:px-2 [&>div]:py-2',
                  isOpen ? 'sticky z-10 border-b border-border bg-background shadow-sm' : 'bg-transparent',
                )}
                style={{ gridTemplateColumns: GRID, ...(isOpen ? { top: HEADER_H } : {}) }}
              >
                <div className="flex items-center justify-center text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(NUM, 'text-center text-muted-foreground')}>{rowNo}</div>
                <div className="ct-num min-w-0 truncate text-[12px] font-bold text-foreground" title={a.assembly}>{a.assembly}</div>
                <div className={cn(NUM, 'text-center text-muted-foreground')}>{a.revisions}</div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {stages.length === 0
                    ? <span className="text-muted-foreground/50">—</span>
                    : stages.map((w) => (
                        <span key={w.code} title={w.label} className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', wcDot(w.code))} />{w.code}
                        </span>
                      ))}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border bg-muted/10 px-2 py-3">
                  <FlowDetail customer={customer} line={line} assembly={a.assembly} aliasMap={aliasMap} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <span>
          {pagination.pageStart.toLocaleString()}–{pagination.pageEnd.toLocaleString()}{' '}
          <span className="text-muted-foreground/60">of {pagination.total.toLocaleString()}</span> assemblies
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
 * Lazily-loaded per-assembly flow detail. Groups /assembly-builds rows into
 * routings (revision, priority), each rendered as one order-sequenced flow.
 * Priority-1 shows by default; the toggle reveals alternates.
 */
function FlowDetail({
  customer, line, assembly, aliasMap,
}: { customer: string | undefined; line: string | undefined; assembly: string; aliasMap?: CycleTimeAliasMap }) {
  const q = useCycleTimeAssemblyBuilds(customer, assembly, line);

  const routings = useMemo<Routing[]>(() => {
    const rows = q.data ?? [];
    if (rows.length === 0) return [];
    const map = new Map<string, Routing>();
    for (const r of rows as CycleTimeAssemblyBuildStep[]) {
      if (typeof r.seconds !== 'number' || Number.isNaN(r.seconds)) continue;
      const key = `${r.revision}|${r.priority}`;
      let rt = map.get(key);
      if (!rt) {
        rt = { revision: r.revision, priority: r.priority, total: 0, lines: 0, steps: [] };
        map.set(key, rt);
      }
      // Cycle time per IE convention = raw seconds × N (N=0/null → ×1).
      const mult = typeof r.n === 'number' && r.n > 0 ? r.n : 1;
      const eff = r.seconds * mult;
      rt.steps.push({
        order: r.step_order ?? 0,
        line: r.sub_workcenter,
        workcenter: String(r.workcenter ?? ''),
        step: r.step,
        seconds: eff,
        cap: r.cap ?? null,
        n: r.n ?? null,
        lct: r.lct ?? null,
        mach: r.mach ?? null,
        imt: r.imt ?? null,
        hand: r.hand ?? null,
        pb: r.pb ?? null,
        hc: r.hc ?? null,
      });
      rt.total += eff;
    }
    const out = Array.from(map.values());
    out.forEach((rt) => {
      rt.steps.sort((a, b) => a.order - b.order);
      rt.lines = new Set(rt.steps.map((s) => s.line)).size;
    });
    // primary first, then by ascending priority, then by revision.
    out.sort((a, b) => a.priority - b.priority || a.revision.localeCompare(b.revision, undefined, { numeric: true }));
    return out;
  }, [q.data]);

  // Available builds = priority-1 routings (fallback: all), one per revision,
  // sorted latest-first via numeric-aware natural sort (revision formats vary by
  // customer: numeric for KEYSIGHT, alpha for ASP/Masimo, …).
  const pool = useMemo<Routing[]>(() => {
    const p1 = routings.filter((r) => r.priority === 1);
    return [...(p1.length ? p1 : routings)].sort(
      (a, b) => b.revision.localeCompare(a.revision, undefined, { numeric: true }),
    );
  }, [routings]);

  // Selected revision — defaults to the latest; resets when the pool changes.
  const [selectedRev, setSelectedRev] = useState<string>('');
  useEffect(() => {
    if (pool.length && !pool.some((r) => r.revision === selectedRev)) {
      setSelectedRev(pool[0].revision);
    }
  }, [pool, selectedRev]);

  const selected = useMemo<Routing | null>(
    () => pool.find((r) => r.revision === selectedRev) ?? pool[0] ?? null,
    [pool, selectedRev],
  );

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading flow…
      </div>
    );
  }
  if (q.error) {
    return <div className="py-3 text-[11px] text-destructive">Couldn’t load flow: {(q.error as Error).message}</div>;
  }
  if (!selected) {
    return <div className="py-3 text-[11px] text-muted-foreground">No process detail available for this assembly.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header: revision selector (left) · steps · lines · total (right) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5">
        {pool.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Revision</span>
            <Select value={selectedRev} onValueChange={setSelectedRev}>
              <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pool.map((r) => (
                  <SelectItem key={r.revision} value={r.revision}>rev {r.revision || '—'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">rev {selected.revision || '—'}</span>
        )}

        <div className="ml-auto flex items-center gap-x-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{selected.steps.length}</span> steps
          </span>
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{selected.lines}</span> {selected.lines === 1 ? 'line' : 'lines'}
          </span>
          <span className={cn(NUM, 'font-bold text-foreground')} title={formatCycleHMS(selected.total)}>
            {formatBuildDuration(selected.total)}
          </span>
        </div>
      </div>

      <RoutingFlow routing={selected} aliasMap={aliasMap} />
    </div>
  );
}

/** One routing rendered as a single continuous, order-sequenced table with a
 *  "line change → X" divider wherever the unit jumps line. */
function RoutingFlow({ routing, aliasMap }: { routing: Routing; aliasMap?: CycleTimeAliasMap }) {
  const maxStep = routing.steps.reduce((m, s) => Math.max(m, s.seconds), 0);

  return (
    /* Ordered step flow */
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
            <th className="w-12 px-2 py-1.5 text-right font-semibold">Ord</th>
            <th className="px-2 py-1.5 text-left font-semibold">Line</th>
            <th className="px-2 py-1.5 text-left font-semibold">Step</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Labour cycle time">LCT</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Machine time">MACH</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="IMT">IMT</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Hand time">HAND</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="PB">PB</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Headcount">HC</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Capacity">CAP</th>
            <th className="px-2 py-1.5 text-right font-semibold" title="Sample size">N</th>
            <th className="w-32 px-2 py-1.5 text-right font-semibold" title="Cycle time = raw × N">Cycle time</th>
          </tr>
        </thead>
        <tbody>
          {routing.steps.map((s, i) => {
            const prev = routing.steps[i - 1];
            const lineChanged = i > 0 && prev.line !== s.line;
            const barPct = maxStep > 0 ? (s.seconds / maxStep) * 100 : 0;
            const info = aliasMap?.[s.step];
            const tip = info?.processes?.length ? `Alias: ${s.step}\nProcess: ${info.processes.join(', ')}` : s.step;
            return (
              <Fragment key={`${s.order}-${s.step}-${i}`}>
                {lineChanged && (
                  <tr className="bg-muted/20">
                    <td colSpan={12} className="border-y border-dashed border-border px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3" /> line change →
                        <span className={cn('h-1.5 w-1.5 rounded-full', wcDot(s.workcenter))} />
                        <span className="text-foreground">{s.line}</span>
                      </span>
                    </td>
                  </tr>
                )}
                <tr className="border-t border-border">
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{s.order}</td>
                  <td className="max-w-[150px] truncate px-2 py-1.5 text-muted-foreground" title={s.line}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', wcDot(s.workcenter))} />
                      <span className="truncate">{s.line}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-foreground" title={tip}>{s.step}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.lct)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.mach)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.imt)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.hand)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.pb)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.hc)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.cap)}</td>
                  <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.n)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40">
                        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className={cn(NUM, 'w-16 text-right text-foreground')} title={formatCycleHMS(s.seconds)}>
                        {formatCycleSecondsLabel(s.seconds)}
                      </span>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHead({
  label, k, sort, onSort, align = 'left',
}: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; align?: 'left' | 'center' | 'right' }) {
  const active = sort.key === k;
  return (
    <div
      onClick={() => onSort(k)}
      className={cn(
        'flex cursor-pointer select-none items-center gap-1 hover:text-foreground',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}
    >
      <span>{label}</span>
      <ChevronDown className={cn('h-3 w-3 transition-all', active ? 'text-foreground' : 'opacity-30', active && sort.dir === 'asc' ? 'rotate-180' : '')} />
    </div>
  );
}
