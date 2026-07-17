import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Download, Timer, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { bays } from '@/mocks/data';
import type { StatusLevel } from '@/types';

/**
 * Report A — "Andon control board".
 * A triage-first remake of the Reports page: lead with fleet line-health, then a
 * worst-first bay board, then a quiet lens-switched trend + incident feed.
 * Status (green / amber / red) is the only chroma; everything else is structure.
 */

const RANGES = ['Today', '7 Days', '30 Days', 'Quarter'] as const;
const SHIFTS = ['All', 'Day', 'Night', 'Morning'] as const;
type Range = typeof RANGES[number];
type Shift = typeof SHIFTS[number];
type Lens = 'productivity' | 'downtime' | 'wip';

/** Runtime shape of the mock `bays` mart rows (the annotated `Bay[]` API type
 *  omits these display fields; the existing Reports page reads them the same way). */
interface MartBay {
  id: string; name: string; plant: string; area: string;
  productivity: number; plan: number; cumm: number; delta: number;
  status: StatusLevel; overallWip: number;
  downtimeLog: { timestamp: string; duration: string; reason: string }[];
}
const martBays = bays as unknown as MartBay[];

// Andon threshold — bays at/above this read as "running" (matches getStatusLevel).
const OPTIMAL_LINE = 85;

const STATUS_HSL: Record<StatusLevel, string> = {
  optimal:  'hsl(var(--status-optimal))',
  warning:  'hsl(var(--status-warning))',
  critical: 'hsl(var(--status-critical))',
  idle:     'hsl(var(--status-idle))',
};
const STATUS_TEXT: Record<StatusLevel, string> = {
  optimal:  'text-status-optimal',
  warning:  'text-status-warning',
  critical: 'text-status-critical',
  idle:     'text-status-idle',
};

// Deterministic trend series (index-driven — no Date/random, stable across renders).
const TREND = Array.from({ length: 14 }, (_, i) => ({
  day:          `Mar ${i + 1}`,
  productivity: Math.round(64 + Math.sin(i * 0.7) * 9 + i * 0.4),
  downtime:     Math.round(48 + Math.cos(i * 0.9) * 22 + (i > 9 ? 14 : 0)),
  wip:          Math.round(1280 + Math.sin(i * 0.5) * 180),
}));

const LENSES: { key: Lens; label: string; unit: string; color: string }[] = [
  { key: 'productivity', label: 'Productivity', unit: '%',   color: 'hsl(var(--primary))' },
  { key: 'downtime',     label: 'Downtime',     unit: 'min', color: 'hsl(var(--status-critical))' },
  { key: 'wip',          label: 'WIP',          unit: 'units', color: 'hsl(var(--status-warning))' },
];

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.18)',
  color: 'hsl(var(--popover-foreground))',
};
const mins = (d: string) => parseInt(d, 10) || 0;

export default function ReportA() {
  const [range, setRange] = useState<Range>('7 Days');
  const [shift, setShift] = useState<Shift>('All');
  const [lens,  setLens]  = useState<Lens>('productivity');

  const m = useMemo(() => {
    const fleetProd = martBays.reduce((s, b) => s + b.productivity, 0) / martBays.length;
    const counts = martBays.reduce(
      (acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }),
      {} as Record<StatusLevel, number>,
    );
    const totalDowntime = martBays.reduce((s, b) => s + b.downtimeLog.reduce((d, e) => d + mins(e.duration), 0), 0);
    const totalWip      = martBays.reduce((s, b) => s + (b.overallWip ?? 0), 0);
    const incidents = martBays
      .flatMap(b => b.downtimeLog.map(e => ({ ...e, bay: b.name, status: b.status })))
      .sort((a, z) => mins(z.duration) - mins(a.duration))
      .slice(0, 6);
    const ranked = [...martBays].sort((a, z) => a.productivity - z.productivity);
    return { fleetProd, counts, totalDowntime, totalWip, incidents, ranked };
  }, []);

  const fleetStatus: StatusLevel =
    m.fleetProd > OPTIMAL_LINE ? 'optimal' : m.fleetProd >= 50 ? 'warning' : 'critical';
  const activeLens = LENSES.find(l => l.key === lens)!;

  return (
    <div className="min-h-full bg-background">
      {/* ── Sticky header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-end justify-between gap-3 px-6 pb-3 pt-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground text-balance">
              Line Health
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fleet productivity, bay triage & downtime — {range.toLowerCase()} · {shift.toLowerCase()} shift
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented<Range> options={RANGES} value={range} onChange={setRange} />
            <Segmented<Shift> options={SHIFTS} value={shift} onChange={setShift} />
            <button className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97]">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl space-y-4 px-6 pb-10 pt-4">

        {/* ── HERO: fleet line-health (the focal point) ───────────────── */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid lg:grid-cols-[1fr_1.45fr]">
            {/* Focal figure */}
            <div className="flex items-stretch gap-4 p-5">
              <span
                className="w-1 shrink-0 rounded-full"
                style={{ background: STATUS_HSL[fleetStatus] }}
                aria-hidden
              />
              <div className="flex flex-col justify-center">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Fleet Productivity
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={cn('font-mono text-5xl font-semibold tabular-nums tracking-tight', STATUS_TEXT[fleetStatus])}>
                    {m.fleetProd.toFixed(1)}
                  </span>
                  <span className="text-2xl font-medium text-muted-foreground">%</span>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-status-optimal">
                  <ArrowUpRight className="h-3.5 w-3.5" /> +2.1 pts vs yesterday
                </p>
              </div>
            </div>

            {/* Andon distribution + supporting stats */}
            <div className="border-t border-border p-5 lg:border-l lg:border-t-0">
              <AndonBar counts={m.counts} total={martBays.length} />
              <div className="mt-4 grid grid-cols-3 divide-x divide-border">
                <MiniStat label="Bays running" value={`${m.counts.optimal ?? 0}/${martBays.length}`} />
                <MiniStat label="Downtime" value={`${m.totalDowntime}m`} icon={<Timer className="h-3 w-3" />} className="pl-4" />
                <MiniStat label="Total WIP" value={m.totalWip.toLocaleString()} icon={<Boxes className="h-3 w-3" />} className="pl-4" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* ── SIGNATURE: bay triage board (worst-first) ─────────────── */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Bay Triage</h2>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">worst first</span>
            </div>
            <ul>
              {m.ranked.map(b => (
                <li
                  key={b.id}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 border-b border-border last:border-0"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_HSL[b.status] }}
                    aria-label={b.status}
                  />
                  <div className="w-32 shrink-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{b.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{b.plant} · {b.area}</p>
                  </div>
                  <Gauge value={b.productivity} status={b.status} />
                  <span className={cn('w-14 shrink-0 text-right font-mono text-sm font-semibold tabular-nums', STATUS_TEXT[b.status])}>
                    {b.productivity.toFixed(1)}
                  </span>
                  <span className="hidden w-12 shrink-0 items-center justify-end gap-0.5 text-right font-mono text-xs tabular-nums text-status-critical sm:flex">
                    <ArrowDownRight className="h-3 w-3" />{Math.abs(b.delta)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Trend (lens-switched) ─────────────────────────────────── */}
          <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">14-Day Trend</h2>
              <Segmented
                options={LENSES.map(l => l.label) as readonly string[]}
                value={activeLens.label}
                onChange={(label) => setLens(LENSES.find(l => l.label === label)!.key)}
              />
            </div>
            <div className="flex-1 px-3 pb-2 pt-4">
              <ResponsiveContainer width="100%" height={232}>
                {lens === 'productivity' ? (
                  <LineChart data={TREND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'hsl(var(--border))' }} />
                    <Line type="monotone" dataKey="productivity" stroke={activeLens.color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name={`Productivity (${activeLens.unit})`} />
                  </LineChart>
                ) : lens === 'downtime' ? (
                  <BarChart data={TREND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.4 }} />
                    <Bar dataKey="downtime" fill={activeLens.color} radius={[3, 3, 0, 0]} maxBarSize={22} name={`Downtime (${activeLens.unit})`} />
                  </BarChart>
                ) : (
                  <AreaChart data={TREND} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ra-wip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeLens.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={activeLens.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="wip" stroke={activeLens.color} strokeWidth={2.5} fill="url(#ra-wip)" name={`WIP (${activeLens.unit})`} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* ── Incident feed ───────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Top Downtime Incidents</h2>
            <span className="text-xs text-muted-foreground">{m.incidents.length} shown</span>
          </div>
          <ul>
            {m.incidents.map((inc, i) => (
              <li key={i} className="flex items-center gap-4 border-b border-border px-5 py-2.5 transition-colors last:border-0 hover:bg-muted/40">
                <span
                  className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                    inc.status === 'critical'
                      ? 'border-status-critical/30 bg-status-critical/10 text-status-critical'
                      : 'border-status-warning/30 bg-status-warning/10 text-status-warning')}
                >
                  {inc.status === 'critical' ? 'Critical' : 'Warning'}
                </span>
                <span className="w-32 shrink-0 truncate text-[13px] font-medium text-foreground">{inc.bay}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">{inc.reason}</span>
                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-status-critical">{mins(inc.duration)}m</span>
                <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">{inc.timestamp}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ── Components ─────────────────────────────────────────────────────── */

function Segmented<T extends string>({
  options, value, onChange,
}: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {options.map(opt => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function AndonBar({ counts, total }: { counts: Record<StatusLevel, number>; total: number }) {
  const order: StatusLevel[] = ['optimal', 'warning', 'critical', 'idle'];
  const labels: Record<StatusLevel, string> = {
    optimal: 'Running', warning: 'Caution', critical: 'Fault', idle: 'Idle',
  };
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {order.map(s => {
          const n = counts[s] ?? 0;
          if (!n) return null;
          return <span key={s} style={{ width: `${(n / total) * 100}%`, background: STATUS_HSL[s] }} />;
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {order.map(s => {
          const n = counts[s] ?? 0;
          if (!n) return null;
          return (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_HSL[s] }} />
              {labels[s]} <span className="font-mono font-medium tabular-nums text-foreground">{n}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, className }: { label: string; value: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{icon}{label}</span>
      <span className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Gauge({ value, status }: { value: number; status: StatusLevel }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
      {/* andon "running" threshold marker */}
      <span
        className="absolute top-0 bottom-0 w-px bg-foreground/25"
        style={{ left: `${OPTIMAL_LINE}%` }}
        aria-hidden
      />
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: STATUS_HSL[status] }}
      />
    </div>
  );
}
