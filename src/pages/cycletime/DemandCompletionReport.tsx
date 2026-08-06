/**
 * DemandCompletionReport.tsx
 * ──────────────────────────
 * Completion status for the models we are actually building and about to build.
 *
 * Scope = MES projection (~4wk forward) UNION planner demand (~13wk), ranked by
 * demand units. Volume is heavily concentrated — the top 500 models are ~88% of
 * it — so the default view is "everything, ranked", and you narrow from there.
 *
 * The picker mirrors the OLE 4Q report's: a plant is "selected" purely because
 * its workcells all happen to be picked. That state is DERIVED, never stored, so
 * un-ticking one workcell silently turns a whole-plant pick into a custom one
 * and the two can never disagree.
 *
 * Route: /cycle-time/completion
 */

import { SortHeader } from '@/components/shared/SortHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCycleTimeCompletionDemand } from '@/hooks/cycle_time/useCycleTimeData';
import { useSortable } from '@/hooks/shared/useSortable';
import type { DemandCompletionModel } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Loader2, Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RouteComparisonDrawer } from './RouteComparisonDrawer';

// Identity first (who/what/where), then schedule, then every number and
// indicator on the right — so the eye scans names down the left and figures
// down the right instead of hopping between them.
/** Fixed row height — the virtualiser needs one number, and every row is a
 *  single line of text, so measuring per-row would buy nothing. */
const ROW_H = 34;

const GRID = '2.75rem minmax(6.5rem,0.9fr) minmax(8rem,1.2fr) 4.5rem  6.5rem 6.5rem  7rem 4.5rem 4.5rem';

/** Status → label + colour. Ordered worst-first so the legend reads as a
 *  priority list: what needs creating, then fixing, then nothing. */
const STATUS_META: Record<string, { label: string; cls: string; hint: string }> = {
  incomplete:  { label: 'Missing CT', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', hint: 'In IEDB with cycle times, but gaps against what the floor actually runs' },
  no_cycle_time: { label: 'No cycle time', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', hint: 'Model EXISTS in IEDB, but not one cycle time has been entered' },
  not_in_iedb: { label: 'Not in IEDB', cls: 'bg-red-500/15 text-red-600 dark:text-red-400', hint: 'Model does not exist in IEDB at all — it has to be created first' },
  not_in_mes:  { label: 'Not in MES', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', hint: 'No MES production found — not built yet, or the workcell is not on MES' },
  not_checked: { label: 'Not checked', cls: 'bg-muted text-muted-foreground', hint: 'The completion run has not reached this model yet' },
  complete:    { label: 'Complete', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', hint: 'Every step MES ran has a cycle time' },
};
const STATUS_ORDER = ['incomplete', 'no_cycle_time', 'not_in_iedb', 'not_in_mes', 'not_checked', 'complete'];

/** The `reason` behind a status — the detail the 4 statuses deliberately fold
 *  away. Shown as a sub-label so the chip stays scannable. */
const REASON_LABEL: Record<string, string> = {
  missing_ct: 'blank cycle time', missing_step: 'step not in route',
  'missing_ct+step': 'blank CT + route gap', unmapped: 'steps unrecognised',
  no_alias: 'cycle times entered, but no alias to match them on',
  in_iedb_untimed: 'in IEDB, nobody has timed it',
  absent: 'no IEDB record',
  absent_unverified: 'not in our IEDB snapshot, and the snapshot is short for this workcell',
  no_production: 'not built yet', workcell_not_on_mes: 'workcell not on MES',
};

type SortKey = 'rank' | 'customer' | 'assembly' | 'status' | 'lbr' | 'ipk' | 'next' | 'last';

/** "6 Aug" — the year is noise when everything sits inside a 13-week window. */
function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** LBR is a balance target, not a percentage of something — 85%+ is healthy. */
const LBR_TARGET = 85;
const lbrTone = (v?: number | null) =>
  v == null ? 'text-muted-foreground'
    : v >= LBR_TARGET ? 'text-emerald-600 dark:text-emerald-400'
    : v >= 70 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500';

// Module-level: useSortable memoises on `accessors`, so rebuilding this object
// every render would defeat the memo and re-sort on each keystroke.
const ACCESSORS: Record<SortKey, (m: DemandCompletionModel) => string | number | null> = {
  rank:     m => m.rank,
  customer: m => m.customer,
  assembly: m => m.assembly,
  // Sort by severity, not alphabetically — "what needs work" first.
  status:   m => STATUS_ORDER.indexOf(m.status),
  lbr:      m => m.lbr ?? null,
  ipk:      m => m.ipk_trolleys ?? null,
  next:     m => m.next_build ?? null,
  last:     m => m.last_build ?? null,
};

function Box({ on, partial = false }: { on: boolean; partial?: boolean }) {
  return (
    <span className={cn(
      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
      on || partial ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
    )}>
      {on && <Check className="h-3 w-3" strokeWidth={3} />}
      {partial && !on && <span className="h-0.5 w-2 rounded bg-primary-foreground" />}
    </span>
  );
}

export default function DemandCompletionReport() {
  const { data, isLoading, error } = useCycleTimeCompletionDemand();

  const [picked, setPicked] = useState<string[]>([]);   // workcells; [] = all
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [limit, setLimit] = useState(0);                // 0 = no cap
  const [open, setOpen] = useState<{ customer: string; assembly: string } | null>(null);

  const scope = data?.scope;
  const plants = useMemo(() => Object.keys(scope?.plants ?? {}).sort(), [scope]);
  const allWorkcells = scope?.workcells ?? [];

  // Filtering 3,900 rows on every keystroke made typing feel laggy. The input
  // stays instant; the filter catches up 180ms later.
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q), 180);
    return () => clearTimeout(id);
  }, [q]);

  // Default is EVERYTHING — the report's job is "show me the demand list", and
  // making the user pick before seeing anything hides the headline.
  useEffect(() => { setPicked([]); }, [data?.as_of]);

  const plantState = (p: string): 'all' | 'some' | 'none' => {
    const list = scope?.plants[p] ?? [];
    if (!picked.length) return 'all';                    // [] means all selected
    const n = list.filter(w => picked.includes(w)).length;
    return n === 0 ? 'none' : n === list.length ? 'all' : 'some';
  };

  const effectivePicked = picked.length ? picked : allWorkcells;

  const togglePlant = (p: string) => {
    const list = scope?.plants[p] ?? [];
    const base = picked.length ? picked : allWorkcells;
    const on = list.every(w => base.includes(w));
    const next = on ? base.filter(w => !list.includes(w)) : [...new Set([...base, ...list])];
    setPicked(next.length === allWorkcells.length ? [] : next);
  };
  const toggleWc = (w: string) => {
    const base = picked.length ? picked : allWorkcells;
    const next = base.includes(w) ? base.filter(x => x !== w) : [...base, w];
    setPicked(next.length === allWorkcells.length ? [] : next);
  };
  const toggleStatus = (s: string) =>
    setStatusFilter(statusFilter.includes(s) ? statusFilter.filter(x => x !== s) : [...statusFilter, s]);

  // Everything EXCEPT the status filter. The chip counts read from this, so each
  // chip always shows how many models it holds in the current workcell/search
  // scope. Counting post-status-filter meant picking one status zeroed every
  // other chip, and the numbers only appeared on whatever was selected.
  const scopedRows = useMemo(() => {
    let r = data?.models ?? [];
    // Sets, not arrays: .includes() on every one of ~3,900 rows was a linear
    // scan per row for both filters.
    if (picked.length) {
      const wanted = new Set(picked);
      r = r.filter(m => wanted.has(m.customer));
    }
    if (qDebounced.trim()) {
      const s = qDebounced.trim().toLowerCase();
      r = r.filter(m => m.assembly.toLowerCase().includes(s) || m.customer.toLowerCase().includes(s));
    }
    return r;
  }, [data, picked, qDebounced]);

  const rows = useMemo(() => {
    let r = scopedRows;
    if (statusFilter.length) {
      const wanted = new Set(statusFilter);
      r = r.filter(m => wanted.has(m.status));
    }
    return limit ? r.slice(0, limit) : r;
  }, [scopedRows, statusFilter, limit]);

  const { sorted, sort, toggle } = useSortable<DemandCompletionModel, SortKey>(rows, ACCESSORS,
    { key: 'rank', dir: 'asc' });

  // Virtualised: the demand list is ~3,900 rows x 10 cells. Rendering them all
  // put ~39,000 nodes in the DOM, and because `open`/`q`/`picked` live in this
  // component EVERY keystroke and every row click re-rendered the lot — which is
  // what made the page feel stuck. Only the visible window is mounted now.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    scopedRows.forEach(m => { c[m.status] = (c[m.status] ?? 0) + 1; });
    return c;
  }, [scopedRows]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-muted-foreground">
      Could not load the report. The completion mart may not be built yet —
      run <code className="rounded bg-muted px-1">scripts/run_completion_target.py</code>.
    </div>;
  }

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Incompletion Report</h1>
          <p className="text-xs text-muted-foreground">
            Models in demand — MES plan (~4wk) + planner forecast (~13wk) — ranked by demand.
          </p>
        </div>
        {data.as_of && (
          <span className="text-[11px] text-muted-foreground">
            checked {new Date(data.as_of).toLocaleString()}
            {data.unchecked > 0 && <> · <span className="text-amber-600 dark:text-amber-400">
              {data.unchecked.toLocaleString()} not yet checked</span></>}
          </span>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card">
        <button onClick={() => setScopeOpen(o => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Report scope
            </span>
            <span className="text-xs text-muted-foreground">
              {picked.length === 0
                ? `All ${allWorkcells.length} workcells`
                : `${picked.length} of ${allWorkcells.length} workcells`}
            </span>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', scopeOpen && 'rotate-180')} />
        </button>

        {scopeOpen && (
          <div className="space-y-4 border-t px-4 py-3">
            <button onClick={() => setPicked([])}
              className={cn('flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/50',
                picked.length === 0 && 'text-primary')}>
              <Box on={picked.length === 0} />
              <span className="text-sm font-semibold">All</span>
              <span className="text-[11px] text-muted-foreground">{allWorkcells.length} workcells</span>
            </button>

            {plants.map(p => {
              const st = plantState(p);
              const list = scope?.plants[p] ?? [];
              return (
                <div key={p}>
                  <button onClick={() => togglePlant(p)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/50">
                    <Box on={st === 'all'} partial={st === 'some'} />
                    <span className="text-sm font-semibold">{p}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {list.filter(w => effectivePicked.includes(w)).length}/{list.length}
                    </span>
                  </button>
                  <div className="ml-6 mt-1.5 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4">
                    {list.map(w => {
                      const on = effectivePicked.includes(w);
                      return (
                        <button key={w} onClick={() => toggleWc(w)}
                          className={cn('flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                            on ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50')}>
                          <Box on={on} />
                          <span className="truncate">{w}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Status chips + search ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.filter(s => (counts[s] ?? 0) > 0 || statusFilter.includes(s)).map(s => {
          const m = STATUS_META[s];
          const on = statusFilter.includes(s);
          return (
            <button key={s} onClick={() => toggleStatus(s)} title={m.hint}
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                m.cls, on ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'opacity-80 hover:opacity-100')}>
              {m.label} <span className="tabular-nums">{counts[s] ?? 0}</span>
            </button>
          );
        })}
        {statusFilter.length > 0 && (
          <button onClick={() => setStatusFilter([])}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground">Clear</button>
        )}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search model or workcell"
            className="h-8 w-56 pl-8 text-xs" />
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs"
          onClick={() => setLimit(limit ? 0 : 500)}>
          {limit ? 'Show all' : 'Top 500 only'}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {sorted.length.toLocaleString()} model{sorted.length === 1 ? '' : 's'}
        {sorted.length !== data.total && <> of {data.total.toLocaleString()}</>}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid items-center gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: GRID }}>
          <SortHeader label="#" active={sort?.key === 'rank'} dir={sort?.dir} onClick={() => toggle('rank')} />
          <SortHeader label="Workcell" active={sort?.key === 'customer'} dir={sort?.dir} onClick={() => toggle('customer')} />
          <SortHeader label="Model" active={sort?.key === 'assembly'} dir={sort?.dir} onClick={() => toggle('assembly')} />
          <span>Plant</span>
          <SortHeader label="Next build" active={sort?.key === 'next'} dir={sort?.dir} onClick={() => toggle('next')} />
          <SortHeader label="Last build" active={sort?.key === 'last'} dir={sort?.dir} onClick={() => toggle('last')} />
          <SortHeader label="Status" active={sort?.key === 'status'} dir={sort?.dir} onClick={() => toggle('status')} />
          <SortHeader label="LBR" active={sort?.key === 'lbr'} dir={sort?.dir} onClick={() => toggle('lbr')} className="justify-end" />
          <SortHeader label="IPK" active={sort?.key === 'ipk'} dir={sort?.dir} onClick={() => toggle('ipk')} className="justify-end" />
        </div>

        <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing matches the current filters.
            </div>
          )}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(v => {
            const m = sorted[v.index];
            const meta = STATUS_META[m.status] ?? STATUS_META.not_checked;
            return (
              <button key={`${m.customer}|${m.assembly}`}
                onClick={() => setOpen({ customer: m.customer, assembly: m.assembly })}
                className="absolute left-0 top-0 grid w-full items-center gap-2 border-b px-4 text-left text-xs hover:bg-muted/30"
                style={{ gridTemplateColumns: GRID, height: ROW_H, transform: `translateY(${v.start}px)` }}>
                <span className="tabular-nums text-muted-foreground">{m.rank}</span>
                <span className="truncate font-medium" title={m.customer}>{m.customer}</span>
                <span className="truncate font-mono text-[11px]" title={m.assembly}>{m.assembly}</span>
                <span className="truncate text-muted-foreground">{m.plant}</span>

                {/* No upcoming start but demand still running = already on the floor. */}
                <span className="tabular-nums text-muted-foreground">
                  {m.next_build ? fmtDate(m.next_build)
                    : m.in_progress ? <span className="text-emerald-600 dark:text-emerald-400">Building</span>
                    : '—'}
                </span>
                <span className="tabular-nums text-muted-foreground">{fmtDate(m.last_build)}</span>

                <span className="flex items-center gap-1">
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', meta.cls)}
                    title={m.reason ? `${meta.hint}\n\n${REASON_LABEL[m.reason] ?? m.reason}` : meta.hint}>
                    {meta.label}</span>
                  {m.source === 'batch' && (
                    <span title="Verdict from #21 batch counts — a customer-level aggregate that can drag in rework and other variants"
                      className="text-[10px] text-amber-500">⚠</span>
                  )}
                </span>
                <span className={cn('text-right tabular-nums', lbrTone(m.lbr))}>
                  {m.lbr != null ? `${Math.round(m.lbr)}%` : '—'}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {m.ipk_trolleys != null ? Math.round(m.ipk_trolleys) : '—'}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {open && (
        <RouteComparisonDrawer
          customer={open.customer}
          assembly={open.assembly}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
