/**
 * VaNvaFourQuadrant.tsx
 * ──────────────────────
 * The VA/NVA 4Q's own quadrants. Q2 (ParetoChart) and Q3 (ImprovementPlan) are
 * the shared components, laid out by VaNva4QReport.
 *
 *   Q1  where we stand   plant NVA % by month against the target, 12 months
 *   Q4  the 100% view    the NVA % tracker — workcell × month, plant row on top.
 *                        This is the KPI tracker the team keeps by hand, with
 *                        a month-on-month delta where OLE's Paynter has Avg(4W).
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, LabelList, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { BAND_BAD, BAND_GOOD, BAND_WARN, statusBands } from '@/components/shared/StatusBands';
import { cn } from '@/lib/utils';
import { TARGET_HEX, nvaTextClass, pct } from '@/lib/va_nva/vanvaConstants';
import { Q1_MONTHS, type MonthPoint, type Tracker, type TrackerRow } from '@/lib/va_nva/vanvaFourQ';
import { BAD, GOOD, fmtPeriod, n0 } from '@/pages/vanva/VaNvaSizingKit';

/** "Aug 2026" → "Aug '26" for axes and column heads. */
const short = (p: string) => fmtPeriod(p).replace(/ 20(\d\d)$/, " '$1");

/** Signed points, e.g. "+1.2" / "−0.8". Down is good for NVA. */
const pts = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d * 100).toFixed(1)}`;

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>;
}

// ─── Headline ────────────────────────────────────────────────────────────────

export function NvaHeadline({ trend, target, avgReduce }: {
  trend: MonthPoint[]; target: number; avgReduce: number;
}) {
  const latest = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = prev ? latest.nvaRatio - prev.nvaRatio : null;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-xl border bg-card px-5 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Plant NVA share of direct labour
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className={cn('font-mono text-4xl font-bold', nvaTextClass(latest.nvaRatio))}>{pct(latest.nvaRatio)}</span>
          {delta != null && (
            <span className={cn('flex items-center gap-1 text-sm font-semibold', delta <= 0 ? GOOD : BAD)}>
              {delta <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {pts(delta)} pts
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {n0(latest.nvaMfg)} NVA of {n0(latest.overall)} DL · {fmtPeriod(latest.period)} · target {pct(target, 0)}
        </p>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Heads to cut, 3-month average: <span className="font-mono font-semibold text-foreground">{n0(avgReduce)}</span>
        <br />{trend.length} of {Q1_MONTHS} months on record
      </div>
    </div>
  );
}

// ─── Q1 ──────────────────────────────────────────────────────────────────────

/** `height="100%"` on the preview sheet, where the quadrant frame sets the size. */
export function Q1Trend({ trend, target, height = 210 }: { trend: MonthPoint[]; target: number; height?: number | string }) {
  if (trend.length < 2) {
    return <Empty>Only one month on record. The trend appears from the second upload.</Empty>;
  }
  const data = trend.map(t => ({
    ...t, label: short(t.period), value: +(t.nvaRatio * 100).toFixed(1),
  }));
  // NVA is a cost: low is good, so the green band is at the bottom. Thresholds
  // are getVaNvaStatus's, kept in step with every badge on the platform.
  const top = Math.max(40, ...data.map(d => d.value));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 52, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        {statusBands([
          { from: 0, to: 25, color: BAND_GOOD },
          { from: 25, to: 35, color: BAND_WARN },
          { from: 35, to: top, color: BAND_BAD },
        ])}
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis domain={[0, 'auto']} unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <ReferenceLine y={target * 100} stroke={TARGET_HEX} strokeDasharray="4 4"
          label={{ value: `target ${pct(target, 0)}`, position: 'right', fontSize: 9, fill: TARGET_HEX }} />
        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
          labelFormatter={(_, p) => fmtPeriod((p?.[0]?.payload as MonthPoint | undefined)?.period ?? '')}
          formatter={(v: number, _k, item) => {
            const m = item.payload as MonthPoint;
            return [`${v}% · ${n0(m.nvaMfg)} of ${n0(m.overall)} DL`, 'NVA share'];
          }} />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          <LabelList dataKey="value" position="top" fontSize={9} formatter={(v: number) => `${v}%`} />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Q4 ──────────────────────────────────────────────────────────────────────

export function NvaTrackerTable({ t, target, isPrint = false }: { t: Tracker; target: number; isPrint?: boolean }) {
  // On the sheet a quadrant is a fixed box, so past ~14 workcells the rows have
  // to give up their padding or the last one is clipped off the bottom.
  const tight = isPrint && t.rows.length > 14;
  const fs = !isPrint ? 'text-xs' : tight ? 'text-[8px] leading-none' : 'text-[9px] leading-tight';
  const px = !isPrint ? 'px-2.5 py-1.5' : tight ? 'px-1 py-0' : 'px-1 py-0.5';
  const ph = !isPrint ? 'px-2.5 py-2' : tight ? 'px-1 py-0.5' : 'px-1 py-1';

  const cell = (v: number | null) => v == null
    ? <span className="text-muted-foreground">—</span>
    : <span className={cn('font-mono font-semibold tabular-nums', nvaTextClass(v))}>{pct(v)}</span>;

  const Row = ({ r, plant = false }: { r: TrackerRow; plant?: boolean }) => (
    <tr className={cn('border-b border-border', plant && 'bg-muted/60 font-bold')}>
      <td className={cn(px, 'border border-border font-semibold',
        !isPrint && 'sticky left-0 z-10 w-36 max-w-[144px] bg-card', plant && !isPrint && 'bg-muted/60',
        plant && 'uppercase tracking-wider')}>
        <span className="block truncate" title={r.workcell}>{r.workcell}</span>
      </td>
      {r.cells.map((v, i) => (
        <td key={t.periods[i]} className={cn(px, 'border border-border text-right')}>{cell(v)}</td>
      ))}
      <td className={cn(px, 'border border-primary/20 bg-primary/10 text-right font-mono font-bold tabular-nums',
        r.delta == null ? 'text-muted-foreground' : r.delta <= 0 ? GOOD : BAD)}>
        {r.delta == null ? '—' : pts(r.delta)}
      </td>
    </tr>
  );

  if (!t.periods.length) return <Empty>No months in scope.</Empty>;

  return (
    <div className={cn(isPrint ? 'flex h-full w-full flex-col overflow-hidden' : 'h-full w-full overflow-x-auto rounded-xl bg-card')}>
      <table className={cn('w-full border-collapse text-left', isPrint && 'h-full table-fixed', fs)}>
        <thead>
          <tr className="bg-primary uppercase tracking-wider text-primary-foreground">
            <th className={cn(ph, 'border border-primary/70 font-semibold',
              isPrint ? 'w-24 text-[9px]' : 'sticky left-0 z-10 w-36 max-w-[144px] bg-primary text-[10px]')}>
              {isPrint ? `Workcell · target ${pct(target, 0)}` : `NVA % · target ${pct(target, 0)}`}
            </th>
            {t.periods.map(p => (
              <th key={p} className={cn(ph, 'border border-primary/70 text-right font-semibold')}>{short(p)}</th>
            ))}
            <th className={cn(ph, 'border border-primary/70 bg-primary/80 text-right font-bold')}>Δ MoM</th>
          </tr>
        </thead>
        <tbody>
          <Row r={t.plant} plant />
          {t.rows.map(r => <Row key={r.workcell} r={r} />)}
        </tbody>
      </table>
    </div>
  );
}

export function NoMonthsYet() {
  return (
    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
      No months in this scope. Upload a KPI Tracker workbook, or widen the scope.
    </div>
  );
}
