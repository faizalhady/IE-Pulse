/**
 * OLEWorkcell4.tsx — Workcell drill-down, same compact layout as OLEHome4
 * Route: /ole/wc4/:workcell
 *
 * Differences from OLEHome4:
 *  - Filter bar: Workcell dropdown (defaulting to URL param) + Week + Date From/To
 *  - No Plant Comparison card
 *  - Right column data table toggles between Labor Input and Production Output
 *    (columns match OLEOverview labor/production tabs exactly)
 */

import { cn } from '@/lib/utils';
import {
  getOleStatus, oleColor,
  OLE_COLOR, STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS, fmtDate, shiftLabel, OLE_TARGET,
} from '@/lib/oleConstants';
import { useOleWeekly, useOleWorkcells, useOleResults, useOleProduction, useOlePaidHours, useSmhLookup } from '@/hooks/useOleData';
import type { OleWeeklyResult } from '@/lib/oleApi';

type WeekRow = { isoWeek: number; label: string; start: string; end: string };
import {
  AlertTriangle, ChevronRight, TrendingUp, TrendingDown,
  X, ArrowRight, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from './OLEFilters';
import {
  ComposedChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 10,
  color: 'hsl(var(--foreground))',
};

// ─── Column layouts (match OLEOverview exactly) ───────────────────────────────
const LABOR_GT  = '2.5rem 6rem 4rem 7rem 6rem 6.5rem 6.5rem 5.5rem 7rem';
const PROD_GT   = '2.5rem 6rem 4rem 5rem 12rem 5rem 6rem 7rem';

// ─── Static fallback week list (replaced by live data once loaded) ──────────
const ALL_WEEKS: { isoWeek: number; label: string; start: string; end: string }[] = [];

// ─── Aggregate live weekly rows for a single workcell ─────────────────────────
function aggregateWcWeekly(rows: OleWeeklyResult[]) {
  const out = rows.reduce((s, r) => s + r.total_output_smh, 0);
  const inp = rows.reduce((s, r) => s + r.total_input_hours, 0);
  return {
    ole_pct:           inp > 0 ? (out / inp) * 100 : 0,
    total_output_smh:  out,
    total_input_hours: inp,
    total_qty:         rows.reduce((s, r) => s + r.total_qty, 0),
    total_shifts:      rows.reduce((s, r) => s + r.shift_count, 0),
    flagged_shifts:    rows.reduce((s, r) => s + r.shifts_flagged, 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEWorkcell4() {
  const navigate = useNavigate();
  const { workcell: paramWc } = useParams<{ workcell: string }>();
  const [searchParams] = useSearchParams();

  // ── Live data ──────────────────────────────────────────────────────────────
  const weeklyHook     = useOleWeekly();
  const workcellsHook  = useOleWorkcells();
  const resultsHook    = useOleResults();
  const productionHook = useOleProduction();
  const paidHoursHook  = useOlePaidHours();
  const smhLookupHook  = useSmhLookup();

  const rawWeekly       = weeklyHook.data     ?? [];
  const workcellConfigs = workcellsHook.data  ?? [];
  const rawResults      = resultsHook.data    ?? [];
  const rawProduction   = productionHook.data ?? [];
  const rawPaidHours    = paidHoursHook.data  ?? [];
  const smhList         = smhLookupHook.data  ?? [];

  const smhMap = useMemo(() => {
    const m = new Map<string, number>();
    smhList.forEach(s => m.set(`${s.workcell}|${s.assembly}`, s.smh_value));
    return m;
  }, [smhList]);

  const workcellNames = useMemo(() => workcellConfigs.map(w => w.workcell).sort(), [workcellConfigs]);

  const weeks = useMemo((): WeekRow[] => {
    const seen = new Set<string>();
    const list: WeekRow[] = [];
    rawWeekly.forEach(r => {
      if (!seen.has(r.week_label)) {
        seen.add(r.week_label);
        list.push({ isoWeek: r.iso_week, label: `WW${String(r.iso_week).padStart(2, '0')}`, start: r.week_start_date, end: r.week_end_date });
      }
    });
    return list.sort((a, b) => a.isoWeek - b.isoWeek);
  }, [rawWeekly]);

  // ── Initialise from URL params passed by Home4 ──────────────────────────────
  const initWeek = searchParams.get('week') ? Number(searchParams.get('week')) : null;
  const initFrom = searchParams.get('from') ?? '';
  const initTo   = searchParams.get('to')   ?? '';

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [workcell, setWorkcell]         = useState<string>(decodeURIComponent(paramWc ?? ''));
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initWeek);
  const [dateFrom, setDateFrom]         = useState<string>(initFrom);
  const [dateTo, setDateTo]             = useState<string>(initTo);
  const [tableTab, setTableTab]         = useState<'labor' | 'production'>('labor');
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());

  function selectWeek(w: WeekRow) {
    setSelectedWeek(w.isoWeek);
    setDateFrom(w.start);
    setDateTo(w.end);
  }
  function handleDateFrom(val: string) { setDateFrom(val); setSelectedWeek(null); }
  function handleDateTo(val: string)   { setDateTo(val);   setSelectedWeek(null); }

  const weekLabel = selectedWeek !== null
    ? `WW${String(selectedWeek).padStart(2, '0')}` : 'Custom';

  // ── Filtered weekly rows for selected workcell + date ─────────────────────
  const filteredWeekly = useMemo(() =>
    rawWeekly.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return r.iso_week === selectedWeek;
      const inDate = (!dateFrom && !dateTo) ||
        ((!dateFrom || r.week_start_date <= dateTo) && (!dateTo || r.week_end_date >= dateFrom));
      return inDate;
    })
  , [rawWeekly, workcell, dateFrom, dateTo, selectedWeek]);

  // ── Aggregates ───────────────────────────────────────────────────────────────
  const agg = useMemo(() => aggregateWcWeekly(filteredWeekly), [filteredWeekly]);

  // ── Weekly trend chart (all weeks for this workcell) ──────────────────────
  const wcWeekly = useMemo(() =>
    rawWeekly
      .filter(r => r.workcell === workcell)
      .sort((a, b) => a.iso_week - b.iso_week)
      .map(r => ({ w: `WW${String(r.iso_week).padStart(2, '0')}`, isoWeek: r.iso_week, ole: r.ole_pct ?? 0 }))
  , [rawWeekly, workcell]);

  // ── MH breakdown for selected workcell ────────────────────────────────────
  const mh = { total_input_hours: agg.total_input_hours, slices: [
    { name: 'Output SMH',    value: agg.total_output_smh,                                   color: '#22c55e' },
    { name: 'Unaccounted',   value: Math.max(0, agg.total_input_hours - agg.total_output_smh), color: '#94a3b8' },
  ]};

  const flaggedCount = useMemo(() =>
    rawResults.filter(r => r.workcell === workcell && r.data_quality !== 'OK').length
  , [rawResults, workcell]);

  const laborRows = useMemo(() =>
    rawResults.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return filteredWeekly.some(w => r.date >= w.week_start_date && r.date <= w.week_end_date);
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo   && r.date > dateTo)   return false;
      return true;
    })
  , [rawResults, workcell, selectedWeek, dateFrom, dateTo, filteredWeekly]);

  const paidHoursByKey = useMemo(() => {
    const map = new Map<string, typeof rawPaidHours>();
    rawPaidHours.filter(h => h.workcell === workcell).forEach(h => {
      const k = `${h.workcell}|${h.date}|${h.shift}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    });
    return map;
  }, [rawPaidHours, workcell]);

  const prodRows = useMemo(() =>
    rawProduction.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return filteredWeekly.some(w => r.date >= w.week_start_date && r.date <= w.week_end_date);
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo   && r.date > dateTo)   return false;
      return true;
    })
  , [rawProduction, workcell, selectedWeek, dateFrom, dateTo, filteredWeekly]);

  const siteOle    = agg.ole_pct;
  const siteStatus = getOleStatus(siteOle);
  const siteColor  = oleColor(siteOle);
  const oles       = wcWeekly.map(d => d.ole).filter(Boolean);
  const yMin       = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax       = oles.length ? Math.ceil(Math.max(...oles) / 10) * 10 + 10 : 100;

  // WoW trend
  const last2     = wcWeekly.slice(-2);
  const trendUp   = last2.length === 2 && last2[1].ole > last2[0].ole;
  const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;

  // Logo
  const k    = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk   = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  const logo = lk ? WORKCELL_LOGOS[lk] : null;

  return (
    <div className="relative">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-2 flex items-center gap-3 flex-wrap">

          {/* Back */}
          <button onClick={() => navigate('/ole/home4')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mr-1">
            ← Home
          </button>

          {/* Workcell */}
          <Select value={workcell} onValueChange={setWorkcell}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {workcellNames.map(w => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Week */}
          <Select
            value={selectedWeek !== null ? String(selectedWeek) : 'custom'}
            onValueChange={(v) => {
              if (v === 'custom') return;
              const found = weeks.find(w => w.isoWeek === Number(v));
              if (found) selectWeek(found);
            }}
          >
            <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {selectedWeek === null && <SelectItem value="custom">All Weeks</SelectItem>}
              {weeks.map(w => (
                <SelectItem key={w.isoWeek} value={String(w.isoWeek)}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DatePickerField id="wc4-from" label="" value={dateFrom} onChange={handleDateFrom} />
          <DatePickerField id="wc4-to"   label="" value={dateTo}   onChange={handleDateTo} />
        </div>
      </div>

      <div className="p-5 flex gap-5" style={{ minHeight: 'calc(100vh - 48px)' }}>

        {/* ── LEFT COLUMN ── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Workcell OLE hero */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              {logo && (
                <div className="w-20 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logo} alt={workcell} className="w-full h-full object-contain p-1" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                  Workcell OLE · {weekLabel}
                </p>
                <p className="text-[10px] font-semibold text-foreground truncate mt-0.5">{workcell}</p>
              </div>
            </div>
            <p className="text-5xl font-mono font-black mt-3 leading-none" style={{ color: siteColor }}>
              {siteOle.toFixed(1)}%
            </p>
            <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(siteOle, 100)}%`, background: siteColor }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', STATUS_BADGE[siteStatus])}>
                {STATUS_LABEL[siteStatus]}
              </span>
              {trendDiff && (
                <span className={cn('text-[10px] flex items-center gap-1 font-medium', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                  {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trendDiff}% WoW
                </span>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1.5">Target {OLE_TARGET}% · Gap {Math.max(0, OLE_TARGET - siteOle).toFixed(1)}pp</p>
          </div>

          {/* Output / Input strip */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Output SMH</p>
                <p className="text-xl font-mono font-bold text-primary mt-0.5">
                  {agg.total_output_smh.toFixed(1)}
                </p>
                <p className="text-[9px] text-muted-foreground">Σ(Qty × SMH/unit)</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Input Hours</p>
                <p className="text-xl font-mono font-bold text-violet-400 mt-0.5">
                  {agg.total_input_hours.toFixed(1)}
                </p>
                <p className="text-[9px] text-muted-foreground">Σ(Paid Direct Hrs)</p>
              </div>
            </div>
          </div>

          {/* Hours distribution */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">Hours Distribution</p>
            <div className="space-y-2">
              {mh.slices.map(s => {
                const pct = (s.value / mh.total_input_hours * 100);
                return (
                  <div key={s.name} className="w-full flex items-center gap-2 px-1 py-0.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[9px] text-muted-foreground flex-1 text-left truncate">{s.name}</span>
                    <span className="text-[9px] font-mono font-bold text-foreground">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attention */}
          {flaggedCount > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Attention</p>
              </div>
              <div className="px-4 py-2.5 flex items-center gap-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground">Flagged shifts</p>
                  <p className="text-[9px] text-muted-foreground">Data quality issues detected</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-400">{flaggedCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Weekly chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Weekly OLE Trend · {workcell}</p>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-2.5 w-2.5" /> Click bar to filter · highlighted = active week
                </p>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> ≥{OLE_TARGET}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 45–{OLE_TARGET - 1}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt;45%</span>
              </div>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={wcWeekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  onClick={(d) => {
                    if (!d?.activePayload) return;
                    const iw = d.activePayload[0]?.payload?.isoWeek;
                    const found = weeks.find(w => w.isoWeek === iw);
                    if (found) selectWeek(found);
                  }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
                  <ReferenceLine y={OLE_TARGET} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="ole" radius={[3, 3, 0, 0]} maxBarSize={24} cursor="pointer">
                    {wcWeekly.map((d, i) => {
                      const isSelected = d.isoWeek === selectedWeek;
                      const baseColor  = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= 45 ? '#f59e0b' : '#ef4444';
                      return <Cell key={i} fill={baseColor} opacity={isSelected ? 1 : 0.4} />;
                    })}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data table with Labor / Production toggle */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">

            {/* Table header + toggle */}
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                {tableTab === 'labor' ? 'Labor Input' : 'Production Output'} · {workcell} · {weekLabel}
              </p>
              <div className="flex gap-1">
                {(['labor', 'production'] as const).map(t => (
                  <button key={t} onClick={() => setTableTab(t)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-medium border transition-all',
                      tableTab === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'text-muted-foreground border-border hover:text-foreground'
                    )}>
                    {t === 'labor' ? 'Labor Input' : 'Production Output'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">

              {/* ── LABOR INPUT ── */}
              {tableTab === 'labor' && (
                <>
                  {/* Header */}
                  <div className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                    style={{ gridTemplateColumns: LABOR_GT }}>
                    {['', 'Date', 'Shift', 'OLE %', 'SMH Cov.', 'Output SMH', 'Input Hrs', 'Qty', 'Assemblies'].map(h => (
                      <div key={h} className="px-3 py-2">{h}</div>
                    ))}
                  </div>

                  {laborRows.length === 0
                    ? <div className="py-8 text-center text-[10px] text-muted-foreground">No labor data</div>
                    : laborRows.map((row) => {
                      const key      = `${row.workcell}|${row.date}|${row.shift}`;
                      const expanded = expandedShifts.has(key);
                      const status   = getOleStatus(row.ole_pct);
                      const empRows  = paidHoursByKey.get(key) ?? [];
                      return (
                        <div key={key} className="border-b border-border last:border-0">
                          <div
                            className="grid items-center hover:bg-muted/30 transition-colors cursor-pointer"
                            style={{ gridTemplateColumns: LABOR_GT, height: 44 }}
                            onClick={() => empRows.length > 0 && setExpandedShifts(prev => {
                              const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
                            })}
                          >
                            {/* expand toggle */}
                            <div className="px-3 flex items-center justify-center text-muted-foreground">
                              {empRows.length > 0
                                ? expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                : null}
                            </div>
                            <div className="px-3 font-mono text-[9px] text-foreground">{fmtDate(row.date)}</div>
                            <div className="px-3 text-[9px] font-mono font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                            <div className="px-3">
                              <span className={cn('text-sm font-mono font-bold', OLE_COLOR[status])}>
                                {row.ole_pct !== null ? `${row.ole_pct}%` : '—'}
                              </span>
                            </div>
                            <div className="px-3">
                              <span className={cn('text-[9px] font-mono font-semibold',
                                (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                                (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                              )}>{row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}</span>
                            </div>
                            <div className="px-3 font-mono text-[9px] text-foreground">{row.effective_output_smh.toFixed(2)}</div>
                            <div className="px-3 font-mono text-[9px] text-foreground">{row.total_input_hours.toFixed(2)}</div>
                            <div className="px-3 font-mono text-[9px] text-foreground">{row.total_qty.toLocaleString()}</div>
                            <div className="px-3 font-mono text-[9px] text-foreground">{row.assembly_count}</div>
                          </div>

                          {/* Employee sub-rows */}
                          {expanded && empRows.length > 0 && (
                            <div className="bg-muted/20 border-t border-border/50">
                              <div className="grid text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border/30"
                                style={{ gridTemplateColumns: '3rem 1fr 5rem 5rem 6rem 7rem' }}>
                                {['', 'Employee', 'Type', 'HC', 'Direct Hrs', 'Total Input'].map(h => (
                                  <div key={h} className="px-3 py-1.5">{h}</div>
                                ))}
                              </div>
                              {empRows.map((emp, ei) => (
                                <div key={ei} className="grid items-center text-[9px] border-b border-border/20 last:border-0 hover:bg-muted/30"
                                  style={{ gridTemplateColumns: '3rem 1fr 5rem 5rem 6rem 7rem', height: 36 }}>
                                  <div className="px-3 text-center text-muted-foreground font-mono">{ei + 1}</div>
                                  <div className="px-3 text-foreground truncate">{emp.name || '—'}</div>
                                  <div className="px-3 flex justify-center">
                                    <span className={cn('text-[8px] font-semibold px-1.5 py-0.5 rounded-full border',
                                      emp.value_type === 'VA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'
                                    )}>{emp.value_type}</span>
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
                </>
              )}

              {/* ── PRODUCTION OUTPUT ── */}
              {tableTab === 'production' && (
                <>
                  <div className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                    style={{ gridTemplateColumns: PROD_GT }}>
                    {['#', 'Date', 'Shift', 'Stage', 'Assembly', 'Qty', 'SMH/unit', 'Output SMH'].map(h => (
                      <div key={h} className="px-3 py-2">{h}</div>
                    ))}
                  </div>

                  {prodRows.length === 0
                    ? <div className="py-8 text-center text-[10px] text-muted-foreground">No production data</div>
                    : prodRows.map((row, idx) => {
                      const smhUnit   = smhMap.get(`${row.workcell}|${row.assembly}`) ?? null;
                      const outputSmh = smhUnit !== null ? row.qty * smhUnit : null;
                      return (
                        <div key={idx} className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          style={{ gridTemplateColumns: PROD_GT, height: 44 }}>
                          <div className="px-3 text-[9px] text-muted-foreground font-mono">{idx + 1}</div>
                          <div className="px-3 font-mono text-[9px] text-foreground">{fmtDate(row.date)}</div>
                          <div className="px-3 font-mono text-[9px] font-semibold text-foreground">{shiftLabel(row.shift)}</div>
                          <div className="px-3 text-[9px] text-muted-foreground">{row.sub_workcell}</div>
                          <div className="px-3 font-mono text-[9px] text-foreground truncate" title={row.assembly}>{row.assembly}</div>
                          <div className="px-3 font-mono text-[9px] font-semibold text-foreground">{row.qty.toLocaleString()}</div>
                          <div className="px-3 font-mono text-[9px] text-foreground">
                            {smhUnit !== null ? smhUnit.toFixed(4) : <span className="text-muted-foreground/50">—</span>}
                          </div>
                          <div className="px-3 font-mono text-[9px] font-semibold text-foreground">
                            {outputSmh !== null ? outputSmh.toFixed(2) : <span className="text-muted-foreground/50">—</span>}
                          </div>
                        </div>
                      );
                    })
                  }
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
