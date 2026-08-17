/**
 * DistributionTab.tsx — "how is the labour spread, and how mature are we".
 *
 * Treemap of total DL → 100% VA/NVA mix → NVA band histogram →
 * maturity funnel (Sheet2) → stage donut → the Sheet2 ladder itself.
 */

import { cn } from '@/lib/utils';
import { measured, nvaHistogram, plantTotals } from '@/lib/va_nva/vanvaCalc';
import {
  AXIS_TICK, GRID_STROKE, NVA_HEX, STAGE_BADGE, STAGE_HEX, STAGE_LABEL,
  TARGET_HEX, TOOLTIP_STYLE, VANVA_PALETTE, VA_HEX, dl, pct,
} from '@/lib/va_nva/vanvaConstants';
import { MATURITY_LADDER } from '@/pages/vanva/mockVaNvaData';
import { ChartCard, PanelCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import type { MaturityStageKey, VaNvaMetrics } from '@/pages/vanva/types';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Legend,
  Pie, PieChart, ReferenceLine, Tooltip, Treemap, XAxis, YAxis,
} from 'recharts';

const short = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

/** Treemap tile: name + value, but only when the tile is big enough to hold them. */
function TreeTile(props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; value?: number; index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', value = 0, index = 0 } = props;
  const fill = VANVA_PALETTE[index % VANVA_PALETTE.length];
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.85}
        stroke="hsl(var(--card))" strokeWidth={2} rx={3} />
      {width > 62 && height > 28 && (
        <>
          <text x={x + 6} y={y + 15} fontSize={9} fontWeight={700} fill="#0b1220">
            {width > 110 ? name : short(name)}
          </text>
          <text x={x + 6} y={y + 27} fontSize={9} fill="#0b1220" opacity={0.75}>{dl(value)} DL</text>
        </>
      )}
    </g>
  );
}

export default function DistributionTab({ rows, target }: { rows: VaNvaMetrics[]; target: number }) {
  const ms = useMemo(() => measured(rows), [rows]);
  const totals = useMemo(() => plantTotals(rows, target), [rows, target]);

  const tree = useMemo(
    () => [...ms]
      .sort((a, b) => (b.overallRound ?? 0) - (a.overallRound ?? 0))
      .map(r => ({ name: r.workcell, size: r.overallRound ?? 0, value: r.overallRound ?? 0 })),
    [ms],
  );

  // 100% stack: mix only, so a 12-head workcell is compared on equal footing
  // with a 450-head one.
  const mix = useMemo(
    () => [...ms]
      .sort((a, b) => (a.nvaRatio ?? 0) - (b.nvaRatio ?? 0))
      .map(r => ({
        name: short(r.workcell), full: r.workcell,
        VA: +(((r.vaRatio as number)) * 100).toFixed(1),
        NVA: +(((r.nvaRatio as number)) * 100).toFixed(1),
      })),
    [ms],
  );

  const hist = useMemo(() => nvaHistogram(rows), [rows]);

  const byStage = useMemo(() => {
    const counts = { baseline: 0, short_term: 0, mid_term: 0, long_term: 0 } as Record<MaturityStageKey, number>;
    ms.forEach(r => { if (r.stage) counts[r.stage]++; });
    return counts;
  }, [ms]);

  // Funnel reads best widest-first: everyone starts at baseline, fewer make it
  // to lean. Value = workcells that have reached this rung or better.
  const funnel = useMemo(() => {
    const order: MaturityStageKey[] = ['baseline', 'short_term', 'mid_term', 'long_term'];
    let remaining = ms.length;
    return order.map((k, i) => {
      const v = remaining;
      remaining -= byStage[k];
      return { name: `${STAGE_LABEL[k]} or better`, value: v, fill: STAGE_HEX[order[i]] };
    });
  }, [ms, byStage]);

  const stagePie = (Object.keys(byStage) as MaturityStageKey[])
    .map(k => ({ name: STAGE_LABEL[k], value: byStage[k], fill: STAGE_HEX[k] }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Total DL by workcell"
          hint="Tile area = VA sizing + NVA MFG. The big tiles are where any % move actually pays."
          height={330}
          span="xl:col-span-2"
        >
          <Treemap data={tree} dataKey="size" aspectRatio={4 / 3} isAnimationActive={false}
            content={<TreeTile />}>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${dl(v)} DL`, 'Total']} />
          </Treemap>
        </ChartCard>

        <ChartCard
          title="Workcells by NVA band"
          hint="How many workcells sit in each 10-point band."
          height={330}
        >
          <BarChart data={hist} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="band" tick={{ ...AXIS_TICK, fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} tickLine={false} axisLine={false} width={26} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v} workcells`, 'Count']} />
            <ReferenceLine x={hist.find(h => target * 100 >= h.lo && target * 100 < h.lo + 10)?.band}
              stroke={TARGET_HEX} strokeDasharray="4 3"
              label={{ value: 'target band', position: 'top', fontSize: 8, fill: TARGET_HEX }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={54}>
              {hist.map((h, i) => (
                <Cell key={i} fill={h.lo < 25 ? '#10b981' : h.lo < 35 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard
        title="VA / NVA mix — normalised to 100%"
        hint="Size removed, so a small workcell's balance is comparable to a large one's. Sorted leanest first."
        height={320}
        actions={<Swatches items={[{ label: 'VA', color: VA_HEX }, { label: 'NVA', color: NVA_HEX }]} />}
      >
        <BarChart data={mix} stackOffset="expand" margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_TICK} tickFormatter={v => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} width={36} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v}%`, n]}
            labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
          <ReferenceLine y={1 - target} stroke={TARGET_HEX} strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: `VA ${pct(1 - target, 0)}`, position: 'right', fontSize: 9, fill: TARGET_HEX }} />
          <Bar dataKey="VA" stackId="mix" fill={VA_HEX} maxBarSize={34} />
          <Bar dataKey="NVA" stackId="mix" fill={NVA_HEX} maxBarSize={34} />
        </BarChart>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Lean maturity funnel"
          hint="Workcells that have reached each rung of the Sheet2 ladder or better."
          height={280}
        >
          <FunnelChart>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v} workcells`, 'Reached']} />
            <Funnel dataKey="value" data={funnel} isAnimationActive={false}>
              {funnel.map((f, i) => <Cell key={i} fill={f.fill} />)}
              <LabelList position="right" dataKey="name" style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <LabelList position="inside" dataKey="value" style={{ fontSize: 11, fontWeight: 800, fill: '#0b1220' }} />
            </Funnel>
          </FunnelChart>
        </ChartCard>

        <ChartCard
          title="Workcells by maturity stage"
          hint="Current rung, from each workcell's own NVA %."
          height={280}
        >
          <PieChart>
            <Pie data={stagePie} dataKey="value" nameKey="name" outerRadius="78%"
              stroke="hsl(var(--card))" strokeWidth={2}
              label={(e: { name?: string; value?: number }) => `${e.name} ${e.value}`}
              labelLine={false} fontSize={9}>
              {stagePie.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} workcells`, n]} />
            <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ChartCard>

        <PanelCard
          title="Sheet2 — lean maturity ladder"
          hint={`Plant is at ${pct(totals.nvaRatio)} NVA today.`}
        >
          {MATURITY_LADDER.map((s, i) => {
            const here = totals.nvaRatio * 100 <= s.nvaHi && totals.nvaRatio * 100 > (MATURITY_LADDER[i + 1]?.nvaHi ?? -1);
            return (
              <div key={s.key}
                className={cn('px-4 py-2.5 flex items-center gap-3', i < MATURITY_LADDER.length - 1 && 'border-b border-border',
                  here && 'bg-muted/40')}>
                <span className="h-6 w-1 rounded-full flex-shrink-0" style={{ background: STAGE_HEX[s.key] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-foreground truncate">{s.stage}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{s.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-mono text-emerald-400 tabular-nums">VA {s.vaLo}–{s.vaHi}%</p>
                  <p className="text-[10px] font-mono text-red-400 tabular-nums">NVA {s.nvaLo}–{s.nvaHi}%</p>
                </div>
                {here && (
                  <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0', STAGE_BADGE[s.key])}>
                    YOU
                  </span>
                )}
              </div>
            );
          })}
        </PanelCard>
      </div>
    </div>
  );
}
