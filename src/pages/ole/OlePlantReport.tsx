import { MhPieModal } from '@/components/ole/MhPieModal';
import { OleFilterBar } from '@/components/ole/OleFilterBar';
import { TrendModal } from '@/components/ole/TrendModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIndirectLabor, useMhDistribution, useOleWeekly, useOleWorkcells } from '@/hooks/ole/useOleData';
import { useOleDateFilter } from '@/hooks/ole/useOleDateFilter';
import type { OleWeeklyResult } from '@/lib/ole/oleApi';
import {
  aggregateByWeek,
  aggregateByWorkcell,
  calculateOLE,
} from '@/lib/ole/oleCalculations';
import { TT } from '@/lib/ole/oleChartStyles';
import {
  OLE_COLOR,
  OLE_TARGET,
  OLE_WARNING,
  STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS,
  formatWeekLabel,
  getOleStatus, oleColor,
} from '@/lib/ole/oleConstants';
import type { WeekRow } from '@/lib/ole/oleTypes';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWeekScroll } from '@/hooks/shared/useWeekScroll';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OlePlantReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const weekBarRef = useRef<HTMLDivElement>(null);
  const initialPlant = (searchParams.get('plant') ?? 'all') as 'all' | 'Plant 1' | 'Plant 2';
  const [plant, setPlant] = useState<'all' | 'Plant 1' | 'Plant 2'>(initialPlant);

  // ── Live data ───────────────────────────────────────────────────────────────
  const weeklyHook = useOleWeekly();
  const workcellsHook = useOleWorkcells();
  const indirectHook = useIndirectLabor();
  const mhHook = useMhDistribution();

  const rawWeekly = weeklyHook.data ?? [];
  const workcellConfigs = workcellsHook.data ?? [];
  const isLoading = weeklyHook.loading && rawWeekly.length === 0;

  // ── Derive week list from live data ─────────────────────────────────────────
  const weeks = useMemo((): WeekRow[] => {
    const seen = new Set<string>();
    const list: WeekRow[] = [];
    rawWeekly.forEach(r => {
      if (!seen.has(r.week_label)) {
        seen.add(r.week_label);
        list.push({
          isoWeek: r.iso_week,
          label: formatWeekLabel(r.iso_week),
          start: r.week_start_date,
          end: r.week_end_date,
        });
      }
    });
    return list.sort((a, b) => a.isoWeek - b.isoWeek);
  }, [rawWeekly]);

  // ── Filter state ────────────────────────────────────────────────────────────
  const initWeek = searchParams.get('week') ? Number(searchParams.get('week')) : null;
  const {
    selectedWeek, setSelectedWeek,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    selectWeek,
    handleDateFrom, handleDateTo,
    reset: resetDateFilter,
  } = useOleDateFilter({ initialWeek: initWeek });

  const seedDoneRef = useRef(false);

  // Once weeks load, seed dateFrom/dateTo from the URL week param -- only once
  useEffect(() => {
    if (seedDoneRef.current || !initWeek || !weeks.length) return;
    const found = weeks.find(w => w.isoWeek === initWeek);
    if (found) {
      setDateFrom(found.start);
      setDateTo(found.end);
      seedDoneRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  // ── Filter by date/week ONLY (no plant filter) ──────────────────────────────
  const weekFilteredWeekly = useMemo(() => {
    return rawWeekly.filter(r => {
      const inDate = (!dateFrom && !dateTo) ||
        ((!dateFrom || r.week_start_date <= dateTo) && (!dateTo || r.week_end_date >= dateFrom));
      if (selectedWeek !== null) return r.iso_week === selectedWeek;
      return inDate;
    });
  }, [rawWeekly, dateFrom, dateTo, selectedWeek]);

  // ── Filter by plant (site level filter) ─────────────────────────────────────
  const filteredWeekly = useMemo(() => {
    return weekFilteredWeekly.filter(r => {
      const wcPlant = workcellConfigs.find(w => w.workcell === r.workcell)?.plant;
      return plant === 'all' || wcPlant === plant;
    });
  }, [weekFilteredWeekly, plant, workcellConfigs]);

  // ── Per-workcell aggregates ──────────────────────────────────────────────────
  const workcellsSorted = useMemo(() => {
    return aggregateByWorkcell(filteredWeekly)
      .map(r => ({
        ...r,
        ole_pct: calculateOLE(r.total_output_smh, r.total_input_hours),
      }))
      .sort((a, b) => a.ole_pct - b.ole_pct);
  }, [filteredWeekly]);

  // ── Site aggregate ───────────────────────────────────────────────────────────
  const site = useMemo(() => {
    const totalOut = workcellsSorted.reduce((s, r) => s + r.total_output_smh, 0);
    const totalIn = workcellsSorted.reduce((s, r) => s + r.total_input_hours, 0);
    return {
      ole_pct: calculateOLE(totalOut, totalIn),
      total_output_smh: totalOut,
      total_input_hours: totalIn,
      total_qty: workcellsSorted.reduce((s, r) => s + r.total_qty, 0),
      total_shifts: workcellsSorted.reduce((s, r) => s + r.total_shifts, 0),
      flagged_shifts: workcellsSorted.reduce((s, r) => s + r.flagged_shifts, 0),
    };
  }, [workcellsSorted]);

  // ── Plant aggregates (ALWAYS show both plants, ignore plant filter) ─────────
  const plantAgg = useMemo(() => {
    const p1rows = weekFilteredWeekly.filter(r => workcellConfigs.find(w => w.workcell === r.workcell)?.plant === 'Plant 1');
    const p2rows = weekFilteredWeekly.filter(r => workcellConfigs.find(w => w.workcell === r.workcell)?.plant === 'Plant 2');
    const agg = (rows: OleWeeklyResult[]) => {
      const out = rows.reduce((s, r) => s + r.total_output_smh, 0);
      const inp = rows.reduce((s, r) => s + r.total_input_hours, 0);
      return { ole_pct: calculateOLE(out, inp) };
    };
    return { p1: agg(p1rows), p2: agg(p2rows) };
  }, [weekFilteredWeekly, workcellConfigs]);

  // ── Man-hours distribution — per shift, summed under plant + date filter ────
  // mfg_lost is RE-DERIVED from the aggregated buckets (the per-shift formula
  // is non-linear, so summing per-shift mfg_lost would be wrong).
  const mhTotals = useMemo(() => {
    const rows = mhHook.data ?? [];
    const wcPlantMap = new Map(workcellConfigs.map(w => [w.workcell, w.plant]));
    const acc = { nva: 0, lunch: 0, mfg_dt: 0, downtime: 0, paid: 0, output: 0 };
    for (const r of rows) {
      const wcPlant = wcPlantMap.get(r.workcell);
      if (!wcPlant) continue;
      if (plant !== 'all' && wcPlant !== plant) continue;
      if (dateFrom && r.date < dateFrom) continue;
      if (dateTo && r.date > dateTo) continue;
      acc.nva += r.nva_hours || 0;
      acc.lunch += r.lunch_hours || 0;
      acc.mfg_dt += r.mfg_dt_hours || 0;
      acc.downtime += r.downtime_hours || 0;
      acc.paid += r.total_paid_hours || 0;
      acc.output += r.effective_output_smh || 0;
    }
    // MFG Hour Lost = paid − named (signed). Keeps row %s additive so the
    // mfg_lost row's % equals 100% − Σ(other row %).
    const named = acc.output + acc.nva + acc.lunch + acc.mfg_dt + acc.downtime;
    const mfg_lost = acc.paid - named;
    return { ...acc, named, mfg_lost };
  }, [mhHook.data, workcellConfigs, plant, dateFrom, dateTo]);

  const [mhModalOpen, setMhModalOpen] = useState(false);

  // ── Headcount (VA/NVA) aggregate — summed from pre-computed weekly mart ─────
  const { vaTotal, nvaTotal } = useMemo(() => {
    let va = 0;
    let nva = 0;
    for (const r of filteredWeekly) {
      va += r.total_va_count || 0;
      nva += r.total_nva_count || 0;
    }
    return { vaTotal: va, nvaTotal: nva };
  }, [filteredWeekly]);

  // ── Indirect labor aggregate (filtered by date + plant) ─────────────────────
  const indirectByEntity = useMemo(() => {
    const rows = indirectHook.data ?? [];
    const inRange = (d: string) =>
      (!dateFrom && !dateTo) || ((!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo));
    const inPlant = (p: string) => plant === 'all' || p === plant;
    const totals = new Map<string, { entity: string; label: string; plant: string; hours: number }>();
    for (const r of rows) {
      if (!inRange(r.date) || !inPlant(r.plant)) continue;
      const cur = totals.get(r.entity) ?? { entity: r.entity, label: r.label || r.entity, plant: r.plant, hours: 0 };
      cur.hours += r.total_input_hours || 0;
      totals.set(r.entity, cur);
    }
    return Array.from(totals.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [indirectHook.data, dateFrom, dateTo, plant]);

  const [trendModalOpen, setTrendModalOpen] = useState(false);

  // ── Weekly trend (plant-filtered raw weekly rows) ────────────────────────────
  const plantFilteredWeekly = useMemo(() =>
    rawWeekly.filter(r =>
      plant === 'all' || workcellConfigs.find(w => w.workcell === r.workcell)?.plant === plant
    ),
    [rawWeekly, plant, workcellConfigs]);

  // ── Weekly trend data with smh + hrs for modal ──────────────────────────────
  const siteWeeklyFull = useMemo(
    () => aggregateByWeek(plantFilteredWeekly),
    [plantFilteredWeekly]
  );

  // ── Weekly trend chart (drops smh/hrs from points; keeps shape stable) ──────
  const siteWeekly = useMemo(
    () => siteWeeklyFull.map(({ w, isoWeek, ole }) => ({ w, isoWeek, ole })),
    [siteWeeklyFull]
  );

  // ── Attention: bottom workcells below target ──────────────────────────────────
  const attention = useMemo(() =>
    workcellsSorted.slice(0, 3).filter(r => r.ole_pct < OLE_TARGET).map(r => ({
      workcell: r.workcell,
      ole_pct: r.ole_pct,
      severity: r.ole_pct < OLE_WARNING ? 'high' as const : 'medium' as const,
      message: r.ole_pct < OLE_WARNING ? 'OLE critically below target' : 'OLE below target',
      value: `${r.ole_pct.toFixed(1)}%`,
      flagged: r.flagged_shifts,
    }))
    , [workcellsSorted]);

  const hasFilters = selectedWeek !== null || plant !== 'all' || !!dateFrom || !!dateTo;

  const siteOle = site.ole_pct;
  const siteStatus = getOleStatus(siteOle);
  const siteColor = oleColor(siteOle);
  const { ref: weekScrollRef, chartWidth: weekChartWidth } = useWeekScroll(siteWeekly.length);

  const oles = siteWeekly.map(d => d.ole).filter(Boolean);
  const yMin = 0;
  const yMax = oles.length ? Math.max(OLE_TARGET + 5, Math.ceil(Math.max(...oles) / 10) * 10 + 10) : 100;
  const weekLabel = useMemo(() => {
    if (selectedWeek !== null) return formatWeekLabel(selectedWeek);
    if (dateFrom && dateTo) {
      return `${format(parseISO(dateFrom), 'd MMMM yyyy')} - ${format(parseISO(dateTo), 'd MMMM yyyy')}`;
    }
    if (dateFrom) return `From ${format(parseISO(dateFrom), 'd MMMM yyyy')}`;
    if (dateTo) return `Until ${format(parseISO(dateTo), 'd MMMM yyyy')}`;
    return 'All Weeks';
  }, [selectedWeek, dateFrom, dateTo]);

  return (
    <div className="relative">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center">
          <span className="text-sm font-bold text-foreground">OLE Report - Plant Level</span>
        </div>
      </div>

      <OleFilterBar
        weeks={weeks}
        selectedWeek={selectedWeek}
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectWeek={selectWeek}
        handleDateFrom={handleDateFrom}
        handleDateTo={handleDateTo}
        reset={resetDateFilter}
        idPrefix="home4"
        before={
          <Select value={plant} onValueChange={(v) => setPlant(v as 'all' | 'Plant 1' | 'Plant 2')}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="Plant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plants</SelectItem>
              <SelectItem value="Plant 1">Plant 1</SelectItem>
              <SelectItem value="Plant 2">Plant 2</SelectItem>
            </SelectContent>
          </Select>
        }
        showClear={hasFilters}
        onClear={() => setPlant('all')}
      />

      <div className="p-5 flex gap-5">

        {/* ── Trend Modal ── */}
        <TrendModal
          open={trendModalOpen}
          onClose={() => setTrendModalOpen(false)}
          title="Output SMH & Input Hours — Weekly Trend"
          data={siteWeeklyFull}
          selectedWeek={selectedWeek}
          yScale="thousands"
          referenceLineOpacity={0.35}
        />

        <MhPieModal
          open={mhModalOpen}
          onClose={() => setMhModalOpen(false)}
          title={`${plant === 'all' ? 'All Plants' : plant} — Man-Hours Distribution`}
          total={mhTotals.paid}
          slices={[
            { name: 'Output SMH', value: mhTotals.output, color: '#22c55e' },
            { name: 'NVA Input', value: mhTotals.nva, color: '#ef4444' },
            { name: 'Lunch', value: mhTotals.lunch, color: '#94a3b8' },
            { name: 'MFG DT', value: mhTotals.mfg_dt, color: '#6366f1' },
            { name: 'Downtime', value: mhTotals.downtime, color: '#a855f7' },
            { name: 'MFG Hour Lost', value: mhTotals.mfg_lost, color: '#f59e0b' },
          ]}
        />

        {/* ── LEFT COLUMN ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-4">

          {isLoading ? (
            <>
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 180 }} />
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 130 }} />
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 120 }} />
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 240 }} />
            </>
          ) : (
            <>
              {/* Site OLE hero + Output/Input strip (merged) */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                        {plant} · {weekLabel}
                      </p>
                      <p className="text-5xl font-mono font-black mt-1 leading-none" style={{ color: siteColor }}>
                        {siteOle.toFixed(1)}%
                      </p>
                    </div>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', STATUS_BADGE[siteStatus])}>
                      {STATUS_LABEL[siteStatus]}
                    </span>
                  </div>
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
                      <p className="text-xl font-mono font-bold text-primary mt-0.5 group-hover:text-primary/80 transition-colors">
                        {(site.total_output_smh / 1000).toFixed(1)}k
                      </p>
                      <p className="text-[9px] text-muted-foreground"> <span className="text-primary/60">view trend ↗</span></p>
                    </div>
                    <div className="p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Input Hours</p>
                      <p className="text-xl font-mono font-bold text-violet-400 mt-0.5 group-hover:text-violet-400/80 transition-colors">
                        {(site.total_input_hours / 1000).toFixed(1)}k
                      </p>
                      <p className="text-[9px] text-muted-foreground"> <span className="text-violet-400/60">view trend ↗</span></p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Plant comparison */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border">
                  <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Plant Comparison</p>
                </div>
                {(plant === 'Plant 1'
                  ? [{ label: 'Plant 2', data: plantAgg.p2 }]
                  : plant === 'Plant 2'
                    ? [{ label: 'Plant 1', data: plantAgg.p1 }]
                    : [
                      { label: 'Plant 1', data: plantAgg.p1 },
                      { label: 'Plant 2', data: plantAgg.p2 },
                    ]
                ).map(({ label, data }, i, arr) => {
                  const clr = oleColor(data.ole_pct);
                  return (
                    <div key={label}
                      className={cn('flex items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-b border-border')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                        <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(data.ole_pct, 100)}%`, background: clr }} />
                        </div>
                      </div>
                      <span className="text-xl font-mono font-bold flex-shrink-0" style={{ color: clr }}>
                        {data.ole_pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
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
                  { label: 'VA', count: vaTotal, color: 'text-emerald-400', bar: '#22c55e' },
                  { label: 'NVA', count: nvaTotal, color: 'text-amber-400', bar: '#f59e0b' },
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
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2 border-b border-border bg-muted/20">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Man Hrs</p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right w-12">%</p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right w-16">Hrs</p>
                </div>
                {[
                  { label: 'Output (OLE)', value: mhTotals.output, color: 'text-emerald-400' },
                  { label: 'NVA Input', value: mhTotals.nva, color: 'text-red-400' },
                  { label: 'Lunch', value: mhTotals.lunch, color: 'text-slate-400' },
                  { label: 'MFG DT', value: mhTotals.mfg_dt, color: 'text-indigo-400' },
                  { label: 'Downtime', value: mhTotals.downtime, color: 'text-purple-400' },
                  { label: 'MFG Hour Lost', value: mhTotals.mfg_lost, color: 'text-amber-400' },
                ].map((r, i, arr) => {
                  const pct = mhTotals.paid > 0 ? (r.value / mhTotals.paid) * 100 : 0;
                  const showPct = mhTotals.paid > 0 && Math.abs(r.value) > 0.01;
                  return (
                    <div
                      key={r.label}
                      className={cn('grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}
                    >
                      <p className="text-xs font-semibold text-foreground truncate">{r.label}</p>
                      <span className={cn('text-sm font-mono font-bold tabular-nums text-right w-12', r.color)}>
                        {showPct ? `${pct.toFixed(1)}%` : '—'}
                      </span>
                      <span className={cn('text-sm font-mono font-bold tabular-nums text-right w-16', r.color)}>
                        {Math.abs(r.value) > 0.01 ? r.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      </span>
                    </div>
                  );
                })}
                {/* Overall Total summary row */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-4 py-2.5 border-t border-border bg-muted/20">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider">Overall Total</p>
                  <span className="text-sm font-mono font-bold tabular-nums text-right w-12 text-foreground">100.0%</span>
                  <span className="text-sm font-mono font-bold tabular-nums text-right w-16 text-foreground">{mhTotals.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </button>

              {/* Indirect labor — input hours only */}
              {indirectByEntity.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border">
                    <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Indirect Labor — Input Hours</p>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2 border-b border-border bg-muted/20">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Entities</p>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right w-16">Hrs</p>
                  </div>
                  {indirectByEntity.map((r, i) => {
                    const m = r.label.match(/^P([12])$/);
                    const display = m ? `Warehouse Plant ${m[1]}`
                      : r.label === 'Support' ? `Support ${r.plant}`
                        : r.label;
                    return (
                      <div
                        key={r.entity}
                        className={cn('grid grid-cols-[1fr_auto] gap-x-3 items-center px-4 py-2.5', i < indirectByEntity.length - 1 && 'border-b border-border')}
                      >
                        <p className="text-xs font-semibold text-foreground truncate">{display}</p>
                        <span className="text-sm font-mono font-bold text-violet-400 tabular-nums text-right w-16">
                          {r.hours > 0 ? r.hours.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hours distribution */}
              {/* <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">Hours Distribution</p>
            <div className="space-y-2">
              {[
                { name: 'Output SMH', value: site.total_output_smh, color: '#22c55e' },
                { name: 'Unaccounted', value: Math.max(0, site.total_input_hours - site.total_output_smh), color: '#94a3b8' },
              ].map(s => (
                <div key={s.name} className="w-full flex items-center gap-2 px-1 py-0.5">
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-[9px] text-muted-foreground flex-1 text-left truncate">{s.name}</span>
                  <span className="text-[9px] font-mono font-bold text-foreground">
                    {site.total_input_hours > 0 ? ((s.value / site.total_input_hours) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              ))}
            </div>
          </div> */}

              {/* Attention items */}
              {/* {attention.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Attention</p>
              </div>
              {attention.map((item, i) => (
                <button key={i}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (selectedWeek !== null) params.set('week', String(selectedWeek));
                    if (dateFrom) params.set('from', dateFrom);
                    if (dateTo)   params.set('to',   dateTo);
                    if (plant !== 'all') params.set('plant', plant);
                    const qs = params.toString();
                    navigate(`/wc4/${encodeURIComponent(item.workcell)}${qs ? `?${qs}` : ''}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors border-b border-border last:border-b-0 group">
                  <AlertTriangle className={cn('h-3.5 w-3.5 flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : 'text-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-foreground truncate">{item.workcell}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{item.message}</p>
                  </div>
                  <span className={cn('text-[10px] font-mono font-bold flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : 'text-amber-400')}>{item.value}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          )} */}
            </>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {isLoading ? (
            <>
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 220 }} />
              <div className="rounded-xl border border-border bg-muted/40 animate-pulse" style={{ height: 400 }} />
            </>
          ) : (
            <>
              {/* Weekly trend chart */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Weekly OLE Trend — FY26</p>
                    <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-2.5 w-2.5" />
                      Click a bar to filter by week · highlighted = active
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> ≥{OLE_TARGET}%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 45–{OLE_TARGET - 1}%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt;45%</span>
                  </div>
                </div>
                <div ref={weekScrollRef} className="overflow-x-auto" style={{ height: 180 }}>
                  <ResponsiveContainer width={weekChartWidth} height="100%">
                    <ComposedChart
                      data={siteWeekly}
                      margin={{ top: 24, right: 4, left: -24, bottom: 0 }}
                      onClick={(d) => {
                        if (!d?.activePayload) return;
                        const iw = d.activePayload[0]?.payload?.isoWeek;
                        const found = weeks.find(w => w.isoWeek === iw);
                        if (found) selectWeek(found);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="w" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <Tooltip {...TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']}
                        cursor={{ fill: 'hsl(var(--primary) / 0.06)' }}
                      />
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
                          const d = siteWeekly[props.index];
                          const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= OLE_WARNING ? '#f59e0b' : '#ef4444';
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 4}
                              textAnchor="middle"
                              fontSize={15}
                              fontFamily="monospace"
                              fontWeight="bold"
                              fill={baseColor}
                              opacity={1}
                              fillOpacity={1}
                            >
                              {Number(value).toFixed(1)}%
                            </text>
                          );
                        }}
                      >
                        {siteWeekly.map((d, i) => {
                          const isSelected = d.isoWeek === selectedWeek;
                          const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= OLE_WARNING ? '#f59e0b' : '#ef4444';
                          return (
                            <Cell
                              key={i}
                              fill={baseColor}
                              opacity={isSelected ? 1 : 0.45}
                              stroke={isSelected ? baseColor : 'none'}
                              strokeWidth={isSelected ? 2 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Workcell table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                    Workcell Performance · {workcellsSorted.length} workcells · {weekLabel}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Sorted lowest OLE first · click name for detail</p>
                </div>
                <div className="overflow-x-auto">
                  <div className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                    style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 5rem 7rem 6rem 5rem 4.5rem 5rem' }}>
                    {['#', 'Workcell', 'Plant', 'OLE %', 'Output SMH', 'Input Hrs', 'Status'].map(h => (
                      <div key={h} className="px-2 py-2">{h}</div>
                    ))}
                  </div>
                  {workcellsSorted.map((wc, idx) => {
                    const st = getOleStatus(wc.ole_pct);
                    const clr = oleColor(wc.ole_pct);
                    const wcConf = workcellConfigs.find(w => w.workcell === wc.workcell);
                    const k = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                    const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
                    const logo = lk ? WORKCELL_LOGOS[lk] : null;
                    return (
                      <div key={wc.workcell}
                        className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 5rem 7rem 6rem 5rem 4.5rem 5rem', height: 44 }}
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (selectedWeek !== null) params.set('week', String(selectedWeek));
                          if (dateFrom) params.set('from', dateFrom);
                          if (dateTo) params.set('to', dateTo);
                          if (plant !== 'all') params.set('plant', plant);
                          const qs = params.toString();
                          navigate(`/ole/report/wc/${encodeURIComponent(wc.workcell)}${qs ? `?${qs}` : ''}`);
                        }}>
                        <div className="px-2 text-[9px] text-muted-foreground font-mono">{idx + 1}</div>
                        <div className="px-2 flex items-center gap-2">
                          {logo && (
                            <div className="w-16 h-6 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-border bg-white">
                              <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-0.5" />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              const params = new URLSearchParams();
                              if (selectedWeek !== null) params.set('week', String(selectedWeek));
                              if (dateFrom) params.set('from', dateFrom);
                              if (dateTo) params.set('to', dateTo);
                              if (plant !== 'all') params.set('plant', plant);
                              const qs = params.toString();
                              navigate(`/ole/report/wc/${encodeURIComponent(wc.workcell)}${qs ? `?${qs}` : ''}`);
                            }}
                            className="text-[10px] font-semibold text-foreground hover:text-primary transition-colors truncate text-left">
                            {wc.workcell}
                          </button>
                          {wc.flagged_shifts > 0 && <AlertTriangle className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />}
                        </div>
                        <div className="px-2 text-[9px] text-muted-foreground">{wcConf?.plant}</div>
                        <div className="px-2">
                          <span className={cn('text-sm font-mono font-bold block', OLE_COLOR[st])}>
                            {wc.ole_pct.toFixed(1)}%
                          </span>
                          <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden mt-0.5" style={{ width: 56 }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(wc.ole_pct, 100)}%`, background: clr }} />
                          </div>
                        </div>
                        <div className="px-2 text-[10px] font-mono text-foreground text-right">
                          {Math.round(wc.total_output_smh).toLocaleString()}
                        </div>
                        <div className="px-2 text-[10px] font-mono text-foreground text-right">
                          {Math.round(wc.total_input_hours).toLocaleString()}
                        </div>
                        {/* <div className="px-2 text-[10px] font-mono text-foreground text-right">{wc.total_shifts}</div> */}
                        <div className="px-2">
                          <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', STATUS_BADGE[st])}>
                            {STATUS_LABEL[st]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {workcellsSorted.length === 0 && (
                    <div className="px-4 py-8 text-center text-[10px] text-muted-foreground">
                      No data for selected period
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
