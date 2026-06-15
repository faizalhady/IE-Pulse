/**
 * FsmsTrends.tsx — Dashboard "Trends" tab.
 * Monthly actual-vs-forecast trend line + the forecast-vs-actual (FVA) table.
 * Mock-backed (useFsmsTrends).
 */

import { useFsmsTrends } from '@/hooks/fsms/useFsmsDashboard';
import { FSMS_CHART, fmtSqft, varianceText } from '@/lib/fsms/fsmsConstants';
import { cn } from '@/lib/utils';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtMth = (mth: string) => {
  const [, m] = mth.split('-');
  return MONTH_ABBR[Number(m) - 1] ?? mth;
};

const signed = (v: number) => `${v > 0 ? '+' : ''}${fmtSqft(v)}`;

export default function FsmsTrends() {
  const { data, isLoading } = useFsmsTrends();

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
        <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const chartData = data.trend.map(t => ({ ...t, label: fmtMth(t.mth) }));

  return (
    <div className="p-5 space-y-5">
      {/* trend line */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Actual vs forecast — monthly (sqft)
        </div>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(val: number, name) => [fmtSqft(val), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={FSMS_CHART.actual} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={FSMS_CHART.forecast} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FVA table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Forecast vs actual — by customer
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left font-medium px-4 py-3">Customer</th>
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
                <td className="px-4 font-mono text-xs text-muted-foreground">{r.qtr}</td>
                <td className="px-4 text-right font-mono">{fmtSqft(r.forecast_sqft)}</td>
                <td className="px-4 text-right font-mono">{fmtSqft(r.actual_sqft)}</td>
                <td className={cn('px-4 text-right font-mono', varianceText(r.variance))}>{signed(r.variance)}</td>
                <td className="px-4 text-right font-mono text-muted-foreground">{fmtSqft(r.temporary_sqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
