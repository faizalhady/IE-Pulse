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
import { useEffect, useMemo, useState } from 'react';

const GRID = '3rem minmax(7rem,1fr) minmax(8rem,1.2fr) 5rem 6rem 7.5rem 5rem 5rem';

/** Status → label + colour. Ordered worst-first so the legend reads as a
 *  priority list: what needs creating, then fixing, then nothing. */
const STATUS_META: Record<string, { label: string; cls: string; hint: string }> = {
  unavailable: { label: 'Not in IEDB', cls: 'bg-red-500/15 text-red-600 dark:text-red-400', hint: 'Model has no IEDB record at all — cycle times need creating' },
  no_data:     { label: 'No cycle time', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', hint: 'In IEDB but not one cycle time entered' },
  incomplete:  { label: 'Missing CT', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', hint: 'IEDB lists the step but its cycle time is blank' },
  route_gap:   { label: 'Route gap', cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', hint: "MES runs steps IEDB's route doesn't list — fix the route" },
  unverified:  { label: 'Unverified', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', hint: 'Has cycle times, but no MES production found to check against' },
  not_checked: { label: 'Not checked', cls: 'bg-muted text-muted-foreground', hint: 'The completion run has not reached this model yet' },
  non_mes:     { label: 'Non-MES', cls: 'bg-muted text-muted-foreground', hint: 'Workcell does not run through MES' },
  complete:    { label: 'Complete', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', hint: 'Every step MES ran has a cycle time' },
};
const STATUS_ORDER = ['unavailable', 'no_data', 'incomplete', 'route_gap', 'unverified', 'not_checked', 'non_mes', 'complete'];

type SortKey = 'rank' | 'customer' | 'assembly' | 'units' | 'status';

// Module-level: useSortable memoises on `accessors`, so rebuilding this object
// every render would defeat the memo and re-sort on each keystroke.
const ACCESSORS: Record<SortKey, (m: DemandCompletionModel) => string | number | null> = {
  rank:     m => m.rank,
  customer: m => m.customer,
  assembly: m => m.assembly,
  units:    m => m.units,
  // Sort by severity, not alphabetically — "what needs work" first.
  status:   m => STATUS_ORDER.indexOf(m.status),
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
  const [scopeOpen, setScopeOpen] = useState(false);
  const [limit, setLimit] = useState(0);                // 0 = no cap

  const scope = data?.scope;
  const plants = useMemo(() => Object.keys(scope?.plants ?? {}).sort(), [scope]);
  const allWorkcells = scope?.workcells ?? [];

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

  const rows = useMemo(() => {
    let r = data?.models ?? [];
    if (picked.length) r = r.filter(m => picked.includes(m.customer));
    if (statusFilter.length) r = r.filter(m => statusFilter.includes(m.status));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter(m => m.assembly.toLowerCase().includes(s) || m.customer.toLowerCase().includes(s));
    }
    return limit ? r.slice(0, limit) : r;
  }, [data, picked, statusFilter, q, limit]);

  const { sorted, sort, toggle } = useSortable<DemandCompletionModel, SortKey>(rows, ACCESSORS,
    { key: 'rank', dir: 'asc' });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(m => { c[m.status] = (c[m.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const unitsShown = useMemo(() => rows.reduce((a, m) => a + (m.units ?? 0), 0), [rows]);

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
            Models in demand — MES plan (~4wk) + planner forecast (~13wk) — ranked by units.
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
        {STATUS_ORDER.filter(s => (data.counts[s] ?? 0) > 0 || statusFilter.includes(s)).map(s => {
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
        {' · '}{unitsShown.toLocaleString()} units
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
          <SortHeader label="Units" active={sort?.key === 'units'} dir={sort?.dir} onClick={() => toggle('units')} />
          <SortHeader label="Status" active={sort?.key === 'status'} dir={sort?.dir} onClick={() => toggle('status')} />
          <span>Steps</span>
          <span>Evidence</span>
        </div>

        <div className="max-h-[62vh] overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing matches the current filters.
            </div>
          )}
          {sorted.map(m => {
            const meta = STATUS_META[m.status] ?? STATUS_META.not_checked;
            return (
              <div key={`${m.customer}|${m.assembly}`}
                className="grid items-center gap-2 border-b px-4 py-2 text-xs last:border-0 hover:bg-muted/30"
                style={{ gridTemplateColumns: GRID }}>
                <span className="tabular-nums text-muted-foreground">{m.rank}</span>
                <span className="truncate font-medium" title={m.customer}>{m.customer}</span>
                <span className="truncate font-mono text-[11px]" title={m.assembly}>{m.assembly}</span>
                <span className="truncate text-muted-foreground">{m.plant}</span>
                <span className="tabular-nums">{(m.units ?? 0).toLocaleString()}</span>
                <span>
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', meta.cls)}
                    title={meta.hint}>{meta.label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {m.expected != null ? `${m.present ?? 0}/${m.expected}` : '—'}
                </span>
                <span className="truncate text-[10px] text-muted-foreground"
                  title={m.source === 'batch'
                    ? 'Verdict from #21 batch counts — a customer-level aggregate that can drag in rework and other variants'
                    : m.source === 'serial' ? 'Verdict from a real board route walk (#132)' : ''}>
                  {m.source === 'serial' ? 'board' : m.source === 'batch' ? 'batch ⚠' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
