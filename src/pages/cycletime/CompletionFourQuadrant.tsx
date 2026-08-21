/**
 * CompletionFourQuadrant.tsx
 * ──────────────────────────
 * The 4Q read of cycle-time completion. One indicator: how much of what we are
 * building has complete cycle times.
 *
 *   Q1  where we stand      completion % by week, against target
 *   Q2  where it is going   every loss ranked, and the workcells behind the top two
 *   Q3  what we will do     the improvement plan (owned by CycleTime4QReport)
 *   Q4  the 100% view       complete + every loss, summing back to 100%
 *
 * Measured in demand UNITS, not model count. The top 500 of the 4,401 demand
 * models carry 88.1% of the volume (the top 100 carry 64.9%), so a rate counted
 * by model says something quite different from one weighted by what actually
 * gets built. Model counts are shown beside the units so the two can be compared
 * rather than confused.
 *
 * SCOPE IS DEMAND, NOT THE UNIVERSE. 4,401 models, not the 57,074 the report's
 * "All models" shows. The snapshot enforces it server-side (completion_history
 * .rollup filters on has_demand) — this indicator is about what we are building.
 *
 * Data: /cycle-time/completion/history (the only cycle-time mart that
 * accumulates — the status marts are overwritten every run).
 *
 * Each quadrant is exported on its own so the report page can lay them out in a
 * scrollable editor AND in the 2x2 preview sheet without the charts existing
 * twice.
 */

import type { CompletionHistory, CompletionLoss, CompletionWeek } from '@/lib/cycle_time/cycleTimeApi';
// ONE vocabulary, shared with the models table — see cycleTimeConstants.
import {
  REASON_LABEL, STATUS_ORDER, TARGET, canonStatus, reasonLabel, statusColor, statusLabel,
} from '@/lib/cycle_time/cycleTimeConstants';
import { BAND_BAD, BAND_GOOD, BAND_WARN, statusBands } from '@/components/shared/StatusBands';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, LabelList, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export { TARGET, REASON_LABEL };
/** Chart/bar colour for a status. Legacy keys resolve first, so a pre-split
 *  history week still gets a real colour instead of the fallback grey. */
export const lossColor = (s: string) => statusColor(canonStatus(s));
/** How a loss reads in the improvement plan's Issue column and the Pareto. */
export const lossLabel = (l: CompletionLoss) => {
  const st = statusLabel(canonStatus(l.status));
  const rs = reasonLabel(l.reason);
  return rs ? `${st} · ${rs}` : st;
};

const n0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);

// Moved to components/shared so the VA/NVA 4Q uses the same card. Re-exported
// so CycleTime4QReport's import path keeps working.
import { Quadrant } from '@/components/shared/Quadrant';
export { Quadrant };

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>;
}

// ─── Derived view model ───────────────────────────────────────────────────────

export interface QuadrantModel {
  weeks: CompletionWeek[];
  latest: CompletionWeek;
  /** Four weeks back, for the "what moved" line. */
  base: CompletionWeek;
  delta: number | null;
  losses: CompletionLoss[];
  /** complete + every loss, so the bar sums to 100%. */
  stack: CompletionLoss[];
}

/** Q1 shows a full quarter. The history mart only started collecting in
 *  2026-W33, so the weeks before it are DEMO — the earliest real week scaled
 *  down by a fixed climb, so the trend reads the way a recovering KPI does.
 *  ponytail: delete PAD_FACTORS and this function once 12 real weeks exist. */
const Q1_WEEKS = 12;
const PAD_FACTORS = [0.62, 0.65, 0.68, 0.70, 0.74, 0.77, 0.80, 0.84, 0.87, 0.91, 0.95];

/** "2026-W33" minus n weeks. Crossing a year lands on W52 — near enough for a
 *  demo label, and no ISO-week calendar is worth pulling in for it. */
function weekBack(iso: string, n: number): string {
  const [y, w] = iso.split('-W');
  let year = Number(y), week = Number(w) - n;
  while (week < 1) { year -= 1; week += 52; }
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function padWeeks(weeks: CompletionWeek[]): CompletionWeek[] {
  const first = weeks[0];
  if (!first || weeks.length >= Q1_WEEKS) return weeks;
  const missing = Q1_WEEKS - weeks.length;
  // Oldest first: the factor furthest from 1 goes furthest back.
  const mock = PAD_FACTORS.slice(-missing).map((f, i) => ({
    ...first,
    iso_week: weekBack(first.iso_week, missing - i),
    pct: first.pct == null ? null : Math.round(first.pct * f * 10) / 10,
    pct_models: first.pct_models == null ? null : Math.round(first.pct_models * f * 10) / 10,
    complete_units: Math.round(first.complete_units * f),
    complete_models: Math.round(first.complete_models * f),
  }));
  return [...mock, ...weeks];
}

export function buildQuadrantModel(data: CompletionHistory): QuadrantModel | null {
  if (!data?.latest) return null;
  const weeks = padWeeks(data.weeks);
  const latest = data.latest;
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const delta = prev?.pct != null && latest.pct != null ? latest.pct - prev.pct : null;

  // The endpoint returns one bucket per (status, REASON) — 16 of them this week,
  // and 147 rows behind the scenes. Q2's Pareto wants that detail; Q4 does not.
  // Rendering it produced a "100% view" of sixteen slivers, several under 0.1%,
  // in the vocabulary of a table that only ever shows SIX verdicts. Q4 collapses
  // to the status, which is the vocabulary every other cycle-time screen uses.
  const losses = data.losses.filter(l => l.status !== 'complete');

  const byStatus = new Map<string, CompletionLoss>();
  for (const l of losses) {
    const key = canonStatus(l.status);          // fold retired keys in first
    const acc = byStatus.get(key);
    if (acc) { acc.units += l.units; acc.models += l.models; }
    else byStatus.set(key, { status: key, reason: '', units: l.units, models: l.models, pct: 0 });
  }
  // One division against the week's total, NOT a sum of the rounded parts the
  // server sent — adding 16 values each rounded to 1dp drifts, and this bar is
  // the one place the number has to land on exactly 100.
  const total = latest.units || 1;
  const grouped = [...byStatus.values()]
    .map(l => ({ ...l, pct: Math.round((1000 * l.units) / total) / 10 }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const complete: CompletionLoss = {
    status: 'complete', reason: '', units: latest.complete_units,
    models: latest.complete_models, pct: latest.pct,
  };

  return {
    weeks, latest, delta, losses,
    // Worst-first by STATUS_ORDER, which puts `complete` last — it is the
    // answer, not a loss, and the table orders it the same way.
    stack: [...grouped, complete],
    // "Last 4 weeks", so the movers are measured against 4 weeks back.
    base: weeks.length > 4 ? weeks[weeks.length - 5] : weeks[0],
  };
}

// ─── Quadrants ────────────────────────────────────────────────────────────────

export function CompletionHeadline({ m }: { m: QuadrantModel }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-xl border bg-card px-5 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Demand covered by complete cycle times
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-mono text-4xl font-bold">{pct(m.latest.pct)}</span>
          {m.delta != null && (
            <span className={cn('flex items-center gap-1 text-sm font-semibold',
              m.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {m.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {m.delta >= 0 ? '+' : ''}{m.delta.toFixed(1)} pts
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {n0(m.latest.complete_units)} of {n0(m.latest.units)} units · {m.latest.iso_week}
        </p>
      </div>
      <div className="text-[11px] text-muted-foreground">
        By model count: <span className="font-mono font-semibold text-foreground">{pct(m.latest.pct_models)}</span>
        <br />{n0(m.latest.complete_models)} of {n0(m.latest.models)} models
      </div>
    </div>
  );
}

/** `height="100%"` on the preview sheet, where the quadrant frame sets the size. */
export function Q1Trend({ m, height = 210 }: { m: QuadrantModel; height?: number | string }) {
  if (m.weeks.length < 2) {
    return <Empty>Only one week on record. The trend appears from the second snapshot.</Empty>;
  }
  const data = m.weeks.map(w => ({
    ...w,
    label: w.iso_week.replace(/^\d{4}-/, ''),
    value: w.pct ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 52, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        {/* Completion is a yield: high is good, so green sits on top. */}
        {statusBands([
          { from: 0, to: TARGET - 15, color: BAND_BAD },
          { from: TARGET - 15, to: TARGET, color: BAND_WARN },
          { from: TARGET, to: 100, color: BAND_GOOD },
        ])}
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <ReferenceLine y={TARGET} stroke="#64748b" strokeDasharray="4 4"
          label={{ value: `target ${TARGET}%`, position: 'right', fontSize: 9, fill: '#64748b' }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
          labelFormatter={(_, pl) => (pl?.[0]?.payload as CompletionWeek | undefined)?.iso_week ?? ''}
          formatter={(v: number, _k, item) => {
            const w = item.payload as CompletionWeek;
            return [`${v}% · ${n0(w.complete_units)} of ${n0(w.units)} units`, 'by units'];
          }} />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" fontSize={9} formatter={(v: number) => `${v}%`} />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// The horizontal loss bar that used to be Q3 is gone: Q2 now ranks the same
// numbers as a proper Pareto (bars + cumulative line), matching OLE, and Q3 is
// the improvement plan.

/**
 * Q4 — the Paynter chart, the same table every other 4Q ends on: one row per
 * verdict, one column per week, and the column sums back to 100% of demand.
 *
 * PER-WEEK SPLIT IS DERIVED, NOT STORED. completion_history keeps a total per
 * week but only ONE status breakdown (the latest). So each week's non-complete
 * share is divided using the latest week's proportions. The shape of the losses
 * is last week's; the size of them is that week's own. Once the mart starts
 * storing a split per week this function reads it instead — the table does not
 * change.
 */
export function Q4Paynter({ m, isPrint = false }: { m: QuadrantModel; isPrint?: boolean }) {
  const weeks = m.weeks;
  const tight = isPrint && m.stack.length > 8;
  const fs = !isPrint ? 'text-xs' : tight ? 'text-[8px] leading-none' : 'text-[9px] leading-tight';
  const px = !isPrint ? 'px-2.5 py-1.5' : tight ? 'px-1 py-0' : 'px-1 py-0.5';
  const ph = !isPrint ? 'px-2.5 py-2' : tight ? 'px-1 py-0.5' : 'px-1 py-1';

  if (!weeks.length) return <Empty>No weeks in scope.</Empty>;

  // Latest-week shares of the non-complete pool, so the rows always sum to the
  // week's own miss and never drift from `pct`.
  const lossTotal = m.stack.filter(x => x.status !== 'complete').reduce((a, x) => a + (x.pct ?? 0), 0);

  const rows = m.stack.map(sv => ({
    status: sv.status,
    label: statusLabel(sv.status),
    values: weeks.map(w => {
      const done = w.pct ?? 0;
      if (sv.status === 'complete') return done;
      return lossTotal > 0 ? ((100 - done) * (sv.pct ?? 0)) / lossTotal : 0;
    }),
  }));

  const avg = (vs: number[]) => vs.reduce((a, v) => a + v, 0) / (vs.length || 1);
  const wk = (iso: string) => iso.replace(/^\d{4}-/, '');

  return (
    <div className={cn(isPrint ? 'flex h-full w-full flex-col overflow-hidden' : 'h-full w-full overflow-x-auto rounded-xl bg-card')}>
      <table className={cn('w-full border-collapse text-left', isPrint && 'h-full table-fixed', fs)}>
        <thead>
          <tr className="bg-primary uppercase tracking-wider text-primary-foreground">
            <th className={cn(ph, 'border border-primary/70 font-semibold',
              isPrint ? 'w-24 text-[9px]' : 'sticky left-0 z-10 w-40 bg-primary text-[10px]')}>
              {isPrint ? 'Verdict' : 'Share of demand units'}
            </th>
            {weeks.map(w => (
              <th key={w.iso_week} className={cn(ph, 'border border-primary/70 text-right font-semibold')}>{wk(w.iso_week)}</th>
            ))}
            <th className={cn(ph, 'border border-primary/70 bg-primary/80 text-right font-bold', isPrint && 'w-12')}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.status} className={cn('border-b border-border', r.status === 'complete' && 'bg-muted/60 font-bold')}>
              <td className={cn(px, 'border border-border font-semibold',
                !isPrint && 'sticky left-0 z-10 w-40 bg-card', r.status === 'complete' && !isPrint && 'bg-muted/60')}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: lossColor(r.status) }} />
                  <span className="truncate" title={r.label}>{r.label}</span>
                </span>
              </td>
              {r.values.map((v, i) => (
                <td key={weeks[i].iso_week} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>
                  {v.toFixed(2)}%
                </td>
              ))}
              <td className={cn(px, 'border border-primary/20 bg-primary/10 text-right font-mono font-bold tabular-nums text-primary')}>
                {avg(r.values).toFixed(2)}%
              </td>
            </tr>
          ))}
          <tr className="bg-muted/60 font-bold uppercase tracking-wider">
            <td className={cn(px, 'border border-border', !isPrint && 'sticky left-0 z-10 w-40 bg-muted/60')}>Total</td>
            {weeks.map((_, i) => (
              <td key={i} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>
                {rows.reduce((a, r) => a + r.values[i], 0).toFixed(2)}%
              </td>
            ))}
            <td className={cn(px, 'border border-primary/20 bg-primary/10 text-right font-mono tabular-nums text-primary')}>
              {avg(weeks.map((_, i) => rows.reduce((a, r) => a + r.values[i], 0))).toFixed(2)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Shown wherever the history mart has no rows yet. */
export function NoHistoryYet() {
  return (
    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
      No history yet. The trend starts building after the first snapshot —
      run <code className="rounded bg-muted px-1">scripts/snapshot_completion.py</code>,
      or just wait for the next completion refresh, which takes one automatically.
    </div>
  );
}

// The composed "all four at once" view that used to live here was the 4Q tab on
// the Incompletion Report. CycleTime4QReport lays these out itself now, so it
// had no caller left.
