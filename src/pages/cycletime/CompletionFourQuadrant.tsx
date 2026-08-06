/**
 * CompletionFourQuadrant.tsx
 * ──────────────────────────
 * The 4Q read of the Incompletion Report. One indicator: how much of what we
 * are building has complete cycle times.
 *
 *   Q1  where we stand      completion % by week, against target
 *   Q2  the last 4 weeks    the same number split by plant, then by workcell
 *   Q3  what it is costing  every loss ranked by the DEMAND UNITS at stake
 *   Q4  the 100% view       complete + every loss, summing back to 100%
 *
 * Measured in demand UNITS, not model count. The top 500 of ~4,100 models are
 * 88% of the volume, so a rate counted by model says something quite different
 * from one weighted by what actually gets built. Model counts are shown beside
 * the units so the two can be compared rather than confused.
 *
 * Data: /cycle-time/completion/history (the only cycle-time mart that
 * accumulates — the status marts are overwritten every run).
 */

import { useCycleTimeCompletionHistory } from '@/hooks/cycle_time/useCycleTimeData';
import type { CompletionLoss, CompletionSplit, CompletionWeek } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import { Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TARGET = 90;

/** Loss colours, worst-first — matches the status chips on the Data Table tab
 *  so a colour means the same thing on both. */
const LOSS_COLOR: Record<string, string> = {
  incomplete:    '#f59e0b',
  no_cycle_time: '#f97316',
  not_in_iedb:   '#ef4444',
  not_in_mes:    '#0ea5e9',
  not_checked:   '#94a3b8',
};
const lossColor = (s: string) => LOSS_COLOR[s] ?? '#94a3b8';

const STATUS_LABEL: Record<string, string> = {
  incomplete: 'Missing CT', no_cycle_time: 'No cycle time', not_in_iedb: 'Not in IEDB',
  not_in_mes: 'Not in MES', not_checked: 'Not checked', complete: 'Complete',
};
const REASON_LABEL: Record<string, string> = {
  missing_ct: 'blank cycle time', missing_step: 'step not in route',
  'missing_ct+step': 'blank CT + route gap', unmapped: 'steps unrecognised',
  no_alias: 'no alias to match on', in_iedb_untimed: 'in IEDB, never timed',
  absent: 'no IEDB record', absent_unverified: 'not in our IEDB snapshot',
  no_production: 'not built yet', workcell_not_on_mes: 'workcell not on MES',
};

const n0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);

function Quadrant({ n, title, sub, children }: {
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

export default function CompletionFourQuadrant() {
  const { data, isLoading, error } = useCycleTimeCompletionHistory(13);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data?.latest) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        No history yet. The trend starts building after the first snapshot —
        run <code className="rounded bg-muted px-1">scripts/snapshot_completion.py</code>,
        or just wait for the next completion refresh, which takes one automatically.
      </div>
    );
  }

  const weeks = data.weeks;
  const latest = data.latest;
  const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const delta = prev?.pct != null && latest.pct != null ? latest.pct - prev.pct : null;

  // Q4 wants complete AND the losses in one list that sums to 100%.
  const complete: CompletionLoss = {
    status: 'complete', reason: '', units: latest.complete_units, models: latest.complete_models,
    pct: latest.pct,
  };
  const losses = data.losses.filter(l => l.status !== 'complete');
  const stack = [complete, ...losses];

  // Q2 is "the last 4 weeks", so the movers are measured against 4 weeks back.
  const base = weeks.length > 4 ? weeks[weeks.length - 5] : weeks[0];

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-xl border bg-card px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Demand covered by complete cycle times
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-4xl font-bold">{pct(latest.pct)}</span>
            {delta != null && (
              <span className={cn('flex items-center gap-1 text-sm font-semibold',
                delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {n0(latest.complete_units)} of {n0(latest.units)} units · {latest.iso_week}
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground">
          By model count: <span className="font-mono font-semibold text-foreground">{pct(latest.pct_models)}</span>
          <br />{n0(latest.complete_models)} of {n0(latest.models)} models
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ── Q1 ── */}
        <Quadrant n="Q1" title="Where we stand" sub={`Completion % by week, target ${TARGET}%`}>
          {weeks.length < 2 ? (
            <Empty>Only one week on record. The line appears from the second snapshot.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={weeks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="iso_week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <ReferenceLine y={TARGET} strokeDasharray="4 4" className="stroke-muted-foreground" />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, k) => [k === 'pct' ? `${v}%` : n0(v),
                    k === 'pct' ? 'by units' : 'by models']} />
                <Line type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="pct_models" stroke="#94a3b8" strokeWidth={1}
                  strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Quadrant>

        {/* ── Q2 ── */}
        <Quadrant n="Q2" title="Last 4 weeks" sub="Same number, split by plant then workcell">
          <div className="space-y-1">
            {data.by_plant.map((p: CompletionSplit) => (
              <SplitRow key={p.plant} label={p.plant ?? '—'} row={p} bold />
            ))}
            <div className="mt-2 max-h-[130px] space-y-1 overflow-y-auto pr-1">
              {data.by_workcell.slice(0, 40).map((w: CompletionSplit) => (
                <SplitRow key={w.workcell} label={w.workcell ?? '—'} row={w} />
              ))}
            </div>
            {weeks.length > 1 && (
              <p className="pt-1 text-[10px] text-muted-foreground">
                {base.iso_week} → {latest.iso_week}: {pct(base.pct)} → {pct(latest.pct)}
              </p>
            )}
          </div>
        </Quadrant>

        {/* ── Q3 ── */}
        <Quadrant n="Q3" title="What it is costing" sub="Every loss, ranked by demand units at stake">
          {losses.length === 0 ? <Empty>Nothing incomplete. Suspicious — check the run.</Empty> : (
            <ResponsiveContainer width="100%" height={Math.max(160, losses.length * 26)}>
              <BarChart data={losses} layout="vertical" margin={{ top: 0, right: 40, left: 96, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="reason" width={92} tick={{ fontSize: 9 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(r: string) => REASON_LABEL[r] ?? r ?? '—'} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, _k, p) => [`${n0(v)} units · ${p.payload.models} models`,
                    STATUS_LABEL[p.payload.status] ?? p.payload.status]} />
                <Bar dataKey="units" radius={[0, 4, 4, 0]}>
                  {losses.map((l, i) => <Cell key={i} fill={lossColor(l.status)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Quadrant>

        {/* ── Q4 ── */}
        <Quadrant n="Q4" title="The 100% view" sub="Complete plus every loss, back to 100%">
          <div className="flex h-6 w-full overflow-hidden rounded-md">
            {stack.filter(s => (s.pct ?? 0) > 0).map((s, i) => (
              <div key={i} style={{ width: `${s.pct}%`, background: s.status === 'complete' ? '#10b981' : lossColor(s.status) }}
                title={`${STATUS_LABEL[s.status] ?? s.status} ${pct(s.pct)}`} />
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {stack.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: s.status === 'complete' ? '#10b981' : lossColor(s.status) }} />
                <span className="min-w-0 flex-1 truncate">
                  {STATUS_LABEL[s.status] ?? s.status}
                  {s.reason && <span className="text-muted-foreground"> · {REASON_LABEL[s.reason] ?? s.reason}</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{n0(s.units)}</span>
                <span className="w-12 text-right font-mono font-semibold tabular-nums">{pct(s.pct)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-1 text-[11px] font-semibold">
              <span className="flex-1">Total</span>
              <span className="tabular-nums text-muted-foreground">{n0(latest.units)}</span>
              <span className="w-12 text-right font-mono tabular-nums">
                {pct(stack.reduce((a, s) => a + (s.pct ?? 0), 0))}
              </span>
            </div>
          </div>
        </Quadrant>
      </div>
    </div>
  );
}

function SplitRow({ label, row, bold }: { label: string; row: CompletionSplit; bold?: boolean }) {
  const v = row.pct ?? 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={cn('w-28 shrink-0 truncate', bold && 'font-semibold')}>{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full"
          style={{ width: `${v}%`, background: v >= TARGET ? '#10b981' : v >= 60 ? '#f59e0b' : '#ef4444' }} />
      </div>
      <span className="w-11 text-right font-mono tabular-nums">{pct(row.pct)}</span>
      <span className="w-14 text-right tabular-nums text-muted-foreground">{n0(row.units)}</span>
    </div>
  );
}
