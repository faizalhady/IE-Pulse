/**
 * OLEHome1.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Home 1 — Hierarchy-driven OLE storyline
 *
 * Tab order mirrors the domain hierarchy:
 *   Site → Workcells → Labor → Output → Projection
 *
 * Rules:
 *  - Filter state is owned HERE and passed down — never duplicated in tabs
 *  - All UI primitives come from oleConstants, OLEFilters, WorkcellBadge
 *  - Table grid styles match OLEOverview exactly (LABOR_GT, PROD_GT tokens)
 *  - No hardcoded colors — always OLE_COLOR / OLE_BAR / STATUS_BADGE
 *  - Tooltip style matches OLEReport (hsl(var(--card)) bg)
 */

import WorkcellBadge from '@/components/ole/WorkcellBadge';
import {
  useOlePaidHours,
  useOleProduction,
  useOleResults,
  useOleSummary,
  useOleWeekly,
  useOleWorkcells,
  useSmhLookup,
} from '@/hooks/ole/useOleData';
import type { OlePaidHours, OleProduction, OleResult, OleSummary } from '@/lib/ole/oleApi';
import {
  fmtDate,
  getOleStatus,
  OLE_BAR,
  OLE_COLOR,
  oleColor,
  shiftLabel,
  STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS
} from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import OLEFilters from '@/pages/ole/OLEFilters';
import {
  Activity,
  ArrowUpDown,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  WifiOff
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const ROW_HEIGHT = 56;
const ALL = '__all__';

// Table grid column templates — match OLEOverview exactly
const SCORECARD_GT = '2.5rem minmax(10rem,1fr) 7rem 9.5rem 9rem 9rem 6.5rem 7.5rem';
const LABOR_GT = '2.5rem minmax(9rem,1fr) 6rem 4rem 7rem 6rem 6.5rem 6.5rem 5.5rem 7rem';
const PROD_GT = '2.5rem 1fr 6rem 4rem 5rem 12rem 5rem 6rem 7rem';

// Shared tooltip style — matches OLEReport
const TT = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    color: 'hsl(var(--foreground))',
  },
};

const TABS = [
  { id: 'site', label: 'Site' },
  { id: 'workcells', label: 'Workcells' },
  { id: 'labor', label: 'Labor' },
  { id: 'output', label: 'Output' },
  { id: 'projection', label: 'Projection' },
] as const;

type TabId = typeof TABS[number]['id'];
type SortDir = 'asc' | 'desc';

// ─── Shared sub-components ────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
}

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        {[['«', 1], ['‹', page - 1], [null, page], ['›', page + 1], ['»', pages]].map(([label, target], i) =>
          label === null ? (
            <span key={i} className="px-3 py-1 text-xs font-mono text-foreground">{page} / {pages}</span>
          ) : (
            <button key={i} onClick={() => onChange(target as number)}
              disabled={(target as number) < 1 || (target as number) > pages}
              className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              {label as string}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function TableHeader({ cols, sortCol, sortDir, onSort, gt }: {
  cols: [string, string][]; sortCol: string; sortDir: SortDir;
  onSort: (c: string) => void; gt: string;
}) {
  return (
    <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
      style={{ gridTemplateColumns: gt }}>
      {cols.map(([col, label]) =>
        col ? (
          <button key={col} onClick={() => onSort(col)}
            className="px-3 py-3 text-left flex items-center hover:text-foreground transition-colors">
            {label}<SortIcon active={sortCol === col} dir={sortDir} />
          </button>
        ) : (
          <div key={label} className="px-3 py-3 text-center">{label}</div>
        )
      )}
    </div>
  );
}

function sortRows<T>(rows: T[], col: string, dir: SortDir): T[] {
  if (!col) return rows;
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = (a as any)[col];
    const vb = (b as any)[col];
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
    return mul * String(va).localeCompare(String(vb), undefined, { numeric: true });
  });
}

function KpiCard({ label, value, sub, trend, up, icon: I, accent, onClick }: {
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

function ChartCard({ title, sub, height = 240, children }: {
  title: string; sub?: string; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function Skeleton({ height = 240 }: { height?: number }) {
  return <div className="rounded-xl bg-muted/40 animate-pulse" style={{ height }} />;
}

function EmptyTable({ msg }: { msg: string }) {
  return <div className="py-12 text-center text-muted-foreground text-sm">{msg}</div>;
}

// ─── Tab 1: Site ──────────────────────────────────────────────────────────────

function SiteTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const summaryHook = useOleSummary();
  const weeklyHook = useOleWeekly({});
  const raw = summaryHook.data ?? [];
  const weeklyRaw = weeklyHook.data ?? [];

  // Site-level aggregates
  const totalOutput = raw.reduce((s, r) => s + (r.total_output_smh || 0), 0);
  const totalInput = raw.reduce((s, r) => s + (r.total_input_hours || 0), 0);
  const siteOle = totalInput > 0 ? (totalOutput / totalInput) * 100 : null;
  const totalQty = raw.reduce((s, r) => s + r.total_qty, 0);
  const totalShifts = raw.reduce((s, r) => s + r.total_shifts, 0);
  const flagged = raw.reduce((s, r) => s + r.flagged_shifts, 0);

  // Plant-level aggregates
  const plant1 = raw.filter(r => !['ARISTA NETWORKS', 'ARISTA NETWORKS HLA'].includes(r.workcell));
  const plant2 = raw.filter(r => ['ARISTA NETWORKS', 'ARISTA NETWORKS HLA'].includes(r.workcell));
  const plantOle = (rows: OleSummary[]) => {
    const out = rows.reduce((s, r) => s + (r.total_output_smh || 0), 0);
    const inp = rows.reduce((s, r) => s + (r.total_input_hours || 0), 0);
    return inp > 0 ? (out / inp) * 100 : null;
  };
  const p1Ole = plantOle(plant1);
  const p2Ole = plantOle(plant2);

  // Weekly site OLE trend
  const weeklyByWeek = useMemo(() => {
    const byWeek: Record<string, { smh: number; hrs: number; year: number; week: number }> = {};
    weeklyRaw.forEach(r => {
      if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, year: r.iso_year, week: r.iso_week };
      byWeek[r.week_label].smh += r.total_output_smh;
      byWeek[r.week_label].hrs += r.total_input_hours;
    });
    return Object.values(byWeek)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
      .map(w => ({
        w: `WW${String(w.week).padStart(2, '0')}`,
        ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
      }));
  }, [weeklyRaw]);

  const last2 = weeklyByWeek.slice(-2);
  const trendUp = last2.length === 2 && last2[1].ole > last2[0].ole;
  const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;
  const oles = weeklyByWeek.map(d => d.ole).filter(Boolean);
  const yMin = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax = oles.length ? Math.ceil(Math.max(...oles) / 10) * 10 + 10 : 100;

  const siteStatus = getOleStatus(siteOle);

  return (
    <div className="px-6 pt-5 pb-16 space-y-6">

      {/* SMH alert — first because it affects data integrity of everything below */}
      {/* {flagged > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">SMH Coverage Gaps — Data May Be Understated</p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              {flagged} shifts flagged PARTIAL_SMH. OLE figures below may be lower than actual.
            </p>
          </div>
        </div>
      )} */}

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Site OLE" icon={Activity} accent="bg-primary/15 text-primary"
          value={siteOle !== null ? `${siteOle.toFixed(1)}%` : '—'}
          sub="Penang · all plants"
          trend={trendDiff ? `${trendDiff}% vs last week` : undefined} up={trendUp}
          onClick={() => onNavigate('workcells')} />
        <KpiCard label="Input Hours" icon={Clock} accent="bg-violet-500/15 text-violet-400"
          value={totalInput > 0 ? `${(totalInput / 1000).toFixed(1)}k` : '—'}
          sub="Total paid direct hrs"
          onClick={() => onNavigate('labor')} />
        <KpiCard label="Units Produced" icon={Users} accent="bg-amber-500/15 text-amber-400"
          value={totalQty > 0 ? `${(totalQty / 1000).toFixed(1)}k` : '—'}
          sub="Total scanned output"
          onClick={() => onNavigate('output')} />
        <KpiCard label="Shifts Captured" icon={BarChart2} accent="bg-blue-500/15 text-blue-400"
          value={totalShifts > 0 ? String(totalShifts) : '—'}
          sub={flagged > 0 ? `${flagged} flagged` : 'All shifts clean'}
          trend={flagged > 0 ? `${flagged} need attention` : undefined} up={false}
          onClick={() => onNavigate('labor')} />
      </div>

      {/* Site OLE trend + Plant comparison side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Weekly OLE trend — 2/3 */}
        <div className="xl:col-span-2">
          <ChartCard title="Site OLE Weekly Trend — FY26" sub="Aggregate across all workcells and plants">
            {weeklyHook.loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyByWeek} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="h1siteGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'Site OLE']} />
                  <ReferenceLine y={61} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: '61% Goal', fill: '#10b981', fontSize: 9, position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="ole" stroke="hsl(var(--primary))" fill="url(#h1siteGrad)"
                    strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Plant 1 vs Plant 2 — 1/3 */}
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">Plant Comparison</p>
          {[
            { label: 'Plant 1', sub: 'Penang Main', ole: p1Ole, rows: plant1 },
            { label: 'Plant 2', sub: 'Batu Kawan', ole: p2Ole, rows: plant2 },
          ].map(({ label, sub, ole, rows }) => {
            const st = getOleStatus(ole);
            const clr = oleColor(ole);
            const hrs = rows.reduce((s, r) => s + r.total_input_hours, 0);
            const qty = rows.reduce((s, r) => s + r.total_qty, 0);
            return (
              <div key={label} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <span className="text-2xl font-mono font-bold" style={{ color: clr }}>
                    {ole !== null ? `${ole.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(ole ?? 0, 100)}%`, background: clr }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{(hrs / 1000).toFixed(1)}k hrs input</span>
                  <span>{(qty / 1000).toFixed(1)}k units</span>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border self-start', STATUS_BADGE[st])}>
                  {STATUS_LABEL[st]}
                </span>
              </div>
            );
          })}
          <button onClick={() => onNavigate('workcells')}
            className="w-full rounded-xl border border-primary/30 bg-primary/5 py-3 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
            View Workcell Breakdown →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Workcells ──────────────────────────────────────────────────────────

function WorkcellsTab({
  plant, workcell, setWorkcell, dateFrom, dateTo, search,
  onNavigate,
}: {
  plant: string; workcell: string; setWorkcell: (v: string) => void;
  dateFrom: string; dateTo: string; search: string;
  onNavigate: (tab: TabId, wc?: string) => void;
}) {
  const navigate = useNavigate();
  const summaryHook = useOleSummary();
  const weeklyHook = useOleWeekly({});
  const [sortCol, setSortCol] = useState('avg_ole_pct');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback((col: string) => {
    setSortCol(prev => { if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else setSortDir('asc'); return col; });
  }, []);

  const PLANT2_WCS = ['ARISTA NETWORKS', 'ARISTA NETWORKS HLA'];

  const filtered = useMemo(() => {
    const list = (summaryHook.data ?? []).filter(r =>
      (!plant || (plant === 'Plant 1' ? !PLANT2_WCS.includes(r.workcell) : PLANT2_WCS.includes(r.workcell))) &&
      (!workcell || r.workcell === workcell) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()))
    );
    return sortRows(list, sortCol, sortDir) as OleSummary[];
  }, [summaryHook.data, plant, workcell, search, sortCol, sortDir]);

  // OLE range per workcell (from weekly data)
  const rangeByWc = useMemo(() => {
    const m: Record<string, { min: number; max: number }> = {};
    (weeklyHook.data ?? []).forEach(r => {
      if (r.ole_pct === null) return;
      if (!m[r.workcell]) m[r.workcell] = { min: r.ole_pct, max: r.ole_pct };
      m[r.workcell].min = Math.min(m[r.workcell].min, r.ole_pct);
      m[r.workcell].max = Math.max(m[r.workcell].max, r.ole_pct);
    });
    return m;
  }, [weeklyHook.data]);

  const cols: [string, string][] = [
    ['', '#'],
    ['workcell', 'Workcell'],
    ['stage_label', 'Stage'],
    ['avg_ole_pct', 'OLE %'],
    ['total_output_smh', 'Output SMH'],
    ['total_input_hours', 'Input Hrs'],
    ['total_qty', 'Units'],
    ['', 'Status'],
  ];

  return (
    <div className="px-6 pt-5 pb-16 space-y-6">
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <TableHeader cols={cols} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} gt={SCORECARD_GT} />
        {summaryHook.loading && filtered.length === 0
          ? <EmptyTable msg="Loading…" />
          : filtered.length === 0
            ? <EmptyTable msg={summaryHook.error ? 'Backend unreachable' : 'No data'} />
            : filtered.map((row, idx) => {
              const calcOle = row.total_input_hours > 0 ? (row.total_output_smh / row.total_input_hours) * 100 : 0;
              const st = getOleStatus(calcOle);
              const clr = oleColor(calcOle);
              const range = rangeByWc[row.workcell];
              const k = row.workcell.toLowerCase().replace(/[^a-z]/g, '');
              const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
              const logo = lk ? WORKCELL_LOGOS[lk] : null;
              return (
                <div key={row.workcell}
                  className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  style={{ gridTemplateColumns: SCORECARD_GT }}>
                  <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                  <button onClick={() => navigate(`/ole/${encodeURIComponent(row.workcell)}`)}
                    className="px-4 py-3.5 flex items-center gap-3 text-left group w-full">
                    {logo
                      ? <div className="w-8 h-8 rounded-lg border border-border bg-white flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={logo} alt={row.workcell} className="w-full h-full object-contain p-1" />
                      </div>
                      : <WorkcellBadge name={row.workcell} status={st} />
                    }
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{row.workcell}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Latest: {fmtDate(row.latest_date)}</p>
                    </div>
                  </button>
                  <div className="px-3 py-3.5">
                    <span className="text-xs font-medium text-muted-foreground">{row.stage_label}</span>
                  </div>
                  <div className="px-3 py-3.5">
                    <div className="text-center">
                      <span className={cn('text-lg font-mono font-bold', OLE_COLOR[st])}>
                        {row.total_input_hours > 0 ? `${calcOle.toFixed(1)}%` : '—'}
                      </span>
                      {/* Range bar below OLE% */}
                      {range && (
                        <div className="relative h-1 rounded-full bg-muted/50 overflow-hidden mt-1">
                          <div className="absolute h-full rounded-full" style={{
                            left: `${range.min}%`, width: `${Math.max(range.max - range.min, 1)}%`,
                            background: clr, opacity: 0.25,
                          }} />
                          <div className={cn('absolute h-full rounded-full', OLE_BAR[st])}
                            style={{ width: `${Math.min(calcOle, 100)}%` }} />
                        </div>
                      )}
                      {range && (
                        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                          <span>{range.min.toFixed(0)}%</span>
                          <span>{range.max.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { onNavigate('labor', row.workcell); }}
                    className="px-3 py-3.5 text-center hover:text-primary transition-colors">
                    <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_output_smh).toLocaleString()}</span>
                    <p className="text-[10px] text-muted-foreground">smh</p>
                  </button>
                  <button onClick={() => { onNavigate('labor', row.workcell); }}
                    className="px-3 py-3.5 text-center hover:text-primary transition-colors">
                    <span className="font-mono text-sm font-semibold text-foreground">{Math.round(row.total_input_hours).toLocaleString()}</span>
                    <p className="text-[10px] text-muted-foreground">hrs</p>
                  </button>
                  <button onClick={() => { onNavigate('output', row.workcell); }}
                    className="px-3 py-3.5 text-center hover:text-primary transition-colors">
                    <span className="font-mono text-sm font-semibold text-foreground">{row.total_qty.toLocaleString()}</span>
                    <p className="text-[10px] text-muted-foreground">units</p>
                  </button>
                  <div className="px-3 py-3.5 flex items-center justify-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap', STATUS_BADGE[st])}>
                      {STATUS_LABEL[st]}
                    </span>
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─── Tab 3: Labor ──────────────────────────────────────────────────────────────

function LaborTab({
  workcell, plant, dateFrom, dateTo, shift, search,
}: {
  workcell: string; plant: string; dateFrom: string; dateTo: string; shift: string; search: string;
}) {
  const shiftsHook = useOleResults();
  const hoursHook = useOlePaidHours();
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const PLANT2_WCS = ['ARISTA NETWORKS', 'ARISTA NETWORKS HLA'];

  const toggleSort = useCallback((col: string) => {
    setSortCol(prev => { if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else setSortDir('desc'); return col; });
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const list = (shiftsHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!plant || (plant === 'Plant 1' ? !PLANT2_WCS.includes(r.workcell) : PLANT2_WCS.includes(r.workcell))) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo || r.date <= dateTo) &&
      (!shift || r.shift === Number(shift)) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()))
    );
    return sortRows(list, sortCol, sortDir) as OleResult[];
  }, [shiftsHook.data, workcell, plant, dateFrom, dateTo, shift, search, sortCol, sortDir]);

  const phByKey = useMemo(() => {
    const m = new Map<string, OlePaidHours[]>();
    (hoursHook.data ?? []).forEach(ph => {
      const k = `${ph.workcell}|${ph.date}|${ph.shift}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ph);
    });
    return m;
  }, [hoursHook.data]);

  const cols: [string, string][] = [
    ['', ''],
    ['workcell', 'Workcell'],
    ['date', 'Date'],
    ['shift', 'Shift'],
    ['ole_pct', 'OLE %'],
    ['smh_coverage_pct', 'SMH Cov.'],
    ['effective_output_smh', 'Output SMH'],
    ['total_input_hours', 'Input Hrs'],
    ['total_qty', 'Qty'],
    ['assembly_count', 'Assemblies'],
  ];

  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-6 pt-5 pb-16 space-y-4">
      <div className="rounded-xl border border-border overflow-x-auto bg-card">
        <TableHeader cols={cols} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} gt={LABOR_GT} />
        {filtered.length === 0
          ? <EmptyTable msg={shiftsHook.error ? 'Backend unreachable' : 'No shift data'} />
          : slice.map((row, i) => {
            const key = `${row.workcell}|${row.date}|${row.shift}`;
            const isOpen = expanded.has(key);
            const emps = phByKey.get(key) ?? [];
            const st = getOleStatus(row.ole_pct);
            const idx = (page - 1) * PAGE_SIZE + i;
            return (
              <div key={key} className="border-b border-border last:border-0">
                <div className="grid items-center text-sm hover:bg-muted/40 transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: LABOR_GT, minHeight: ROW_HEIGHT }}
                  onClick={() => emps.length > 0 && setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}>
                  <div className="px-4 flex items-center justify-center text-muted-foreground">
                    {emps.length > 0
                      ? isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      : <span className="text-[10px] font-mono">{idx + 1}</span>}
                  </div>
                  <div className="px-3 flex items-center gap-2.5">
                    <WorkcellBadge name={row.workcell} status={st} />
                    <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                  </div>
                  <div className="px-3 font-mono text-xs text-foreground">{fmtDate(row.date)}</div>
                  <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                  <div className="px-3 text-center">
                    <span className={cn('font-mono font-bold', OLE_COLOR[st])}>
                      {row.ole_pct !== null ? `${row.ole_pct}%` : '—'}
                    </span>
                  </div>
                  <div className="px-3 text-center">
                    <span className={cn('text-xs font-mono font-semibold',
                      (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                        (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>{row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}</span>
                  </div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.effective_output_smh.toFixed(2)}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.total_input_hours.toFixed(2)}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.total_qty.toLocaleString()}</div>
                  <div className="px-3 text-center font-mono text-sm text-foreground">{row.assembly_count}</div>
                </div>
                {isOpen && emps.length > 0 && (
                  <div className="bg-muted/20 border-t border-border/50">
                    <div className="grid text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border/30"
                      style={{ gridTemplateColumns: '3rem 1fr 6rem 6rem 7rem 8rem' }}>
                      {['', 'Employee', 'Type', 'Direct HC', 'Direct Hrs', 'Total Input'].map(h => (
                        <div key={h} className="px-3 py-1.5">{h}</div>
                      ))}
                    </div>
                    {emps.map((emp, ei) => (
                      <div key={`${emp.name}-${ei}`}
                        className="grid items-center text-xs border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                        style={{ gridTemplateColumns: '3rem 1fr 6rem 6rem 7rem 8rem', height: 40 }}>
                        <div className="px-4 text-center text-muted-foreground font-mono">{ei + 1}</div>
                        <div className="px-3 text-foreground truncate">{emp.name || '—'}</div>
                        <div className="px-3 flex justify-center">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            emp.value_type === 'VA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                              emp.value_type === 'NVA' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                'bg-muted text-muted-foreground border-border'
                          )}>{emp.value_type || 'NVA'}</span>
                        </div>
                        <div className="px-3 text-center font-mono text-foreground">{emp.thc_direct}</div>
                        <div className="px-3 text-center font-mono text-foreground">{emp.tph_direct.toFixed(2)}</div>
                        <div className="px-3 text-center font-mono font-semibold text-foreground">{emp.total_input_hours.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

// ─── Tab 4: Output ─────────────────────────────────────────────────────────────

function OutputTab({
  workcell, plant, dateFrom, dateTo, search,
}: {
  workcell: string; plant: string; dateFrom: string; dateTo: string; search: string;
}) {
  const prodHook = useOleProduction();
  const smhHook = useSmhLookup();
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const PLANT2_WCS = ['ARISTA NETWORKS', 'ARISTA NETWORKS HLA'];

  const toggleSort = useCallback((col: string) => {
    setSortCol(prev => { if (prev === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else setSortDir('desc'); return col; });
    setPage(1);
  }, []);

  const smhMap = useMemo(() => {
    const m = new Map<string, number>();
    (smhHook.data ?? []).forEach(s => m.set(`${s.workcell}|${s.assembly}`, s.smh_value));
    return m;
  }, [smhHook.data]);

  const filtered = useMemo(() => {
    const list = (prodHook.data ?? []).filter(r =>
      (!workcell || r.workcell === workcell) &&
      (!plant || (plant === 'Plant 1' ? !PLANT2_WCS.includes(r.workcell) : PLANT2_WCS.includes(r.workcell))) &&
      (!dateFrom || r.date >= dateFrom) &&
      (!dateTo || r.date <= dateTo) &&
      (!search || r.workcell.toLowerCase().includes(search.toLowerCase()) || r.assembly.toLowerCase().includes(search.toLowerCase()))
    );
    return sortRows(list, sortCol, sortDir) as OleProduction[];
  }, [prodHook.data, workcell, plant, dateFrom, dateTo, search, sortCol, sortDir]);

  const cols: [string, string][] = [
    ['', '#'],
    ['workcell', 'Workcell'],
    ['date', 'Date'],
    ['shift', 'Shift'],
    ['sub_workcell', 'Stage'],
    ['assembly', 'Assembly'],
    ['qty', 'Qty'],
    ['smh_unit', 'SMH/unit'],
    ['output_smh', 'Output SMH'],
  ];

  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-6 pt-5 pb-16 space-y-4">
      <div className="rounded-xl border border-border overflow-x-auto bg-card">
        <TableHeader cols={cols} sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} gt={PROD_GT} />
        {filtered.length === 0
          ? <EmptyTable msg={prodHook.error ? 'Backend unreachable' : 'No production data'} />
          : slice.map((row, i) => {
            const smhUnit = smhMap.get(`${row.workcell}|${row.assembly}`) ?? null;
            const outputSmh = smhUnit !== null ? row.qty * smhUnit : null;
            const idx = (page - 1) * PAGE_SIZE + i;
            return (
              <div key={`${row.workcell}-${row.assembly}-${row.date}-${row.shift}-${idx}`}
                className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                style={{ gridTemplateColumns: PROD_GT, height: ROW_HEIGHT }}>
                <div className="px-4 text-center text-xs text-muted-foreground font-mono">{idx + 1}</div>
                <div className="px-3 flex items-center gap-2.5">
                  <WorkcellBadge name={row.workcell} status="idle" />
                  <span className="font-semibold text-foreground truncate">{row.workcell}</span>
                </div>
                <div className="px-3 font-mono text-xs text-foreground">{fmtDate(row.date)}</div>
                <div className="px-3 text-center font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                <div className="px-3"><span className="text-xs font-medium text-muted-foreground">{row.sub_workcell}</span></div>
                <div className="px-3 font-mono text-xs text-foreground truncate" title={row.assembly}>{row.assembly}</div>
                <div className="px-3 text-center font-mono font-semibold text-foreground">{row.qty.toLocaleString()}</div>
                <div className="px-3 text-center font-mono text-xs text-foreground">
                  {smhUnit !== null ? smhUnit.toFixed(4) : <span className="text-muted-foreground/50">—</span>}
                </div>
                <div className="px-3 text-center font-mono text-sm font-semibold text-foreground">
                  {outputSmh !== null ? outputSmh.toFixed(2) : <span className="text-muted-foreground/50">—</span>}
                </div>
              </div>
            );
          })
        }
      </div>
      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  );
}

// ─── Tab 5: Projection ─────────────────────────────────────────────────────────
// Re-exports the existing OLEPredictiveBacktesting component unchanged

import OLEPredictiveBacktesting from '@/pages/ole/tabs/OLEPredictiveBacktesting';

// ─── Main Page Shell ──────────────────────────────────────────────────────────

export default function OLEHome1() {
  const [activeTab, setActiveTab] = useState<TabId>('site');

  // ── Shared filter state — single source of truth for all tabs ──
  const [search, setSearch] = useState('');
  const [workcell, setWorkcell] = useState('');
  const [plant, setPlant] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shift, setShift] = useState('');

  // Reset page when filters change
  useEffect(() => { /* tabs handle their own pagination */ }, [workcell, plant, dateFrom, dateTo, shift, search]);

  const workcellsHook = useOleWorkcells();
  const workcellConfigs = workcellsHook.data ?? [];
  const summaryHook = useOleSummary();

  const plantOptions = useMemo(() =>
    Array.from(new Set(workcellConfigs.map(c => c.plant))).sort()
    , [workcellConfigs]);

  const workcellOptions = useMemo(() =>
    Array.from(new Set((summaryHook.data ?? []).map(r => r.workcell))).sort()
    , [summaryHook.data]);

  // Which filters are shown per tab
  const showSearch = activeTab !== 'site';
  const showPlant = activeTab !== 'site';
  const showWorkcell = activeTab !== 'site';
  const showDate = ['labor', 'output', 'projection'].includes(activeTab);
  const showShift = activeTab === 'labor';
  const showFilters = activeTab !== 'site' && activeTab !== 'projection';

  const onNavigate = useCallback((tab: TabId, wc?: string) => {
    setActiveTab(tab);
    if (wc) setWorkcell(wc);
  }, []);

  // Row counts for tab badges
  const rowCounts: Partial<Record<TabId, number>> = {
    workcells: (summaryHook.data ?? []).length,
  };

  return (
    <div className="space-y-0">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">OLE Analyzer <span className="text-xs font-normal text-muted-foreground ml-2">Home 1</span></h1>
            <p className="text-xs text-muted-foreground mt-0.5">Overall Labor Effectiveness · Penang</p>
          </div>
          <div className="flex items-center gap-3">
            {summaryHook.error && (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <WifiOff className="h-3.5 w-3.5" /> API offline
              </span>
            )}
            <button onClick={() => summaryHook.refetch()} disabled={summaryHook.loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
              <RefreshCw className={cn('h-3.5 w-3.5', summaryHook.loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 -mb-px">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}>
              {tab.label}
              {rowCounts[tab.id] != null && rowCounts[tab.id]! > 0 && (
                <span className="ml-2 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {rowCounts[tab.id]!.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters — reusing OLEFilters directly ── */}
      {showFilters && (
        <OLEFilters
          search={showSearch ? search : ''}
          setSearch={setSearch}
          workcell={showWorkcell ? workcell : ''}
          setWorkcell={setWorkcell}
          plant={showPlant ? plant : ''}
          setPlant={setPlant}
          plantOptions={plantOptions}
          workcellConfigs={workcellConfigs}
          dateFrom={showDate ? dateFrom : undefined}
          setDateFrom={showDate ? setDateFrom : undefined}
          dateTo={showDate ? dateTo : undefined}
          setDateTo={showDate ? setDateTo : undefined}
          shift={showShift ? shift : undefined}
          setShift={showShift ? setShift : undefined}
          workcellOptions={workcellOptions}
          rowCount={0}
          activeTab={activeTab}
        />
      )}

      {/* ── Tab content ── */}
      {activeTab === 'site' && (
        <SiteTab onNavigate={onNavigate} />
      )}

      {activeTab === 'workcells' && (
        <WorkcellsTab
          plant={plant} workcell={workcell} setWorkcell={setWorkcell}
          dateFrom={dateFrom} dateTo={dateTo} search={search}
          onNavigate={onNavigate}
        />
      )}

      {activeTab === 'labor' && (
        <LaborTab
          workcell={workcell} plant={plant}
          dateFrom={dateFrom} dateTo={dateTo}
          shift={shift} search={search}
        />
      )}

      {activeTab === 'output' && (
        <OutputTab
          workcell={workcell} plant={plant}
          dateFrom={dateFrom} dateTo={dateTo} search={search}
        />
      )}

      {activeTab === 'projection' && (
        <OLEPredictiveBacktesting />
      )}

    </div>
  );
}
