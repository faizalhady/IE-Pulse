/**
 * OleWorkcellReport.tsx — Workcell drill-down for the OLE report.
 * Route: /report/wc/:workcell
 */

import { OleFilterBar } from '@/components/ole/OleFilterBar';
import { MhPieModal } from '@/components/ole/MhPieModal';
import { TrendModal } from '@/components/ole/TrendModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShiftOperator } from '@/lib/ole/oleApi';
import { useMhDistribution, useOleProduction, useOleResults, useOleWeekly, useOleWorkcells, useWorkcellOperators, useSmhLookup } from '@/hooks/ole/useOleData';
import { useOleDateFilter } from '@/hooks/ole/useOleDateFilter';
import { aggregateTotals } from '@/lib/ole/oleCalculations';
import { TT } from '@/lib/ole/oleChartStyles';
import {
  OLE_COLOR,
  OLE_TARGET,
  OLE_WARNING,
  STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS,
  dayName,
  fmtDate,
  formatWeekLabel,
  getOleStatus, oleColor,
  shiftLabel,
} from '@/lib/ole/oleConstants';
import { LABOR_GT, PROD_GT, ROW_H, TD, TH } from '@/lib/ole/oleTableLayouts';
import type { WeekRow } from '@/lib/ole/oleTypes';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  Info,
  Loader2,
  Users,
  X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';

// ─── Shift drawer ─────────────────────────────────────────────────────────────
interface ShiftDrawerData {
  workcell: string;
  date: string;
  shift: number;
  ole_pct: number | null;
  smh_coverage_pct: number | null;
  effective_output_smh: number;
  total_input_hours: number;
  total_qty: number;
  assembly_count: number;
}

function ShiftDrawer({
  data, onClose, employees, loading,
}: {
  data: ShiftDrawerData;
  onClose: () => void;
  employees: ShiftOperator[];
  loading: boolean;
}) {
  const clr = oleColor(data.ole_pct ?? 0);
  const paidHoursLoading = loading && employees.length === 0;

  const vaCount  = employees.filter(emp => emp.value_type === 'VA').length;
  const nvaCount = employees.filter(emp => emp.value_type === 'NVA' || emp.value_type === '').length;

  const sortedEmployees = [...employees].sort((a, b) => {
    // Use empty strings as fallbacks in case position is null/undefined
    const posA = a.position || "";
    const posB = b.position || "";

    return posA.localeCompare(posB);
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[680px] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">
              {data.workcell} · {fmtDate(data.date)} · {shiftLabel(data.shift)} Shift
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Labor input breakdown · {paidHoursLoading ? 'loading…' : `${employees.length} operator${employees.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 divide-x divide-border border-b border-border flex-shrink-0">
          {[
            {
              label: 'Headcount',
              value: employees.length > 0 ? employees.length.toString() : '—',
              color: undefined
            },
            {
              label: 'VA Total',
              value: vaCount > 0 ? vaCount.toString() : '—',
              color: undefined
            },
            {
              label: 'NVA Total',
              value: nvaCount > 0 ? nvaCount.toString() : '—',
              color: undefined
            },
            { label: 'Output SMH', value: data.effective_output_smh.toFixed(1), color: undefined },
            { label: 'Input Hrs', value: data.total_input_hours.toFixed(1), color: undefined },
          ].map(k => (
            <div key={k.label} className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-xl font-mono font-bold mt-0.5" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Operator table */}
        <div className="flex-1 overflow-y-auto">
          {paidHoursLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin opacity-50" />
              <p className="text-xs">Loading operator data…</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Users className="h-6 w-6 opacity-40" />
              <p className="text-xs">No operator data for this shift</p>
            </div>
          ) : (
            <>
              <div className="grid bg-muted/100 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border sticky top-0"
                style={{ gridTemplateColumns: '2.5rem 1fr 5rem 6rem 7rem' }}>
                {['#', 'Position', 'Type', 'Total Input'].map(h => (
                  <div key={h} className="px-4 py-2.5">{h}</div>
                ))}
              </div>
              {sortedEmployees.map((emp: any, i: number) => (
                <div key={i}
                  className="grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1fr 5rem 6rem 7rem', height: 52 }}>
                  <div className="px-4 text-xs text-muted-foreground font-mono">{i + 1}</div>
                  <div className="px-4 text-sm font-medium text-foreground truncate">{emp.position || '—'}</div>
                  <div className="px-4">
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      emp.value_type === 'VA'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/15 text-red-400 border-red-500/30'
                    )}>{emp.value_type || 'NVA'}</span>
                  </div>
                  <div className="px-4 text-sm font-mono font-semibold text-foreground text-center">
                    {typeof emp.total_input_hours === 'number' ? emp.total_input_hours.toFixed(2) : '—'}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OleWorkcellReport() {
  const navigate = useNavigate();
  const { workcell: paramWc } = useParams<{ workcell: string }>();
  const [searchParams] = useSearchParams();

  const weeklyHook = useOleWeekly();
  const workcellsHook = useOleWorkcells();
  const resultsHook = useOleResults();
  const productionHook = useOleProduction();
  const smhLookupHook = useSmhLookup();
  const mhHook = useMhDistribution();

  const rawWeekly = weeklyHook.data ?? [];
  const workcellConfigs = workcellsHook.data ?? [];
  const rawResults = resultsHook.data ?? [];
  const rawProduction = productionHook.data ?? [];
  const smhList = smhLookupHook.data ?? [];

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
        list.push({ isoWeek: r.iso_week, label: formatWeekLabel(r.iso_week), start: r.week_start_date, end: r.week_end_date });
      }
    });
    return list.sort((a, b) => a.isoWeek - b.isoWeek);
  }, [rawWeekly]);

  const initWeek = searchParams.get('week') ? Number(searchParams.get('week')) : null;
  const initFrom = searchParams.get('from') ?? '';
  const initTo = searchParams.get('to') ?? '';

  const [workcell, setWorkcell] = useState<string>(decodeURIComponent(paramWc ?? ''));
  const opsHook = useWorkcellOperators(workcell || null);
  const {
    selectedWeek,
    dateFrom,
    dateTo,
    selectWeek,
    handleDateFrom, handleDateTo,
    reset: resetDateFilter,
  } = useOleDateFilter({ initialWeek: initWeek, initialFrom: initFrom, initialTo: initTo });
  const [tableTab, setTableTab] = useState<'labor' | 'production'>('labor');
  const [drawerShift, setDrawerShift] = useState<ShiftDrawerData | null>(null);
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [mhModalOpen, setMhModalOpen] = useState(false);

  const weekLabel = useMemo(() => {
    if (selectedWeek !== null) return formatWeekLabel(selectedWeek);
    if (dateFrom && dateTo) {
      return `${format(parseISO(dateFrom), 'd MMMM yyyy')} - ${format(parseISO(dateTo), 'd MMMM yyyy')}`;
    }
    if (dateFrom) return `From ${format(parseISO(dateFrom), 'd MMMM yyyy')}`;
    if (dateTo) return `Until ${format(parseISO(dateTo), 'd MMMM yyyy')}`;
    return 'All Weeks';
  }, [selectedWeek, dateFrom, dateTo]);

  const filteredWeekly = useMemo(() =>
    rawWeekly.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return r.iso_week === selectedWeek;
      const inDate = (!dateFrom && !dateTo) ||
        ((!dateFrom || r.week_start_date <= dateTo) && (!dateTo || r.week_end_date >= dateFrom));
      return inDate;
    }), [rawWeekly, workcell, dateFrom, dateTo, selectedWeek]);

  const agg = useMemo(() => aggregateTotals(filteredWeekly), [filteredWeekly]);

  const wcWeeklyFull = useMemo(() =>
    rawWeekly
      .filter(r => r.workcell === workcell)
      .sort((a, b) => a.iso_week - b.iso_week)
      .map(r => ({
        w: formatWeekLabel(r.iso_week),
        isoWeek: r.iso_week,
        ole: r.ole_pct ?? 0,
        smh: r.total_output_smh,
        hrs: r.total_input_hours,
      })), [rawWeekly, workcell]);

  const wcWeekly = useMemo(
    () => wcWeeklyFull.map(({ w, isoWeek, ole }) => ({ w, isoWeek, ole })),
    [wcWeeklyFull]);

  const mh = {
    total_input_hours: agg.total_input_hours,
    slices: [
      { name: 'Output SMH', value: agg.total_output_smh, color: '#22c55e' },
      { name: 'Unaccounted', value: Math.max(0, agg.total_input_hours - agg.total_output_smh), color: '#94a3b8' },
    ]
  };

  const flaggedCount = useMemo(() =>
    rawResults.filter(r => r.workcell === workcell && r.data_quality !== 'OK').length,
    [rawResults, workcell]);

  const laborRows = useMemo(() =>
    rawResults.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return filteredWeekly.some(w => r.date >= w.week_start_date && r.date <= w.week_end_date);
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    }), [rawResults, workcell, selectedWeek, dateFrom, dateTo, filteredWeekly]);

  const operatorsByShift = useMemo(() => {
    const rows = opsHook.data ?? [];
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = `${r.date}|${r.shift}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [opsHook.data]);

  const prodRows = useMemo(() =>
    rawProduction.filter(r => {
      if (r.workcell !== workcell) return false;
      if (selectedWeek !== null) return filteredWeekly.some(w => r.date >= w.week_start_date && r.date <= w.week_end_date);
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    }), [rawProduction, workcell, selectedWeek, dateFrom, dateTo, filteredWeekly]);

  const kpiSmh = useMemo(() => laborRows.reduce((s, r) => s + r.effective_output_smh, 0), [laborRows]);
  const kpiHrs = useMemo(() => laborRows.reduce((s, r) => s + r.total_input_hours, 0), [laborRows]);

  // ── Man-hours distribution — pre-computed per shift, summed under current filter
  const mhTotals = useMemo(() => {
    const rows = mhHook.data ?? [];
    const acc = { nva: 0, lunch: 0, mfg_dt: 0, downtime: 0, mfg_lost: 0, paid: 0 };
    for (const r of rows) {
      if (r.workcell !== workcell) continue;
      if (selectedWeek !== null) {
        if (!filteredWeekly.some(w => r.date >= w.week_start_date && r.date <= w.week_end_date)) continue;
      } else {
        if (dateFrom && r.date < dateFrom) continue;
        if (dateTo && r.date > dateTo) continue;
      }
      acc.nva      += r.nva_hours       || 0;
      acc.lunch    += r.lunch_hours     || 0;
      acc.mfg_dt   += r.mfg_dt_hours    || 0;
      acc.downtime += r.downtime_hours  || 0;
      acc.mfg_lost += r.mfg_lost_hours  || 0;
      acc.paid     += r.total_paid_hours || 0;
    }
    return acc;
  }, [mhHook.data, workcell, selectedWeek, dateFrom, dateTo, filteredWeekly]);

  // Overall VA / NVA counts — pre-aggregated in ole_computed (no paid_hours walk).
  const { vaTotal, nvaTotal } = useMemo(() => {
    let va = 0;
    let nva = 0;
    for (const r of laborRows) {
      va += r.va_count || 0;
      nva += r.nva_count || 0;
    }
    return { vaTotal: va, nvaTotal: nva };
  }, [laborRows]);
  const kpiOle = kpiHrs > 0 ? (kpiSmh / kpiHrs) * 100 : 0;

  const siteOle = kpiOle;
  const siteColor = oleColor(siteOle);
  const oles = wcWeekly.map(d => d.ole).filter(Boolean);
  const yMin = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax = oles.length ? Math.ceil(Math.max(...oles) / 10) * 10 + 10 : 100;

  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  const logo = lk ? WORKCELL_LOGOS[lk] : null;

  return (
    <div className="relative">
      {drawerShift && (
        <ShiftDrawer
          data={drawerShift}
          onClose={() => setDrawerShift(null)}
          employees={operatorsByShift.get(`${drawerShift.date}|${drawerShift.shift}`) ?? []}
          loading={opsHook.loading}
        />
      )}
      <TrendModal
        open={trendModalOpen}
        onClose={() => setTrendModalOpen(false)}
        title={`${workcell} — Output SMH & Input Hours Trend`}
        data={wcWeeklyFull}
        selectedWeek={selectedWeek}
        yScale="raw"
        referenceLineOpacity={0.8}
      />

      <MhPieModal
        open={mhModalOpen}
        onClose={() => setMhModalOpen(false)}
        title={`${workcell} — Man-Hours Distribution`}
        total={mhTotals.paid}
        slices={[
          { name: 'Output (Productive)', value: kpiSmh,         color: '#22c55e' },
          { name: 'NVA Input',     value: mhTotals.nva,          color: '#ef4444' },
          { name: 'Lunch',         value: mhTotals.lunch,        color: '#94a3b8' },
          { name: 'MFG DT',        value: mhTotals.mfg_dt,       color: '#6366f1' },
          { name: 'Downtime',      value: mhTotals.downtime,     color: '#a855f7' },
          { name: 'MFG Hour Lost', value: mhTotals.mfg_lost,     color: '#f59e0b' },
        ]}
      />

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/report')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            &larr; Plant Level
          </button>
          <span className="text-sm font-bold text-foreground">OLE Report - {workcell}</span>
        </div>
      </div>

      {/* Filter bar */}
      <OleFilterBar
        weeks={weeks}
        selectedWeek={selectedWeek}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectWeek={selectWeek}
        handleDateFrom={handleDateFrom}
        handleDateTo={handleDateTo}
        reset={resetDateFilter}
        idPrefix="wc4"
        before={
          <Select value={workcell} onValueChange={setWorkcell}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {workcellNames.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {/* ── MAIN LAYOUT — page scrolls naturally ── */}
      <div className="p-5 flex gap-5">

        {/* LEFT COLUMN */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">
          {/* Workcell OLE hero + Output/Input strip (merged) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                {logo && (
                  <div className="w-20 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={logo} alt={workcell} className="w-full h-full object-contain p-1" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Workcell OLE · {weekLabel}</p>
                  <p className="text-[10px] font-semibold text-foreground truncate mt-0.5">{workcell}</p>
                </div>
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', STATUS_BADGE[getOleStatus(siteOle)])}>
                  {STATUS_LABEL[getOleStatus(siteOle)]}
                </span>
              </div>
              <p className="text-5xl font-mono font-black mt-3 leading-none" style={{ color: siteColor }}>
                {siteOle.toFixed(1)}%
              </p>
              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(siteOle, 100)}%`, background: siteColor }} />
              </div>
            </div>

            <button
              onClick={() => setTrendModalOpen(true)}
              className="block w-full text-left border-t border-border hover:bg-muted/20 transition-colors group"
            >
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Output SMH</p>
                  <p className="text-xl font-mono font-bold text-primary mt-0.5 group-hover:text-primary/80 transition-colors">{kpiSmh.toFixed(1)}</p>
                  <p className="text-[9px] text-muted-foreground"><span className="text-primary/60">view trend ↗</span></p>
                </div>
                <div className="p-3">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Input Hours</p>
                  <p className="text-xl font-mono font-bold text-violet-400 mt-0.5 group-hover:text-violet-400/80 transition-colors">{kpiHrs.toFixed(1)}</p>
                  <p className="text-[9px] text-muted-foreground"><span className="text-violet-400/60">view trend ↗</span></p>
                </div>
              </div>
            </button>
          </div>

          {/* Headcount breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Headcount</p>
              <span className="text-base font-mono font-bold text-foreground">
                {(vaTotal + nvaTotal).toLocaleString()}
              </span>
            </div>
            {[
              { label: 'VA',  count: vaTotal,  color: 'text-emerald-400', bar: '#22c55e' },
              { label: 'NVA', count: nvaTotal, color: 'text-amber-400',   bar: '#f59e0b' },
            ].map((r, i, arr) => {
              const total = vaTotal + nvaTotal;
              const pct = total > 0 ? (r.count / total) * 100 : 0;
              return (
                <div key={r.label}
                  className={cn('flex items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-b border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{r.label}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.bar }} />
                    </div>
                  </div>
                  <span className={cn('text-xl font-mono font-bold flex-shrink-0', r.color)}>
                    {r.count > 0 ? r.count.toLocaleString() : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Man-hours distribution — click to open pie modal */}
          <button
            type="button"
            onClick={() => setMhModalOpen(true)}
            className="rounded-xl border border-border bg-card overflow-hidden w-full text-left hover:border-primary/40 hover:bg-muted/20 transition-colors"
          >
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Man-Hrs Distribution</p>
              <span className="text-[9px] text-muted-foreground">view pie ↗</span>
            </div>
            {[
              { label: 'NVA Input',     value: mhTotals.nva,      bar: '#ef4444', color: 'text-red-400' },
              { label: 'Lunch',         value: mhTotals.lunch,    bar: '#94a3b8', color: 'text-slate-400' },
              { label: 'MFG DT',        value: mhTotals.mfg_dt,   bar: '#6366f1', color: 'text-indigo-400' },
              { label: 'Downtime',      value: mhTotals.downtime, bar: '#a855f7', color: 'text-purple-400' },
              { label: 'MFG Hour Lost', value: mhTotals.mfg_lost, bar: '#f59e0b', color: 'text-amber-400' },
            ].map((r, i, arr) => {
              const pct = mhTotals.paid > 0 ? (r.value / mhTotals.paid) * 100 : 0;
              return (
                <div key={r.label}
                  className={cn('flex items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-b border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{r.label}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: r.bar }} />
                    </div>
                  </div>
                  <span className={cn('text-base font-mono font-bold flex-shrink-0', r.color)}>
                    {r.value > 0 ? r.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                  </span>
                </div>
              );
            })}
          </button>
        </div>

        {/* RIGHT COLUMN */}
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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> &ge;{OLE_TARGET}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 45&ndash;{OLE_TARGET - 1}%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt;45%</span>
              </div>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={wcWeekly} margin={{ top: 24, right: 4, left: -24, bottom: 0 }}
                  onClick={(d) => {
                    if (!d?.activePayload) return;
                    const iw = d.activePayload[0]?.payload?.isoWeek;
                    const found = weeks.find(w => w.isoWeek === iw);
                    if (found) selectWeek(found);
                  }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']} cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
                  <ReferenceLine y={OLE_TARGET} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1.5} />
                  {selectedWeek !== null && (
                    <ReferenceLine
                      x={formatWeekLabel(selectedWeek)}
                      stroke="hsl(var(--foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      strokeOpacity={0.4}
                    />
                  )}
                  <Bar dataKey="ole" radius={[3, 3, 0, 0]} maxBarSize={24} cursor="pointer"
                    label={(props: any) => {
                      const { x, y, width, value } = props;
                      const d = wcWeekly[props.index];
                      const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= OLE_WARNING ? '#f59e0b' : '#ef4444';
                      return (
                        <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={15} fontFamily="monospace" fontWeight="bold" fill={baseColor} opacity={1} fillOpacity={1}>
                          {Number(value).toFixed(1)}%
                        </text>
                      );
                    }}
                  >
                    {wcWeekly.map((d, i) => {
                      const isSelected = d.isoWeek === selectedWeek;
                      const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= OLE_WARNING ? '#f59e0b' : '#ef4444';
                      return <Cell key={i} fill={baseColor} opacity={isSelected ? 1 : 0.4} />;
                    })}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data table — natural height, page scrolls */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                {tableTab === 'labor' ? 'Labor Input' : 'Production Output'} · {workcell} · {weekLabel}
              </p>
              <div className="flex gap-1">
                {(['labor', 'production'] as const).map(t => (
                  <button key={t} onClick={() => setTableTab(t)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-medium border transition-all',
                      tableTab === t ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground'
                    )}>
                    {t === 'labor' ? 'Labor Input' : 'Production Output'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {tableTab === 'labor' && (
                <>
                  <div className={`grid bg-muted/40 ${TH} text-muted-foreground uppercase tracking-wider font-semibold border-b border-border`}
                    style={{ gridTemplateColumns: LABOR_GT }}>
                    {['', 'Day', 'Date', 'Shift', 'OLE %', 'SMH Cov.', 'Output SMH', 'Input Hrs', 'Headcount', 'Qty', 'Assemblies'].map(h => (
                      <div key={h} className="px-3 py-2">{h}</div>
                    ))}
                  </div>
                  {laborRows.length === 0
                    ? <div className="py-8 text-center text-[10px] text-muted-foreground">No labor data</div>
                    : laborRows.map((row) => {
                      const rowKey = `${row.workcell}|${row.date}|${row.shift}`;
                      const status = getOleStatus(row.ole_pct);
                      return (
                        <div
                          key={rowKey}
                          className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          style={{ gridTemplateColumns: LABOR_GT, height: ROW_H }}
                          onClick={() => setDrawerShift({
                            workcell: row.workcell,
                            date: row.date,
                            shift: row.shift,
                            ole_pct: row.ole_pct,
                            smh_coverage_pct: row.smh_coverage_pct,
                            effective_output_smh: row.effective_output_smh,
                            total_input_hours: row.total_input_hours,
                            total_qty: row.total_qty,
                            assembly_count: row.assembly_count,
                          })}
                        >
                          <div className="px-3 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
                          </div>
                          <div className={`px-3 ${TD} font-mono text-muted-foreground`}>{dayName(row.date)}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{fmtDate(row.date)}</div>
                          <div className={`px-3 ${TD} font-mono font-semibold text-foreground`}>{shiftLabel(row.shift)}</div>
                          <div className="px-3">
                            <span className={cn('text-sm font-mono font-bold', OLE_COLOR[status])}>
                              {row.ole_pct !== null ? `${row.ole_pct}%` : '—'}
                            </span>
                          </div>
                          <div className="px-3">
                            <span className={cn(`${TD} font-mono font-semibold`,
                              (row.smh_coverage_pct ?? 0) >= 90 ? 'text-emerald-400' :
                                (row.smh_coverage_pct ?? 0) >= 70 ? 'text-amber-400' : 'text-red-400'
                            )}>{row.smh_coverage_pct !== null ? `${row.smh_coverage_pct}%` : '—'}</span>
                          </div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{row.effective_output_smh.toFixed(2)}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{row.total_input_hours.toFixed(2)}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{((row.va_count || 0) + (row.nva_count || 0)).toLocaleString()}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{row.total_qty.toLocaleString()}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{row.assembly_count}</div>
                        </div>
                      );
                    })
                  }
                </>
              )}

              {tableTab === 'production' && (
                <>
                  <div className={`grid bg-muted/40 ${TH} text-muted-foreground uppercase tracking-wider font-semibold border-b border-border`}
                    style={{ gridTemplateColumns: PROD_GT }}>
                    {['#', 'Day', 'Date', 'Shift', 'Stage', 'Assembly', 'Qty', 'SMH/unit', 'Output SMH'].map(h => (
                      <div key={h} className="px-3 py-2">{h}</div>
                    ))}
                  </div>
                  {prodRows.length === 0
                    ? <div className="py-8 text-center text-[10px] text-muted-foreground">No production data</div>
                    : prodRows.map((row, idx) => {
                      const smhUnit = smhMap.get(`${row.workcell}|${row.assembly}`) ?? null;
                      const outputSmh = smhUnit !== null ? row.qty * smhUnit : null;
                      return (
                        <div key={idx} className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          style={{ gridTemplateColumns: PROD_GT, height: ROW_H }}>
                          <div className={`px-3 ${TD} text-muted-foreground font-mono`}>{idx + 1}</div>
                          <div className={`px-3 ${TD} font-mono text-muted-foreground`}>{dayName(row.date)}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>{fmtDate(row.date)}</div>
                          <div className={`px-3 font-mono ${TD} font-semibold text-foreground`}>{shiftLabel(row.shift)}</div>
                          <div className={`px-3 ${TD} text-muted-foreground`}>{row.sub_workcell}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground truncate`} title={row.assembly}>{row.assembly}</div>
                          <div className={`px-3 font-mono ${TD} font-semibold text-foreground`}>{row.qty.toLocaleString()}</div>
                          <div className={`px-3 font-mono ${TD} text-foreground`}>
                            {smhUnit !== null ? smhUnit.toFixed(4) : <span className="text-muted-foreground/50">—</span>}
                          </div>
                          <div className={`px-3 font-mono ${TD} font-semibold text-foreground`}>
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
