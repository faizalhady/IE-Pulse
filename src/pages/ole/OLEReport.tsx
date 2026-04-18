import { useOleSummary } from '@/hooks/useOleData';
import { cn } from '@/lib/utils';
import {
    Activity, AlertTriangle, ArrowRight,
    BarChart2, ChevronRight, Clock,
    TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid,
    Cell, Line, Pie, PieChart, ReferenceLine,
    ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── colour helpers ───────────────────────────────────────────────────────────

function oleColor(pct: number | null) {
    if (pct === null) return 'hsl(var(--muted-foreground))';
    if (pct >= 80) return '#22c55e';
    if (pct >= 60) return '#f59e0b';
    return '#ef4444';
}

function getStatus(pct: number | null): 'optimal' | 'warning' | 'critical' | 'idle' {
    if (pct === null) return 'idle';
    if (pct >= 80) return 'optimal';
    if (pct >= 60) return 'warning';
    return 'critical';
}

const TT = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    color: 'hsl(var(--foreground))',
};

const LOGOS: Record<string, string> = {
    arista: '/workcell logo/Arista.png',
    keysight: '/workcell logo/keyisght.png',
    aop: '/workcell logo/aop.png',
    micron: '/workcell logo/micron.png',
};

// ─── static data ──────────────────────────────────────────────────────────────

const WEEKLY = [
    { w: 'W05', ole: 49.9, va: 74.6 }, { w: 'W06', ole: 54.1, va: 80.9 },
    { w: 'W07', ole: 55.1, va: 82.8 }, { w: 'W08', ole: 55.6, va: 82.0 },
    { w: 'W09', ole: 54.0, va: 82.4 }, { w: 'W10', ole: 57.1, va: 86.4 },
    { w: 'W11', ole: 55.7, va: 84.5 }, { w: 'W12', ole: 50.5, va: 77.7 },
    { w: 'W13', ole: 57.3, va: 87.4 }, { w: 'W14', ole: 57.2, va: 88.0 },
    { w: 'W15', ole: 60.2, va: 92.1 }, { w: 'W16', ole: 61.8, va: 94.8 },
];

const PARETO = [
    { c: 'Arista', ole: 39.0, va: 51.1, cum: 17.0 },
    { c: 'AOP1', ole: 74.1, va: 100.1, cum: 32.7 },
    { c: 'MSI', ole: 60.8, va: 69.2, cum: 44.4 },
    { c: 'ARISTA PCA', ole: 89.4, va: 117.2, cum: 52.8 },
    { c: 'MED', ole: 119.3, va: 185.4, cum: 59.8 },
    { c: 'REINERA', ole: 74.3, va: 107.1, cum: 73.3 },
    { c: 'Photonics', ole: 39.2, va: 62.1, cum: 79.5 },
    { c: 'MSI PCA', ole: 70.2, va: 104.5, cum: 83.7 },
    { c: 'LAMKEY', ole: 78.4, va: 116.2, cum: 87.7 },
    { c: 'KEYSIGHT', ole: 45.6, va: 74.4, cum: 91.5 },
    { c: 'MAN COUL', ole: 89.1, va: 245.0, cum: 95.3 },
    { c: 'WABTEC', ole: 6.5, va: 8.5, cum: 96.6 },
    { c: 'Tellabs', ole: 295.1, va: 377.0, cum: 99.8 },
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

// ─── active donut shape ───────────────────────────────────────────────────────

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

// ─── KPI card ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, trend, up, icon: I, accent, onClick }: {
    label: string; value: string; sub?: string; trend?: string; up?: boolean;
    icon: React.ComponentType<{ className?: string }>; accent: string; onClick?: () => void;
}) {
    return (
        <button onClick={onClick}
            className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left w-full',
                onClick && 'hover:border-primary/40 hover:shadow-lg cursor-pointer group transition-all')}
        >
            <div className="flex items-center justify-between">
                <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', accent)}>
                    <I className="h-4 w-4" />
                </div>
                {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />}
            </div>
            <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-3xl font-mono font-bold text-foreground mt-1 leading-none">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </div>
            {trend && (
                <p className={cn('text-xs flex items-center gap-1 font-medium', up ? 'text-emerald-400' : 'text-red-400')}>
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{trend}
                </p>
            )}
        </button>
    );
}

// ─── section header ───────────────────────────────────────────────────────────

function Hdr({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between mb-4">
            <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            {action}
        </div>
    );
}

function NavLink({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap">
            {label} <ArrowRight className="h-3 w-3" />
        </button>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEReport({ onNavigateTab }: {
    onNavigateTab: (tab: string) => void;
}) {
    const navigate = useNavigate();
    const [slice, setSlice] = useState(0);
    const { data, loading } = useOleSummary();

    // Safely fallback to an empty array if data is null OR undefined
    const raw = data ?? [];

    const avgOle = useMemo(() => {
        const v = raw.filter(r => r.avg_ole_pct !== null);
        return v.length ? v.reduce((s, r) => s + (r.avg_ole_pct ?? 0), 0) / v.length : null;
    }, [raw]);

    const totalShifts = raw.reduce((s, r) => s + r.total_shifts, 0);
    const totalQty = raw.reduce((s, r) => s + r.total_qty, 0);
    const flagged = raw.reduce((s, r) => s + r.flagged_shifts, 0);
    const totalInputHrs = raw.reduce((s, r) => s + r.total_input_hours, 0);

    const last2 = WEEKLY.slice(-2);
    const trendUp = last2.length === 2 && last2[1].ole > last2[0].ole;
    const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;

    return (
        <div className="px-6 pt-5 pb-16 space-y-6">

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <Kpi label="Plant OLE" icon={Activity} accent="bg-primary/15 text-primary"
                    value={avgOle !== null ? `${avgOle.toFixed(1)}%` : '—'}
                    sub="Avg across all workcells"
                    trend={trendDiff ? `${trendDiff}% vs prev week` : undefined} up={trendUp}
                    onClick={() => onNavigateTab('summary')} />
                <Kpi label="Total Input Hrs" icon={Clock} accent="bg-violet-500/15 text-violet-400"
                    value={totalInputHrs > 0 ? `${(totalInputHrs / 1000).toFixed(1)}k` : '—'}
                    sub="Direct + Support man-hours"
                    onClick={() => onNavigateTab('paid_hours')} />
                <Kpi label="Shifts Captured" icon={BarChart2} accent="bg-blue-500/15 text-blue-400"
                    value={totalShifts > 0 ? String(totalShifts) : '—'}
                    sub={`${flagged} flagged PARTIAL_SMH`}
                    trend={flagged > 0 ? `${flagged} need attention` : 'All shifts clean'} up={flagged === 0}
                    onClick={() => onNavigateTab('shifts')} />
                <Kpi label="Units Produced" icon={Users} accent="bg-amber-500/15 text-amber-400"
                    value={totalQty > 0 ? `${(totalQty / 1000).toFixed(1)}k` : '—'}
                    sub="Total scanned output"
                    onClick={() => onNavigateTab('production')} />
            </div>

            {/* ── Trend chart + Workcell cards ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

                {/* trend 2/3 */}
                <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5">
                    <Hdr title="OLE Weekly Trend — FY26" sub="OLE vs Value-Added OLE % per week"
                        action={<NavLink label="Shift data" onClick={() => onNavigateTab('shifts')} />} />
                    <div style={{ height: 220 }}>
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

                {/* workcell cards 1/3 */}
                <div className="flex flex-col gap-2.5">
                    <Hdr title="Workcell Health" sub="Click to drill down" />
                    {loading && (
                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">Loading…</div>
                    )}
                    {!loading && raw.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">OLE backend offline</div>
                    )}
                    {raw.map(wc => {
                        const st = getStatus(wc.avg_ole_pct);
                        const clr = oleColor(wc.avg_ole_pct);
                        const k = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                        const lk = Object.keys(LOGOS).find(x => k.startsWith(x));
                        const logo = lk ? LOGOS[lk] : null;
                        const ring = ({ optimal: 'ring-emerald-500/30', warning: 'ring-amber-500/30', critical: 'ring-red-500/30', idle: 'ring-border' })[st];
                        return (
                            <button key={wc.workcell}
                                onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                                className={cn('flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-md group w-full', ring)}
                            >
                                <div className={cn('w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ring-1 overflow-hidden', ring)}
                                    style={logo ? { background: '#fff' } : undefined}>
                                    {logo
                                        ? <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-1.5" />
                                        : <span className="text-[10px] font-black text-foreground">{wc.workcell.slice(0, 3)}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{wc.workcell}</p>
                                    <p className="text-[10px] text-muted-foreground">{wc.stage_label} · {wc.total_shifts} shifts</p>
                                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(wc.avg_ole_pct ?? 0, 100)}%`, background: clr }} />
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-lg font-mono font-bold leading-none" style={{ color: clr }}>
                                        {wc.avg_ole_pct !== null ? `${wc.avg_ole_pct.toFixed(1)}%` : '—'}
                                    </p>
                                    {wc.flagged_shifts > 0 && (
                                        <p className="text-[9px] text-amber-400 flex items-center gap-0.5 justify-end mt-0.5">
                                            <AlertTriangle className="w-2.5 h-2.5" />{wc.flagged_shifts}
                                        </p>
                                    )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Pareto + Donut ── */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

                {/* pareto 3/5 */}
                <div className="xl:col-span-3 rounded-xl border border-border bg-card p-5">
                    <Hdr title="Customer Pareto — OLE vs OLE VA" sub="Sorted by cumulative input man-hours"
                        action={<NavLink label="Production" onClick={() => onNavigateTab('production')} />} />
                    <div style={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={PARETO} margin={{ top: 4, right: 28, left: -16, bottom: 48 }} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="c" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                                    tickLine={false} axisLine={false} angle={-38} textAnchor="end" interval={0} />
                                <YAxis yAxisId="p" tickFormatter={v => `${v}%`}
                                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="c" orientation="right" domain={[0, 110]} tickFormatter={v => `${v}%`}
                                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [`${(v as number).toFixed(1)}%`, n]} />
                                <Bar yAxisId="p" dataKey="ole" name="OLE %" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={14} />
                                <Bar yAxisId="p" dataKey="va" name="OLE VA %" fill="#8fa388" radius={[3, 3, 0, 0]} maxBarSize={14} />
                                <Line yAxisId="c" type="monotone" dataKey="cum" name="Cum. Man-Hr %"
                                    stroke="#f59e0b" strokeWidth={2} dot={{ r: 2, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex items-center gap-5 mt-2 justify-center">
                        {[['OLE %', 'hsl(var(--primary))'], ['OLE VA %', '#8fa388'], ['Cum. Man-Hr %', '#f59e0b']].map(([n, c]) => (
                            <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="w-3 h-0.5 inline-block rounded" style={{ background: c }} />{n}
                            </span>
                        ))}
                    </div>
                </div>

                {/* donut 2/5 */}
                <div className="xl:col-span-2 rounded-xl border border-border bg-card p-5">
                    <Hdr title="Man-Hours Distribution" sub="Hover a slice · % of total input"
                        action={<NavLink label="Paid hours" onClick={() => onNavigateTab('paid_hours')} />} />
                    <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={DONUT} cx="50%" cy="50%" innerRadius={58} outerRadius={82}
                                    dataKey="value" activeIndex={slice} activeShape={ActiveSlice}
                                    onMouseEnter={(_, i) => setSlice(i)}>
                                    {DONUT.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
                        {DONUT.filter(d => d.value > 0).map(d => (
                            <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                <span className="truncate">{d.name}</span>
                                <span className="ml-auto font-mono font-semibold text-foreground flex-shrink-0">{d.value.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── OLE range bars ── */}
            {raw.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                    <Hdr title="Workcell OLE Range & Gap" sub="Min → Avg → Max per workcell · click to drill down"
                        action={<NavLink label="Shift detail" onClick={() => onNavigateTab('shifts')} />} />
                    <div className="space-y-5">
                        {raw.map(wc => {
                            const clr = oleColor(wc.avg_ole_pct);
                            const mn = wc.min_ole_pct ?? 0;
                            const av = wc.avg_ole_pct ?? 0;
                            const mx = wc.max_ole_pct ?? 0;
                            return (
                                <button key={wc.workcell} onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                                    className="w-full text-left group">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{wc.workcell}</span>
                                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border">{wc.stage_label}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-mono">
                                            <span className="text-muted-foreground">{mn.toFixed(1)}%</span>
                                            <span className="font-bold" style={{ color: clr }}>{av.toFixed(1)}%</span>
                                            <span className="text-muted-foreground">{mx.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    <div className="relative h-2.5 rounded-full bg-muted/40 overflow-hidden">
                                        <div className="absolute h-full rounded-full"
                                            style={{ left: `${mn}%`, width: `${Math.max(mx - mn, 1)}%`, background: clr, opacity: 0.15 }} />
                                        <div className="absolute h-full rounded-full"
                                            style={{ width: `${Math.min(av, 100)}%`, background: clr, opacity: 0.9 }} />
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500/60" style={{ left: '80%' }} />
                                    </div>
                                </button>
                            );
                        })}
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span className="inline-block w-0.5 h-3 rounded bg-emerald-500/60" />
                            Green line = 80% target
                        </p>
                    </div>
                </div>
            )}

            {/* ── SMH alert ── */}
            {flagged > 0 && (
                <button onClick={() => onNavigateTab('smh')}
                    className="w-full flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-left hover:bg-amber-500/10 transition-colors group">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-400">SMH Coverage Gaps Detected</p>
                        <p className="text-xs text-amber-400/80 mt-0.5">
                            {flagged} shifts flagged PARTIAL_SMH — OLE understated. Enter missing SMH values in OLE Webtools.
                        </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-amber-400 group-hover:text-amber-300 transition-colors whitespace-nowrap mt-0.5">
                        View SMH Coverage <ArrowRight className="h-3 w-3" />
                    </span>
                </button>
            )}

        </div>
    );
}
