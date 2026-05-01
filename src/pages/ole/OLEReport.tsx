import { useOleSummary, useOleWeekly, useOleWorkcells } from '@/hooks/useOleData';
import { oleApi } from '@/lib/oleApi';
import { getOleStatus, oleColor, WORKCELL_LOGOS } from '@/lib/oleConstants';
import { cn } from '@/lib/utils';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    BarChart2,
    ChevronRight,
    Clock,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TT = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    color: 'hsl(var(--foreground))',
};

type PlantId = 'all' | 'plant1' | 'plant2';

const PLANTS: { id: PlantId; label: string }[] = [
    { id: 'all',    label: 'All' },
    { id: 'plant1', label: 'Plant 1' },
    { id: 'plant2', label: 'Plant 2' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kpi({ label, value, sub, trend, up, icon: I, accent, onClick }: {
    label: string; value: string; sub?: string; trend?: string; up?: boolean;
    icon: React.ComponentType<{ className?: string }>; accent: string; onClick?: () => void;
}) {
    return (
        <button onClick={onClick}
            className={cn('flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left w-full',
                onClick && 'hover:border-primary/40 hover:shadow-lg cursor-pointer group transition-all')}>
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

// Clickable chart wrapper — clicking anywhere on the chart navigates to Analysis
function ChartCard({ title, sub, action, height = 260, onClick, children }: {
    title: string; sub?: string; action?: React.ReactNode;
    height?: number; onClick?: () => void; children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-card p-5',
                onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all group'
            )}
            onClick={onClick}
        >
            <Hdr title={title} sub={sub} action={action} />
            {/* Pointer-events:none so recharts tooltips still work on hover,
                but the outer div captures click navigation */}
            <div style={{ height }} className="pointer-events-none group-hover:pointer-events-none">
                <div style={{ height }} className="pointer-events-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEReport({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
    const navigate = useNavigate();
    const [plant, setPlant] = useState<PlantId>('all');

    const plantParam: string | undefined =
        plant === 'plant1' ? 'Plant 1' : plant === 'plant2' ? 'Plant 2' : undefined;

    // Hooks
    const { data: allSummary, loading } = useOleSummary();
    const { data: allWeekly }           = useOleWeekly();
    const { data: workcellConfigs }     = useOleWorkcells();

    // Build plant → workcell set for fast in-browser filtering
    const plantWorkcells = useMemo(() => {
        if (!plantParam || !workcellConfigs) return null; // null = no filter
        return new Set(
            workcellConfigs
                .filter(c => c.plant === plantParam)
                .map(c => c.workcell)
        );
    }, [plantParam, workcellConfigs]);

    // Apply plant filter to summary rows (KPIs, Workcell Health, OLE Range)
    const raw = useMemo(() =>
        (allSummary ?? []).filter(r => !plantWorkcells || plantWorkcells.has(r.workcell))
    , [allSummary, plantWorkcells]);

    // Apply plant filter to weekly rows (charts)
    const weeklyRaw = useMemo(() =>
        (allWeekly ?? []).filter(r => !plantWorkcells || plantWorkcells.has(r.workcell))
    , [allWeekly, plantWorkcells]);

    // Pareto — real data from /api/ole/pareto
    const [paretoData, setParetoData] = useState<any[]>([]);
    useEffect(() => {
        const params = new URLSearchParams();
        if (plantParam) params.set('plant', plantParam);
        oleApi.ole.pareto(params.toString()).then(setParetoData).catch(() => setParetoData([]));
    }, [plantParam]);

    // Weekly OLE aggregated across all workcells — with VA/NVA breakdown
    const realWeekly = useMemo(() => {
        const byWeek: Record<string, { smh: number; hrs: number; va: number; nva: number; year: number; week: number }> = {};
        weeklyRaw.forEach(r => {
            if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, va: 0, nva: 0, year: r.iso_year, week: r.iso_week };
            byWeek[r.week_label].smh  += r.total_output_smh;
            byWeek[r.week_label].hrs  += r.total_input_hours;
            byWeek[r.week_label].va   += r.total_va_hours;
            byWeek[r.week_label].nva  += r.total_nva_hours;
        });
        return Object.values(byWeek)
            .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
            .map(w => ({
                w:   `WW${String(w.week).padStart(2, '0')}`,
                ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
                va:  w.hrs > 0 ? Math.round((w.va  / w.hrs) * 10000) / 100 : 0,
                nva: w.hrs > 0 ? Math.round((w.nva / w.hrs) * 10000) / 100 : 0,
            }));
    }, [weeklyRaw]);

    // Projection: actuals + 3 EMA projected weeks
    const realProjection = useMemo(() => {
        if (!realWeekly.length) return [];
        const actuals = realWeekly.map(r => r.ole);
        const result = realWeekly.map(r => ({ w: r.w, ole: r.ole, emr: null as number | null, proj: false }));
        const alpha = 0.5;
        let ema = actuals[0];
        for (let i = 0; i < actuals.length; i++) {
            ema = alpha * actuals[i] + (1 - alpha) * ema;
            result[i].emr = Math.round(ema * 100) / 100;
        }
        const lastRow = realWeekly[realWeekly.length - 1];
        const wMatch = lastRow.w.match(/(\d+)/);
        let projWeek = wMatch ? parseInt(wMatch[1]) : 17;
        for (let p = 1; p <= 3; p++) {
            projWeek++;
            const projEma = Math.round((alpha * actuals[actuals.length - 1] + (1 - alpha) * ema) * 100) / 100;
            const projOle = Math.round((actuals.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, actuals.length)) * 100) / 100;
            result.push({ w: `WW${String(projWeek).padStart(2, '0')}`, ole: projOle, emr: projEma, proj: true });
        }
        return result;
    }, [realWeekly]);

    const PARETO = useMemo(() => {
        if (!paretoData.length) return [];
        const maxOle = Math.max(...paretoData.map(r => r.ole_pct ?? 0));
        return paretoData.map(r => ({
            c:          r.workcell,
            ole:        r.ole_pct  ?? 0,
            va:         r.va_pct   ?? 0,
            cum:        maxOle > 0 ? ((r.cum_pct ?? 0) / 100) * maxOle : 0,
            cum_actual: r.cum_pct ?? 0,
        }));
    }, [paretoData]);

    const WEEKLY     = realWeekly.length     > 0 ? realWeekly     : [];
    const PROJECTION = realProjection.length > 0 ? realProjection : [];

    const projWeeks = PROJECTION.filter(p => p.proj);
    const projStart = projWeeks[0]?.w;
    const projEnd   = projWeeks[projWeeks.length - 1]?.w;

    const apiAvgOle = useMemo(() => {
        const v = raw.filter(r => r.avg_ole_pct !== null);
        return v.length ? v.reduce((s, r) => s + (r.avg_ole_pct ?? 0), 0) / v.length : null;
    }, [raw]);

    const totalInputHrs = raw.reduce((s, r) => s + r.total_input_hours, 0);
    const totalShifts   = raw.reduce((s, r) => s + r.total_shifts, 0);
    const flagged       = raw.reduce((s, r) => s + r.flagged_shifts, 0);
    const totalQty      = raw.reduce((s, r) => s + r.total_qty, 0);

    const last2     = WEEKLY.slice(-2);
    const trendUp   = last2.length === 2 && last2[1].ole > last2[0].ole;
    const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;

    const oleValues  = WEEKLY.map(d => d.ole).filter(Boolean);
    const yMin = oleValues.length ? Math.max(0, Math.floor(Math.min(...oleValues) / 10) * 10 - 10) : 0;
    const yMax = oleValues.length ? Math.ceil(Math.max(...oleValues) / 10) * 10 + 10 : 120;

    const projValues = PROJECTION.map(d => d.ole).filter(Boolean);
    const pMin = projValues.length ? Math.max(0, Math.floor(Math.min(...projValues) / 10) * 10 - 10) : 0;
    const pMax = projValues.length ? Math.ceil(Math.max(...projValues) / 10) * 10 + 15 : 120;

    return (
        <div className="px-6 pt-5 pb-16 space-y-6">

            {/* Plant filter */}
            <div className="flex flex-wrap gap-2">
                {PLANTS.map(p => (
                    <button key={p.id} onClick={() => setPlant(p.id)}
                        className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            plant === p.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30')}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <Kpi label="Plant OLE" icon={Activity} accent="bg-primary/15 text-primary"
                    value={apiAvgOle !== null ? `${(apiAvgOle as number).toFixed(1)}%` : '—'}
                    sub={plant === 'all' ? 'Avg across all workcells' : `Avg — ${PLANTS.find(p => p.id === plant)?.label}`}
                    trend={trendDiff ? `${trendDiff}% vs prev week` : undefined} up={trendUp}
                    onClick={() => onNavigateTab('summary')} />
                <Kpi label="Total Input Hrs" icon={Clock} accent="bg-violet-500/15 text-violet-400"
                    value={totalInputHrs > 0 ? `${(totalInputHrs / 1000).toFixed(1)}k` : '—'}
                    sub="Direct man-hours"
                    onClick={() => onNavigateTab('labor')} />
                <Kpi label="Shifts Captured" icon={BarChart2} accent="bg-blue-500/15 text-blue-400"
                    value={totalShifts > 0 ? String(totalShifts) : '—'}
                    sub={`${flagged} flagged PARTIAL_SMH`}
                    trend={flagged > 0 ? `${flagged} need attention` : 'All shifts clean'} up={flagged === 0}
                    onClick={() => onNavigateTab('labor')} />
                <Kpi label="Units Produced" icon={Users} accent="bg-amber-500/15 text-amber-400"
                    value={totalQty > 0 ? `${(totalQty / 1000).toFixed(1)}k` : '—'}
                    sub="Total scanned output"
                    onClick={() => onNavigateTab('production')} />
            </div>

            {/* ── Weekly OLE + Projection (full width, fixed height) ── */}
            <ChartCard
                title="Weekly OLE + Upcoming Weeks Projection"
                sub="Actual OLE % with EMA Fast (3) projection line · click to analyse"
                height={260}
                onClick={() => onNavigateTab('analysis')}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={PROJECTION} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => `${v}%`} domain={[pMin, pMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`]} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 10, paddingBottom: 10, paddingRight: 10 }} />
                        {projStart && projEnd && (
                            <ReferenceArea x1={projStart} x2={projEnd} fill="hsl(var(--primary) / 0.05)" strokeOpacity={0.3}
                                label={{ value: 'PROJECTION', position: 'insideTop', fill: 'hsl(var(--primary))', fontSize: 10, fontWeight: 700, offset: 10 }} />
                        )}
                        <Bar dataKey="ole" name="Weekly OLE" radius={[4, 4, 0, 0]} barSize={32}>
                            {PROJECTION.map((entry, i) => (
                                <Cell key={i}
                                    fill={entry.proj ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary))'}
                                    stroke={entry.proj ? 'hsl(var(--primary))' : 'none'}
                                    strokeDasharray={entry.proj ? '4 4' : '0'} />
                            ))}
                        </Bar>
                        <Line type="monotone" dataKey="emr" name="EMA Fast (3)" stroke="#f59e0b" strokeWidth={2.5}
                            dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* ── OLE Weekly Trend (full width, fixed height — no longer coupled to workcell list) ── */}
            <ChartCard
                title="OLE Weekly Trend — FY26"
                sub="OLE % per week with VA / NVA breakdown · click to analyse"
                height={240}
                onClick={() => onNavigateTab('analysis')}
                action={<NavLink label="Deep analysis" onClick={() => onNavigateTab('analysis')} />}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={WEEKLY} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gVA" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gNVA" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, name]} />
                        <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5}
                            label={{ value: '80%', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                        <Area type="monotone" dataKey="nva" name="NVA %" stroke="#ef4444" fill="url(#gNVA)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="va"  name="VA %"  stroke="#22c55e" fill="url(#gVA)"  strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Area type="monotone" dataKey="ole" name="OLE %" stroke="hsl(var(--primary))" fill="url(#gO)" strokeWidth={2.5}
                            dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* ── Workcell Health — now its own full-width section (scrollable list) ── */}
            <div className="rounded-xl border border-border bg-card p-5">
                <Hdr title="Workcell Health" sub="OLE status per workcell · click to drill down" />
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}
                    </div>
                )}
                {!loading && raw.length === 0 && (
                    <p className="text-xs text-muted-foreground py-4">OLE backend offline</p>
                )}
                {!loading && raw.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {raw.map(wc => {
                            const calcOle = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
                            const st  = getOleStatus(calcOle);
                            const clr = oleColor(calcOle);
                            const k   = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                            const lk  = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
                            const logo = lk ? WORKCELL_LOGOS[lk] : null;
                            const ring = ({ optimal: 'ring-emerald-500/30', warning: 'ring-amber-500/30', critical: 'ring-red-500/30', idle: 'ring-border' })[st];
                            return (
                                <button key={wc.workcell}
                                    onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                                    className={cn('flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-md group w-full', ring)}>
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
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(calcOle, 100)}%`, background: clr }} />
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-lg font-mono font-bold leading-none" style={{ color: clr }}>
                                            {wc.total_input_hours > 0 ? `${calcOle.toFixed(2)}%` : '—'}
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
                )}
            </div>

            {/* ── Pareto — full width (donut removed) ── */}
            <ChartCard
                title="Workcell Pareto — OLE vs OLE VA"
                sub="Sorted by descending input man-hours · cumulative % line · click to analyse"
                height={300}
                onClick={() => onNavigateTab('analysis')}
                action={<NavLink label="Analysis" onClick={() => onNavigateTab('analysis')} />}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={PARETO} margin={{ top: 4, right: 28, left: -16, bottom: 48 }} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="c" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} angle={-38} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={TT} formatter={(v: number, n: string, p: any) => [
                            n === 'Cum. Input Man-Hr %'
                                ? `${p.payload.cum_actual?.toFixed(1)}%`
                                : `${v.toFixed(1)}%`,
                            n,
                        ]} />
                        <Bar dataKey="ole" name="OLE %"    fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Bar dataKey="va"  name="OLE VA %" fill="#8fa388"              radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Line type="monotone" dataKey="cum" name="Cum. Input Man-Hr %" stroke="#f59e0b" strokeWidth={2.5}
                            dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-5 mt-3 justify-center">
                    {[['OLE %', 'hsl(var(--primary))'], ['OLE VA %', '#8fa388'], ['Cum. Input Man-Hr %', '#f59e0b']].map(([n, c]) => (
                        <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-3 h-0.5 inline-block rounded" style={{ background: c }} />{n}
                        </span>
                    ))}
                </div>
            </ChartCard>

            {/* ── OLE Range & Gap (full width) ── */}
            {raw.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                    <Hdr title="Workcell OLE Range & Gap"
                        sub="Min → Avg → Max per workcell · click to drill down"
                        action={<NavLink label="Labor Input" onClick={() => onNavigateTab('labor')} />} />
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
                        {raw.map(wc => {
                            const clr = oleColor(wc.avg_ole_pct);
                            const mn = wc.min_ole_pct ?? 0;
                            const av = wc.avg_ole_pct ?? 0;
                            const mx = wc.max_ole_pct ?? 0;
                            return (
                                <button key={wc.workcell}
                                    onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
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
                                        <div className="absolute h-full rounded-full" style={{ left: `${mn}%`, width: `${Math.max(mx - mn, 1)}%`, background: clr, opacity: 0.15 }} />
                                        <div className="absolute h-full rounded-full" style={{ width: `${Math.min(av, 100)}%`, background: clr, opacity: 0.9 }} />
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500/60" style={{ left: '80%' }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-5">
                        <span className="inline-block w-0.5 h-3 rounded bg-emerald-500/60" />Green line = 80% target
                    </p>
                </div>
            )}

            {/* ── SMH alert ── */}
            {flagged > 0 && (
                <button onClick={() => onNavigateTab('smh')}
                    className="w-full flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-left hover:bg-amber-500/10 transition-colors group">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-400">SMH Coverage Gaps Detected</p>
                        <p className="text-xs text-amber-400/80 mt-0.5">{flagged} shifts flagged PARTIAL_SMH — OLE understated. Enter missing SMH values in OLE Webtools.</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-amber-400 group-hover:text-amber-300 transition-colors whitespace-nowrap mt-0.5">
                        View SMH Coverage <ArrowRight className="h-3 w-3" />
                    </span>
                </button>
            )}

        </div>
    );
}
