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
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

export function Quadrant({ n, title, sub, children }: {
  n: string; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold text-muted-foreground">{n}</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </div>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </div>
  );
}

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

export function buildQuadrantModel(data: CompletionHistory): QuadrantModel | null {
  if (!data?.latest) return null;
  const weeks = data.weeks;
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

export function Q1Trend({ m, height = 210 }: { m: QuadrantModel; height?: number }) {
  if (m.weeks.length < 2) {
    return <Empty>Only one week on record. The line appears from the second snapshot.</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={m.weeks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="iso_week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <ReferenceLine y={TARGET} strokeDasharray="4 4" className="stroke-muted-foreground" />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
          formatter={(v: number, k) => [k === 'pct' ? `${v}%` : n0(v), k === 'pct' ? 'by units' : 'by models']} />
        <Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="pct_models" stroke="#94a3b8" strokeWidth={1}
          strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// The horizontal loss bar that used to be Q3 is gone: Q2 now ranks the same
// numbers as a proper Pareto (bars + cumulative line), matching OLE, and Q3 is
// the improvement plan.

export function Q4Stack({ m }: { m: QuadrantModel }) {
  return (
    <>
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {m.stack.filter(s => (s.pct ?? 0) > 0).map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: lossColor(s.status) }}
            title={`${statusLabel(s.status)} ${pct(s.pct)}`} />
        ))}
      </div>
      <div className="mt-3 space-y-1">
        {m.stack.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: lossColor(s.status) }} />
            {/* Status only. The reason breakdown lives in Q2's Pareto, which is
                where the detail is actionable. */}
            <span className="min-w-0 flex-1 truncate">{statusLabel(s.status)}</span>
            <span className="w-16 text-right tabular-nums text-muted-foreground">
              {n0(s.models)}
            </span>
            <span className="tabular-nums text-muted-foreground">{n0(s.units)}</span>
            <span className="w-12 text-right font-mono font-semibold tabular-nums">{pct(s.pct)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1 text-[11px] font-semibold">
          <span className="flex-1">Total</span>
          <span className="w-16 text-right tabular-nums text-muted-foreground">{n0(m.latest.models)}</span>
          <span className="tabular-nums text-muted-foreground">{n0(m.latest.units)}</span>
          {/* Derived from units, NOT by summing the rounded parts. Each of the
              ~147 buckets is rounded to 1dp server-side, so adding them up drifts
              — the W34 stack sums to 100.1%. In the quadrant whose entire point
              is that everything adds back to 100, that reads as a broken number. */}
          <span className="w-12 text-right font-mono tabular-nums">
            {pct(m.latest.units
              ? (100 * m.stack.reduce((a, s) => a + s.units, 0)) / m.latest.units
              : null)}
          </span>
        </div>
      </div>
    </>
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
