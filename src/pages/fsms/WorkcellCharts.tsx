/**
 * WorkcellCharts.tsx — the four data widgets of the Workcell Space Directory tab.
 * ──────────────────────────────────────────────────────────────────────────────
 * Faithful to the legacy workcell-space-directory charts, in the IE Pulse style:
 *   • WorkcellVarianceTable — "Forecast vs Actual by Customer"
 *   • WorkcellPie           — "Summary Space Usage" (Permanent vs Temporary donut)
 *   • WorkcellTrend         — "Actual over Forecast" trend, with a range selector
 *   • WorkcellArea          — "Distribution of Space by Location and Area" bar chart
 *                             (Actual / Temporary / Surplus toggle + Plant → Area → Bay drill-down)
 * Mock-backed (reuses useFsmsDashboard / useFsmsTrends / useFsmsAreaDetails).
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFsmsAreaDetails, useFsmsDashboard, useFsmsTrends } from '@/hooks/fsms/useFsmsDashboard';
import { FSMS_CHART, fmtSqft, varianceText } from '@/lib/fsms/fsmsConstants';
import { cn } from '@/lib/utils';
import { type ReactNode, useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Label, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMth = (mth: string) => {
  const [y, m] = mth.split('-');
  const mm = MONTH_ABBR[Number(m) - 1] ?? mth;
  return y ? `${mm} '${y.slice(2)}` : mm;
};
const fmtVar = (v: number) => (v === 0 ? '—' : v < 0 ? `(${Math.abs(v).toLocaleString()})` : v.toLocaleString());

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 } as const;

function Panel({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden flex flex-col', className)}>
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Forecast vs Actual by Customer ──────────────────────────────────────────────
export function WorkcellVarianceTable() {
  const { data, isLoading } = useFsmsTrends();
  if (isLoading || !data) return <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />;
  return (
    <Panel title="Forecast vs Actual by Customer">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium px-4 py-3">Customer</th>
              <th className="text-left font-medium px-4 py-3">Month</th>
              <th className="text-left font-medium px-4 py-3">Quarter</th>
              <th className="text-right font-medium px-4 py-3">Forecast</th>
              <th className="text-right font-medium px-4 py-3">Actual</th>
              <th className="text-right font-medium px-4 py-3">Variance</th>
              <th className="text-right font-medium px-4 py-3">Temporary</th>
            </tr>
          </thead>
          <tbody>
            {data.fva.map(r => (
              <tr key={`${r.customer}-${r.mth}`} className="h-14 border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 font-medium text-foreground">{r.customer}</td>
                <td className="px-4 text-muted-foreground">{fmtMth(r.mth)}</td>
                <td className="px-4 font-mono text-xs text-muted-foreground">{r.qtr}</td>
                <td className="px-4 text-right font-mono">{fmtSqft(r.forecast_sqft)}</td>
                <td className="px-4 text-right font-mono">{fmtSqft(r.actual_sqft)}</td>
                <td className={cn('px-4 text-right font-mono', r.variance === 0 ? 'text-muted-foreground' : varianceText(r.variance))}>{fmtVar(r.variance)}</td>
                <td className="px-4 text-right font-mono text-muted-foreground">{fmtSqft(r.temporary_sqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── Summary Space Usage (Permanent vs Temporary donut) ──────────────────────────
export function WorkcellPie() {
  const { data, isLoading } = useFsmsDashboard();
  if (isLoading || !data) return <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />;
  const { permanent, temporary } = data.kpis;
  const total = permanent + temporary;
  const slices = [
    { source: 'Permanent', sqft: permanent, fill: FSMS_CHART.utilization },
    { source: 'Temporary', sqft: temporary, fill: FSMS_CHART.temporary },
  ];
  return (
    <Panel title="Summary Space Usage, sqft">
      <div className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name) => [fmtSqft(val), name]} />
            <Pie data={slices} dataKey="sqft" nameKey="source" cx="50%" cy="50%" innerRadius="68%" outerRadius="100%" paddingAngle={2} cornerRadius={4}>
              {slices.map(s => <Cell key={s.source} fill={s.fill} />)}
              <Label content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">{Math.round(total).toLocaleString()}</tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">sqft</tspan>
                    </text>
                  );
                }
                return null;
              }} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 flex justify-center gap-4 text-xs">
        {slices.map(s => (
          <span key={s.source} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: s.fill }} />
            {s.source} <span className="font-mono text-foreground">{fmtSqft(s.sqft)}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ─── Trend — Actual over Forecast ────────────────────────────────────────────────
const RANGES = [
  { label: 'Last 3 months', n: 3 },
  { label: 'Last 6 months', n: 6 },
  { label: 'Last 9 months', n: 9 },
  { label: 'Last 1 year', n: 12 },
];

export function WorkcellTrend() {
  const { data, isLoading } = useFsmsTrends();
  const [range, setRange] = useState('Last 1 year');

  const series = useMemo(() => {
    const n = RANGES.find(r => r.label === range)?.n ?? 12;
    return (data?.trend ?? []).slice(-n).map(t => ({ ...t, label: fmtMth(t.mth) }));
  }, [data, range]);

  if (isLoading || !data) return <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />;

  return (
    <Panel
      title="Trend — Actual over Forecast (sqft)"
      right={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map(r => <SelectItem key={r.label} value={r.label} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
        </Select>
      }
    >
      <div className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name) => [fmtSqft(val), name]} />
            <Area type="linear" dataKey="forecast" name="Forecast" stroke={FSMS_CHART.forecast} fill={FSMS_CHART.forecast} fillOpacity={0.2} dot={false} />
            <Line type="linear" dataKey="actual" name="Actual" stroke={FSMS_CHART.actual} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// ─── Distribution of Space by Location and Area ──────────────────────────────────
// Stacked bars: Occupied (actual) + Surplus (available − actual) + Temporary.
const AREA_SERIES = [
  { key: 'occupied',  label: 'Occupied',  color: FSMS_CHART.actual },   // emerald
  { key: 'surplus',   label: 'Surplus',   color: FSMS_CHART.surplus },  // yellow
  { key: 'temporary', label: 'Temporary', color: '#f97316' },           // orange
] as const;

export function WorkcellArea({ initialPlant }: { initialPlant?: string | null }) {
  const { data, isLoading } = useFsmsAreaDetails();
  const [plant, setPlant] = useState(initialPlant ?? 'all');
  const [area, setArea] = useState('all');

  const rows = data?.rows ?? [];
  const plantOptions = useMemo(() => Array.from(new Set(rows.map(r => r.plant))).sort(), [rows]);
  const areaOptions = useMemo(() => {
    const src = plant === 'all' ? rows : rows.filter(r => r.plant === plant);
    return Array.from(new Set(src.map(r => r.area).filter(Boolean))).sort();
  }, [rows, plant]);

  const { chartData, dim } = useMemo(() => {
    let dimension: 'plant' | 'area' | 'bay';
    let filtered = rows;
    if (area !== 'all') { dimension = 'bay'; filtered = rows.filter(r => r.plant === plant && r.area === area); }
    else if (plant !== 'all') { dimension = 'area'; filtered = rows.filter(r => r.plant === plant); }
    else dimension = 'plant';

    const sums = new Map<string, { occupied: number; surplus: number; temporary: number }>();
    for (const r of filtered) {
      const key = dimension === 'bay' ? r.bay : dimension === 'area' ? r.area : r.plant;
      const cur = sums.get(key) ?? { occupied: 0, surplus: 0, temporary: 0 };
      cur.occupied += r.sqft;
      cur.surplus += Math.max(0, r.total_available - r.sqft);
      cur.temporary += r.temp_sqft;
      sums.set(key, cur);
    }
    const out = Array.from(sums.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([location, v]) => ({ location, ...v }));
    return { chartData: out, dim: dimension };
  }, [rows, plant, area]);

  if (isLoading || !data) return <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />;

  const onPlant = (v: string) => { setPlant(v); setArea('all'); };

  return (
    <Panel
      title={`Distribution of Space (sqft) — by ${dim}`}
      right={
        <div className="flex items-center gap-3">
          <Select value={plant} onValueChange={onPlant}>
            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Plants</SelectItem>
              {plantOptions.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={area} onValueChange={setArea} disabled={plant === 'all' || areaOptions.length === 0}>
            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="All Areas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Areas</SelectItem>
              {areaOptions.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="p-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="location" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false}
              angle={dim !== 'plant' ? -35 : 0} textAnchor={dim !== 'plant' ? 'end' : 'middle'} height={dim !== 'plant' ? 60 : 30} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} contentStyle={tooltipStyle}
              formatter={(val: number, name) => [fmtSqft(val), name]} />
            {AREA_SERIES.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="space" fill={s.color}
                radius={i === AREA_SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-4 flex justify-center gap-4 text-xs">
        {AREA_SERIES.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </Panel>
  );
}
