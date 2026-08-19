/**
 * WorkcellCoverage.tsx
 * ────────────────────
 * One row per workcell: how many models exist, how many we have judged, and what
 * the judgements were.
 *
 * WHY THE DENOMINATOR IS THE POINT
 *   Every completion number until now was a share of the models we happened to
 *   have checked — and every check ever run targeted the 13-week planner window.
 *   So "LAM RESEARCH is 38% complete" meant 38% of 628 checked models, out of
 *   7,807 that exist. The missing 7,179 were not failing, they were invisible.
 *   This page exists to put them back in the denominator.
 *
 * WHY TWO PERCENTAGES AND NOT ONE
 *   `pct_graded` is how much we have LOOKED at. `pct_complete_of_graded` is how
 *   much of what we looked at was fine. Multiplying them into a single "percent
 *   complete" reads as a quality problem when it is usually a coverage problem,
 *   and the two have different owners: coverage is ours, completeness is IEDB's.
 *
 * WHY EXCLUDED ROWS ARE ON SCREEN
 *   1,782 MES rows are not models at all — `Job Recovery`, `MES maintenance`,
 *   dead job codes with no workcell. They are dropped on purpose, and the count
 *   is shown so the total can be reconciled rather than trusted.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { SortHeader } from '@/components/shared/SortHeader';
import { useSortable } from '@/hooks/shared/useSortable';
import { cycleTimeApi, type UniverseWorkcell } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const GRID =
  'minmax(8.5rem,1.2fr) 4.75rem  5rem 5rem 5.5rem 7rem  5rem 5.5rem  4.75rem 5.25rem 4.75rem 5.25rem 4.75rem 5.5rem';

const n = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString();

/** Same colours the Report tab uses, so a status means one thing platform-wide. */
const TONE: Record<string, string> = {
  complete: 'text-emerald-600 dark:text-emerald-400',
  incomplete: 'text-amber-700 dark:text-amber-400',
  no_cycle_time: 'text-orange-600 dark:text-orange-400',
  not_in_iedb: 'text-red-600 dark:text-red-400',
  not_built: 'text-sky-600 dark:text-sky-400',
  cannot_check: 'text-muted-foreground',
};

/** The three buckets as one stacked bar. Reading three numbers and forming a
 *  ratio in your head is the thing a chart is for, and these three always sum to
 *  the row's model count so the bar is always full. */
function Buckets({ has, no, absent }: { has: number; no: number; absent: number }) {
  const total = has + no + absent || 1;
  const seg = (n: number, cls: string, label: string) =>
    n === 0 ? null : (
      <span className={cn('block h-full', cls)} style={{ width: `${(n / total) * 100}%` }}
            title={`${label}: ${n.toLocaleString()} (${Math.round((n / total) * 100)}%)`} />
    );
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {seg(has, 'bg-emerald-500', 'Has cycle time')}
      {seg(no, 'bg-orange-500', 'In IEDB, not timed')}
      {seg(absent, 'bg-red-500', 'Not in IEDB')}
    </span>
  );
}

/** A coverage bar, because 3% and 61% are hard to compare as digits in a column. */
function Bar({ pct, tone }: { pct: number | null; tone: string }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
        <span className={cn('block h-full rounded-full', tone)}
              style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </span>
      <span className="w-9 text-right tabular-nums">{pct.toFixed(0)}%</span>
    </span>
  );
}

type SortKey = keyof UniverseWorkcell;

export default function WorkcellCoverage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ct-universe-summary'],
    queryFn: () => cycleTimeApi.universe.summary(),
    staleTime: 1000 * 60 * 10,
  });

  const rows = useMemo(() => {
    const r = data?.workcells ?? [];
    const s = q.trim().toLowerCase();
    return s ? r.filter(w => w.workcell.toLowerCase().includes(s)) : r;
  }, [data, q]);

  const ACCESSORS = useMemo(() => {
    const keys: SortKey[] = ['workcell', 'models', 'in_iedb', 'built_24mo', 'in_demand',
      'graded', 'ungraded', 'pct_graded', 'complete', 'incomplete', 'no_cycle_time',
      'not_in_iedb', 'not_built', 'cannot_check', 'pct_complete_of_graded'];
    return Object.fromEntries(keys.map(k => [k, (w: UniverseWorkcell) => w[k] ?? null])) as
      Record<SortKey, (w: UniverseWorkcell) => string | number | null>;
  }, []);

  const { sorted, sort, toggle } = useSortable<UniverseWorkcell, SortKey>(
    rows, ACCESSORS, { key: 'models', dir: 'desc' });

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return <div className="p-6 text-sm text-rose-600">
      Could not load coverage: {(error as Error)?.message}
    </div>;
  }

  const t = data.totals;
  const stale = (data.freshness ?? []).filter(f => (f.days_old ?? 0) > 14);
  const head = (label: string, k: SortKey, cls = 'justify-end') => (
    <SortHeader label={label} active={sort?.key === k} dir={sort?.dir}
                onClick={() => toggle(k)} className={cls} />
  );

  return (
    <div className="h-full space-y-4 overflow-auto p-4 md:p-6">
      <div>
        <h1 className="text-lg font-bold">Coverage by workcell</h1>
        <p className="text-xs text-muted-foreground">
          Every model we know of, from IEDB, MES and demand — deduplicated. Not
          only the ones inside the 13-week planner window.
        </p>
      </div>

      {/* Stale inputs, above the numbers. This is the page most likely to be
          screenshotted and sent upward, and a stale verdict looks exactly like a
          fresh one. */}
      {stale.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm">
            <div className="font-medium text-amber-700 dark:text-amber-500">
              These numbers rest on data that has not been refreshed
            </div>
            {stale.map(f => (
              <div key={f.mart} className="text-[11px] text-muted-foreground">
                <span className="font-mono">{f.mart}</span> — {f.days_old} days old · {f.drives}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THE THREE BUCKETS lead, because they are known for every model. The
          completion tiles below them are a share of the ~10% we have checked,
          and putting those first invited reading them as a share of everything. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'models', label: 'Models', hint: 'Every model, deduped across IEDB, MES and demand' },
          { k: 'has_ct', label: 'Has cycle time', hint: 'IEDB has priced it' },
          { k: 'no_ct', label: 'No cycle time', hint: 'In IEDB, nobody timed it — an IE task' },
          { k: 'not_iedb', label: 'Not in IEDB', hint: 'IEDB has never heard of it — create it first' },
        ].map(c => (
          <div key={c.k} className="rounded-xl border bg-card p-3" title={c.hint}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className={cn('text-xl font-semibold tabular-nums',
              c.k === 'has_ct' && TONE.complete, c.k === 'no_ct' && TONE.no_cycle_time,
              c.k === 'not_iedb' && TONE.not_in_iedb)}>
              {n(t[c.k])}
            </div>
            {c.k !== 'models' && t.models > 0 && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {Math.round((t[c.k] / t.models) * 100)}% of all models
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Second row, clearly labelled as the checked subset. */}
      <div className="text-[11px] text-muted-foreground">
        Below: the MES comparison. It has only run on{' '}
        <span className="font-medium text-foreground">
          {n(t.graded)} of {n(t.models)}
        </span>{' '}
        models, so these are a share of what we checked — not of everything.
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'graded', label: 'Checked', hint: 'The MES comparison has run on it' },
          { k: 'ungraded', label: 'Not checked', hint: 'No verdict, or one from code that no longer exists' },
          { k: 'complete', label: 'Complete', hint: 'Every MES step named AND timed' },
          { k: 'in_demand', label: 'In demand', hint: 'Planner 13wk or eDash ~4wk' },
        ].map(c => (
          <div key={c.k} className="rounded-xl border bg-card p-3" title={c.hint}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className={cn('text-xl font-semibold tabular-nums',
              c.k === 'complete' && TONE.complete, c.k === 'ungraded' && 'text-muted-foreground')}>
              {n(t[c.k])}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a workcell"
                 className="h-8 w-56 pl-8 text-xs" />
        </div>
        <span className="text-xs text-muted-foreground">{sorted.length} workcells</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-[84rem] items-center gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
             style={{ gridTemplateColumns: GRID }}>
          {head('Workcell', 'workcell', 'justify-start')}
          {head('Models', 'models')}
          {/* THE THREE BUCKETS. 100% coverage, straight from IEDB. */}
          {head('Has CT', 'has_ct')}
          {head('No CT', 'no_ct')}
          {head('Not in IEDB', 'not_iedb')}
          <div className="text-center">Split</div>
          {/* Everything right of here is a share of what we CHECKED, not of all. */}
          {head('Checked', 'graded')}
          {head('Coverage', 'pct_graded')}
          {head('Complete', 'complete')}
          {head('Incomplete', 'incomplete')}
          {head('Unbuilt', 'not_built')}
          {head("Can't check", 'cannot_check')}
          {head('Built 24mo', 'built_24mo')}
          {head('Of checked', 'pct_complete_of_graded')}
        </div>

        {sorted.map(w => (
          <button key={w.workcell}
            onClick={() => navigate(`/cycle-time/${encodeURIComponent(w.workcell)}?tab=report`)}
            className="grid min-w-[84rem] w-full items-center gap-2 border-b px-4 py-1.5 text-left text-xs last:border-0 hover:bg-muted/30"
            style={{ gridTemplateColumns: GRID }}>
            <span className="truncate font-medium" title={w.workcell}>{w.workcell}</span>
            <span className="text-right font-medium tabular-nums">{n(w.models)}</span>
            <span className={cn('text-right tabular-nums', TONE.complete)}>{n(w.has_ct)}</span>
            <span className={cn('text-right tabular-nums', TONE.no_cycle_time)}>{n(w.no_ct)}</span>
            <span className={cn('text-right tabular-nums', TONE.not_in_iedb)}>{n(w.not_iedb)}</span>
            <span className="px-1"><Buckets has={w.has_ct} no={w.no_ct} absent={w.not_iedb} /></span>
            <span className="text-right tabular-nums">{n(w.graded)}</span>
            <Bar pct={w.pct_graded} tone="bg-sky-500" />
            <span className={cn('text-right tabular-nums', TONE.complete)}>{n(w.complete)}</span>
            <span className={cn('text-right tabular-nums', TONE.incomplete)}>{n(w.incomplete)}</span>
            <span className={cn('text-right tabular-nums', TONE.not_built)}>{n(w.not_built)}</span>
            <span className={cn('text-right tabular-nums', TONE.cannot_check)}>{n(w.cannot_check)}</span>
            <span className="text-right tabular-nums text-muted-foreground">{n(w.built_24mo)}</span>
            <Bar pct={w.pct_complete_of_graded} tone="bg-emerald-500" />
          </button>
        ))}
      </div>

      {/* Reconcilable, not just trustworthy. */}
      {data.excluded.rows > 0 && (
        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {n(data.excluded.rows)} MES rows excluded
          </span>{' '}
          — not products, so they are not counted as models:
          {Object.entries(data.excluded.why).map(([why, c]) => (
            <span key={why} className="ml-2">· {n(c)} {why}</span>
          ))}
        </div>
      )}
    </div>
  );
}
