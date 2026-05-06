import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOleWeekly, useOleWorkcells } from '@/hooks/useOleData';
import type { OleWeeklyResult } from '@/lib/oleApi';
import {
  OLE_COLOR,
  OLE_TARGET,
  STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS,
  getOleStatus, oleColor
} from '@/lib/oleConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Info,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';
import { DatePickerField } from './OLEFilters';

const TT = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 13,
    color: 'hsl(var(--foreground))',
    padding: '8px 12px',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: 12, marginBottom: 2 },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: 14 },
};

const TT_AREA = {
  contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 },
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  itemStyle: { color: 'hsl(var(--muted-foreground))' },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

// ─── Trend Modal ─────────────────────────────────────────────────────────────
function TrendModal({ open, onClose, data, selectedWeek }: {
  open: boolean;
  onClose: () => void;
  data: { w: string; isoWeek: number; ole: number; smh: number; hrs: number }[];
  selectedWeek: number | null;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        style={{ transition: 'opacity 0.25s ease', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col"
        style={{
          width: '72vw', height: '68vh', top: '50%', left: '50%',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          opacity: open ? 1 : 0,
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -52%) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">Output SMH &amp; Input Hours — Weekly Trend</span>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-5 grid grid-cols-2 gap-4">
          {/* Output SMH */}
          <div className="flex flex-col bg-muted/20 rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Output SMH <span className="text-primary">(Σ Qty × SMH/unit)</span></p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="smhGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" type="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip {...TT_AREA} formatter={(v: number) => [`${(v / 1000).toFixed(1)}k hrs`, 'Output SMH']} />
                  {selectedWeek !== null && <ReferenceLine x={`WW${String(selectedWeek).padStart(2, '0')}`} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 2" strokeOpacity={0.35} />}
                  <Area type="monotone" dataKey="smh" stroke="#22c55e" strokeWidth={2} fill="url(#smhGrad)" dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Input Hours */}
          <div className="flex flex-col bg-muted/20 rounded-xl border border-border p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Input Hours <span className="text-violet-400">(Σ Paid Direct Hrs)</span></p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" type="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip {...TT_AREA} formatter={(v: number) => [`${(v / 1000).toFixed(1)}k hrs`, 'Input Hours']} />
                  {selectedWeek !== null && <ReferenceLine x={`WW${String(selectedWeek).padStart(2, '0')}`} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 2" strokeOpacity={0.35} />}
                  <Area type="monotone" dataKey="hrs" stroke="#a78bfa" strokeWidth={2} fill="url(#hrsGrad)" dot={false} activeDot={{ r: 4, fill: '#a78bfa' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

type WeekRow = { isoWeek: number; label: string; start: string; end: string };

// ─── Aggregate weekly rows into per-workcell summary ─────────────────────────
function aggregateFromWeekly(rows: OleWeeklyResult[]) {
  const map: Record<string, {
    workcell: string;
    total_output_smh: number;
    total_input_hours: number;
    total_qty: number;
    total_shifts: number;
    flagged_shifts: number;
  }> = {};
  rows.forEach(r => {
    if (!map[r.workcell]) {
      map[r.workcell] = {
        workcell: r.workcell,
        total_output_smh: 0,
        total_input_hours: 0,
        total_qty: 0,
        total_shifts: 0,
        flagged_shifts: 0,
      };
    }
    const m = map[r.workcell];
    m.total_output_smh += r.total_output_smh;
    m.total_input_hours += r.total_input_hours;
    m.total_qty += r.total_qty;
    m.total_shifts += r.shift_count;
    m.flagged_shifts += r.shifts_flagged;
  });
  return Object.values(map);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEHome4() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const weekBarRef = useRef<HTMLDivElement>(null);
  const initialPlant = (searchParams.get('plant') ?? 'all') as 'all' | 'Plant 1' | 'Plant 2';
  const [plant, setPlant] = useState<'all' | 'Plant 1' | 'Plant 2'>(initialPlant);

  // ── Live data ───────────────────────────────────────────────────────────────
  const weeklyHook = useOleWeekly();
  const workcellsHook = useOleWorkcells();

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
          label: `WW${String(r.iso_week).padStart(2, '0')}`,
          start: r.week_start_date,
          end: r.week_end_date,
        });
      }
    });
    return list.sort((a, b) => a.isoWeek - b.isoWeek);
  }, [rawWeekly]);

  // ── Filter state ────────────────────────────────────────────────────────────
  const initWeek = searchParams.get('week') ? Number(searchParams.get('week')) : null;
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initWeek);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Once weeks load, seed dateFrom/dateTo from the URL week param
  useEffect(() => {
    if (!initWeek || !weeks.length) return;
    const found = weeks.find(w => w.isoWeek === initWeek);
    if (found && !dateFrom && !dateTo) {
      setDateFrom(found.start);
      setDateTo(found.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  function selectWeek(w: WeekRow) {
    setSelectedWeek(w.isoWeek);
    setDateFrom(w.start);
    setDateTo(w.end);
  }
  function handleDateFrom(val: string) { setDateFrom(val); setSelectedWeek(null); }
  function handleDateTo(val: string) { setDateTo(val); setSelectedWeek(null); }

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
    return aggregateFromWeekly(filteredWeekly)
      .map(r => ({
        ...r,
        ole_pct: r.total_input_hours > 0 ? (r.total_output_smh / r.total_input_hours) * 100 : 0,
      }))
      .sort((a, b) => a.ole_pct - b.ole_pct);
  }, [filteredWeekly]);

  // ── Site aggregate ───────────────────────────────────────────────────────────
  const site = useMemo(() => {
    const totalOut = workcellsSorted.reduce((s, r) => s + r.total_output_smh, 0);
    const totalIn = workcellsSorted.reduce((s, r) => s + r.total_input_hours, 0);
    return {
      ole_pct: totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
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
      return { ole_pct: inp > 0 ? (out / inp) * 100 : 0 };
    };
    return { p1: agg(p1rows), p2: agg(p2rows) };
  }, [weekFilteredWeekly, workcellConfigs]);

  const [trendModalOpen, setTrendModalOpen] = useState(false);

  // ── Weekly trend data with smh + hrs for modal ──────────────────────────────
  const siteWeeklyFull = useMemo(() => {
    const byWeek: Record<string, { smh: number; hrs: number; week: number }> = {};
    rawWeekly
      .filter(r => plant === 'all' || workcellConfigs.find(w => w.workcell === r.workcell)?.plant === plant)
      .forEach(r => {
        if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, week: r.iso_week };
        byWeek[r.week_label].smh += r.total_output_smh;
        byWeek[r.week_label].hrs += r.total_input_hours;
      });
    return Object.values(byWeek)
      .sort((a, b) => a.week - b.week)
      .map(w => ({
        w: `WW${String(w.week).padStart(2, '0')}`,
        isoWeek: w.week,
        ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
        smh: w.smh,
        hrs: w.hrs,
      }));
  }, [rawWeekly, plant, workcellConfigs]);

  // ── Weekly trend chart (all weeks, plant-filtered) ───────────────────────────
  const siteWeekly = useMemo(() => {
    const byWeek: Record<string, { smh: number; hrs: number; week: number }> = {};
    rawWeekly
      .filter(r => plant === 'all' || workcellConfigs.find(w => w.workcell === r.workcell)?.plant === plant)
      .forEach(r => {
        if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, week: r.iso_week };
        byWeek[r.week_label].smh += r.total_output_smh;
        byWeek[r.week_label].hrs += r.total_input_hours;
      });
    return Object.values(byWeek)
      .sort((a, b) => a.week - b.week)
      .map(w => ({
        w: `WW${String(w.week).padStart(2, '0')}`,
        isoWeek: w.week,
        ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
      }));
  }, [rawWeekly, plant, workcellConfigs]);

  // ── Attention: bottom workcells below target ──────────────────────────────────
  const attention = useMemo(() =>
    workcellsSorted.slice(0, 3).filter(r => r.ole_pct < OLE_TARGET).map(r => ({
      workcell: r.workcell,
      ole_pct: r.ole_pct,
      severity: r.ole_pct < 45 ? 'high' as const : 'medium' as const,
      message: r.ole_pct < 45 ? 'OLE critically below target' : 'OLE below target',
      value: `${r.ole_pct.toFixed(1)}%`,
      flagged: r.flagged_shifts,
    }))
    , [workcellsSorted]);

  const hasFilters = selectedWeek !== null || plant !== 'all' || !!dateFrom || !!dateTo;

  const last2 = siteWeekly.slice(-2);
  const trendUp = last2.length === 2 && last2[1].ole > last2[0].ole;
  const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;
  const siteOle = site.ole_pct;
  const siteStatus = getOleStatus(siteOle);
  const siteColor = oleColor(siteOle);
  const oles = siteWeekly.map(d => d.ole).filter(Boolean);
  const yMin = 0;
  const yMax = oles.length ? Math.max(OLE_TARGET + 5, Math.ceil(Math.max(...oles) / 10) * 10 + 10) : 100;
  const weekLabel = selectedWeek !== null
    ? `WW${String(selectedWeek).padStart(2, '0')}`
    : 'All Weeks';

  return (
    <div className="relative">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center">
          <span className="text-sm font-bold text-foreground">OLE Report - Plant Level</span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
          Loading OLE data…
        </div>
      )}

      <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-border">
        <Select value={plant} onValueChange={(v) => setPlant(v as 'all' | 'Plant 1' | 'Plant 2')}>
          <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="Plant" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plants</SelectItem>
            <SelectItem value="Plant 1">Plant 1</SelectItem>
            <SelectItem value="Plant 2">Plant 2</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={selectedWeek !== null ? String(selectedWeek) : 'all'}
          onValueChange={(v) => {
            if (v === 'all') { setSelectedWeek(null); setDateFrom(''); setDateTo(''); return; }
            const found = weeks.find(w => w.isoWeek === Number(v));
            if (found) selectWeek(found);
          }}
        >
          <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="Week" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {weeks.map(w => (
              <SelectItem key={w.isoWeek} value={String(w.isoWeek)}>{w.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePickerField id="home4-from" label="" value={dateFrom} onChange={handleDateFrom} />
        <DatePickerField id="home4-to" label="" value={dateTo} onChange={handleDateTo} />

        {hasFilters && (
          <button
            onClick={() => { setPlant('all'); setSelectedWeek(null); setDateFrom(''); setDateTo(''); }}
            className="h-8 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="p-5 flex gap-5">

        {/* ── Trend Modal ── */}
        <TrendModal open={trendModalOpen} onClose={() => setTrendModalOpen(false)} data={siteWeeklyFull} selectedWeek={selectedWeek} />

        {/* ── LEFT COLUMN ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-4">

          {/* Site OLE hero */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                  {plant} · {weekLabel}
                </p>
                <p className="text-5xl font-mono font-black mt-1 leading-none" style={{ color: siteColor }}>
                  {siteOle.toFixed(1)}%
                </p>
              </div>
            </div>
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
          <button
            onClick={() => setTrendModalOpen(true)}
            className="rounded-xl border border-border bg-card overflow-hidden w-full text-left hover:border-primary/40 hover:bg-muted/20 transition-colors group"
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

          {/* Plant comparison */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Plant Comparison</p>
            </div>
            {[
              { label: 'Plant 1', data: plantAgg.p1 },
              { label: 'Plant 2', data: plantAgg.p2 },
            ].map(({ label, data }, i) => {
              const clr = oleColor(data.ole_pct);
              return (
                <div key={label}
                  className={cn('flex items-center gap-3 px-4 py-3', i === 0 && 'border-b border-border')}>
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

          {/* Hours distribution */}
          <div className="rounded-xl border border-border bg-card p-4">
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
          </div>

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
                    navigate(`/ole/wc4/${encodeURIComponent(item.workcell)}${qs ? `?${qs}` : ''}`);
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
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

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
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
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
                      x={`WW${String(selectedWeek).padStart(2, '0')}`}
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
                      const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= 45 ? '#f59e0b' : '#ef4444';
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
                      const baseColor = d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= 45 ? '#f59e0b' : '#ef4444';
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
                {['#', 'Workcell', 'Plant', 'OLE %', 'Output SMH', 'Input Hrs', 'Shifts', 'Status'].map(h => (
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
                      navigate(`/ole/wc4/${encodeURIComponent(wc.workcell)}${qs ? `?${qs}` : ''}`);
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
                          navigate(`/ole/wc4/${encodeURIComponent(wc.workcell)}${qs ? `?${qs}` : ''}`);
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
                    <div className="px-2 text-[10px] font-mono text-foreground text-right">{wc.total_shifts}</div>
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
        </div>
      </div>
    </div>
  );
}
