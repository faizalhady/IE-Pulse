/**
 * FsmsOverview.tsx — Dashboard "Overview" tab.
 * KPI cards (MFG space, utilisation, surplus, util %, forecast, temporary, rates)
 * + per-plant utilisation chart for the latest CONSO month. Mock-backed.
 */

import KpiTile from '@/components/dashboard/KpiTile';
import { useFsmsDashboard } from '@/hooks/fsms/useFsmsDashboard';
import { FSMS_CHART, UTIL_TARGET_PCT, fmtPct, fmtSqft, fmtUsd } from '@/lib/fsms/fsmsConstants';
import { Boxes, Building2, DollarSign, Gauge, Layers, PackageOpen, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export default function FsmsOverview() {
  const { data, isLoading, isError } = useFsmsDashboard();

  // One bar per plant — sum its areas. (Hook must run before any early return.)
  const chartRows = useMemo(() => {
    if (!data) return [];
    return data.utilization.plants.map((plant) => {
      const rows = data.utilization.data[plant] ?? [];
      const used = rows.reduce((s, r) => s + r.utilization_space, 0);
      const surplus = rows.reduce((s, r) => s + r.surplus, 0);
      const avail = rows.reduce((s, r) => s + r.total_available, 0);
      const pct = avail > 0 ? Math.round((used / avail) * 1000) / 10 : 0;
      return { plant, used, surplus, avail, pct };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Couldn’t load dashboard data.</div>;
  }

  const { kpis, utilization } = data;

  const tiles = [
    { label: 'MFG Space',     value: fmtSqft(kpis.total_available), icon: <Building2 className="h-5 w-5" />,   trend: utilization.conso_month },
    { label: 'Utilisation',   value: fmtSqft(kpis.permanent),       icon: <Boxes className="h-5 w-5" />,        trend: 'permanent sqft' },
    { label: 'Surplus',       value: fmtSqft(kpis.surplus),         icon: <PackageOpen className="h-5 w-5" />,  trend: 'available sqft' },
    { label: 'Utilisation %', value: fmtPct(kpis.utilization),      icon: <Gauge className="h-5 w-5" />,        trend: `target ${UTIL_TARGET_PCT}%` },
    { label: 'Forecast',      value: fmtSqft(kpis.forecast),        icon: <TrendingUp className="h-5 w-5" />,   trend: 'PRISM / CONSO' },
    { label: 'Temporary',     value: fmtSqft(kpis.temporary),       icon: <Layers className="h-5 w-5" />,       trend: 'temp sqft' },
    { label: 'SMT Rate',      value: fmtUsd(kpis.rate_smt),         icon: <DollarSign className="h-5 w-5" />,   trend: '$/sqft' },
    { label: 'DF Rate',       value: fmtUsd(kpis.rate_df),          icon: <DollarSign className="h-5 w-5" />,   trend: '$/sqft' },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <KpiTile key={t.label} label={t.label} value={t.value} icon={t.icon} trend={t.trend} />
        ))}
      </div>

      {/* Plant utilisation chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Plant utilisation — {utilization.conso_month}
          </span>
          <span className="text-[10px] text-muted-foreground">Utilisation + surplus = MFG space</span>
        </div>
        <div className="p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="plant" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(val: number, name) => [fmtSqft(val), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="used" name="Utilisation" stackId="a" fill={FSMS_CHART.utilization} />
              <Bar dataKey="surplus" name="Surplus" stackId="a" fill={FSMS_CHART.surplus} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
