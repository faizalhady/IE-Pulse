import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Sector, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── static data ──────────────────────────────────────────────────────────────

const WEEKLY = [
  { w: 'W05', ole: 49.9, va: 74.6 }, { w: 'W06', ole: 54.1, va: 80.9 },
  { w: 'W07', ole: 55.1, va: 82.8 }, { w: 'W08', ole: 55.6, va: 82.0 },
  { w: 'W09', ole: 54.0, va: 82.4 }, { w: 'W10', ole: 57.1, va: 86.4 },
  { w: 'W11', ole: 55.7, va: 84.5 }, { w: 'W12', ole: 50.5, va: 77.7 },
  { w: 'W13', ole: 57.3, va: 87.4 }, { w: 'W14', ole: 57.2, va: 88.0 },
  { w: 'W15', ole: 60.2, va: 92.1 }, { w: 'W16', ole: 61.8, va: 94.8 },
];

const DONUT = [
  { name: 'Output SMH', value: 59.32, color: '#22c55e' },
  { name: 'NVA Input', value: 24.63, color: '#ef4444' },
  { name: 'NVA Warehouse P1', value: 6.96, color: '#f87171' },
  { name: 'Lunch / Break', value: 7.07, color: '#94a3b8' },
  { name: 'NVA Warehouse P2', value: 2.33, color: '#fca5a5' },
  { name: 'MFG DT', value: 1.36, color: '#f59e0b' },
  { name: 'NVA Support P1', value: 0.73, color: '#fcd34d' },
  { name: 'TE DT', value: 0.03, color: '#e2e8f0' },
  { name: 'NVA Support P2', value: 0.12, color: '#fecaca' },
];

const HC_TREND = [
  { w: 'W05', direct: 120, support: 45 }, { w: 'W06', direct: 125, support: 46 },
  { w: 'W07', direct: 122, support: 45 }, { w: 'W08', direct: 128, support: 48 },
  { w: 'W09', direct: 130, support: 48 }, { w: 'W10', direct: 135, support: 50 },
  { w: 'W11', direct: 133, support: 49 }, { w: 'W12', direct: 125, support: 45 },
  { w: 'W13', direct: 140, support: 52 }, { w: 'W14', direct: 142, support: 53 },
  { w: 'W15', direct: 150, support: 55 }, { w: 'W16', direct: 152, support: 56 },
];

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
  color: 'hsl(var(--foreground))',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>{payload.name}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={fill} fontSize={18} fontWeight={800}>{payload.value.toFixed(1)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

function Hdr({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEWorkcellTab({
  workcell, dateFrom, dateTo
}: {
  workcell: string; dateFrom: string; dateTo: string;
}) {
  const [slice, setSlice] = useState(0);

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* trend 1/2 */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Hdr title="OLE Weekly Trend — FY26" sub="OLE vs Value-Added OLE % per week" />
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEKLY} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => `${v}%`} domain={[40, 100]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TT} formatter={(v: number) => [`${(v as number).toFixed(1)}%`]} />
                <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5}
                  label={{ value: '80%', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="va" name="OLE VA" stroke="#22c55e" fill="url(#gV)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="ole" name="OLE" stroke="hsl(var(--primary))" fill="url(#gO)" strokeWidth={2.5}
                  dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3 justify-center">
            {[['OLE', 'hsl(var(--primary))'], ['OLE VA', '#22c55e'], ['80% Target', '#22c55e']].map(([n, c]) => (
              <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-4 h-px inline-block rounded" style={{ background: c }} />{n}
              </span>
            ))}
          </div>
        </div>

        {/* headcount ratio trend 2/2 */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Hdr title="Headcount Ratio Trend" sub="Direct vs Support Headcount per week" />
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HC_TREND} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="direct" name="Direct HC" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                <Bar dataKey="support" name="Support HC" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3 justify-center">
            {[['Direct HC', '#3b82f6'], ['Support HC', '#f59e0b']].map(([n, c]) => (
              <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 inline-block rounded-sm" style={{ background: c }} />{n}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* donut 1/2 */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Hdr title="Man-Hours Distribution" sub="Hover a slice · % of total input" />
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={DONUT} cx="50%" cy="50%" innerRadius={70} outerRadius={95}
                  dataKey="value" activeIndex={slice} activeShape={ActiveSlice}
                  onMouseEnter={(_, i) => setSlice(i)}>
                  {DONUT.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4">
            {DONUT.filter(d => d.value > 0).map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto font-mono font-semibold text-foreground flex-shrink-0">{d.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
