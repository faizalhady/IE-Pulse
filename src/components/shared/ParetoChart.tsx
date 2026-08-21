/**
 * ParetoChart — bars descending, cumulative % line on a right axis.
 *
 * The Q2 workhorse for every 4Q report: OLE measures man-hours lost, Cycle Time
 * measures demand units with no cycle time, and both read the same way — the
 * tall bars on the left are where the work is.
 *
 * The only per-module difference is the unit, so `unit` + `unitLabel` are props
 * and everything else is fixed. Same chart, same colours, same axis positions,
 * whatever the number means.
 */

import { cn } from '@/lib/utils';
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export interface ParetoBar {
  name: string;
  value: number;
  color: string;
  /** Running share of the total, 0-100. */
  cum: number;
}

/**
 * Sort descending, drop zeroes, and carry the running cumulative %.
 *
 * Absolute values: a "loss" of -5 and a loss of 5 are the same size of problem,
 * and a negative bar would break the cumulative line.
 */
export function buildPareto(data: { name: string; value: number; color: string }[]): ParetoBar[] {
  const sorted = data
    .map(x => ({ ...x, value: Math.abs(x.value) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  let cum = 0;
  return sorted.map(x => {
    cum += x.value;
    return { ...x, cum: total > 0 ? Math.min((cum / total) * 100, 100) : 0 };
  });
}

const TT_PROPS = {
  contentStyle: {
    background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, fontSize: 11, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: 4, fontWeight: 500 },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

/**
 * Category labels are workcell and loss names — "ARISTANETWORKS", "LAM MECH /
 * EFEM" — and on the preview sheet a quadrant is half a screen wide. Flat
 * labels ran into each other and printed as "ARISTANETWORKSMICRON".
 *
 * Slanted, so neighbours can never collide however long they are, and wrapped
 * to two lines so a long name stays legible instead of running off the plot.
 */
const WRAP_AT = 14;

function wrapLabel(value: string): string[] {
  const words = value.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > WRAP_AT) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  // A single unbroken word longer than the wrap width has no space to break on.
  return lines.length === 1 && lines[0].length > WRAP_AT + 4
    ? [lines[0].slice(0, WRAP_AT + 3) + '…']
    : lines.slice(0, 2);
}

/** Room for two slanted lines. Anything less and they clip at the frame edge. */
const TICK_HEIGHT = 46;

const AngledTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value?: unknown } }) => (
  <g transform={`translate(${x},${(y ?? 0) + 4}) rotate(-35)`}>
    {wrapLabel(String(payload?.value ?? '')).map((line, i) => (
      <text key={i} x={0} y={0} dy={i * 9} textAnchor="end" fontSize={8.5}
        fill="hsl(var(--muted-foreground))">{line}</text>
    ))}
  </g>
);

/** 24,800 → "24.8k". Bar labels have a bar's width to live in. */
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

export interface ParetoChartProps {
  title: string;
  data: ParetoBar[];
  loading?: boolean;
  height?: number;
  /** Fill the parent instead of a fixed height — used by the preview sheet. */
  fillHeight?: boolean;
  /** Left axis title, e.g. "Hours" or "Units". */
  unit?: string;
  /** Tooltip suffix, e.g. "hrs" or "units". */
  unitLabel?: string;
  /** Shown when there is nothing to plot. */
  emptyText?: string;
}

export function ParetoChart({
  title, data, loading = false, height = 180, fillHeight = false,
  unit = 'Hours', unitLabel = 'hrs', emptyText = 'No data',
}: ParetoChartProps) {
  if (loading) {
    return <div className={cn('rounded-lg bg-muted/40 animate-pulse', fillHeight && 'flex-1 min-h-0')}
      style={fillHeight ? undefined : { height }} />;
  }
  if (!data.length) {
    return <div className={cn('flex items-center justify-center border border-border rounded-lg text-xs text-muted-foreground',
      fillHeight && 'flex-1 min-h-0')} style={fillHeight ? undefined : { height }}>{emptyText}</div>;
  }
  return (
    <div className={cn('border border-border rounded-lg flex flex-col bg-card',
      fillHeight ? 'flex-1 min-h-0 p-0 gap-0' : 'p-2 gap-1')}>
      <p className={cn('text-[10px] font-semibold text-foreground flex-shrink-0', fillHeight && 'px-1.5 pt-1')}>
        {title}
      </p>
      <div className={fillHeight ? 'flex-1 min-h-0' : ''} style={fillHeight ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0}
              height={TICK_HEIGHT} tick={<AngledTick />} />
            <YAxis
              yAxisId="left"
              // Headroom so the tallest bar's value label is not clipped.
              domain={[0, (max: number) => max * 1.2]}
              tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={compact}
              label={{ value: unit, angle: -90, position: 'insideLeft', offset: 16,
                style: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' } }}
            />
            <YAxis
              yAxisId="right" orientation="right" domain={[0, 100]}
              tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v}%`}
              label={{ value: 'Cumulative %', angle: 90, position: 'insideRight', offset: 8,
                style: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip
              {...TT_PROPS}
              formatter={(v: number, n: string) =>
                n === 'Cumulative %'
                  ? [`${Number(v).toFixed(1)}%`, n]
                  : [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}`, n]
              }
            />
            <Bar yAxisId="left" dataKey="value" name={unit} radius={[3, 3, 0, 0]} maxBarSize={40}>
              <LabelList dataKey="value" position="top" offset={8} formatter={compact}
                style={{ fontSize: 9, fill: 'hsl(var(--foreground))' }} />
              {data.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="Cumulative %"
              stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
