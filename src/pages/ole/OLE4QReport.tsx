import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MhDistributionRow, OleWeeklyResult, OleWorkcellConfig } from '@/lib/ole/oleApi';
import { oleApi } from '@/lib/ole/oleApi';
import type { SavedReportMeta } from '@/lib/shared/savedReportsApi';
import { savedReports } from '@/lib/shared/savedReportsApi';
import { useSavedReport } from '@/hooks/shared/useSavedReport';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { FourQPreview } from '@/components/shared/FourQPreview';
import { ParetoChart, buildPareto } from '@/components/shared/ParetoChart';
import type { ActionItem } from '@/components/shared/ImprovementPlan';
import { ImprovementEditor, ImprovementTable } from '@/components/shared/ImprovementPlan';
import { ReportStartScreen } from '@/components/shared/ReportStartScreen';
import { ScopePicker, plantState } from '@/components/shared/ScopePicker';
import { CalendarIcon, ChevronLeft, ChevronRight, Download, Eye, EyeOff, FileSpreadsheet, FolderOpen, GripVertical, Info, Pencil, Plus, Save, Settings, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type SetupMode = 'plant' | 'workcell';
type ReportScope = { mode: SetupMode; selectedPlants: string[]; selectedWorkcells: string[] };
type SavedPlan = { actions: ActionItem[]; scope?: ReportScope; title?: string };
type TrendPoint = { id: string; label: string; ole: number; target: number; projected?: boolean; hidden?: boolean };

const genId = () => Math.random().toString(36).substr(2, 9);

// Module scope, not per-render: the factory returns a fresh object each call.
const reportsApi = savedReports('ole', '4q');

/** "4Q Report 07-29-26" — MM-DD-YY, matching how the reports are named by hand. */
function defaultReportTitle(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `4Q Report ${p(d.getMonth() + 1)}-${p(d.getDate())}-${String(d.getFullYear()).slice(-2)}`;
}

const TT_PROPS = {
  contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: 4, fontWeight: 500 },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

const FORMULA_LABELS: Record<string, string> = {
  sma3: 'SMA (3w)', sma5: 'SMA (5w)', wma3: 'WMA (3w)',
  ema_fast: 'EMA Fast', ema_slow: 'EMA Slow',
  cma: 'Cumulative MA', linear_reg: 'Linear Reg',
};
type FormulaKey = keyof typeof FORMULA_LABELS;
const ALL_FORMULA_KEYS = Object.keys(FORMULA_LABELS) as FormulaKey[];

// ─── Backtesting math ─────────────────────────────────────────────────────────

function _sma(v: number[], n: number) { if (v.length < n) return null; const w = v.slice(-n); return w.reduce((a, b) => a + b, 0) / n; }
function _wma(v: number[], n: number) { if (v.length < n) return null; const w = v.slice(-n); let num = 0, den = 0; w.forEach((x, i) => { const wt = i + 1; num += x * wt; den += wt; }); return num / den; }
function _ema(v: number[], p: number) { if (!v.length) return null; const a = 2 / (p + 1); let e = v[0]; for (let i = 1; i < v.length; i++) e = a * v[i] + (1 - a) * e; return e; }
function _linReg(v: number[], s = 1) { const n = v.length; if (n < 2) return null; const xs = v.map((_, i) => i); const mx = xs.reduce((a, b) => a + b, 0) / n; const my = v.reduce((a, b) => a + b, 0) / n; const num2 = xs.reduce((s2, x, i) => s2 + (x - mx) * (v[i] - my), 0); const den = xs.reduce((s2, x) => s2 + (x - mx) ** 2, 0); if (!den) return null; const slope = num2 / den; return slope * (n - 1 + s) + (my - slope * mx); }

interface ChartPoint {
  week_label: string; actual: number | null; proj_bar?: number | null;
  sma3?: number | null; sma5?: number | null; wma3?: number | null;
  ema_fast?: number | null; ema_slow?: number | null; cma?: number | null; linear_reg?: number | null;
  projected?: boolean;
}

function buildChartData(rows: OleWeeklyResult[], projectionWeeks: number): ChartPoint[] {
  const valid = rows.filter(r => r.ole_pct !== null);
  if (!valid.length) return [];
  const actuals = valid.map(r => r.ole_pct as number);
  const points: ChartPoint[] = valid.map((r, i) => ({
    week_label: r.week_label, actual: r.ole_pct, proj_bar: null,
    sma3: i >= 3 ? _sma(actuals.slice(0, i), 3) : null,
    sma5: i >= 5 ? _sma(actuals.slice(0, i), 5) : null,
    wma3: i >= 3 ? _wma(actuals.slice(0, i), 3) : null,
    ema_fast: i >= 1 ? _ema(actuals.slice(0, i), 3) : null,
    ema_slow: i >= 1 ? _ema(actuals.slice(0, i), 9) : null,
    cma: i >= 1 ? _sma(actuals.slice(0, i), i) : null,
    linear_reg: i >= 2 ? _linReg(actuals.slice(0, i)) : null,
    projected: false,
  }));
  const last = valid[valid.length - 1];
  let py = last.iso_year, pw = last.iso_week;
  const s3d = [...actuals], s5d = [...actuals], w3d = [...actuals], efd = [...actuals], esd = [...actuals], cmd = [...actuals];
  for (let p = 1; p <= projectionWeeks; p++) {
    pw++; if (pw > 52) { pw = 1; py++; }
    const s3 = _sma(s3d, 3), s5 = _sma(s5d, 5), w3 = _wma(w3d, 3);
    const ef = _ema(efd, 3), es = _ema(esd, 9), cm = _sma(cmd, cmd.length), lr = _linReg(actuals, p);
    if (s3 != null) s3d.push(s3); if (s5 != null) s5d.push(s5); if (w3 != null) w3d.push(w3);
    if (ef != null) efd.push(ef); if (es != null) esd.push(es); if (cm != null) cmd.push(cm);
    points.push({ week_label: `${py}-W${String(pw).padStart(2, '0')}`, actual: null, proj_bar: null, sma3: s3, sma5: s5, wma3: w3, ema_fast: ef, ema_slow: es, cma: cm, linear_reg: lr, projected: true });
  }
  return points;
}

function calcMae(points: ChartPoint[], key: keyof ChartPoint) {
  const pairs = points.filter(p => !p.projected && p.actual != null && p[key] != null && p[key] !== undefined);
  if (!pairs.length) return null;
  return pairs.reduce((s, p) => s + Math.abs((p.actual as number) - (p[key] as number)), 0) / pairs.length;
}

function getBestFormula(points: ChartPoint[]): FormulaKey | null {
  const scored = ALL_FORMULA_KEYS.map(f => ({ f, m: calcMae(points, f as any) })).filter(x => x.m != null);
  return scored.length ? scored.reduce((a, b) => a.m! < b.m! ? a : b).f : null;
}

function injectProjBars(points: ChartPoint[], best: FormulaKey | null): ChartPoint[] {
  if (!best) return points;
  return points.map(p => p.projected ? { ...p, proj_bar: p[best] ?? null } : p);
}

function chartDataToTrend(points: ChartPoint[], best: FormulaKey | null): TrendPoint[] {
  return points.map(p => ({
    id: genId(), label: p.week_label,
    ole: p.projected ? (best && p[best] != null ? Math.round((p[best] as number) * 100) / 100 : 0) : (p.actual ?? 0),
    target: 61, projected: p.projected ?? false,
  }));
}

function fmtWeekLabel(v: string): string {
  const m = v.match(/\d+$/);
  return m ? `WW${m[0].padStart(2, '0')}` : v;
}



// ─── Scope dialog ─────────────────────────────────────────────────────────────
// Replaces the old full-page setup step: picking a scope is a decision, not a
// destination, so it belongs in a modal.
//
// Selection model: a plant button is "selected" purely because the chosen
// workcells happen to equal that plant's full set — it is DERIVED, not a
// separate flag. So ticking or unticking any single workcell makes the plant
// highlight fall away on its own (a custom report) with no extra bookkeeping,
// and no way for the two to disagree.

/** Picked workcells → a ReportScope.
 *
 *  Whole plants become one query per plant; anything else goes per-workcell.
 *  Shared by the launch dialog and the Settings tab so the two cannot classify
 *  the same selection differently. */
function deriveScope(plants: string[], byPlant: Record<string, string[]>, picked: string[]): ReportScope {
  const full = plants.filter(p => plantState(byPlant[p] ?? [], picked) === 'all');
  const covered = full.flatMap(p => byPlant[p] ?? []);
  return picked.length > 0 && picked.length === covered.length
    ? { mode: 'plant', selectedPlants: full, selectedWorkcells: [] }
    : { mode: 'workcell', selectedPlants: [], selectedWorkcells: picked };
}

/** The scope block: tree, count, Clear. No chrome and no confirm button —
 *  the dialog and the Settings tab supply their own. */
function ScopeFields({ plants, byPlant, picked, onChange, maxH = 'max-h-[26rem]', gridClassName }: {
  plants: string[];
  byPlant: Record<string, string[]>;
  picked: string[];
  onChange: (next: string[]) => void;
  maxH?: string;
  /** Narrower containers need fewer columns — the drawer is half a dialog wide,
   *  and at 3 columns "ARISTA NETWORKS PCA" and "…HLA" both truncate to the
   *  same string. */
  gridClassName?: string;
}) {
  return (
    <>
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Report scope
      </Label>

      <div className={cn('mt-1.5 space-y-4 overflow-y-auto pr-1', maxH)}>
        <ScopePicker plants={plants} byPlant={byPlant} picked={picked} onChange={onChange}
          gridClassName={gridClassName} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {picked.length} workcell{picked.length === 1 ? '' : 's'} selected
        </span>
        <button onClick={() => onChange([])} disabled={!picked.length}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
          Clear
        </button>
      </div>
    </>
  );
}

function ScopeDialog({ open, onOpenChange, plants, byPlant, generating, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plants: string[];
  byPlant: Record<string, string[]>;
  generating: boolean;
  onConfirm: (scope: ReportScope, title: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(defaultReportTitle);

  // Default: first plant fully ticked — the common case is one plant.
  // The name resets each time so a new report never inherits the last one's.
  useEffect(() => {
    if (!open) return;
    setName(defaultReportTitle());
    if (!picked.length && plants.length) setPicked(byPlant[plants[0]] ?? []);
  }, [open, plants]);           // eslint-disable-line react-hooks/exhaustive-deps

  function confirm() {
    onConfirm(deriveScope(plants, byPlant, picked), name.trim() || defaultReportTitle());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <h3 className="text-base font-semibold mb-4">New report</h3>

        <div className="space-y-1.5 mb-5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Report name
          </Label>
          <Input value={name} onChange={e => setName(e.target.value)}
            placeholder={defaultReportTitle()} className="h-9 text-sm" />
        </div>

        <ScopeFields plants={plants} byPlant={byPlant} picked={picked} onChange={setPicked} />

        <Button onClick={confirm} disabled={!picked.length || generating} className="mt-3 w-full">
          {generating ? 'Loading data...' : 'Generate Report'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Q1 Chart ─────────────────────────────────────────────────────────────────

function Q1Chart({ trendData, fillHeight = false }: { trendData: TrendPoint[]; fillHeight?: boolean }) {
  const visible = trendData.filter(p => !p.hidden);
  if (!visible.length) return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data - go back to setup</div>;
  return (
    <div style={fillHeight ? { height: '100%' } : { height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visible} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtWeekLabel} />
          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...TT_PROPS} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} labelFormatter={fmtWeekLabel} />
          <Bar dataKey="ole" name="OLE %" maxBarSize={32} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="ole" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
            {visible.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
          </Bar>
          <Line type="monotone" dataKey="target" name="Target 61%" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}


// ─── Q2 Section ──────────────────────────────────────────────────────────────
// Reads mh_distribution, the same mart as Q4, so the two always agree.
// Chart 1: avg hours/week per loss bucket over the last 4 weeks.
// Chart 2: top 3 workcells by #1 loss category.
// Chart 3: top 3 workcells by #2 loss category.

// Real Paynter buckets — match mh_distribution.parquet columns.
// Order is display-only; pareto re-orders by value.
const MH_CATS: { key: keyof MhDistributionRow; label: string; color: string }[] = [
  { key: 'nva_hours',      label: 'NVA Input',     color: '#ef4444' },
  { key: 'lunch_hours',    label: 'Lunch',         color: '#94a3b8' },
  { key: 'mfg_dt_hours',   label: 'MFG DT',        color: '#6366f1' },
  { key: 'downtime_hours', label: 'Downtime',      color: '#a855f7' },
  { key: 'mfg_lost_hours', label: 'MFG Hour Lost', color: '#f59e0b' },
];

function Q2Section({ aggregateRows, weeklyRows, mhRows, compact = false, onCatsChange }: {
  aggregateRows: OleWeeklyResult[];
  weeklyRows: OleWeeklyResult[];
  mhRows: MhDistributionRow[];
  compact?: boolean;
  onCatsChange?: (c1: string, c2: string) => void;
}) {
  const { pareto1, pareto2, pareto3, top1Cat, top2Cat } = useMemo(() => {
    const last4 = aggregateRows
      .filter(r => r.ole_pct !== null)
      .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week)
      .slice(-4);

    if (!last4.length) return { pareto1: [], pareto2: [], pareto3: [], top1Cat: '', top2Cat: '' };

    // Scope: only workcells that survived the page filter, only dates inside
    // the last-4 ISO weeks. mhRows is already filtered by plant/workcell server-side.
    const allowedWcs = new Set(weeklyRows.map(r => r.workcell));
    const minStart = last4[0].week_start_date;
    const maxEnd   = last4[last4.length - 1].week_end_date;
    const scoped = mhRows.filter(r =>
      allowedWcs.has(r.workcell) &&
      r.date >= minStart && r.date <= maxEnd
    );

    // Total paid hours over the window — denominator for every %.
    const totalPaid = scoped.reduce((s, r) => s + (r.total_paid_hours || 0), 0);
    if (totalPaid <= 0) return { pareto1: [], pareto2: [], pareto3: [], top1Cat: '', top2Cat: '' };

    // Divide by the number of weeks actually in the window, NOT a literal 4 —
    // last4 is .slice(-4), so it holds 1-3 weeks early in a year or under a
    // narrow filter, and a hardcoded /4 would understate those by up to 4x.
    const weekCount = last4.length;

    // Chart 1: AVERAGE hours per week per bucket over the window.
    // (Bars are in hours, Pareto line shows cumulative % — chart unit consistency.)
    const catTotals = MH_CATS.map(cat => ({
      name: cat.label,
      color: cat.color,
      value: parseFloat(
        (scoped.reduce((s, r) => s + ((r[cat.key] as number) || 0), 0) / weekCount).toFixed(1)
      ),
    }));
    const p1 = buildPareto(catTotals);
    const top1 = p1[0]?.name ?? '';
    const top2 = p1[1]?.name ?? '';

    // Charts 2 & 3: top 3 workcells by AVERAGE hours per week of the #1 / #2
    // bucket. Same per-week basis as chart 1 so the three charts are comparable.
    const findCat = (label: string) => MH_CATS.find(c => c.label === label);
    const shortName = (wc: string) => wc.length > 12 ? wc.slice(0, 12) + '...' : wc;

    const top3ForCat = (label: string) => {
      const cat = findCat(label);
      if (!cat) return [];
      const wcHours = new Map<string, number>();
      for (const r of scoped) {
        const v = (r[cat.key] as number) || 0;
        if (v <= 0) continue;
        wcHours.set(r.workcell, (wcHours.get(r.workcell) ?? 0) + v);
      }
      return buildPareto(
        [...wcHours.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([wc, hrs]) => ({
            name: shortName(wc),
            value: parseFloat((hrs / weekCount).toFixed(1)),
            color: cat.color,
          }))
      );
    };

    return { pareto1: p1, pareto2: top3ForCat(top1), pareto3: top3ForCat(top2), top1Cat: top1, top2Cat: top2 };
  }, [aggregateRows, weeklyRows, mhRows]);

  useEffect(() => { onCatsChange?.(top1Cat, top2Cat); }, [top1Cat, top2Cat, onCatsChange]);

  if (compact) {
    return (
      <div className="flex gap-2 h-full min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <ParetoChart title="Man-hrs Loss Distribution (avg hrs/week)" data={pareto1} loading={false} fillHeight />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <ParetoChart title={`Top 3 Workcells - ${top1Cat || '#1 Loss'}`} data={pareto2} loading={false} fillHeight />
          <ParetoChart title={`Top 3 Workcells - ${top2Cat || '#2 Loss'}`} data={pareto3} loading={false} fillHeight />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ParetoChart title="Man-hrs Loss Distribution (avg hrs/week)" data={pareto1} loading={false} height={200} />
      <div className="grid grid-cols-2 gap-3">
        <ParetoChart title={`Top 3 Workcells - ${top1Cat || '#1 Loss'}`} data={pareto2} loading={false} height={180} />
        <ParetoChart title={`Top 3 Workcells - ${top2Cat || '#2 Loss'}`} data={pareto3} loading={false} height={180} />
      </div>
    </div>
  );
}

// ─── Q4 Paynter Chart ────────────────────────────────────────────────────────

/** Reference shares, shown in the Q2 editor panel as context for what a typical
 *  split looks like. Display only — every number on screen comes from
 *  mh_distribution. (An earlier build SYNTHESISED the Paynter rows from these
 *  shares plus a seeded jitter; that generator is gone.) */
const PAYNTER_CATS = [
  { key: 'lunch', label: 'Lunch, Break time', color: '#94a3b8', share: 0.136 },
  { key: 'mfg_manh', label: 'Mfg ManH. Lost', color: '#f59e0b', share: 0.383 },
  { key: 'nva_input', label: 'NVA Input', color: '#ef4444', share: 0.456 },
  { key: 'support_dt', label: 'Support DT', color: '#6366f1', share: 0.025 },
];

interface MhWeekData { week_label: string; values: Record<string, number>; total: number; }

function PaynterTable({ aggregateRows, weeklyRows, mhRows, isPrint = false }: {
  aggregateRows: OleWeeklyResult[];
  weeklyRows: OleWeeklyResult[];
  mhRows: MhDistributionRow[];
  isPrint?: boolean;
}) {
  const weekData = useMemo((): MhWeekData[] => {
    const allowedWcs = new Set(weeklyRows.map(r => r.workcell));
    const weeks = aggregateRows
      .filter(r => r.ole_pct !== null)
      .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week);

    return weeks.map(w => {
      // Per-bucket weighted % of paid hours, summed across the week's date range
      // and across every workcell that passed the filter.
      let paid = 0;
      const sums: Record<string, number> = {};
      MH_CATS.forEach(c => { sums[c.key] = 0; });

      for (const r of mhRows) {
        if (!allowedWcs.has(r.workcell)) continue;
        if (r.date < w.week_start_date || r.date > w.week_end_date) continue;
        paid += r.total_paid_hours || 0;
        for (const c of MH_CATS) {
          sums[c.key] += (r[c.key] as number) || 0;
        }
      }

      const values: Record<string, number> = {};
      MH_CATS.forEach(c => {
        values[c.key] = paid > 0 ? parseFloat(((sums[c.key] / paid) * 100).toFixed(2)) : 0;
      });
      const total = parseFloat(Object.values(values).reduce((a, b) => a + b, 0).toFixed(2));
      return { week_label: w.week_label, values, total };
    });
  }, [aggregateRows, weeklyRows, mhRows]);

  // Weighted 4-week average: use the real underlying hours, not avg-of-percentages.
  const last4Avg = useMemo(() => {
    const allowedWcs = new Set(weeklyRows.map(r => r.workcell));
    const last4Weeks = aggregateRows
      .filter(r => r.ole_pct !== null)
      .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week)
      .slice(-4);
    if (!last4Weeks.length) return { values: {} as Record<string, number>, total: null as number | null };

    const minStart = last4Weeks[0].week_start_date;
    const maxEnd   = last4Weeks[last4Weeks.length - 1].week_end_date;
    let paid = 0;
    const sums: Record<string, number> = {};
    MH_CATS.forEach(c => { sums[c.key] = 0; });
    for (const r of mhRows) {
      if (!allowedWcs.has(r.workcell)) continue;
      if (r.date < minStart || r.date > maxEnd) continue;
      paid += r.total_paid_hours || 0;
      for (const c of MH_CATS) sums[c.key] += (r[c.key] as number) || 0;
    }
    const values: Record<string, number> = {};
    MH_CATS.forEach(c => {
      values[c.key] = paid > 0 ? parseFloat(((sums[c.key] / paid) * 100).toFixed(2)) : 0;
    });
    const total = paid > 0 ? parseFloat(Object.values(values).reduce((a, b) => a + b, 0).toFixed(2)) : null;
    return { values, total };
  }, [aggregateRows, weeklyRows, mhRows]);

  const avg4 = (key: string) => last4Avg.values[key] ?? null;
  const avgTotal = last4Avg.total;
  const fs = isPrint ? 'text-[10px]' : 'text-xs';
  const px = isPrint ? 'px-1.5 py-1' : 'px-3 py-1.5';
  const ph = isPrint ? 'px-1.5 py-1.5' : 'px-3 py-2';

  if (!weekData.length) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No data</div>;

  return (
    <div className={cn(isPrint ? 'w-full h-full overflow-hidden flex flex-col' : 'overflow-x-auto rounded-xl bg-card w-full h-full')}>
      <table className={cn('w-full text-left border-collapse table-fixed', isPrint ? 'h-full' : '', fs)}>
        <thead>
          {isPrint && <tr><th colSpan={weekData.length + 2} className="text-center py-1 text-[10px] font-bold uppercase text-primary-foreground bg-primary border-0">Fourth Quadrant - Paynter Chart</th></tr>}
          <tr className="bg-primary text-primary-foreground uppercase tracking-wider">
            <th className={cn(ph, 'border border-primary/70 font-semibold', isPrint ? 'text-[9px] w-28' : 'sticky left-0 bg-primary z-10 w-36 max-w-[144px] text-[10px]')}>{isPrint ? 'Category' : 'Man Hrs Distribution'}</th>
            {weekData.map(w => <th key={w.week_label} className={cn(ph, 'border border-primary/70 text-right font-semibold')}>{fmtWeekLabel(w.week_label)}</th>)}
            <th className={cn(ph, 'border border-primary/70 text-right font-bold bg-primary/80')}>Avg (4W)</th>
          </tr>
        </thead>
        <tbody>
          {MH_CATS.map(cat => {
            const a4 = avg4(cat.key);
            return (
              <tr key={cat.key} className="border-b border-border">
                <td className={cn(px, 'border border-border font-semibold', isPrint ? 'break-words' : 'sticky left-0 bg-card z-10 w-36 max-w-[144px] leading-snug')}>
                  <span className="flex items-center gap-1.5">{cat.label}</span>
                </td>
                {weekData.map(w => <td key={w.week_label} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>{(w.values[cat.key] ?? 0).toFixed(2)}%</td>)}
                <td className={cn(px, 'border border-primary/20 text-right font-mono font-bold tabular-nums text-primary')}>{a4 != null ? `${a4.toFixed(2)}%` : '-'}</td>
              </tr>
            );
          })}
          <tr className="font-bold text-foreground bg-muted/60">
            <td className={cn(px, 'border border-border uppercase tracking-wider', isPrint ? '' : 'sticky left-0 bg-muted/60 z-10 w-36 max-w-[144px]')}>Total</td>
            {weekData.map(w => <td key={w.week_label} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>{w.total.toFixed(2)}%</td>)}
            <td className={cn(px, 'border border-primary/20 text-right font-mono tabular-nums bg-primary/10 text-primary')}>{avgTotal != null ? `${avgTotal.toFixed(2)}%` : '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLE4QReport() {
  const location = useLocation();
  const [title, setTitle] = useState(defaultReportTitle);
  const [tab, setTab] = useState<'start' | 'editor'>('start');
  const [scopeOpen, setScopeOpen] = useState(false);

  // Reset to setup whenever the user re-navigates here (e.g. clicks the sidebar
  // 4Q nav while already in editor). location.key changes on every navigate(),
  // including same-route replace from the sidebar's "click-when-active" handler.
  useEffect(() => {
    setTab('start');
  }, [location.key]);
  const [rightOpen, setRightOpen] = useState(true);
  const [workcellConfigs, setWorkcellConfigs] = useState<OleWorkcellConfig[]>([]);
  const [mode, setMode] = useState<SetupMode>('plant');
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [selectedWorkcells, setSelectedWorkcells] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendScope, setTrendScope] = useState('');
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [weeklyRows, setWeeklyRows] = useState<OleWeeklyResult[]>([]);
  const [mhRows, setMhRows] = useState<MhDistributionRow[]>([]);
  const [top1Cat, setTop1Cat] = useState('');
  const [top2Cat, setTop2Cat] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Saved Q3 plans ─────────────────────────────────────────────────────────
  // Only the Q3 improvement plan is persisted. Q1/Q2/Q4 always rebuild from the
  // live mart, so loading last month's plan shows it against THIS week's data.
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleBeforeEdit, setTitleBeforeEdit] = useState('');

  // Fingerprint of the plan. Compared as JSON because ActionItem is flat data —
  // no need for a deep-equal helper, and field ORDER is stable since every row
  // is built from one literal. Deliberately NARROWER than the payload: `scope`
  // is persisted but does not by itself mark the report unsaved.
  const planFingerprint = useMemo(() => JSON.stringify({ actions, title }), [actions, title]);

  const saved = useSavedReport<SavedPlan>({
    api: reportsApi,
    name: title,
    payload: { actions, scope: { mode, selectedPlants, selectedWorkcells }, title },
    dirtyKey: planFingerprint,
    autosave: tab === 'editor',
  });
  const { user, savedList, autoState, saveMsg, dirty, setSaveMsg, ensureUser } = saved;

  async function handleLoadSaved(id: number) {
    try {
      const rec = await saved.load(id);
      if (!rec) return;
      const loadedActions = rec.payload?.actions ?? [];
      setActions(loadedActions);
      const loadedTitle = rec.payload?.title ?? title;
      if (rec.payload?.title) setTitle(rec.payload.title);
      saved.markSaved(JSON.stringify({ actions: loadedActions, title: loadedTitle }));

      // Restore the scope the plan was written against, so loading is ONE click
      // — no "pick a plant first". Only the scope is restored; Q1/Q2/Q4 are
      // always re-pulled from the live mart below.
      const scope = rec.payload?.scope;
      if (scope) {
        setMode(scope.mode);
        setSelectedPlants(scope.selectedPlants ?? []);
        setSelectedWorkcells(scope.selectedWorkcells ?? []);
      }
      const effective = scope ?? { mode, selectedPlants, selectedWorkcells };
      if (effective.mode === 'plant' ? effective.selectedPlants.length === 0 : effective.selectedWorkcells.length === 0) {
        // Older save with no scope stored — send them to the scope picker
        // rather than leaving them staring at the start screen.
        setSaveMsg('Plan loaded — choose a scope to generate.');
        setScopeOpen(true);
        return;
      }
      await handleGenerate(effective);  // Q1/Q2/Q4 from CURRENT data
    } catch (e) {
      console.error(e);
      setSaveMsg(e instanceof Error ? e.message : 'Load failed');
    }
  }

  const handleSavePlan = saved.save;
  const handleDeleteSave = saved.remove;

  const scrollToSection = (t: string) => {
    const ids: Record<string, string> = { q1: 'q1-section', q2: 'q2-section', q3: 'q3-section', q4: 'q4-section' };
    const id = ids[t]; if (!id) return;
    setTimeout(() => { bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  };

  const plants = useMemo(() => Array.from(new Set(workcellConfigs.map(w => w.plant))).sort(), [workcellConfigs]);
  const byPlant = useMemo(() => {
    const map: Record<string, string[]> = {};
    workcellConfigs.forEach(w => { if (!map[w.plant]) map[w.plant] = []; map[w.plant].push(w.workcell); });
    return map;
  }, [workcellConfigs]);

  useEffect(() => { oleApi.workcells.list().then(setWorkcellConfigs).catch(() => { }); }, []);

  // The Settings tab edits a DRAFT, not the live scope — so half-made changes
  // never move the report until "Update Report Scope" is pressed. Seeded from
  // whatever the report currently covers, flattened to workcells because that
  // is the one representation the picker understands.
  const currentScope = useMemo(
    () => (mode === 'plant' ? selectedPlants.flatMap(p => byPlant[p] ?? []) : selectedWorkcells),
    [mode, selectedPlants, selectedWorkcells, byPlant],
  );
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);
  useEffect(() => { setScopeDraft(currentScope); }, [currentScope]);

  const aggregateRows = useMemo((): OleWeeklyResult[] => {
    const byWeek: Record<string, { smh: number; hrs: number; label: string; year: number; week: number; ws: string; we: string }> = {};
    weeklyRows.forEach(r => {
      if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, label: r.week_label, year: r.iso_year, week: r.iso_week, ws: r.week_start_date, we: r.week_end_date };
      byWeek[r.week_label].smh += r.total_output_smh; byWeek[r.week_label].hrs += r.total_input_hours;
    });
    return Object.values(byWeek).sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week).slice(-13).map(w => ({
      workcell: 'All', iso_year: w.year, iso_week: w.week, week_label: w.label,
      week_start_date: w.ws, week_end_date: w.we, stage_label: 'All', scan_stage: 'All',
      total_qty: 0, shift_count: 0, total_output_smh: w.smh, total_input_hours: w.hrs,
      avg_hc_direct: 0, total_va_hours: 0, total_nva_hours: 0,
      ole_pct: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : null,
      ole_pct_avg_shifts: null, shifts_ok: 0, shifts_flagged: 0, smh_coverage_pct: null,
    } as OleWeeklyResult));
  }, [weeklyRows]);

  // `scope` overrides the state values. Needed when loading a saved plan:
  // setMode/setSelectedPlants are async, so reading state here would use the
  // PREVIOUS scope on the very run that matters.
  async function handleGenerate(scope?: ReportScope) {
    const useMode    = scope?.mode ?? mode;
    const usePlants  = scope?.selectedPlants ?? selectedPlants;
    const useWcs     = scope?.selectedWorkcells ?? selectedWorkcells;
    if (useMode === 'plant' ? usePlants.length === 0 : useWcs.length === 0) return;
    setGenerating(true);
    try {
      let rows: OleWeeklyResult[] = []; let label = '';
      let mh: MhDistributionRow[] = [];
      if (useMode === 'plant') {
        const res   = await Promise.all(usePlants.map(p => oleApi.ole.weekly({ plant: p })));
        const mhRes = await Promise.all(usePlants.map(p => oleApi.mhDistribution.list({ plant: p })));
        rows = res.flat(); mh = mhRes.flat(); label = usePlants.join(' + ');
      } else {
        const res   = await Promise.all(useWcs.map(wc => oleApi.ole.weekly({ workcell: wc })));
        const mhRes = await Promise.all(useWcs.map(wc => oleApi.mhDistribution.list({ workcell: wc })));
        rows = res.flat(); mh = mhRes.flat(); label = useWcs.join(', ');
      }
      setWeeklyRows(rows); setMhRows(mh); setTrendScope(label);
      const byWeek: Record<string, { smh: number; hrs: number; label: string; year: number; week: number; ws: string; we: string }> = {};
      rows.forEach(r => {
        if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, label: r.week_label, year: r.iso_year, week: r.iso_week, ws: r.week_start_date, we: r.week_end_date };
        byWeek[r.week_label].smh += r.total_output_smh; byWeek[r.week_label].hrs += r.total_input_hours;
      });
      const aggRows = Object.values(byWeek).sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week).slice(-13).map(w => ({
        workcell: 'All', iso_year: w.year, iso_week: w.week, week_label: w.label,
        week_start_date: w.ws, week_end_date: w.we, stage_label: 'All', scan_stage: 'All',
        total_qty: 0, shift_count: 0, total_output_smh: w.smh, total_input_hours: w.hrs,
        avg_hc_direct: 0, total_va_hours: 0, total_nva_hours: 0,
        ole_pct: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : null,
        ole_pct_avg_shifts: null, shifts_ok: 0, shifts_flagged: 0, smh_coverage_pct: null,
      } as OleWeeklyResult));
      const basePoints = buildChartData(aggRows, 0);
      const best = getBestFormula(basePoints);
      setTrendData(chartDataToTrend(injectProjBars(basePoints, best), best));
      setTab('editor');
    } catch (e) { console.error(e); } finally { setGenerating(false); }
  }

  function handleTrendDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const n = [...trendData]; const [moved] = n.splice(fromIdx, 1); n.splice(toIdx, 0, moved); setTrendData(n);
  }

  // Slots 3 and 4 are bare — Paynter and Improvement each print their own banner
  // — so those two headings only name the slots. The sheet reads Q1, Q2, then
  // Paynter bottom-left and the plan bottom-right, the layout people know.
  const preview = (
    <FourQPreview
      title={title}
      headings={['First Quadrant - OLE Trend', 'Second Quadrant - Pareto Four Weeks',
                 'Fourth Quadrant - Paynter Chart', 'Third Quadrant - Improvement Plan']}
      frameClassName={['', '', 'items-start', '']}
      quadrants={[
        <Q1Chart trendData={trendData} fillHeight />,
        <Q2Section aggregateRows={aggregateRows} weeklyRows={weeklyRows} mhRows={mhRows} compact
          onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }} />,
        <PaynterTable aggregateRows={aggregateRows} weeklyRows={weeklyRows} mhRows={mhRows} isPrint />,
        <ImprovementTable actions={actions} issues={[top1Cat, top2Cat]} isPrint />,
      ]}
    />
  );

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-3">
          {tab === 'editor' && (
            <button onClick={() => setTab('start')} title="Back to start"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-foreground">4Q Generator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{tab === 'start' ? 'Create a new report or open a saved one' : `Scope: ${trendScope} · ${trendData.filter(p => !p.hidden).length} weeks visible`}</p>
          </div>
        </div>

        {/* Report title — click to edit in place (Google Docs style). Absolutely
            positioned so it stays centred on the HEADER, not on whatever space
            is left between the two button groups. */}
        {tab === 'editor' && (
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[38%]">
            {titleEditing ? (
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => { if (!title.trim()) setTitle(defaultReportTitle()); setTitleEditing(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setTitle(titleBeforeEdit); setTitleEditing(false); }
                }}
                className="w-full min-w-[20rem] bg-transparent text-center text-lg font-semibold text-foreground border-b-2 border-primary outline-none px-2 py-1"
              />
            ) : (
              <button
                onClick={() => { setTitleBeforeEdit(title); setTitleEditing(true); }}
                title="Click to rename this report"
                className="group flex items-center gap-2 max-w-full rounded-md px-2 py-1 text-lg font-semibold text-foreground hover:bg-muted/60 transition-colors"
              >
                <span className="truncate">{title}</span>
                <Pencil className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            )}
          </div>
        )}

        {tab === 'editor' && (
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-[11px] text-muted-foreground">{saveMsg}</span>}
            {user ? (
              <span aria-live="polite"
                title={autoState === 'error' ? 'Autosave failed - retrying every 5s' : undefined}
                className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  autoState === 'error' ? 'bg-red-500/10 text-red-500'
                    : autoState === 'saving' ? 'bg-muted text-muted-foreground'
                      : dirty ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground')}>
                <span className={cn('h-1.5 w-1.5 rounded-full',
                  autoState === 'error' ? 'bg-red-500'
                    : autoState === 'saving' ? 'bg-muted-foreground animate-pulse'
                      : dirty ? 'bg-amber-500' : 'bg-emerald-500')} />
                {autoState === 'error' ? 'Retrying save...'
                  : autoState === 'saving' ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
              </span>
            ) : (
              <div className="relative">
                <Button onClick={handleSavePlan} variant={dirty ? 'default' : 'outline'} size="sm" className="gap-2"
                  title="Autosave is off until we can identify you - click to save">
                  <Save className="w-4 h-4" />{dirty ? 'Save' : 'Saved'}
                </Button>
                {dirty && <span aria-label="Unsaved changes"
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" />}
              </div>
            )}
            {preview}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {tab === 'start' && (
          <ReportStartScreen
            icon={FileSpreadsheet}
            title="4Q Report"
            subtitle="Weekly OLE performance review — trend, loss Paretos, improvement plan."
            savedList={savedList} loading={generating}
            onNew={() => { const t = defaultReportTitle(); setActions([]); setTitle(t); saved.startNew(JSON.stringify({ actions: [], title: t })); setScopeOpen(true); }}
            onLoad={handleLoadSaved} onDeleteSave={handleDeleteSave} />
        )}

        <ScopeDialog
          open={scopeOpen} onOpenChange={setScopeOpen}
          plants={plants} byPlant={byPlant} generating={generating}
          onConfirm={async (scope, name) => {
            setTitle(name);
            saved.markSaved(JSON.stringify({ actions: [], title: name }));
            setMode(scope.mode);
            setSelectedPlants(scope.selectedPlants);
            setSelectedWorkcells(scope.selectedWorkcells);
            setScopeOpen(false);
            await handleGenerate(scope);
            // Persist immediately so a brand-new report shows up under "Load
            // saved" right away, and so the header's "Saved" state is TRUE
            // rather than merely un-edited. Skipped when we can't identify the
            // user — the button then honestly reads "Save".
            if (user) {
              try {
                await saved.persist(user, {
                  id: null, name, payload: { actions: [], scope, title: name },
                  snapshot: JSON.stringify({ actions: [], title: name }), announce: false,
                });
              } catch (e) { console.error('autosave failed', e); }
            }
          }} />


        {tab === 'editor' && (
          <>
            <div className="flex-1 overflow-y-auto p-8" ref={bodyRef}>
              <div className="max-w-5xl mx-auto space-y-12 pb-16">

                <section id="q1-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">1</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">First Quadrant - OLE Trend</h2><p className="text-xs text-muted-foreground mt-0.5">Scope: {trendScope}</p></div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm"><Q1Chart trendData={trendData} /></div>
                </section>

                <section id="q2-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">2</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Second Quadrant - Pareto Four Weeks</h2><p className="text-xs text-muted-foreground mt-0.5">Avg of last 4 actual weeks - derived from Paynter categories</p></div>
                  </div>
                  <Q2Section aggregateRows={aggregateRows} weeklyRows={weeklyRows} mhRows={mhRows} onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }} />
                </section>

                <section id="q3-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">3</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Third Quadrant - Improvement Plan</h2><p className="text-xs text-muted-foreground mt-0.5">Corrective actions and ownership</p></div>
                  </div>
                  <ImprovementTable actions={actions} issues={[top1Cat, top2Cat]} />
                </section>

                <section id="q4-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">4</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Fourth Quadrant - Paynter Chart</h2><p className="text-xs text-muted-foreground mt-0.5">Man-hours loss distribution per week</p></div>
                  </div>
                  <div className="overflow-x-auto"><PaynterTable aggregateRows={aggregateRows} weeklyRows={weeklyRows} mhRows={mhRows} /></div>
                </section>

              </div>
            </div>

            <div className={cn('border-l border-border bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out shadow-xl flex flex-col flex-shrink-0 z-10', rightOpen ? 'w-[460px]' : 'w-12')}>
              <div className={cn('flex items-center cursor-pointer hover:bg-muted/40 transition-colors border-b border-border flex-shrink-0 group', rightOpen ? 'justify-between px-5' : 'justify-center')} style={{ height: 52 }} onClick={() => setRightOpen(!rightOpen)}>
                {rightOpen
                  ? <><div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Editor</span></div><div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary text-muted-foreground transition-colors"><ChevronRight className="h-3.5 w-3.5" /></div></>
                  : <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary text-muted-foreground transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></div>
                }
              </div>

              {rightOpen && (
                <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0">
                  <Tabs defaultValue="q1" className="h-full flex flex-col min-h-0" onValueChange={scrollToSection}>
                    <TabsList className="w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent h-auto p-0 gap-x-4 gap-y-2 pb-2">
                      {[
                        { v: 'q1', label: 'Q1 Trend', cls: 'data-[state=active]:border-primary' },
                        // Q2 Pareto and Q4 Paynter are generated, not edited — their
                        // tabs held nothing to change. Panels stay mounted below so
                        // scrollToSection and the printed report are unaffected.
                        { v: 'q3', label: 'Q3 Improvements', cls: 'data-[state=active]:border-emerald-500' },
                        { v: 'settings', label: 'Settings', cls: 'data-[state=active]:border-muted-foreground ml-auto' },
                      ].map(t => <TabsTrigger key={t.v} value={t.v} className={cn('rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs', t.cls)}>{t.label}</TabsTrigger>)}
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2">

                      <TabsContent value="q1" className="m-0 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground">Auto-populated · {trendData.filter(p => !p.hidden).length} of {trendData.length} weeks visible.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setTrendData([...trendData, { id: genId(), label: `WW${String(trendData.length + 1).padStart(2, '0')}`, ole: 0, target: 61, projected: false, hidden: false }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        <div className="grid text-[10px] text-muted-foreground uppercase tracking-wider px-7 gap-2" style={{ gridTemplateColumns: '1fr 5rem 5rem 2rem' }}>
                          <span>Label</span><span className="text-right">OLE %</span><span className="text-right">Target</span><span />
                        </div>
                        {trendData.map((t, i) => (
                          <div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(i))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleTrendDrop(Number(e.dataTransfer.getData('text/plain')), i); }}
                            className={cn('flex items-center gap-2 p-2 rounded border transition-all', t.hidden ? 'bg-muted/10 border-border/40 opacity-50 cursor-grab' : 'bg-muted/30 border-border cursor-grab active:opacity-60')}>
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1" style={{ display: 'grid', gridTemplateColumns: '1fr 5rem 5rem' }}>
                              <Input value={t.label} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], label: e.target.value }; setTrendData(n); }} className={cn('h-7 text-xs', t.hidden && 'text-muted-foreground line-through')} />
                              <Input type="number" value={t.ole} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], ole: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" disabled={t.hidden} />
                              <Input type="number" value={t.target} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], target: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" disabled={t.hidden} />
                            </div>
                            <button title={t.hidden ? 'Show week' : 'Hide week'} onClick={() => { const n = [...trendData]; n[i] = { ...n[i], hidden: !n[i].hidden }; setTrendData(n); }}
                              className={cn('h-7 w-7 flex items-center justify-center rounded flex-shrink-0 transition-colors', t.hidden ? 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40')}>
                              {t.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="q2" className="m-0 space-y-2">
                        <p className="text-[11px] text-muted-foreground">Same mart as Q4 (mh_distribution). All three charts are average hours per week over the last 4 weeks. Chart 1 = loss buckets; charts 2 and 3 = top 3 workcells for the top 2 buckets.</p>
                        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                          {PAYNTER_CATS.map(c => (
                            <div key={c.key} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="flex-1 text-muted-foreground">{c.label}</span>
                              <span className="font-mono text-[10px] text-muted-foreground/60">{(c.share * 100).toFixed(0)}% avg share</span>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="q3" className="m-0">
                        <ImprovementEditor
                          actions={actions} onChange={setActions}
                          issues={[top1Cat, top2Cat]} />
                      </TabsContent>

                      <TabsContent value="q4" className="m-0 space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                          Per-week share of paid hours by loss bucket, straight from
                          mh_distribution. Nothing to edit — fix the source data, not the table.
                        </p>
                      </TabsContent>

                      {/* Same scope UI as the launch dialog, inline in the drawer —
                          one component, so the two can't drift. Report title is not
                          repeated here; it is edited in place in the header. */}
                      <TabsContent value="settings" className="m-0">
                        <ScopeFields plants={plants} byPlant={byPlant}
                          picked={scopeDraft} onChange={setScopeDraft}
                          maxH="max-h-[22rem]"
                          gridClassName="grid-cols-1 sm:grid-cols-2" />

                        <Button
                          onClick={() => {
                            const scope = deriveScope(plants, byPlant, scopeDraft);
                            // Push the derived scope back into component state as
                            // well as passing it: handleGenerate reads `scope ?? state`,
                            // so state left untouched would go stale the moment
                            // anything else called it without one.
                            setMode(scope.mode);
                            setSelectedPlants(scope.selectedPlants);
                            setSelectedWorkcells(scope.selectedWorkcells);
                            void handleGenerate(scope);
                          }}
                          disabled={generating || scopeDraft.length === 0}
                          className="mt-3 w-full">
                          {generating ? 'Updating...' : 'Update Report Scope'}
                        </Button>
                      </TabsContent>

                    </div>
                  </Tabs>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
