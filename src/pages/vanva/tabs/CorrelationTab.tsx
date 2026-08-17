/**
 * CorrelationTab.tsx — "what moves with what".
 *
 * VA vs NVA scatter (bubble = total DL) → sizing vs actual parity scatter →
 * sizing/actual/crew composed chart → radar of the biggest workcells →
 * diverging over/under-staffing bars → PPQT vs MFG NVA gap.
 *
 * The PPQT gap chart exists because column K in the workbook feeds no formula
 * at all — the whole tracker runs on MFG NVA alone. This is the first place
 * the two numbers are put side by side.
 */

import { measured } from '@/lib/va_nva/vanvaCalc';
import {
  ACTUAL_HEX, AXIS_TICK, GRID_STROKE, NVA_HEX, PPQT_HEX, TARGET_HEX,
  TOOLTIP_STYLE, VANVA_STATUS_HEX, VA_HEX, dl, pct, signed,
} from '@/lib/va_nva/vanvaConstants';
import { ChartCard, Swatches } from '@/pages/vanva/VaNvaChartKit';
import type { VaNvaMetrics } from '@/pages/vanva/types';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, PolarAngleAxis,
  PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';

const short = (name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name);

/** Scatter points carry the workcell name, so the default tooltip is useless. */
function PointTip({ active, payload }: {
  active?: boolean;
  payload?: { payload: { full: string; lines: [string, string][] } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE.contentStyle}>
      <p className="font-semibold text-foreground mb-1">{p.full}</p>
      {p.lines.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-mono text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

export default function CorrelationTab({ rows, target }: { rows: VaNvaMetrics[]; target: number }) {
  const ms = useMemo(() => measured(rows), [rows]);

  const vaVsNva = ms.map(r => ({
    x: r.vaSizingRound ?? 0,
    y: r.nvaMfg ?? 0,
    z: r.overallRound ?? 0,
    full: r.workcell,
    fill: VANVA_STATUS_HEX[r.status],
    lines: [
      ['VA sizing', `${dl(r.vaSizingRound)} DL`],
      ['NVA MFG', `${dl(r.nvaMfg)} DL`],
      ['NVA %', pct(r.nvaRatio)],
      ['Total DL', dl(r.overallRound)],
    ] as [string, string][],
  }));
  const maxVa = Math.max(...vaVsNva.map(p => p.x), 1);

  const sizingVsActual = ms
    .filter(r => r.vaActual !== null)
    .map(r => ({
      x: r.vaSizingRound ?? 0,
      y: r.vaActual ?? 0,
      z: r.overallRound ?? 0,
      full: r.workcell,
      fill: (r.sizingGap ?? 0) > 0 ? '#ef4444' : '#10b981',
      lines: [
        ['VA sizing', dl(r.vaSizingRound)],
        ['Actual heads', dl(r.vaActual)],
        ['Gap', signed(r.sizingGap)],
        ['Crew', r.crew === null ? '—' : String(r.crew)],
      ] as [string, string][],
    }));
  const maxParity = Math.max(...sizingVsActual.flatMap(p => [p.x, p.y]), 1);

  const composed = [...ms]
    .sort((a, b) => (b.overallRound ?? 0) - (a.overallRound ?? 0))
    .map(r => ({
      name: short(r.workcell), full: r.workcell,
      sizing: r.vaSizingRound ?? 0,
      nva: r.nvaMfg ?? 0,
      actual: r.vaActual ?? 0,
      crew: r.crew ?? 0,
    }));

  // Radar needs comparable axes, so each metric is scaled 0–100 against the
  // largest workcell on that metric. Six workcells max — more and the web
  // turns into noise.
  const radar = useMemo(() => {
    const top = [...ms].sort((a, b) => (b.overallRound ?? 0) - (a.overallRound ?? 0)).slice(0, 6);
    const axes = [
      { key: 'VA sizing', pick: (r: VaNvaMetrics) => r.vaSizingRound ?? 0 },
      { key: 'NVA MFG', pick: (r: VaNvaMetrics) => r.nvaMfg ?? 0 },
      { key: 'Actual', pick: (r: VaNvaMetrics) => r.vaActual ?? 0 },
      { key: 'NVA %', pick: (r: VaNvaMetrics) => (r.nvaRatio ?? 0) * 100 },
      { key: 'Crew', pick: (r: VaNvaMetrics) => r.crew ?? 0 },
      { key: 'To cut', pick: (r: VaNvaMetrics) => Math.max(r.toReduce ?? 0, 0) },
    ];
    const data = axes.map(a => {
      const max = Math.max(...top.map(a.pick), 1);
      const row: Record<string, string | number> = { axis: a.key };
      top.forEach(r => { row[r.workcell] = +((a.pick(r) / max) * 100).toFixed(1); });
      return row;
    });
    return { data, names: top.map(r => r.workcell) };
  }, [ms]);

  const gaps = [...ms]
    .filter(r => r.sizingGap !== null)
    .sort((a, b) => (b.sizingGap ?? 0) - (a.sizingGap ?? 0))
    .map(r => ({ name: short(r.workcell), full: r.workcell, gap: +(r.sizingGap as number).toFixed(1) }));

  const ppqtGap = [...ms]
    .filter(r => r.ppqtVsMfg !== null)
    .sort((a, b) => (b.ppqtVsMfg ?? 0) - (a.ppqtVsMfg ?? 0))
    .map(r => ({
      name: short(r.workcell), full: r.workcell,
      ppqt: r.nvaPpqt ?? 0, mfg: r.nvaMfg ?? 0,
      delta: +(r.ppqtVsMfg as number).toFixed(1),
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="VA sizing vs NVA headcount"
          hint={`Bubble = total DL. Amber line is the ${pct(target, 0)} target ratio — anything above it is over-target.`}
          height={320}
        >
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 26 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis type="number" dataKey="x" name="VA sizing" tick={AXIS_TICK} tickLine={false} axisLine={false}
              label={{ value: 'VA sizing (DL)', position: 'insideBottom', offset: -14, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis type="number" dataKey="y" name="NVA MFG" tick={AXIS_TICK} tickLine={false} axisLine={false} width={38}
              label={{ value: 'NVA MFG (DL)', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <ZAxis type="number" dataKey="z" range={[40, 520]} />
            <Tooltip content={<PointTip />} cursor={{ strokeDasharray: '3 3' }} />
            {/* NVA/(VA+NVA) = t  ⇒  NVA = VA · t/(1−t) */}
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: maxVa, y: (maxVa * target) / (1 - target) }]}
              stroke={TARGET_HEX} strokeDasharray="5 3" strokeWidth={1.5} ifOverflow="extendDomain" />
            <Scatter data={vaVsNva} isAnimationActive={false}>
              {vaVsNva.map((p, i) => <Cell key={i} fill={p.fill} fillOpacity={0.75} stroke={p.fill} />)}
            </Scatter>
          </ScatterChart>
        </ChartCard>

        <ChartCard
          title="Sizing vs actual — parity plot"
          hint="Grey diagonal = perfectly sized. Red points are above the line: more heads than the sizing calls for."
          height={320}
        >
          <ScatterChart margin={{ top: 12, right: 20, left: 4, bottom: 26 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis type="number" dataKey="x" name="Sizing" tick={AXIS_TICK} tickLine={false} axisLine={false}
              label={{ value: 'VA sizing (DL)', position: 'insideBottom', offset: -14, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis type="number" dataKey="y" name="Actual" tick={AXIS_TICK} tickLine={false} axisLine={false} width={38}
              label={{ value: 'Actual heads', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
            <ZAxis type="number" dataKey="z" range={[40, 420]} />
            <Tooltip content={<PointTip />} cursor={{ strokeDasharray: '3 3' }} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxParity, y: maxParity }]}
              stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={1.2} ifOverflow="extendDomain" />
            <Scatter data={sizingVsActual} isAnimationActive={false}>
              {sizingVsActual.map((p, i) => <Cell key={i} fill={p.fill} fillOpacity={0.75} stroke={p.fill} />)}
            </Scatter>
          </ScatterChart>
        </ChartCard>
      </div>

      <ChartCard
        title="Sizing · NVA · actual · crew"
        hint="Bars are headcount on the left axis; the crew line uses the right axis."
        height={330}
        actions={<Swatches items={[
          { label: 'VA sizing', color: VA_HEX }, { label: 'NVA MFG', color: NVA_HEX },
          { label: 'Actual', color: ACTUAL_HEX }, { label: 'Crew', color: TARGET_HEX },
        ]} />}
      >
        <ComposedChart data={composed} margin={{ top: 8, right: 16, left: 0, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 9 }} interval={0} angle={-42} textAnchor="end" height={54} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
          <YAxis yAxisId="r" orientation="right" domain={[0, 5]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={26} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
          <Bar yAxisId="l" dataKey="sizing" name="VA sizing" stackId="dl" fill={VA_HEX} maxBarSize={30} />
          <Bar yAxisId="l" dataKey="nva" name="NVA MFG" stackId="dl" fill={NVA_HEX} radius={[3, 3, 0, 0]} maxBarSize={30} />
          <Bar yAxisId="l" dataKey="actual" name="Actual" fill={ACTUAL_HEX} radius={[3, 3, 0, 0]} maxBarSize={12} />
          <Line yAxisId="r" type="monotone" dataKey="crew" name="Crew" stroke={TARGET_HEX} strokeWidth={1.5}
            dot={{ r: 2.5, fill: TARGET_HEX }} />
        </ComposedChart>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Six biggest workcells — profile"
          hint="Each axis scaled 0–100 against the largest workcell on that metric."
          height={330}
        >
          <RadarChart data={radar.data} outerRadius="72%">
            <PolarGrid stroke={GRID_STROKE} />
            <PolarAngleAxis dataKey="axis" tick={{ ...AXIS_TICK, fontSize: 9 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
            <Tooltip {...TOOLTIP_STYLE} />
            {radar.names.map((n, i) => (
              <Radar key={n} name={n} dataKey={n}
                stroke={['#10b981', '#38bdf8', '#8b5cf6', '#f59e0b', '#ef4444', '#f472b6'][i]}
                fill={['#10b981', '#38bdf8', '#8b5cf6', '#f59e0b', '#ef4444', '#f472b6'][i]}
                fillOpacity={0.10} strokeWidth={1.5} />
            ))}
            <Legend iconSize={7} wrapperStyle={{ fontSize: 9 }} />
          </RadarChart>
        </ChartCard>

        <ChartCard
          title="Over / under staffed"
          hint="Actual heads minus VA sizing. Red = more people than the sizing calls for."
          height={330}
        >
          <BarChart data={gaps} layout="vertical" margin={{ top: 8, right: 20, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 8 }} width={78} tickLine={false} axisLine={false} interval={0} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [signed(v), 'Gap']}
              labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
            <Bar dataKey="gap" radius={[0, 3, 3, 0]} maxBarSize={12}>
              {gaps.map((g, i) => <Cell key={i} fill={g.gap > 0 ? '#ef4444' : '#10b981'} />)}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard
          title="NVA: PPQT vs MFG"
          hint="Column K feeds no formula in the workbook — every ratio there runs on MFG alone. Big gaps mean the two sources disagree."
          height={330}
          actions={<Swatches items={[{ label: 'PPQT', color: PPQT_HEX }, { label: 'MFG', color: NVA_HEX }]} />}
        >
          <BarChart data={ppqtGap} layout="vertical" margin={{ top: 8, right: 16, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 8 }} width={78} tickLine={false} axisLine={false} interval={0} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ''} />
            <Bar dataKey="ppqt" name="PPQT" fill={PPQT_HEX} radius={[0, 3, 3, 0]} maxBarSize={8} />
            <Bar dataKey="mfg" name="MFG" fill={NVA_HEX} radius={[0, 3, 3, 0]} maxBarSize={8} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
