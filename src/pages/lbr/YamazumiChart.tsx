/**
 * YamazumiChart.tsx
 * ──────────────────
 * Reusable Yamazumi (stacked bar, one bar per station, stacked by work
 * element). VA elements in emerald shades, NVA in slate, machine-only stations
 * violet. TAKT (red dashed) and 95% TAKT (amber dashed) reference lines overlay.
 *
 * Recharts can't stack heterogeneous element keys directly, so each element is
 * mapped to a positional slot segN; cells are coloured individually.
 */

import {
  YAMAZUMI_MACHINE_COLOR, YAMAZUMI_NVA_COLORS, YAMAZUMI_VA_COLORS,
} from '@/lib/lbr/lbrConstants';
import { stationCt } from '@/lib/lbr/lbrCalc';
import type { LBRStation } from './types';
import {
  Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const TT = {
  contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
};

function colorFor(station: LBRStation, segIdx: number): string {
  const el = station.elements[segIdx];
  if (!el) return 'transparent';
  if (station.type === 'machine_only') return YAMAZUMI_MACHINE_COLOR;
  return el.category === 'VA'
    ? YAMAZUMI_VA_COLORS[segIdx % YAMAZUMI_VA_COLORS.length]
    : YAMAZUMI_NVA_COLORS[segIdx % YAMAZUMI_NVA_COLORS.length];
}

interface Row { station: string; ct: number; els: { name: string; time: number; cat: string }[]; [seg: string]: unknown }

function YamazumiTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={TT.contentStyle}>
      <p className="font-semibold text-foreground mb-1">{row.station} · {row.ct}s</p>
      {row.els.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{e.name} <span className="opacity-60">({e.cat})</span></span>
          <span className="font-mono text-foreground">{e.time}s</span>
        </div>
      ))}
    </div>
  );
}

export default function YamazumiChart({
  stations, takt, height = 320, showAxisLabels = true,
}: {
  stations: LBRStation[];
  takt: number;
  height?: number;
  showAxisLabels?: boolean;
}) {
  const maxSegs = stations.reduce((m, s) => Math.max(m, s.elements.length), 0);
  const data: Row[] = stations.map(s => {
    const row: Row = { station: s.id, ct: stationCt(s), els: s.elements.map(e => ({ name: e.name, time: e.timeSec, cat: e.category })) };
    s.elements.forEach((e, i) => { row[`seg${i}`] = e.timeSec; });
    return row;
  });
  const maxCt = data.reduce((m, r) => Math.max(m, r.ct), 0);
  const yMax = Math.ceil(Math.max(maxCt, takt) * 1.1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="22%">
        <XAxis dataKey="station" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32}
          label={showAxisLabels ? { value: 'seconds', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' } } : undefined} />
        <Tooltip content={<YamazumiTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
        {Array.from({ length: maxSegs }).map((_, k) => (
          <Bar key={k} dataKey={`seg${k}`} stackId="a" isAnimationActive={false}>
            {data.map((_, ri) => <Cell key={ri} fill={colorFor(stations[ri], k)} />)}
          </Bar>
        ))}
        <ReferenceLine y={takt} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5}
          label={showAxisLabels ? { value: `TAKT ${takt}s`, position: 'right', fontSize: 9, fill: '#ef4444' } : undefined} />
        <ReferenceLine y={Math.round(takt * 0.95)} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
          label={showAxisLabels ? { value: '95%', position: 'right', fontSize: 9, fill: '#f59e0b' } : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}
