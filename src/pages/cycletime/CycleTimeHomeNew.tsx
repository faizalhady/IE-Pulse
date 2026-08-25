/**
 * CycleTimeHomeNew.tsx  —  TEMPORARY, a candidate landing page
 * ────────────────────────────────────────────────────────────
 * A copy of WorkcellCoverage with the workcell logo and its home plant in the
 * first column, so the list reads like the rest of the platform instead of like
 * a spreadsheet. Kept as a SEPARATE file on purpose: it is being tried out, and
 * the real Coverage page must keep working while that happens.
 *
 * Delete one of the two once a decision is made. Do not let both live.
 *
 * ── inherited from WorkcellCoverage ──
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
import { ClipboardList, Layers, Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { SortHeader } from '@/components/shared/SortHeader';
import { useSortable } from '@/hooks/shared/useSortable';
import { cycleTimeApi, type UniverseWorkcell } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { ExportButton } from '@/components/shared/ExportButton';
import type { ExportColumn } from '@/lib/cycle_time/exportTable';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import DemandCompletionReport from './DemandCompletionReport';

// Workcell · Models | Has CT · No CT · Not in IEDB · Split | Checked · Coverage
// · Complete · Incomplete · Unbuilt · Built 24mo
// The 12 tracks need 80.5rem (58rem fixed + 15rem workcell min + 5.5rem gaps
// + 2rem padding). The container asked for min-w-90rem, so on every screen it
// forced 9.5rem it did not need: the sole fr track swallowed the slack, the
// workcell column went cavernous, and the right-hand columns fell off the edge.
// min-w now matches what the tracks actually need.
const GRID =
  'minmax(13rem,1.4fr) 5rem  5.25rem 5rem 5.75rem 6.5rem  5.25rem 5rem 5.5rem 5rem  5.75rem';

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

/** Mirrors the on-screen columns, in the same order. Kept beside the table so
 *  adding a column to one and forgetting the other is visible in one diff. */
/** Built per scope, because the sheet has to say what the screen said. A fixed
 *  active_* spec would export Active numbers under a header saying Planned. */
function coverageColumns(pre: string, totalKey: string, label: string):
    ExportColumn<UniverseWorkcell>[] {
  // The un-prefixed ("all") set spells two buckets differently.
  const k = (name: string) => (pre ? `${pre}${name}`
    : name === 'not_iedb' ? 'not_in_iedb'
    : name === 'no_ct' ? 'no_cycle_time' : name);
  const num = (w: UniverseWorkcell, name: string) =>
    (w as unknown as Record<string, number | null | undefined>)[k(name)] ?? null;
  return [
    { key: 'workcell', header: 'Workcell', width: 26 },
    { key: 'plant',    header: 'Plant',    width: 14 },
    { key: totalKey,   header: label,      width: 12, numFmt: '#,##0',
      get: w => (w as unknown as Record<string, number | null>)[totalKey] ?? null },
    { key: 'has_ct_s',     header: 'With cycle time', width: 15, numFmt: '#,##0', get: w => num(w, 'has_ct') },
    { key: 'no_ct_s',      header: 'No cycle time',   width: 14, numFmt: '#,##0', get: w => num(w, 'no_ct') },
    { key: 'not_iedb_s',   header: 'Not in IEDB',     width: 13, numFmt: '#,##0', get: w => num(w, 'not_iedb') },
    { key: 'complete_s',   header: 'Complete',        width: 11, numFmt: '#,##0', get: w => num(w, 'complete') },
    { key: 'incomplete_s', header: 'Partial',         width: 11, numFmt: '#,##0', get: w => num(w, 'incomplete') },
    { key: 'not_built_s',  header: 'No build found',  width: 14, numFmt: '#,##0', get: w => num(w, 'not_built') },
    { key: 'pct_s', header: '% complete of timed', width: 18, numFmt: '0.0',
      get: w => { const h = Number(num(w, 'has_ct') ?? 0);
                  return h ? (Number(num(w, 'complete') ?? 0) / h) * 100 : null; } },
    { key: 'models', header: 'All models (incl. dormant)', width: 22, numFmt: '#,##0' },
  ];
}

/** The three scopes, and the column prefix each reads. `all` has no prefix -
 *  those are the original whole-pool columns, which is why it maps to ''. */
const SCOPES = [
  { key: 'planned', label: 'Planned', pre: 'planned_', total: 'planned',
    hint: 'On the planner 13-week list or the eDash 4-week projection' },
  { key: 'active',  label: 'Active',  pre: 'active_',  total: 'active',
    hint: 'Ran in MES since Sep 2024, or planned. What the plant is actually building' },
  { key: 'all',     label: 'All models', pre: '',      total: 'models',
    hint: 'Every model that exists, including ones nobody has built in years' },
] as const;
type ScopeKey = typeof SCOPES[number]['key'];

function CoverageTab() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  // Active by default — the same default the workcell page and the cards use.
  // Three screens disagreeing about what "a model" means is what this whole
  // rebuild was fixing.
  const [scope, setScope] = useState<ScopeKey>('active');
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

  const S = SCOPES.find(x => x.key === scope)!;
  const coverageCols = useMemo(
    () => coverageColumns(S.pre, S.total, S.label), [S.pre, S.total, S.label]);
  /** Column key for the current scope, e.g. 'has_ct' -> 'active_has_ct'. */
  const f = (name: string) => (`${S.pre}${name}`) as SortKey;
  /** Value of a scoped column for one workcell row. */
  const v = (w: UniverseWorkcell, name: string) =>
    (w as unknown as Record<string, number | null | undefined>)[f(name)] ?? 0;
  const totalOf = (w: UniverseWorkcell) =>
    (w as unknown as Record<string, number | null | undefined>)[S.total] ?? 0;

  const ACCESSORS = useMemo(() => {
    // Every scope's columns, so a sort survives switching scope.
    const scoped = SCOPES.flatMap(sc => [sc.total,
      `${sc.pre}has_ct`, `${sc.pre}no_ct`, `${sc.pre}not_iedb`,
      `${sc.pre}complete`, `${sc.pre}incomplete`, `${sc.pre}not_built`]);
    const keys = ['workcell', 'plant', 'models', 'in_iedb', 'built_24mo', 'in_demand',
      'graded', 'ungraded', 'pct_graded', 'pct_complete_of_graded',
      ...new Set(scoped)] as SortKey[];
    return Object.fromEntries(keys.map(k => [k, (w: UniverseWorkcell) =>
      (w as unknown as Record<string, string | number | null>)[k] ?? null])) as
      Record<SortKey, (w: UniverseWorkcell) => string | number | null>;
  }, []);

  const { sorted, sort, toggle } = useSortable<UniverseWorkcell, SortKey>(
    rows, ACCESSORS, { key: 'active', dir: 'desc' });

  // The un-prefixed set spells two buckets differently — `not_in_iedb` and
  // `no_cycle_time` where the scoped ones use `not_iedb` / `no_ct`. Map here so
  // the table body can ask for one name and get the right column in every scope.
  const colOf = (name: string) => (S.pre ? `${S.pre}${name}`
    : name === 'not_iedb' ? 'not_in_iedb'
    : name === 'no_ct' ? 'no_cycle_time' : name);
  const val = (w: UniverseWorkcell, name: string) =>
    (w as unknown as Record<string, number | null | undefined>)[colOf(name)] ?? 0;

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
  // ACTIVE is the scope now: MES saw it run since `active_since`, or it is on
  // the forward list. Dormant models are still counted in `models` and still
  // queryable — the page just stops leading with them.
  const since = data.active_since ?? '2024-09-01';
  const sinceLabel = new Date(since + 'T00:00:00')
    .toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  /** A scoped total off the summary, e.g. tv('has_ct') -> totals.active_has_ct.
   *  The cards used to be hardwired to active_* while the table below them
   *  followed the toggle, so switching scope moved the table and left the
   *  headline saying something else. */
  const tv = (name: string) => t[colOf(name)] ?? 0;
  const scopeTotal = t[S.total] ?? 0;
  const outOfScope = (t.models ?? 0) - scopeTotal;
  // NO BUILD FOUND = not_built + everything else the comparison could not
  // decide. Derived by subtraction, so the three tiles ALWAYS reconcile to the
  // scope's has_ct — a hand-summed version drifts the day a new verdict is added.
  //
  // The tail it absorbs is small and mixed: models the catalogue and raw.parquet
  // disagree about, workcells that are not on MES at all, and a handful with no
  // verdict yet. They were their own "Other" tile, which bought a question at
  // every readout and answered nothing anyone could act on. The tooltip still
  // spells out the split so the number is never a black box to whoever asks.
  const noBuild = tv('has_ct') - tv('complete') - tv('incomplete');
  const head = (label: string, k: SortKey, cls = 'justify-end') => (
    <SortHeader label={label} active={sort?.key === k} dir={sort?.dir}
                onClick={() => toggle(k)} className={cls} />
  );

  return (
    <div className="h-full space-y-4 overflow-auto p-4 md:p-6">

      {/* ROW 1 — the ACTIVE pool and how much of it IEDB has timed.
          This used to lead with all 58,000 models, most of which the factory has
          not built in years, so the page opened on a number nobody could act on.
          Scoping to what actually ran turns the headline from "84% unchecked"
          into "36% of what we build has never been timed" — same data, a
          question with an owner. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { k: 'total', label: S.label === 'All models' ? 'Models' : S.label, tone: '',
            v: scopeTotal,
            sub: scope === 'active' ? `active since ${sinceLabel}`
               : scope === 'planned' ? 'planner 13wk + eDash 4wk'
               : 'every model that exists',
            hint: S.hint },
          { k: 'has_ct', label: 'With cycle time', tone: TONE.complete, pct: true,
            hint: 'IEDB has priced it, so the comparison can decide something' },
          { k: 'no_ct', label: 'No cycle time', tone: TONE.no_cycle_time, pct: true,
            hint: 'IEDB carries the model but nobody has timed it — an IE task' },
          { k: 'not_iedb', label: 'Not in IEDB', tone: TONE.not_in_iedb, pct: true,
            hint: 'IEDB has never heard of it. We build it and it does not exist in the system — it has to be created before it can be timed' },
          // The remainder always reconciles to the whole universe, whichever
          // scope is picked, so a scoped headline can never read as the total.
          { k: '_rest', label: scope === 'all' ? 'All models' : 'Out of scope',
            tone: 'text-muted-foreground',
            v: scope === 'all' ? (t.models ?? 0) : outOfScope,
            sub: scope === 'all' ? 'the whole universe' : 'still stored, not shown',
            hint: scope === 'all'
              ? 'Every model across IEDB, MES and demand'
              : `Not in the ${S.label} scope. Counted, kept, queryable — just not the priority` },
        ].map(c => {
          const v = c.v ?? tv(c.k);
          return (
            <div key={c.k} className="rounded-xl border bg-card p-3" title={c.hint}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <div className={cn('text-xl font-semibold tabular-nums', c.tone)}>{n(v)}</div>
              {c.sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{c.sub}</div>}
              {c.pct && scopeTotal > 0 && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {Math.round((v / scopeTotal) * 100)}% of {S.label.toLowerCase()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ROW 2 — ONE population: the ACTIVE models IEDB has timed. Every tile
          here is a share of `active_has_ct`, and the four add back up to it
          exactly (the fourth is derived by subtraction for that reason).

          "No build found" is 0.8% now, where the old "No recent build" card was
          84%. Nothing was hidden: a model can no longer be called active unless
          MES saw it run, so "active but never built" is close to impossible by
          construction. The old card was an artefact of checking a 120-day window
          against a pool of every model IEDB ever priced. */}
      <div className="text-[11px] text-muted-foreground">
        Below: the{' '}
        <span className="font-medium text-foreground">{n(tv('has_ct'))}</span>{' '}
        {S.label.toLowerCase()} models IEDB has a cycle time for, compared step by
        step against what MES actually ran — every day for 3 years across 39
        workcells. The other{' '}
        <span className="font-medium text-foreground">
          {n(tv('no_ct') + tv('not_iedb'))}
        </span>{' '}
        have no cycle time to check.
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { k: 'complete', label: 'Complete', tone: TONE.complete, v: tv('complete'),
            hint: 'Every step the floor ran is named in IEDB and has a cycle time' },
          { k: 'partial', label: 'Partial', tone: TONE.incomplete, v: tv('incomplete'),
            hint: 'Built recently, but a step is missing a cycle time or our naming '
                + 'bridge could not identify it. This is the fix list' },
          { k: 'nobuild', label: 'No build found', tone: 'text-muted-foreground', v: noBuild,
            hint: `Nothing to compare against. ${n(tv('not_built'))} have no MES production `
                + `in the window; the remaining ${n(noBuild - tv('not_built'))} could not be `
                + 'decided — the catalogue and the cycle-time mart disagree about them, their '
                + 'workcell is not on MES, or no verdict has been reached yet' },
        ].map(c => (
          <div key={c.k} className="rounded-xl border bg-card p-3" title={c.hint}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className={cn('text-xl font-semibold tabular-nums', c.tone)}>{n(c.v)}</div>
            {tv('has_ct') > 0 && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {Math.round((c.v / tv('has_ct')) * 100)}% of timed
              </div>
            )}
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

        {/* Same three scopes, same order, same default as the workcell page.
            The table used to be fixed to Active while that page could switch,
            so the two screens answered "how many models" differently. */}
        <div className="ml-auto flex items-center rounded-lg border bg-card p-0.5">
          {SCOPES.map(sc => (
            <button key={sc.key} onClick={() => setScope(sc.key)} title={sc.hint}
              className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                scope === sc.key ? 'bg-primary text-primary-foreground'
                                 : 'text-muted-foreground hover:text-foreground')}>
              {sc.label}
              <span className="ml-1 tabular-nums opacity-70">
                {n(t[sc.total])}
              </span>
            </button>
          ))}
        </div>

        {/* Exports `sorted` — the rows the table is about to draw, so the search
            box and the scope both narrow the file. */}
        <ExportButton
          rows={sorted}
          columns={coverageCols}
          filename="cycle_time_coverage"
          sheetName="Coverage"
          title="Cycle Time — Workcell Coverage"
          subtitle={`Scope: ${S.label} — ${S.hint}.`
            + ` ${n(t[S.total])} models across ${sorted.length} workcells.`
            + (q.trim() ? ` Filtered by "${q.trim()}".` : '')}
          scopeNote={q.trim() ? `filtered from ${(data.workcells ?? []).length}` : undefined}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-[78rem] items-center gap-2 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
             style={{ gridTemplateColumns: GRID }}>
          {head('Workcell', 'workcell', 'justify-start')}
          {/* EVERY column left of "All models" is the ACTIVE scope. The table
              used to lead with the full pool, so KEYSIGHT read 24,080 while the
              cards above it read 5,783 for the same workcell — the page argued
              with itself. `models` is still here, last and muted, because the
              dormant count has to stay reconcilable. */}
          {head(S.label === 'All models' ? 'Models' : S.label, S.total as SortKey)}
          {head('Has CT', colOf('has_ct') as SortKey)}
          {head('No CT', colOf('no_ct') as SortKey)}
          {head('Not in IEDB', colOf('not_iedb') as SortKey)}
          <div className="text-center">Split</div>
          {head('Complete', colOf('complete') as SortKey)}
          {head('Partial', colOf('incomplete') as SortKey)}
          {head('No build', colOf('not_built') as SortKey)}
          {head('Coverage', 'pct_complete_of_graded')}
          {head('All models', 'models')}
        </div>

        {sorted.map(w => (
          <button key={w.workcell}
            onClick={() => navigate(`/cycle-time/${encodeURIComponent(w.workcell)}`)}
            className="grid min-w-[78rem] w-full items-center gap-2 border-b px-4 py-1.5 text-left text-xs last:border-0 hover:bg-muted/30"
            style={{ gridTemplateColumns: GRID }}>
            {/* Logo, name, plant — the same identity block the workcell page
                uses, so a workcell looks the same everywhere. The logo is a
                recognition shortcut; the plant answers "where is this?" without
                a second column. */}
            <span className="flex min-w-0 items-center gap-2.5">
              {getWorkcellLogo(w.workcell) ? (
                <span className="flex h-7 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border"
                      style={{ backgroundColor: getWorkcellLogoBg(w.workcell) ?? '#ffffff' }}>
                  <img src={getWorkcellLogo(w.workcell)!} alt="" className="h-full w-full object-contain p-0.5" />
                </span>
              ) : (
                <span className="flex h-7 w-14 shrink-0 items-center justify-center rounded border border-border bg-muted text-[9px] font-bold text-muted-foreground">
                  {w.workcell.slice(0, 4).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium leading-tight" title={w.workcell}>{w.workcell}</span>
                <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                  {w.plant ?? 'plant unknown'}
                </span>
              </span>
            </span>
            <span className="text-right font-medium tabular-nums">{n(totalOf(w))}</span>
            <span className={cn('text-right tabular-nums', TONE.complete)}>{n(val(w, 'has_ct'))}</span>
            <span className={cn('text-right tabular-nums', TONE.no_cycle_time)}>{n(val(w, 'no_ct'))}</span>
            <span className={cn('text-right tabular-nums', TONE.not_in_iedb)}>{n(val(w, 'not_iedb'))}</span>
            <span className="px-1">
              <Buckets has={val(w, 'has_ct')} no={val(w, 'no_ct')} absent={val(w, 'not_iedb')} />
            </span>
            <span className={cn('text-right tabular-nums', TONE.complete)}>{n(val(w, 'complete'))}</span>
            <span className={cn('text-right tabular-nums', TONE.incomplete)}>{n(val(w, 'incomplete'))}</span>
            <span className={cn('text-right tabular-nums', TONE.not_built)}>{n(val(w, 'not_built'))}</span>
            {/* Complete as a share of what is TIMED in the CURRENT scope — the
                only denominator on this row the reader can actually see. */}
            <Bar pct={val(w, 'has_ct') > 0
                      ? (val(w, 'complete') / val(w, 'has_ct')) * 100 : null}
                 tone="bg-emerald-500" />
            <span className="text-right tabular-nums text-muted-foreground" title="Every model incl. dormant">
              {n(w.models)}
            </span>
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

/** The landing page. Two questions, in the order they get asked: how much do we
 *  cover, then what is in demand right now. Report is the same component the
 *  /cycle-time/completion route renders — one component, so the two can never
 *  show a different verdict for the same model. */
const TABS = [
  { key: 'coverage', label: 'Coverage', icon: Layers,
    tip: 'Every workcell, every model — what IEDB has priced and what it has not' },
  { key: 'report',   label: 'Report',   icon: ClipboardList,
    tip: 'Models in demand — MES plan (~4wk) + planner forecast (~13wk)' },
] as const;

export default function CycleTimeHomeNew() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('coverage');
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background px-4 pt-4 md:px-6">
        <h1 className="text-lg font-bold">Cycle Time</h1>
        <p className="text-xs text-muted-foreground">
          Every workcell, every model we know of — from IEDB, MES and demand,
          deduplicated. Pick a workcell to go into its models.
        </p>
        {/* -mb-px inside UnderlineTabs lands the active underline on this
            header's bottom border, so the tabs must come last. */}
        <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} className="mt-3" />
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'coverage' ? <CoverageTab /> : <DemandCompletionReport embedded />}
      </div>
    </div>
  );
}
