/**
 * OverviewTab.tsx — "where is the waste, and how much of it".
 *
 * Plant KPIs → VA/NVA split gauge → ranked NVA % → VA vs NVA stack →
 * Pareto of reducible DL → NVA share donut.
 */

import { buildPareto, ParetoChart } from '@/components/shared/ParetoChart';
import { measured, plantTotals, reducibleDl } from '@/lib/va_nva/vanvaCalc';
import {
  ACTUAL_HEX, AXIS_TICK, GRID_STROKE, NVA_HEX, TARGET_HEX, TOOLTIP_STYLE,
  VANVA_PALETTE, VANVA_STATUS_HEX, VA_HEX, dl, pct,
} from '@/lib/va_nva/vanvaConstants';
import { ChartCard, KpiTile, Swatches } from '@/pages/vanva/VaNvaChartKit';
import type { VaNvaMetrics } from '@/pages/vanva/types';
import {
  AlertTriangle, Factory, Scissors, Target, TrendingDown, Users,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Label, Legend, Pie, PieChart,
  PolarAngleAxis, RadialBar, RadialBarChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from 'recharts';

const short = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

export default function OverviewTab({ rows, target }: { rows: VaNvaMetrics[]; target: number }) {
  const totals = useMemo(() => plantTotals(rows, target), [rows, target]);
  const ranked = useMemo(
    () => [...measured(rows)].sort((a, b) => (b.nvaRatio ?? 0) - (a.nvaRatio ?? 0)),
    [rows],
  );

  const gauge = [
    { name: 'NVA', value: +(totals.nvaRatio * 100).toFixed(1), fill: NVA_HEX },
    { name: 'VA', value: +(totals.vaRatio * 100).toFixed(1), fill: VA_HEX },
  ];

  const stack = ranked.map(r => ({
    name: short(r.workcell),
    full: r.workcell,
    VA: r.vaSizingRound ?? 0,
    NVA: r.nvaMfg ?? 0,
  }));

  const pareto = useMemo(() => buildPareto(
    measured(rows)
      .filter(r => (r.toReduce ?? 0) > 0)
      .map(r => ({ name: r.workcell, value: r.toReduce as number, color: NVA_HEX })),
  ), [rows]);

  // Top 8 by NVA headcount; everything else collapses into one slice so the
  // donut stays readable instead of turning into 20 hairline wedges.
  const donut = useMemo(() => {
    const sorted = [...measured(rows)].sort((a, b) => (b.nvaMfg ?? 0) - (a.nvaMfg ?? 0));
    const top = sorted.slice(0, 8).map((r, i) => ({
      name: r.workcell, value: r.nvaMfg ?? 0, fill: VANVA_PALETTE[i % VANVA_PALETTE.length],
    }));
    const rest = sorted.slice(8).reduce((s, r) => s + (r.nvaMfg ?? 0), 0);
    return rest > 0 ? [...top, { name: `Other (${sorted.length - 8})`, value: +rest.toFixed(1), fill: '#475569' }] : top;
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* ─── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile label="Total DL" value={dl(totals.overall)} sub={`${totals.workcells} workcells`} icon={Users} />
        <KpiTile label="VA DL" value={dl(totals.vaSizing)} sub={pct(totals.vaRatio)} icon={Factory} tone="good" />
        <KpiTile label="NVA DL" value={dl(totals.nvaMfg)} sub={pct(totals.nvaRatio)} icon={TrendingDown} tone="bad" />
        <KpiTile
          label="Plant NVA %" value={pct(totals.nvaRatio)}
          sub={`target ${pct(target, 0)}`} icon={Target}
          tone={totals.nvaRatio <= target ? 'good' : 'bad'}
        />
        <KpiTile
          label="Above target" value={String(totals.aboveTarget)}
          sub={`of ${measured(rows).length} measured`} icon={AlertTriangle}
          tone={totals.aboveTarget > 0 ? 'warn' : 'good'}
        />
        <KpiTile
          label={`DL to cut @ ${pct(target, 0)}`} value={dl(reducibleDl(rows))}
          sub="sum of positive gaps only" icon={Scissors} tone="accent"
        />
      </div>

      {/* ─── Split gauge + ranked NVA % ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Plant VA / NVA split"
          hint={`Weighted by headcount. Sheet2 lean band is 15–25% NVA.`}
          height={280}
        >
          <RadialBarChart innerRadius="45%" outerRadius="95%" data={gauge} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'hsl(var(--muted) / 0.35)' }} dataKey="value" cornerRadius={6} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v}%`, n]} />
            <Legend
              iconSize={8} layout="vertical" verticalAlign="middle" align="right"
              formatter={(v: string, e) => (
                <span className="text-[10px] text-muted-foreground">
                  {v} {(e?.payload as { value?: number })?.value}%
                </span>
              )}
            />
          </RadialBarChart>
        </ChartCard>

        <ChartCard
          title="NVA % by workcell — ranked"
          hint={`Amber line = ${pct(target, 0)} target. Bar colour is the maturity verdict.`}
          height={280}
          span="xl:col-span-2"
        >
          <BarChart data={ranked.map(r => ({
            name: short(r.workcell), full: r.workcell,
            nva: +((r.nvaRatio as number) * 100).toFixed(1),
            fill: VANVA_STATUS_HEX[r.status],
          }))} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickFormatter={v => `${v}%`} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'NVA']}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <ReferenceLine y={target * 100} stroke={TARGET_HEX} strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: `${(target * 100).toFixed(0)}%`, position: 'right', fontSize: 9, fill: TARGET_HEX }} />
            <Bar dataKey="nva" radius={[3, 3, 0, 0]} maxBarSize={34}>
              {ranked.map((r, i) => <Cell key={i} fill={VANVA_STATUS_HEX[r.status]} />)}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      {/* ─── Stacked headcount + donut ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="VA vs NVA direct labour"
          hint="Absolute heads. Bar height is the workcell's total DL."
          height={300}
          span="xl:col-span-2"
          actions={<Swatches items={[{ label: 'VA', color: VA_HEX }, { label: 'NVA', color: NVA_HEX }]} />}
        >
          <BarChart data={stack} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...TOOLTIP_STYLE}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <Bar dataKey="VA" stackId="dl" fill={VA_HEX} radius={[0, 0, 0, 0]} maxBarSize={34} />
            <Bar dataKey="NVA" stackId="dl" fill={NVA_HEX} radius={[3, 3, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Where the NVA heads sit"
          hint="Share of total NVA direct labour."
          height={300}
        >
          <PieChart>
            <Pie data={donut} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%"
              paddingAngle={1.5} stroke="hsl(var(--card))" strokeWidth={2}>
              {donut.map((d, i) => <Cell key={i} fill={d.fill} />)}
              <Label
                position="center"
                content={() => (
                  <>
                    <text x="50%" y="46%" textAnchor="middle" fontSize={22} fontWeight={800} fill="hsl(var(--foreground))">
                      {dl(totals.nvaMfg, 0)}
                    </text>
                    <text x="50%" y="58%" textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
                      NVA DL
                    </text>
                  </>
                )}
              />
            </Pie>
            <Tooltip {...TOOLTIP_STYLE}
              formatter={(v: number, n: string) => [`${dl(v)} DL (${((v / totals.nvaMfg) * 100).toFixed(1)}%)`, n]} />
            <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ChartCard>
      </div>

      {/* ─── Pareto ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ParetoChart
          title={`Reducible DL @ ${pct(target, 0)} NVA — 80/20`}
          data={pareto}
          height={260}
          unit="DL heads"
          unitLabel="DL"
          emptyText="Every workcell is already at or under target."
        />
        <ChartCard
          title="Sizing vs actual headcount"
          hint="Blue above emerald = more people on the floor than the VA sizing calls for."
          height={300}
          actions={<Swatches items={[{ label: 'VA sizing', color: VA_HEX }, { label: 'Actual', color: ACTUAL_HEX }]} />}
        >
          <BarChart data={ranked.map(r => ({
            name: short(r.workcell), full: r.workcell,
            sizing: r.vaSizingRound ?? 0, actual: r.vaActual ?? 0,
          }))} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
            <Tooltip {...TOOLTIP_STYLE}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <Bar dataKey="sizing" name="VA sizing" fill={VA_HEX} radius={[3, 3, 0, 0]} maxBarSize={16} />
            <Bar dataKey="actual" name="Actual" fill={ACTUAL_HEX} radius={[3, 3, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
