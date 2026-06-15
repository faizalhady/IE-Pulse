/**
 * FsmsRevenue.tsx — Dashboard "Revenue / sqft" tab.
 * Revenue-per-sqft over time per profit centre + the Golden Line benchmark
 * per division. Mock-backed (useFsmsRevenue).
 */

import { useFsmsRevenue } from '@/hooks/fsms/useFsmsDashboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtUsd } from '@/lib/fsms/fsmsConstants';
import { useMemo, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const PALETTE = ['hsl(var(--primary))', '#3b82f6', '#eab308', '#ec4899', '#06b6d4', '#f97316'];
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export default function FsmsRevenue() {
  const { data, isLoading } = useFsmsRevenue();
  const [division, setDivision] = useState<string>('All');

  const divisions = useMemo(
    () => ['All', ...Array.from(new Set((data?.goldenLines ?? []).map(g => g.division)))],
    [data],
  );

  const filteredRows = useMemo(
    () => (data?.rows ?? []).filter(r => division === 'All' || r.division === division),
    [data, division],
  );

  // Build one series per profit centre, keyed by month.
  const { chartData, series } = useMemo(() => {
    const byMonth = new Map<string, Record<string, number | string>>();
    const pcMeta = new Map<string, string>(); // profit_center → customer
    for (const r of filteredRows) {
      pcMeta.set(r.profit_center, r.customer);
      if (!byMonth.has(r.month_date)) byMonth.set(r.month_date, { _date: r.month_date, label: r.month_label.split(' ')[0] });
      if (r.rev_per_sqft != null) byMonth.get(r.month_date)![r.profit_center] = r.rev_per_sqft;
    }
    const rows = Array.from(byMonth.values()).sort((a, b) => String(a._date).localeCompare(String(b._date)));
    const ser = Array.from(pcMeta.entries()).map(([key, name], i) => ({ key, name, color: PALETTE[i % PALETTE.length] }));
    return { chartData: rows, series: ser };
  }, [filteredRows]);

  const goldenRows = useMemo(
    () => (data?.goldenLines ?? []).filter(g => division === 'All' || g.division === division),
    [data, division],
  );

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
        <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* division filter */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Division</span>
        <Select value={division} onValueChange={setDivision}>
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {divisions.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* revenue/sqft line chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Revenue per sqft — by profit centre ($/sqft)
        </div>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(val: number, name) => [fmtUsd(val), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map(s => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Golden Line summary */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Golden Line — by division
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium px-4 py-3">Division</th>
              <th className="text-right font-medium px-4 py-3">Total Revenue</th>
              <th className="text-right font-medium px-4 py-3">Avg $/sqft</th>
              <th className="text-right font-medium px-4 py-3">Profit Centres</th>
              <th className="text-right font-medium px-4 py-3">Golden Line</th>
            </tr>
          </thead>
          <tbody>
            {goldenRows.map(g => (
              <tr key={g.division} className="h-14 border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 font-medium text-foreground">{g.division}</td>
                <td className="px-4 text-right font-mono">{fmtM(g.total_revenue)}</td>
                <td className="px-4 text-right font-mono">{fmtUsd(g.avg_rev_per_sqft)}</td>
                <td className="px-4 text-right font-mono text-muted-foreground">{g.profit_center_count}</td>
                <td className="px-4 text-right font-mono font-semibold text-primary">{g.golden_line != null ? fmtUsd(g.golden_line) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
