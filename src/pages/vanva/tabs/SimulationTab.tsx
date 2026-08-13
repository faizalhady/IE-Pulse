/**
 * SimulationTab.tsx — "what does hitting the target actually cost".
 *
 * Waterfall from today's NVA to the post-cut NVA → target sweep curve →
 * per-workcell reduction plan. Everything reacts to the target slider in the
 * page header, so this is the workbook's P/Q columns made interactive.
 */

import { cn } from '@/lib/utils';
import { countable, measured, plantTotals, reducibleDl, sweepTarget } from '@/lib/va_nva/vanvaCalc';
import {
  AXIS_TICK, GRID_STROKE, NVA_HEX, TARGET_HEX, TOOLTIP_STYLE,
  VANVA_STATUS_BADGE, VANVA_STATUS_HEX, VANVA_STATUS_LABEL, VA_HEX,
  dl, nvaTextClass, pct, signed,
} from '@/lib/va_nva/vanvaConstants';
import { ChartCard, KpiTile, PanelCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import type { VaNvaMetrics, VaNvaRow } from '@/pages/vanva/types';
import { ArrowDownRight, Scissors, Target, TrendingDown } from 'lucide-react';
import { useMemo } from 'react';
import {
  Area, Bar, Cell, CartesianGrid, ComposedChart, Legend, Line, ReferenceDot,
  ReferenceLine, Tooltip, XAxis, YAxis,
} from 'recharts';

const short = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

/** Waterfall in recharts = an invisible base bar carrying a visible delta bar. */
interface WaterfallBar { name: string; full: string; base: number; delta: number; kind: 'total' | 'cut'; from: number; to: number }

function WaterfallTip({ active, payload }: { active?: boolean; payload?: { payload: WaterfallBar }[] }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE.contentStyle}>
      <p className="font-semibold text-foreground mb-1">{b.full}</p>
      {b.kind === 'total'
        ? <p className="font-mono text-foreground">{dl(b.to)} NVA DL</p>
        : (
          <p className="font-mono text-foreground">
            −{dl(b.delta)} DL <span className="text-muted-foreground">({dl(b.from)} → {dl(b.to)})</span>
          </p>
        )}
    </div>
  );
}

export default function SimulationTab({
  rawRows, rows, target,
}: { rawRows: VaNvaRow[]; rows: VaNvaMetrics[]; target: number }) {
  const totals = useMemo(() => plantTotals(rows, target), [rows, target]);
  const cut = useMemo(() => reducibleDl(rows), [rows]);
  const after = totals.nvaMfg - cut;

  // Top 7 contributors get their own step; the rest collapse into one so the
  // waterfall stays readable at 20+ workcells.
  const waterfall = useMemo<WaterfallBar[]>(() => {
    const cutters = measured(rows)
      .filter(r => (r.toReduce ?? 0) > 0)
      .sort((a, b) => (b.toReduce ?? 0) - (a.toReduce ?? 0));
    const top = cutters.slice(0, 7);
    const restCut = cutters.slice(7).reduce((s, r) => s + (r.toReduce as number), 0);

    const bars: WaterfallBar[] = [
      { name: 'Today', full: 'NVA DL today', base: 0, delta: totals.nvaMfg, kind: 'total', from: 0, to: totals.nvaMfg },
    ];
    let running = totals.nvaMfg;
    top.forEach(r => {
      const d = r.toReduce as number;
      bars.push({ name: short(r.workcell), full: r.workcell, base: running - d, delta: d, kind: 'cut', from: running, to: running - d });
      running -= d;
    });
    if (restCut > 0) {
      bars.push({ name: `Other ${cutters.length - 7}`, full: `${cutters.length - 7} smaller workcells`, base: running - restCut, delta: restCut, kind: 'cut', from: running, to: running - restCut });
      running -= restCut;
    }
    bars.push({ name: 'After', full: `NVA DL after cuts @ ${pct(target, 0)}`, base: 0, delta: running, kind: 'total', from: 0, to: running });
    return bars;
  }, [rows, totals.nvaMfg, target]);

  const sweep = useMemo(() => sweepTarget(rawRows).map(s => ({
    targetPct: +(s.target * 100).toFixed(0),
    reducible: s.reducible,
    above: s.workcellsAbove,
  })), [rawRows]);
  const here = sweep.reduce((best, s) =>
    Math.abs(s.targetPct - target * 100) < Math.abs(best.targetPct - target * 100) ? s : best, sweep[0]);

  const plan = useMemo(
    () => countable(rows)
      .filter(r => r.nvaRatio !== null)
      .sort((a, b) => (b.toReduce ?? 0) - (a.toReduce ?? 0)),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="NVA today" value={dl(totals.nvaMfg)} sub={pct(totals.nvaRatio)} icon={TrendingDown} tone="bad" />
        <KpiTile label={`DL to cut @ ${pct(target, 0)}`} value={dl(cut)} sub="positive gaps only" icon={Scissors} tone="accent" />
        <KpiTile label="NVA after cuts" value={dl(after)} sub={pct(totals.overall ? after / (totals.overall - cut) : 0)} icon={Target} tone="good" />
        <KpiTile label="Workcells to fix" value={String(totals.aboveTarget)} sub={`of ${measured(rows).length} measured`} icon={ArrowDownRight} tone={totals.aboveTarget ? 'warn' : 'good'} />
      </div>

      <ChartCard
        title={`Waterfall — NVA DL today → after hitting ${pct(target, 0)}`}
        hint="Each red step is one workcell's reduction. Emerald bars are the start and end totals."
        height={330}
        actions={<Swatches items={[{ label: 'Total', color: VA_HEX }, { label: 'Reduction', color: NVA_HEX }]} />}
      >
        <ComposedChart data={waterfall} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={38} />
          <Tooltip content={<WaterfallTip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
          {/* Invisible pedestal — lifts each delta bar to where the running total is. */}
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="delta" stackId="w" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {waterfall.map((b, i) => <Cell key={i} fill={b.kind === 'total' ? VA_HEX : NVA_HEX} />)}
          </Bar>
        </ComposedChart>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Target sweep — cost of every target"
          hint="Area = DL that must come out. Line = workcells still above target. The dot is where the slider sits."
          height={300}
        >
          <ComposedChart data={sweep} margin={{ top: 12, right: 16, left: 0, bottom: 22 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="targetPct" tick={AXIS_TICK} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false}
              label={{ value: 'NVA target', position: 'insideBottom', offset: -12, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis yAxisId="l" tick={AXIS_TICK} tickLine={false} axisLine={false} width={38}
              label={{ value: 'DL to cut', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis yAxisId="r" orientation="right" tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={v => `Target ${v}% NVA`}
              formatter={(v: number, n: string) => [n === 'Workcells above' ? `${v}` : `${dl(v)} DL`, n]} />
            <Area yAxisId="l" type="monotone" dataKey="reducible" name="DL to cut"
              stroke={NVA_HEX} fill={NVA_HEX} fillOpacity={0.16} strokeWidth={1.8} />
            <Line yAxisId="r" type="monotone" dataKey="above" name="Workcells above"
              stroke={TARGET_HEX} strokeWidth={1.5} dot={{ r: 2.5, fill: TARGET_HEX }} />
            <ReferenceLine yAxisId="l" x={here?.targetPct} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" />
            <ReferenceDot yAxisId="l" x={here?.targetPct} y={here?.reducible} r={5} fill={NVA_HEX} stroke="hsl(var(--card))" strokeWidth={2} />
            <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Reduction by workcell"
          hint="Positive = DL to remove. Negative = headroom already in hand."
          height={300}
        >
          <ComposedChart data={plan.map(r => ({
            name: short(r.workcell), full: r.workcell, cut: +(r.toReduce ?? 0).toFixed(1),
          }))} layout="vertical" margin={{ top: 8, right: 20, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 8 }} width={82} tickLine={false} axisLine={false} interval={0} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${signed(v)} DL`, 'Gap to target']}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
            <Bar dataKey="cut" radius={[0, 3, 3, 0]} maxBarSize={12}>
              {plan.map((r, i) => <Cell key={i} fill={(r.toReduce ?? 0) > 0 ? NVA_HEX : VA_HEX} />)}
            </Bar>
          </ComposedChart>
        </ChartCard>
      </div>

      <PanelCard
        title={`Reduction plan @ ${pct(target, 0)} NVA`}
        hint="Exactly the workbook's P and Q columns, re-run at the slider target."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-muted/50 text-[10px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left font-semibold px-4 py-2.5">Workcell</th>
                <th className="text-right font-semibold px-3 py-2.5">Total DL</th>
                <th className="text-right font-semibold px-3 py-2.5">NVA now</th>
                <th className="text-right font-semibold px-3 py-2.5">NVA %</th>
                <th className="text-right font-semibold px-3 py-2.5">NVA allowed</th>
                <th className="text-right font-semibold px-3 py-2.5">To cut</th>
                <th className="text-right font-semibold px-4 py-2.5">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {plan.map(r => (
                <tr key={r.id} className="h-11 border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 text-xs font-semibold text-foreground">{r.workcell}</td>
                  <td className="px-3 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(r.overallRound)}</td>
                  <td className="px-3 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(r.nvaMfg)}</td>
                  <td className={cn('px-3 text-right text-[11px] font-mono font-bold tabular-nums', nvaTextClass(r.nvaRatio))}>{pct(r.nvaRatio)}</td>
                  <td className="px-3 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(r.nvaTarget)}</td>
                  <td className={cn('px-3 text-right text-[11px] font-mono font-bold tabular-nums',
                    (r.toReduce ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400')}>{signed(r.toReduce)}</td>
                  <td className="px-4 text-right">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', VANVA_STATUS_BADGE[r.status])}>
                      {VANVA_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="h-11 bg-muted/40 font-semibold">
                <td className="px-4 text-xs text-foreground">Plant total</td>
                <td className="px-3 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(totals.overall)}</td>
                <td className="px-3 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(totals.nvaMfg)}</td>
                <td className="px-3 text-right text-[11px] font-mono tabular-nums" style={{ color: VANVA_STATUS_HEX[totals.nvaRatio <= target ? 'healthy' : 'critical'] }}>{pct(totals.nvaRatio)}</td>
                <td className="px-3 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(totals.nvaTarget)}</td>
                <td className="px-3 text-right text-[11px] font-mono text-red-400 tabular-nums">{dl(cut)}</td>
                <td className="px-4" />
              </tr>
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}
