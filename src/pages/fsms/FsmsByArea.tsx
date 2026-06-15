/**
 * FsmsByArea.tsx — Dashboard "By area" tab.
 * Composition (permanent / temporary / surplus) + the top bays by sqft.
 * Mock-backed (useFsmsAreaDetails).
 */

import KpiTile from '@/components/dashboard/KpiTile';
import { useFsmsAreaDetails } from '@/hooks/fsms/useFsmsDashboard';
import { FSMS_CHART, fmtSqft } from '@/lib/fsms/fsmsConstants';
import { Boxes, Grid3x3, Layers, PackageOpen } from 'lucide-react';
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export default function FsmsByArea() {
  const { data, isLoading } = useFsmsAreaDetails();

  const totals = useMemo(() => {
    const rows = data?.rows ?? [];
    const permanent = rows.reduce((s, r) => s + r.sqft, 0);
    const temporary = rows.reduce((s, r) => s + r.temp_sqft, 0);
    const available = rows.reduce((s, r) => s + r.total_available, 0);
    const surplus = Math.max(0, available - permanent - temporary);
    return { permanent, temporary, available, surplus };
  }, [data]);

  const topBays = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => b.sqft - a.sqft).slice(0, 8).map(r => ({ bay: r.bay, sqft: r.sqft })),
    [data],
  );

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[88px] rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const pieData = [
    { name: 'Permanent', value: totals.permanent, color: FSMS_CHART.utilization },
    { name: 'Temporary', value: totals.temporary, color: FSMS_CHART.temporary },
    { name: 'Surplus',   value: totals.surplus,   color: FSMS_CHART.surplus },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="MFG Space" value={fmtSqft(totals.available)} icon={<Grid3x3 className="h-5 w-5" />} trend="total available" />
        <KpiTile label="Permanent" value={fmtSqft(totals.permanent)} icon={<Boxes className="h-5 w-5" />} trend="utilisation" />
        <KpiTile label="Temporary" value={fmtSqft(totals.temporary)} icon={<Layers className="h-5 w-5" />} trend="temp sqft" />
        <KpiTile label="Surplus" value={fmtSqft(totals.surplus)} icon={<PackageOpen className="h-5 w-5" />} trend="remaining" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* composition pie */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Space composition
          </div>
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: number, name) => [fmtSqft(val), name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* top bays */}
        <div className="rounded-xl border border-border bg-card overflow-hidden lg:col-span-2">
          <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top bays by utilisation (sqft)
          </div>
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBays} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="bay" width={64} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: number) => [fmtSqft(val), 'Utilisation']}
                />
                <Bar dataKey="sqft" fill={FSMS_CHART.utilization} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
