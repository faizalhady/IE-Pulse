/**
 * CycleTimeAssemblyFlow.tsx
 * ─────────────────────────
 * "Flow" tab — shows each assembly's COMPLETE build as one continuous,
 * order-sequenced process flow that can cross multiple lines (sub_workcenters).
 *
 * A build here is one routing = (revision, priority). The expanded view shows
 * the latest revision's priority-1 routing as collapsible per-line tables
 * (collapsed by default), ordered by each line's first step so the line sequence
 * mirrors the physical flow. A revision dropdown switches revisions.
 *
 * Used (customer-locked) as the workcell page's Flow tab and (customer-picked)
 * as the standalone Flow page. Mirrors CycleTimeAssembliesTable's list shell
 * (client-side search/sort/pagination over the cheap /assembly-list scan) but
 * renders a different detail body.
 */

import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, Copy, Download, Loader2, Rows3,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
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

import { exportFlowMetricsXlsx } from '@/lib/cycle_time/cycleTimeExport';
import CycleTimeFilters, { useCycleTimeFilters } from './CycleTimeFilters';

/** Workcenter (stage) colours — used as a dot next to the line name. */
const WC_DOT: Record<string, string> = {
  SMT: 'bg-emerald-500',
  TH: 'bg-sky-500',
  BE: 'bg-violet-500',
};
const wcDot = (code: string) => WC_DOT[code] ?? 'bg-muted-foreground/40';

/** Compact numeric cell: integers as-is, decimals to 2 places, null → em-dash. */
const fmtVal = (v: number | null) =>
  v == null ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(2);

/**
 * Cycle time per the IE formula:
 *   CT = [MACH + (HAND × CAP)] / [(CAP × N) × (S%/100)]
 * MACH/HAND null → 0; CAP/N/S% null-or-zero → neutral defaults (1, 1, 100) so
 * the denominator can never be zero.
 */
function computeCycleTime(
  mach: number | null, hand: number | null,
  cap: number | null, n: number | null, sampling: number | null,
): number {
  const m = mach ?? 0;
  const h = hand ?? 0;
  const c = cap && cap > 0 ? cap : 1;
  const nn = n && n > 0 ? n : 1;
  const ss = sampling && sampling > 0 ? sampling : 100;
  return (m + h * c) / ((c * nn) * (ss / 100));
}

/** Fallback line efficiency when the real per-line value isn't available yet. */
const DEFAULT_EFFICIENCY = 0.85;

/** Normalise an efficiency value to a 0–1 rate. effGoal may arrive as a percent
 *  (85) or a fraction (0.85); fall back to the default when missing. */
function effRate(eff: number | null): number {
  if (eff == null || eff <= 0) return DEFAULT_EFFICIENCY;
  return eff > 1 ? eff / 100 : eff;
}

/**
 * Units-per-hour for a process:
 *   UPH = 3600 / CT × Efficiency × (FPY/100)
 * CT in seconds; efficiency = the line's real eff (or 85% default); FPY null →
 * 100% (no yield loss). Returns null when CT is non-positive (can't divide).
 */
function computeUph(seconds: number, fpy: number | null, eff: number | null): number | null {
  if (!(seconds > 0)) return null;
  const yieldRate = fpy != null && fpy > 0 ? fpy / 100 : 1;
  return (3600 / seconds) * effRate(eff) * yieldRate;
}

/** Process label for display: keep only the part before a separator dash.
 *  Splits on the first dash (hyphen "-", en-dash "–", or em-dash "—") that has
 *  whitespace on at least one side — handles inconsistent spacing like
 *  "HLA 1– HLA 3 LINK" / "HLA 2 –HLA Mech Assy 2" / "BIRTH 1 - LABELING", while
 *  preserving genuine hyphenated names like "HI-PORT" (no surrounding space). */
function stepLabel(step: string): string {
  const i = step.search(/\s+[-–—]|[-–—]\s+/);
  return i >= 0 ? step.slice(0, i).trim() : step;
}

/** A logical process = all steps sharing a display label (e.g. the four
 *  "SUB MA 1 - …" sub-operations), combined: cycle times summed, FPY compounded
 *  (yield multiplies across steps in series), efficiency from the line. */
interface CombinedProcess {
  label: string;
  minOrder: number;
  seconds: number;        // Σ step cycle times
  fpyPct: number | null;  // (Π fpy_i/100) × 100, null if no step had fpy
  eff: number | null;     // line efficiency
  count: number;          // how many steps were combined
  fullSteps: { order: number; step: string }[];  // underlying steps + order (for the tooltip)
}

/** Group steps by display label, summing CT and compounding FPY. Order preserved
 *  by each label's earliest step. */
function combineSteps(steps: FlowStep[]): CombinedProcess[] {
  const m = new Map<string, CombinedProcess>();
  for (const s of steps) {
    const label = stepLabel(s.step);
    let c = m.get(label);
    if (!c) {
      c = { label, minOrder: s.order, seconds: 0, fpyPct: null, eff: s.eff, count: 0, fullSteps: [] };
      m.set(label, c);
    }
    c.seconds += s.seconds;
    c.minOrder = Math.min(c.minOrder, s.order);
    if (c.eff == null && s.eff != null) c.eff = s.eff;
    if (s.fpy != null && s.fpy > 0) {
      const prev = c.fpyPct == null ? 1 : c.fpyPct / 100;
      c.fpyPct = prev * (s.fpy / 100) * 100;   // compound yield
    }
    c.count++;
    c.fullSteps.push({ order: s.order, step: s.step });
  }
  return [...m.values()].sort((a, b) => a.minOrder - b.minOrder || a.label.localeCompare(b.label));
}

/** One ordered step in a routing flow. */
interface FlowStep {
  order: number;
  line: string;
  workcenter: string;
  step: string;
  /** Cycle time = [MACH + (HAND × CAP)] / [(CAP × N) × (S%/100)]. */
  seconds: number;
  grp: number | null;
  cap: number | null;
  n: number | null;
  sampling: number | null;
  lct: number | null;
  mach: number | null;
  imt: number | null;
  hand: number | null;
  pb: number | null;
  hc: number | null;
  fpy: number | null;
  eff: number | null;
}
/** One complete routing = (revision, priority). */
interface Routing {
  revision: string;
  priority: number;
  total: number;
  lines: number;        // distinct sub_workcenters crossed
  steps: FlowStep[];    // already sorted by order
}

/** Expanded line-table style:
 *  'detail' — full per-step variable table (Ord/Step/GRP/LCT/MACH/…), one row per process.
 *  'matrix' — transposed: processes as columns (ordered left→right), one cycle-time value row. */
export type FlowVariant = 'detail' | 'matrix';

// chevron · # · Assembly · SMH · Revisions · Workcenter
const GRID = '28px 44px minmax(220px,0.5fr) 96px 100px minmax(160px,1fr)';
const HEADER_H = 34;
const NUM = 'ct-num font-semibold text-[12px]';
const PAGE_SIZE = 50;

type SortKey = 'assembly' | 'revisions';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

function stagesOf(a: CycleTimeAssemblyListRow) {
  const out: { code: string; label: string }[] = [];
  if (a.has_smt) out.push({ code: 'SMT', label: 'SMT' });
  if (a.has_th) out.push({ code: 'TH', label: 'Through Hole' });
  if (a.has_be) out.push({ code: 'BE', label: 'Backend' });
  return out;
}

interface Props {
  /** When set, the customer is fixed (workcell Flow tab); the filter bar hides
   *  its customer Select. Omit for the standalone Flow page. */
  lockedCustomer?: string;
}

/** Exportable metrics for the download dialog. `key` is stable for later
 *  wiring to the actual export builder. */
const EXPORT_METRICS = [
  { key: 'smh', label: 'SMH' },
  { key: 'manual', label: 'Manual' },
  { key: 'imt', label: 'IMT' },
  { key: 'machine', label: 'Machine' },
  { key: 'total_ct', label: 'Total CT' },
  { key: 'uph', label: 'UPH' },
] as const;
type ExportMetric = typeof EXPORT_METRICS[number]['key'];

/** Workcenters (build stages) the export can be scoped to. */
const EXPORT_STAGES = [
  { key: 'SMT', label: 'Surface Mount Technology (SMT)' },
  { key: 'TH', label: 'Through Hole (TH)' },
  { key: 'BE', label: 'Backend (BE)' },
] as const;
type ExportStage = typeof EXPORT_STAGES[number]['key'];

/** Above this assembly count, the export run asks for confirmation first. */
const LONG_EXPORT_THRESHOLD = 500;
/** Rough ETA: ~70s per 1000 assemblies. */
function exportEtaLabel(count: number): string {
  const sec = Math.round((count / 1000) * 70);
  return sec < 90 ? `~${Math.max(sec, 5)} seconds` : `~${Math.round(sec / 60)} minutes`;
}

export default function CycleTimeAssemblyFlow({ lockedCustomer }: Props) {
  const [filters] = useCycleTimeFilters();
  const customer = lockedCustomer ?? (filters.customer || undefined);
  const search = filters.assembly.trim().toLowerCase();

  // How an expanded sub-workcenter renders its processes — switched by the
  // Compact|Detail toggle in the filter row. Defaults to Compact (matrix).
  const [variant, setVariant] = useState<FlowVariant>('matrix');

  // Export — selection modal, then a separate run dialog (confirm + progress).
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRun, setExportRun] = useState<{ metrics: ExportMetric[]; stages: ExportStage[] } | null>(null);

  const listQ = useCycleTimeAssemblyList(customer);
  const { data: aliasMap } = useCycleTimeAliases(customer);

  const [sort, setSort] = useState<Sort>({ key: 'assembly', dir: 'asc' });
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Search + stage filter (exact-set match on the assembly's stage footprint).
  const filtered = useMemo<CycleTimeAssemblyListRow[]>(() => {
    let all = listQ.data ?? [];
    if (search) all = all.filter((a) => a.assembly.toLowerCase().includes(search));
    const sel = filters.stages ? filters.stages.split(',') : [];
    if (sel.length) {
      all = all.filter((a) => {
        const set: string[] = [];
        if (a.has_smt) set.push('SMT');
        if (a.has_th) set.push('TH');
        if (a.has_be) set.push('BE');
        return set.length === sel.length && sel.every((s) => set.includes(s));
      });
    }
    return all;
  }, [listQ.data, search, filters.stages]);

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
  useEffect(() => { setPage(1); }, [customer, filters.stages, search, sort]);
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
      <CycleTimeFilters
        availableLines={[]}
        lockedCustomer={lockedCustomer}
        stageMode
        rightSlot={
          <div className="flex items-center gap-2">
            <ViewToggle variant={variant} onChange={setVariant} />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={!customer}
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        }
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        customer={customer}
        assemblies={sorted.map((a) => a.assembly)}
        onSubmit={(metrics, stages) => { setExportOpen(false); setExportRun({ metrics, stages }); }}
      />

      {exportRun && customer && (
        <ExportRunDialog
          customer={customer}
          assemblies={sorted.map((a) => a.assembly)}
          metrics={exportRun.metrics}
          stages={exportRun.stages}
          onClose={() => setExportRun(null)}
        />
      )}

      <div className="flex-1 min-h-0">
        <FlowList
          rows={pageRows}
          customer={customer}
          variant={variant}
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
  variant: FlowVariant;
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
  rows, customer, variant, aliasMap, loading, error, hasCustomer, open, onToggle, sort, onSort, pagination,
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
          <div className="text-right" title="Standard Manufacturing Hour — operator content per unit: (IMT + Hand) × S%, summed over the primary routing">SMH</div>
          <SortHead label="Revisions" k="revisions" sort={sort} onSort={onSort} align="center" />
          <div className="text-right">Workcenter</div>
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
                  'grid w-full items-center text-left text-[11px] transition-colors [&>div]:px-2 [&>div]:py-2',
                  isOpen
                    ? 'sticky z-10 border-b border-border bg-background shadow-sm hover:bg-muted'
                    : 'bg-transparent hover:bg-muted/40',
                )}
                style={{ gridTemplateColumns: GRID, ...(isOpen ? { top: HEADER_H } : {}) }}
              >
                <div className="flex items-center justify-center text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(NUM, 'text-center text-muted-foreground')}>{rowNo}</div>
                <div className="ct-num flex min-w-0 items-center gap-1 text-[12px] font-bold text-foreground">
                  <span className="truncate" title={a.assembly}>{a.assembly}</span>
                  <CopyButton text={a.assembly} />
                </div>
                <div className={cn(NUM, 'text-right text-foreground')} title={a.smh == null ? 'No primary routing' : formatCycleHMS(a.smh)}>
                  {a.smh == null ? '—' : formatBuildDuration(a.smh)}
                </div>
                <div className={cn(NUM, 'text-center text-muted-foreground')}>{a.revisions}</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {stages.length === 0
                    ? <span className="text-muted-foreground/50">—</span>
                    : stages.map((w) => (
                      <span key={w.code} title={w.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <span className={cn('h-2.5 w-2.5 rounded-full', wcDot(w.code))} />{w.code}
                      </span>
                    ))}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border bg-muted/10 px-2 py-3">
                  <FlowDetail customer={customer} assembly={a.assembly} variant={variant} aliasMap={aliasMap} />
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
  customer, assembly, variant, aliasMap,
}: { customer: string | undefined; assembly: string; variant: FlowVariant; aliasMap?: CycleTimeAliasMap }) {
  const q = useCycleTimeAssemblyBuilds(customer, assembly);

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
      // Cycle time = [MACH + (HAND × CAP)] / [(CAP × N) × (S%/100)].
      const eff = computeCycleTime(r.mach, r.hand, r.cap, r.n, r.sampling);
      rt.steps.push({
        order: r.step_order ?? 0,
        line: r.sub_workcenter,
        workcenter: String(r.workcenter ?? ''),
        step: r.step,
        seconds: eff,
        grp: r.grp ?? null,
        cap: r.cap ?? null,
        n: r.n ?? null,
        sampling: r.sampling ?? null,
        lct: r.lct ?? null,
        mach: r.mach ?? null,
        imt: r.imt ?? null,
        hand: r.hand ?? null,
        pb: r.pb ?? null,
        hc: r.hc ?? null,
        fpy: r.fpy ?? null,
        eff: r.eff ?? null,
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
            <span className="font-bold text-foreground">{selected.steps.length}</span> {selected.steps.length === 1 ? 'Process' : 'Processes'}
          </span>
          <span className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{selected.lines}</span> {selected.lines === 1 ? 'Sub-Workcenter' : 'Sub-Workcenters'}
          </span>
          <span className={cn(NUM, 'font-bold text-foreground')} title={formatCycleHMS(selected.total)}>
            {formatBuildDuration(selected.total)}
          </span>
        </div>
      </div>

      <RoutingFlow routing={selected} variant={variant} aliasMap={aliasMap} />
    </div>
  );
}

interface LineGroupData {
  line: string;
  workcenter: string;
  steps: FlowStep[];
  total: number;
  minOrder: number;
}

/** A routing rendered as collapsible per-line tables, ordered by each line's
 *  first step so the sequence mirrors the physical flow. */
function RoutingFlow({ routing, variant, aliasMap }: { routing: Routing; variant: FlowVariant; aliasMap?: CycleTimeAliasMap }) {
  const groups = useMemo<LineGroupData[]>(() => {
    const m = new Map<string, LineGroupData>();
    for (const s of routing.steps) {
      let g = m.get(s.line);
      if (!g) { g = { line: s.line, workcenter: s.workcenter, steps: [], total: 0, minOrder: s.order }; m.set(s.line, g); }
      g.steps.push(s);
      g.total += s.seconds;
      g.minOrder = Math.min(g.minOrder, s.order);
    }
    const arr = Array.from(m.values());
    arr.forEach((g) => g.steps.sort((a, b) => a.order - b.order));
    arr.sort((a, b) => a.minOrder - b.minOrder);
    return arr;
  }, [routing]);

  return (
    <div className="space-y-2 p-2">
      {groups.map((g, i) => (
        <LineGroup key={g.line} index={i} group={g} variant={variant} aliasMap={aliasMap} />
      ))}
    </div>
  );
}

/** One line's steps — a collapsible table (collapsed by default). The header
 *  names the line; the step table omits the Line column.
 *  variant 'detail' → one row per process with its variables;
 *  variant 'matrix' → processes as columns (ordered), one cycle-time value row. */
function LineGroup({ index, group, variant, aliasMap }: {
  index: number; group: LineGroupData; variant: FlowVariant; aliasMap?: CycleTimeAliasMap;
}) {
  const [open, setOpen] = useState(false);
  // Efficiency is a per-line value (same across the line's steps).
  const lineEff = group.steps.find((s) => s.eff != null)?.eff ?? null;
  // Compact view combines same-name processes (e.g. the 4 "SUB MA 1" sub-ops):
  // CT summed, FPY compounded, then UPH recomputed from the total.
  const combinedSteps = useMemo(() => combineSteps(group.steps), [group.steps]);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
        <span className="text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
        <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', wcDot(group.workcenter))} />
        <span className="min-w-0 truncate text-sm font-medium text-foreground" title={group.line}>{group.line}</span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          <span title={lineEff == null ? 'Line efficiency (default)' : 'Line efficiency'}>
            Efficiency <span className="font-bold text-foreground">{lineEff == null ? `${Math.round(DEFAULT_EFFICIENCY * 100)}%*` : `${Math.round(lineEff)}%`}</span>
          </span>
          <span><span className="font-bold text-foreground">{group.steps.length}</span> {group.steps.length === 1 ? 'Process' : 'Processes'}</span>
          <span className={cn(NUM, 'font-bold text-foreground')} title={formatCycleHMS(group.total)}>
            {formatBuildDuration(group.total)}
          </span>
        </span>
      </button>

      {open && variant === 'matrix' && (
        <div className="overflow-x-auto border-t border-border">
          {/* Transposed: process names across the top (already order-sorted
              left→right by RoutingFlow), one cycle-time value row beneath.
              No w-full — the table sizes to content (each process cell holds
              CT + UPH) and the wrapper scrolls horizontally. */}
          <table className="border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
                {combinedSteps.map((c) => (
                  <th
                    key={c.label}
                    title={c.count > 1
                      ? `${c.label} — ${c.count} steps combined:\n${[...c.fullSteps].sort((a, b) => a.order - b.order).map((f) => `Ord ${f.order}: ${f.step}`).join('\n')}`
                      : c.fullSteps[0] && `Ord ${c.fullSteps[0].order}: ${c.fullSteps[0].step}`}
                    className="whitespace-nowrap border-r border-border px-2.5 py-1.5 text-center text-[12px] normal-case font-semibold text-foreground last:border-r-0"
                  >
                    {c.label}
                    {c.count > 1 && <span className="ml-1 text-[9px] font-normal text-muted-foreground">×{c.count}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {combinedSteps.map((c, i) => {
                  const uph = computeUph(c.seconds, c.fpyPct, c.eff);
                  return (
                    <td
                      key={c.label}
                      className={cn(
                        'whitespace-nowrap border-r border-t border-border px-2.5 py-1.5 last:border-r-0',
                        i % 2 ? 'bg-muted/10' : '',
                      )}
                    >
                      <div className="flex items-center justify-center gap-2.5">
                        {/* left: combined cycle time (seconds) — grows with the
                            value (min width for alignment) and never wraps, so
                            big summed numbers can't spill into the UPH cell */}
                        <span className={cn(NUM, 'min-w-16 whitespace-nowrap text-right text-foreground')} title={formatCycleHMS(c.seconds)}>
                          {formatCycleSecondsLabel(c.seconds)}
                        </span>
                        <span className="h-3.5 w-px flex-shrink-0 bg-border" />
                        {/* right: UPH (pieces/hour) from the combined CT */}
                        <span
                          className={cn(NUM, 'min-w-16 whitespace-nowrap text-left text-muted-foreground')}
                          title={`UPH = 3600 / CT${c.count > 1 ? ` (${c.count} steps summed)` : ''} × ${Math.round(effRate(c.eff) * 100)}% efficiency${c.eff == null ? ' (default)' : ''}${c.fpyPct != null ? ` × FPY (${Math.round(c.fpyPct)}%)` : ''}`}
                        >
                          {uph == null ? '—' : `${Math.round(uph).toLocaleString()} pcs`}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {open && variant === 'detail' && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="w-12 px-2 py-1.5 text-right font-semibold">Ord</th>
                <th className="px-2 py-1.5 text-left font-semibold">Step</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Group (WIP)">GRP</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Line cycle time">LCT</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Machine time">MACH</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="IMT">IMT</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Hand time">HAND</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Playbook">PB</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Headcount">HC</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Capacity">CAP</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Number of Machine/Workstation">N</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Sampling %">Sampling</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="First Pass Yield">FPY</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="UPH = 3600 / CT × Efficiency × FPY">UPH</th>
                <th className="w-28 px-2 py-1.5 text-right font-semibold" title="CT = [MACH + (HAND × CAP)] / [(CAP × N) × (S%/100)]">Cycle time</th>
              </tr>
            </thead>
            <tbody>
              {group.steps.map((s) => {
                const info = aliasMap?.[s.step];
                const tip = info?.processes?.length ? `Alias: ${s.step}\nProcess: ${info.processes.join(', ')}` : s.step;
                const uph = computeUph(s.seconds, s.fpy, s.eff);
                return (
                  <tr key={`${s.order}-${s.step}`} className="border-t border-border text-base">
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{s.order}</td>
                    <td className="px-2 py-1.5 text-foreground " title={tip}>{stepLabel(s.step)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.grp)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.lct)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.mach)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.imt)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.hand)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.pb)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.hc)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.cap)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{fmtVal(s.n)}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{s.sampling == null ? '—' : `${Math.round(s.sampling)}%`}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{s.fpy == null ? '—' : `${Math.round(s.fpy)}%`}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-muted-foreground')}>{uph == null ? '—' : `${Math.round(uph).toLocaleString()}`}</td>
                    <td className={cn(NUM, 'px-2 py-1.5 text-right text-foreground')} title={formatCycleHMS(s.seconds)}>
                      {formatCycleSecondsLabel(s.seconds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Export picker — choose which metrics to pull from the current workcell's
 *  data. For now this only collects the selection; the actual file build is
 *  wired in a later step. */
function ExportDialog({
  open, onOpenChange, customer, assemblies, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer?: string;
  assemblies: string[];
  onSubmit: (metrics: ExportMetric[], stages: ExportStage[]) => void;
}) {
  // Default: everything selected.
  const [selected, setSelected] = useState<Set<ExportMetric>>(
    () => new Set(EXPORT_METRICS.map((m) => m.key)),
  );
  const [stages, setStages] = useState<Set<ExportStage>>(
    () => new Set(EXPORT_STAGES.map((s) => s.key)),
  );

  function toggle(key: ExportMetric) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function toggleStage(key: ExportStage) {
    setStages((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export cycle-time data</DialogTitle>
          <DialogDescription>
            Pick the metrics and workcenters.
          </DialogDescription>
        </DialogHeader>

        {/* Two columns so the modal stays short on 16:9 / small screens */}
        <div className="grid grid-cols-2 gap-4">
          {/* Metrics column */}
          <div className="space-y-1">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Metrics
            </p>
            {EXPORT_METRICS.map((m) => (
              <label
                key={m.key}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox checked={selected.has(m.key)} onCheckedChange={() => toggle(m.key)} />
                <span className="text-sm text-foreground">{m.label}</span>
              </label>
            ))}
          </div>

          {/* Workcenter column */}
          <div className="space-y-1 border-l border-border pl-4">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workcenter
            </p>
            {EXPORT_STAGES.map((s) => (
              <label
                key={s.key}
                className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
              >
                <Checkbox checked={stages.has(s.key)} onCheckedChange={() => toggleStage(s.key)} className="mt-0.5" />
                <span className="text-sm text-foreground">{s.label}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || stages.size === 0 || !assemblies.length}
            onClick={() => onSubmit([...selected], [...stages])}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Export run flow: optional confirmation (large workcells) → progress bar.
 *  Mounted only while an export is in flight; unmounts (onClose) when done. */
function ExportRunDialog({
  customer, assemblies, metrics, stages, onClose,
}: {
  customer: string;
  assemblies: string[];
  metrics: ExportMetric[];
  stages: ExportStage[];
  onClose: () => void;
}) {
  const needsConfirm = assemblies.length >= LONG_EXPORT_THRESHOLD;
  const [phase, setPhase] = useState<'confirm' | 'running'>(needsConfirm ? 'confirm' : 'running');
  const [progress, setProgress] = useState({ done: 0, total: assemblies.length });
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Kick off the export once we enter the running phase.
  useEffect(() => {
    if (phase !== 'running' || startedRef.current) return;
    startedRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    (async () => {
      try {
        await exportFlowMetricsXlsx({
          customer, assemblies, metrics, stages,
          signal: ctrl.signal,
          onProgress: (done, total) => setProgress({ done, total }),
        });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error('Cycle-time export failed', e);
        }
      } finally {
        onClose();
      }
    })();
  }, [phase, customer, assemblies, metrics, stages, onClose]);

  function cancelRun() {
    abortRef.current?.abort();
    onClose();
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) (phase === 'confirm' ? onClose() : cancelRun()); }}>
      <DialogContent className="sm:max-w-[440px]">
        {phase === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Large export
              </DialogTitle>
              <DialogDescription>
                {customer} has {assemblies.length.toLocaleString()} assemblies. Preparing this download will take
                about <span className="font-semibold text-foreground">{exportEtaLabel(assemblies.length)}</span>. Continue?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => setPhase('running')} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Exporting…</DialogTitle>
              <DialogDescription>Preparing the {customer} cycle-time export — please wait.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <Progress value={pct} />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} assemblies</span>
                <span className="font-mono">{pct}%</span>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelRun}
                className="border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              >
                Cancel download
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Segmented Detail|Matrix toggle — switches how an expanded sub-workcenter
 *  renders its processes (full variable table vs transposed cycle-time row). */
function ViewToggle({ variant, onChange }: { variant: FlowVariant; onChange: (v: FlowVariant) => void }) {
  const opts: { value: FlowVariant; label: string; icon: typeof Rows3; tip: string }[] = [
    { value: 'matrix', label: 'Compact', icon: Columns3, tip: 'Processes as columns, one cycle-time row' },
    { value: 'detail', label: 'Detail', icon: Rows3, tip: 'One row per process with its variables' },
  ];
  return (
    <div className="flex h-9 items-center overflow-hidden rounded-md border border-input bg-background">
      {opts.map(({ value, label, icon: Icon, tip }) => (
        <button
          key={value}
          type="button"
          title={tip}
          onClick={() => onChange(value)}
          className={cn(
            'flex h-full items-center gap-1.5 px-3 text-xs font-medium transition-colors',
            variant === value
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

/** Copy-to-clipboard affordance for the assembly name. Rendered as a span
 *  (not a button) because the table row itself is a <button> — nested buttons
 *  are invalid. stopPropagation keeps the click from toggling the row. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      title={copied ? 'Copied!' : 'Copy assembly'}
      onClick={copy}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') copy(e); }}
      className="inline-flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </span>
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
