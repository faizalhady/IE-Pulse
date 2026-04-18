import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bays } from '@/mocks/data';

type ReportTab = 'overview' | 'productivity' | 'downtime' | 'wip';

const SHIFTS = ['All Shifts', 'Day', 'Night', 'Morning'];
const RANGES = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Quarter'];

const DOWNTIME_DATA = [
  { day: 'Mon', minutes: 42 }, { day: 'Tue', minutes: 18 }, { day: 'Wed', minutes: 67 },
  { day: 'Thu', minutes: 31 }, { day: 'Fri', minutes: 55 }, { day: 'Sat', minutes: 12 }, { day: 'Sun', minutes: 8 },
];

const PRODUCTIVITY_TREND = Array.from({ length: 14 }, (_, i) => ({
  day: `Mar ${i + 1}`,
  gardena:    Math.round(82 + Math.sin(i) * 8),
  marin:      Math.round(58 + Math.cos(i * 0.8) * 12),
  eldridge:   Math.round(71 + Math.sin(i * 1.2) * 10),
  woodpecker: Math.round(44 + Math.cos(i) * 9),
}));

const WIP_TREND = Array.from({ length: 12 }, (_, i) => ({
  hour:    `${6 + i}:00`,
  overall: Math.round(1200 + Math.sin(i * 0.5) * 200),
  pending: Math.round(140  + Math.cos(i * 0.7) * 40),
}));

const INCIDENT_LOG = [
  { id: 'INC-0041', bay: 'Bay 215 AOI_TOP', type: 'Downtime', duration: '68 min', reason: 'Unknown',          date: '17 Mar 2026', severity: 'critical' },
  { id: 'INC-0040', bay: 'Bay 212 AOI_BOT', type: 'Low UPH',  duration: '—',      reason: 'Feeder jam',       date: '17 Mar 2026', severity: 'warning'  },
  { id: 'INC-0039', bay: 'Bay 213 AOI_TOP', type: 'Downtime', duration: '22 min', reason: 'PCB misfeed',      date: '16 Mar 2026', severity: 'critical' },
  { id: 'INC-0038', bay: 'Bay 211 AOI_TOP', type: 'Low UPH',  duration: '—',      reason: 'Nozzle change',    date: '16 Mar 2026', severity: 'warning'  },
  { id: 'INC-0037', bay: 'Bay 215 AOI_BOT', type: 'Downtime', duration: '31 min', reason: 'Unknown',          date: '15 Mar 2026', severity: 'critical' },
  { id: 'INC-0036', bay: 'Bay 212 AOI_TOP', type: 'WIP Alert', duration: '—',     reason: 'Pending WIP > 40', date: '15 Mar 2026', severity: 'warning'  },
];

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'overview',     label: 'Overview'     },
  { key: 'productivity', label: 'Productivity' },
  { key: 'downtime',     label: 'Downtime'     },
  { key: 'wip',          label: 'WIP Trends'   },
];

const TOOLTIP_STYLE = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 };

export default function Reports() {
  const [tab,   setTab]   = useState<ReportTab>('overview');
  const [shift, setShift] = useState('All Shifts');
  const [range, setRange] = useState('Last 7 Days');

  const avgProductivity = (bays.reduce((s, b) => s + b.productivity, 0) / bays.length).toFixed(1);
  const totalDowntime   = bays.reduce((s, b) => s + b.downtimeLog.reduce((ds, d) => ds + parseInt(d.duration), 0), 0);

  return (
    <div className="space-y-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 pb-0">
        <div className="pt-4 pb-3 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Reports & History</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Production analytics, downtime logs, and trend analysis</p>
          </div>
          <button className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        <div className="flex gap-0 -mb-px">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
                tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Filters — in body */}
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all',
              range === r ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground'
            )}>{r}</button>
        ))}
        <span className="w-px h-4 bg-border mx-1" />
        {SHIFTS.map(s => (
          <button key={s} onClick={() => setShift(s)}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all',
              shift === s ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground'
            )}>{s}</button>
        ))}
      </div>

      <div className="px-6 pt-5 pb-8 space-y-5">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Avg Productivity', value: `${avgProductivity}%`, trend: '+2.1%', up: true  },
                { label: 'Total Downtime',   value: `${totalDowntime}m`,   trend: '-8m',   up: true  },
                { label: 'Total WIP',        value: '1,422',               trend: '+67',   up: false },
                { label: 'Incidents Today',  value: '6',                   trend: '+2',    up: false },
              ].map(k => (
                <div key={k.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className="text-3xl font-mono font-bold text-foreground mt-1">{k.value}</p>
                  <p className={cn('text-xs mt-1 flex items-center gap-1', k.up ? 'text-status-optimal' : 'text-status-critical')}>
                    {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {k.trend} vs yesterday
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Bay Productivity — Current Shift</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bays.map(b => ({ name: b.name.replace('Bay ', 'B').replace(' AOI_', '/'), value: b.productivity }))} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Productivity %" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Recent Incidents</h3>
                <span className="text-xs text-muted-foreground">{INCIDENT_LOG.length} incidents</span>
              </div>
              {INCIDENT_LOG.map(inc => (
                <div key={inc.id} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0',
                    inc.severity === 'critical'
                      ? 'bg-status-critical/15 text-status-critical border-status-critical/30'
                      : 'bg-status-warning/15  text-status-warning  border-status-warning/30'
                  )}>{inc.type}</span>
                  <span className="font-mono text-xs text-muted-foreground w-20 flex-shrink-0">{inc.id}</span>
                  <span className="text-sm text-foreground flex-1">{inc.bay}</span>
                  <span className="text-xs text-muted-foreground hidden sm:block">{inc.reason}</span>
                  {inc.duration !== '—' && <span className="text-xs font-mono text-status-critical flex-shrink-0">{inc.duration}</span>}
                  <span className="text-xs text-muted-foreground w-24 text-right flex-shrink-0">{inc.date}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PRODUCTIVITY */}
        {tab === 'productivity' && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">14-Day Productivity Trend by Workcell</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={PRODUCTIVITY_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="gardena"    stroke="#10b981" strokeWidth={2} dot={false} name="Gardena" />
                <Line type="monotone" dataKey="marin"      stroke="#f59e0b" strokeWidth={2} dot={false} name="Marin" />
                <Line type="monotone" dataKey="eldridge"   stroke="#3b82f6" strokeWidth={2} dot={false} name="Eldridge" />
                <Line type="monotone" dataKey="woodpecker" stroke="#ef4444" strokeWidth={2} dot={false} name="Woodpecker" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 justify-center">
              {([['Gardena','#10b981'],['Marin','#f59e0b'],['Eldridge','#3b82f6'],['Woodpecker','#ef4444']] as [string,string][]).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: color }} />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOWNTIME */}
        {tab === 'downtime' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Daily Downtime (minutes)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DOWNTIME_DATA} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="minutes" name="Downtime (min)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Downtime Incidents</h3>
              </div>
              {INCIDENT_LOG.filter(i => i.type === 'Downtime').map(inc => (
                <div key={inc.id} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-sm">
                  <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{inc.id}</span>
                  <span className="flex-1 text-foreground">{inc.bay}</span>
                  <span className="text-muted-foreground hidden sm:block">{inc.reason}</span>
                  <span className="font-mono font-semibold text-status-critical flex-shrink-0">{inc.duration}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{inc.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WIP */}
        {tab === 'wip' && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">WIP Trend — Today</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={WIP_TREND}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="overall" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} name="Overall WIP" />
                <Area type="monotone" dataKey="pending" stroke="#ef4444"             fill="url(#g2)" strokeWidth={2} name="Pending WIP" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 justify-center">
              {([['Overall WIP','hsl(var(--primary))'],['Pending WIP','#ef4444']] as [string,string][]).map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: color }} />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
