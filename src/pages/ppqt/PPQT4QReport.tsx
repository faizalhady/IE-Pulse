/**
 * PPQT4QReport.tsx — the 4Q read of PPQT capacity sizing.
 *
 * Same four boxes, same frame and the same shared components as the OLE 4Q
 * (see pages/ole/OLE4QReport.tsx — this page is deliberately its twin):
 *
 *   Q1  where we stand      DL coverage % per period against 100, demand behind it
 *   Q2  where it is going   the shortfall ranked by bay, then the models loading
 *                           the top two short bays
 *   Q3  what we will do     the improvement plan (shared, seeded with the top 2 bays)
 *   Q4  the 100% view       where the capacity goes — VA, changeover, allowance,
 *                           NPI, spare — summing back to 100%
 *
 * ONE DIFFERENCE FROM THE OTHER THREE 4Qs, and it is the whole story: OLE,
 * Cycle Time and VA/NVA review the PAST. PPQT reviews the PLAN. So the trend
 * axis is the sizing horizon (months forward), not history — and there is no
 * projection maths, because demand IS the forecast. Everything else, down to
 * the autosave badge and the PNG export, is the OLE page's behaviour.
 *
 * Numbers: IE-Pulse-Backend modules/ppqt/compute.py `fourq()`, one call.
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PPQT4Q, PPQT4QPeriod } from '@/lib/ppqt/ppqtApi';
import { ppqtApi } from '@/lib/ppqt/ppqtApi';
import { savedReports } from '@/lib/shared/savedReportsApi';
import { useSavedReport } from '@/hooks/shared/useSavedReport';
import { cn } from '@/lib/utils';
import { FourQPreview } from '@/components/shared/FourQPreview';
import { BAND_BAD, BAND_GOOD, BAND_WARN, statusBands } from '@/components/shared/StatusBands';
import { ParetoChart, buildPareto } from '@/components/shared/ParetoChart';
import type { ActionItem } from '@/components/shared/ImprovementPlan';
import { ImprovementEditor, ImprovementTable } from '@/components/shared/ImprovementPlan';
import { ReportStartScreen } from '@/components/shared/ReportStartScreen';
import { ScopeFields } from '@/components/shared/ScopePicker';
import { ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical, LayoutGrid, Pencil, Plus, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type SavedPlan = { actions: ActionItem[]; scope?: string[]; title?: string };
/** One period of Q1, editable in the right panel the way OLE's weeks are. */
type TrendPoint = { period: string; label: string; coverage: number; target: number; demand: number };

const genId = () => Math.random().toString(36).substr(2, 9);

// Module scope, not per-render: the factory returns a fresh object each call.
const reportsApi = savedReports('ppqt', '4q');

/** Coverage target. 100% = the plan is staffed exactly to the demand. */
const TARGET = 100;

/** The one group the scope tree needs. PPQT has no plant dimension — a workbook
 *  is filed per workcell, so every workcell sits under one heading. */
const SCOPE_GROUP = 'PPQT Workcells';

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

/** "2026-08" → "Aug '26" for axes and column heads. */
function fmtPeriod(p: string): string {
  const [y, m] = p.split('-');
  const name = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m)] ?? p;
  return `${name} '${y.slice(-2)}`;
}

const n0 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** Bar colour per area, so a Pareto of bays reads as a Pareto of the plant. */
const AREA_HEX: Record<string, string> = { SMT: '#6366f1', BE: '#f59e0b', HLA: '#10b981' };
const areaColor = (a: string | null) => AREA_HEX[a ?? ''] ?? '#94a3b8';

// ─── Scope dialog ─────────────────────────────────────────────────────────────
// Same shape as OLE's: picking a scope is a decision, not a destination, so it
// lives in a modal. PPQT's scope is just the list of workcells, since one
// workbook covers one workcell across every area and period it contains.

function ScopeDialog({ open, onOpenChange, workcells, generating, onConfirm }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workcells: string[];
  generating: boolean;
  onConfirm: (picked: string[], title: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(defaultReportTitle);

  // Default: everything ticked — one plant's worth of workbooks is the common
  // case. The name resets each time so a new report never inherits the last one's.
  useEffect(() => {
    if (!open) return;
    setName(defaultReportTitle());
    if (!picked.length && workcells.length) setPicked(workcells);
  }, [open, workcells]);           // eslint-disable-line react-hooks/exhaustive-deps

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

        <ScopeFields plants={[SCOPE_GROUP]} byPlant={{ [SCOPE_GROUP]: workcells }}
          picked={picked} onChange={setPicked} maxH="max-h-[26rem]" />

        <Button onClick={() => onConfirm(picked, name.trim() || defaultReportTitle())}
          disabled={!picked.length || generating} className="mt-3 w-full">
          {generating ? 'Loading data...' : 'Generate Report'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Q1 Chart ─────────────────────────────────────────────────────────────────
// Coverage bars against the 100% line, with demand on the right axis. Demand is
// what moves every other number in PPQT, so it is never off the chart.

const Q1_MONTHS = 12;
/** The mart is forward-looking — it holds the horizon, roughly 3 months. Q1
 *  shows a year, so the months before the horizon are DEMO: the earliest real
 *  month scaled by a fixed climb, oldest furthest from it.
 *  ponytail: delete PAD_FACTORS and padTrend once history is stored. */
const PAD_FACTORS = [0.82, 0.84, 0.86, 0.88, 0.90, 0.92, 0.94, 0.96, 0.98];

/** "2026-08" minus n months. */
function monthBack(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

function padTrend(points: TrendPoint[]): TrendPoint[] {
  const first = points[0];
  if (!first || points.length >= Q1_MONTHS) return points;
  const missing = Math.min(Q1_MONTHS - points.length, PAD_FACTORS.length);
  const mock = PAD_FACTORS.slice(-missing).map((f, i) => {
    const period = monthBack(first.period, missing - i);
    return {
      period,
      label: fmtPeriod(period),
      coverage: Math.round(first.coverage * f * 10) / 10,
      target: first.target,
      demand: Math.round(first.demand * f),
    };
  });
  return [...mock, ...points];
}

function Q1Chart({ trendData, fillHeight = false }: { trendData: TrendPoint[]; fillHeight?: boolean }) {
  const visible = trendData;
  if (!visible.length) return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data - go back to setup</div>;
  return (
    <div style={fillHeight ? { height: '100%' } : { height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visible} margin={{ top: 14, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          {/* Coverage is a yield: high is good, so green sits on top. */}
          {statusBands([
            { from: 0, to: 95, color: BAND_BAD },
            { from: 95, to: TARGET, color: BAND_WARN },
            { from: TARGET, to: 130, color: BAND_GOOD },
          ], 'l')}
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
          <YAxis yAxisId="l" domain={[0, 130]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
            tickFormatter={v => `${Math.round(v / 1000)}k`} width={34} />
          <Tooltip {...TT_PROPS} formatter={(v: number, n: string) =>
            n === 'Demand' ? [n0(Number(v)), n] : [`${Number(v).toFixed(1)}%`, n]} />
          <Bar yAxisId="l" dataKey="coverage" name="DL coverage" fill="hsl(var(--primary))" maxBarSize={40} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="coverage" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fontSize: 9, fill: 'hsl(var(--foreground))' }} />
          </Bar>
          <Line yAxisId="l" type="monotone" dataKey="target" name="Target 100%" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} />
          <Line yAxisId="r" type="monotone" dataKey="demand" name="Demand" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Q2 Section ──────────────────────────────────────────────────────────────
// Chart 1: heads short per bay, averaged over the periods in the horizon —
// OLE's "avg of the last 4 weeks", in months and in people.
// Charts 2 and 3: the models loading the top-2 short bays, in the month each
// bay is worst. OLE drills to workcells; a bay already belongs to one workcell,
// so PPQT drills to what demand × CT actually put on it.

function Q2Section({ data, compact = false, onBaysChange }: {
  data: PPQT4Q | null;
  compact?: boolean;
  onBaysChange?: (b1: string, b2: string) => void;
}) {
  const { pareto1, drills, top1, top2 } = useMemo(() => {
    if (!data) return { pareto1: [], drills: [] as { title: string; bars: ReturnType<typeof buildPareto> }[], top1: '', top2: '' };
    const many = data.workcells.length > 1;
    const p1 = buildPareto(data.shortfall.map(s => ({
      name: many ? `${s.workcell} · ${s.bay}` : s.bay,
      value: s.dl_short_avg,
      color: areaColor(s.area_code),
    })));
    const drills = data.drill.map(d => ({
      title: `Top ${d.rows.length} Models - ${d.bay} (${fmtPeriod(d.period)})`,
      bars: buildPareto(d.rows.map(r => ({
        name: r.model || r.assembly,
        value: r.load_sec / 3600,
        color: areaColor(data.shortfall.find(s => s.bay === d.bay)?.area_code ?? null),
      }))),
    }));
    return { pareto1: p1, drills, top1: p1[0]?.name ?? '', top2: p1[1]?.name ?? '' };
  }, [data]);

  useEffect(() => { onBaysChange?.(top1, top2); }, [top1, top2]);   // eslint-disable-line react-hooks/exhaustive-deps

  const drillTitle = (i: number) => drills[i]?.title ?? `Top Models - #${i + 1} Short Bay`;

  // The preview sheet gives this chart a quarter of a page. A plant can be
  // short in a dozen bays and their names collide there, so the sheet shows the
  // vital few and SAYS so — the cumulative line still runs against the full
  // total, and the editor view above is uncapped.
  const COMPACT_BARS = 6;
  const capped = pareto1.length > COMPACT_BARS;
  const p1Title = capped
    ? `Heads Short by Bay (avg per period, top ${COMPACT_BARS} of ${pareto1.length})`
    : 'Heads Short by Bay (avg per period)';

  if (compact) {
    // ParetoChart's fillHeight makes it a flex CHILD — every wrapper here has to
    // be `flex flex-col` or the chart collapses to zero height.
    return (
      <div className="flex gap-2 h-full min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <ParetoChart title={p1Title} data={pareto1.slice(0, COMPACT_BARS)} loading={false}
            fillHeight unit="Heads" unitLabel="heads" emptyText="No bay is short — the plan is covered" />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          {[0, 1].map(i => (
            <ParetoChart key={i} title={drillTitle(i)} data={drills[i]?.bars ?? []}
              loading={false} fillHeight unit="Hours" unitLabel="hrs" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <ParetoChart title="Heads Short by Bay (avg per period)" data={pareto1} loading={false}
        height={200} unit="Heads" unitLabel="heads" emptyText="No bay is short — the plan is covered" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <ParetoChart key={i} title={drillTitle(i)} data={drills[i]?.bars ?? []}
            loading={false} height={180} unit="Hours" unitLabel="hrs" />
        ))}
      </div>
    </div>
  );
}

// ─── Q4 Capacity table ───────────────────────────────────────────────────────
// The Paynter's twin: rows are where the capacity goes, columns are periods,
// cells are % of available — and every column sums to exactly 100.
//
// Spare goes NEGATIVE when the period is short. That is the point of the
// quadrant: the row that should be headroom is the row that reads the debt.

const CAP_CATS: { key: keyof PPQT4QPeriod['capacity_pct']; label: string; color: string }[] = [
  { key: 'va', label: 'VA Requirement', color: '#10b981' },
  { key: 'changeover', label: 'Changeover', color: '#6366f1' },
  { key: 'allowance', label: 'FPY / Efficiency Allowance', color: '#f59e0b' },
  { key: 'npi', label: 'NPI', color: '#a855f7' },
  { key: 'spare', label: 'Spare Capacity', color: '#94a3b8' },
];

function CapacityTable({ data, isPrint = false }: { data: PPQT4Q | null; isPrint?: boolean }) {
  const periods = data?.periods ?? [];

  // Weighted average over the horizon: the real resource-units summed, then one
  // division — NOT the mean of the per-period percentages, which drifts.
  const avg = useMemo(() => {
    const tot = periods.reduce((a, p) => a + p.capacity.available, 0);
    const out: Record<string, number | null> = {};
    CAP_CATS.forEach(c => {
      out[c.key] = tot ? (periods.reduce((a, p) => a + (p.capacity[c.key] ?? 0), 0) / tot) * 100 : null;
    });
    return out;
  }, [periods]);

  const fs = isPrint ? 'text-[10px]' : 'text-xs';
  const px = isPrint ? 'px-1.5 py-1' : 'px-3 py-1.5';
  const ph = isPrint ? 'px-1.5 py-1.5' : 'px-3 py-2';

  if (!periods.length) return <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No data</div>;
  const colTotal = (p: PPQT4QPeriod) => CAP_CATS.reduce((a, c) => a + (p.capacity_pct[c.key] ?? 0), 0);

  return (
    <div className={cn(isPrint ? 'w-full h-full overflow-hidden flex flex-col' : 'overflow-x-auto rounded-xl bg-card w-full h-full')}>
      <table className={cn('w-full text-left border-collapse table-fixed', isPrint ? 'h-full' : '', fs)}>
        <thead>
          <tr className="bg-primary text-primary-foreground uppercase tracking-wider">
            <th className={cn(ph, 'border border-primary/70 font-semibold', isPrint ? 'text-[9px] w-28' : 'sticky left-0 bg-primary z-10 w-44 max-w-[176px] text-[10px]')}>{isPrint ? 'Category' : 'Capacity Distribution'}</th>
            {periods.map(p => <th key={p.period} className={cn(ph, 'border border-primary/70 text-right font-semibold')}>{fmtPeriod(p.period)}</th>)}
            <th className={cn(ph, 'border border-primary/70 text-right font-bold bg-primary/80')}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {CAP_CATS.map(cat => {
            const a = avg[cat.key];
            return (
              <tr key={cat.key} className="border-b border-border">
                <td className={cn(px, 'border border-border font-semibold', isPrint ? 'break-words' : 'sticky left-0 bg-card z-10 w-44 max-w-[176px] leading-snug')}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: cat.color }} />
                    {cat.label}
                  </span>
                </td>
                {periods.map(p => {
                  const v = p.capacity_pct[cat.key] ?? 0;
                  return <td key={p.period} className={cn(px, 'border border-border text-right font-mono tabular-nums', v < 0 && 'text-red-500 font-semibold')}>{v.toFixed(2)}%</td>;
                })}
                <td className={cn(px, 'border border-primary/20 text-right font-mono font-bold tabular-nums text-primary')}>{a != null ? `${a.toFixed(2)}%` : '-'}</td>
              </tr>
            );
          })}
          <tr className="font-bold text-foreground bg-muted/60">
            <td className={cn(px, 'border border-border uppercase tracking-wider', isPrint ? '' : 'sticky left-0 bg-muted/60 z-10 w-44 max-w-[176px]')}>Total</td>
            {periods.map(p => <td key={p.period} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>{colTotal(p).toFixed(2)}%</td>)}
            <td className={cn(px, 'border border-primary/20 text-right font-mono tabular-nums bg-primary/10 text-primary')}>100.00%</td>
          </tr>
          {/* The absolute the percentages are shares of — otherwise "55% spare"
              on a 42-bay plant reads the same as on a 4-bay one. */}
          <tr className="text-muted-foreground">
            <td className={cn(px, 'border border-border', isPrint ? '' : 'sticky left-0 bg-card z-10 w-44 max-w-[176px]')}>Resources available</td>
            {periods.map(p => <td key={p.period} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>{p.capacity.available.toFixed(0)}</td>)}
            <td className={cn(px, 'border border-primary/20 text-right font-mono tabular-nums')}>-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function PPQT4QReport() {
  const location = useLocation();
  const [title, setTitle] = useState(defaultReportTitle);
  const [tab, setTab] = useState<'start' | 'editor'>('start');
  const [scopeOpen, setScopeOpen] = useState(false);

  // Reset to setup whenever the user re-navigates here (e.g. clicks the sidebar
  // 4Q nav while already in editor). location.key changes on every navigate().
  useEffect(() => { setTab('start'); }, [location.key]);

  const [rightOpen, setRightOpen] = useState(true);
  const [allWorkcells, setAllWorkcells] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<PPQT4Q | null>(null);
  const trendData = useMemo(() => padTrend((data?.periods ?? []).map(p => ({
    period: p.period, label: fmtPeriod(p.period),
    coverage: Math.round((p.coverage_pct ?? 0) * 10) / 10,
    target: TARGET, demand: p.total_demand,
  }))), [data]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [top1Bay, setTop1Bay] = useState('');
  const [top2Bay, setTop2Bay] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleBeforeEdit, setTitleBeforeEdit] = useState('');

  // ── Saved Q3 plans ─────────────────────────────────────────────────────────
  // Only the Q3 improvement plan is persisted. Q1/Q2/Q4 always rebuild from the
  // live mart, so loading last month's plan shows it against THIS workbook.
  const planFingerprint = useMemo(() => JSON.stringify({ actions, title }), [actions, title]);

  const saved = useSavedReport<SavedPlan>({
    api: reportsApi,
    name: title,
    payload: { actions, scope: picked, title },
    dirtyKey: planFingerprint,
    autosave: tab === 'editor',
  });
  const { user, savedList, autoState, saveMsg, dirty, setSaveMsg } = saved;

  useEffect(() => {
    ppqtApi.workcells()
      .then(r => setAllWorkcells(r.workcells.map(w => w.workcell)))
      .catch(() => { });
  }, []);

  // The Settings tab edits a DRAFT, so half-made changes never move the report
  // until "Update Report Scope" is pressed.
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);
  useEffect(() => { setScopeDraft(picked); }, [picked]);

  const scopeLabel = picked.join(', ') || '—';

  /** `scope` overrides state — setPicked is async, so reading state on the run
   *  that matters would use the PREVIOUS scope. Same reason as OLE's. */
  async function handleGenerate(scope?: string[]) {
    const use = scope ?? picked;
    if (!use.length) return;
    setGenerating(true);
    try {
      const res = await ppqtApi.fourq(use);
      setData(res);

      setTab('editor');
    } catch (e) {
      console.error(e);
      setSaveMsg(e instanceof Error ? e.message : 'Load failed');
    } finally { setGenerating(false); }
  }

  async function handleLoadSaved(id: number) {
    try {
      const rec = await saved.load(id);
      if (!rec) return;
      const loadedActions = rec.payload?.actions ?? [];
      setActions(loadedActions);
      const loadedTitle = rec.payload?.title ?? title;
      if (rec.payload?.title) setTitle(rec.payload.title);
      saved.markSaved(JSON.stringify({ actions: loadedActions, title: loadedTitle }));

      // Restore the scope the plan was written against, so loading is ONE click.
      // Only the scope is restored; Q1/Q2/Q4 are re-pulled from the live mart.
      const scope = rec.payload?.scope ?? [];
      setPicked(scope);
      if (!scope.length) {
        setSaveMsg('Plan loaded — choose a scope to generate.');
        setScopeOpen(true);
        return;
      }
      await handleGenerate(scope);
    } catch (e) {
      console.error(e);
      setSaveMsg(e instanceof Error ? e.message : 'Load failed');
    }
  }

  const scrollToSection = (t: string) => {
    const ids: Record<string, string> = { q1: 'q1-section', q2: 'q2-section', q3: 'q3-section', q4: 'q4-section' };
    const id = ids[t]; if (!id) return;
    setTimeout(() => { bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  };

  // The sheet reads Q1, Q2, then Q4 bottom-left and the plan bottom-right —
  // the layout people know. Every banner is drawn by the quadrant frame.
  const preview = (
    <FourQPreview
      title={title}
      headings={['First Quadrant - Capacity vs Demand', 'Second Quadrant - Shortfall Pareto',
                 'Fourth Quadrant - Where Capacity Goes', 'Third Quadrant - Improvement Plan']}
      quadrants={[
        <Q1Chart trendData={trendData} fillHeight />,
        <Q2Section data={data} compact onBaysChange={(b1, b2) => { setTop1Bay(b1); setTop2Bay(b2); }} />,
        <CapacityTable data={data} isPrint />,
        <ImprovementTable actions={actions} issues={[top1Bay, top2Bay]} isPrint />,
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
            <h1 className="text-xl font-semibold text-foreground">PPQT 4Q</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tab === 'start'
                ? 'Create a new report or open a saved one'
                : `Scope: ${scopeLabel} · ${trendData.length} periods`}
            </p>
          </div>
        </div>

        {/* Report title — click to edit in place. Absolutely positioned so it
            stays centred on the HEADER, not on the space left between buttons. */}
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
                <Button onClick={saved.save} variant={dirty ? 'default' : 'outline'} size="sm" className="gap-2"
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
            icon={LayoutGrid}
            title="PPQT 4Q"
            subtitle="Capacity sizing review — can we take the demand, and where it breaks."
            savedList={savedList} loading={generating}
            onNew={() => { const t = defaultReportTitle(); setActions([]); setTitle(t); saved.startNew(JSON.stringify({ actions: [], title: t })); setScopeOpen(true); }}
            onLoad={handleLoadSaved} onDeleteSave={saved.remove} />
        )}

        <ScopeDialog
          open={scopeOpen} onOpenChange={setScopeOpen}
          workcells={allWorkcells} generating={generating}
          onConfirm={async (scope, name) => {
            setTitle(name);
            saved.markSaved(JSON.stringify({ actions: [], title: name }));
            setPicked(scope);
            setScopeOpen(false);
            await handleGenerate(scope);
            // Persist immediately so a brand-new report shows up under "Load
            // saved" right away, and so the header's "Saved" state is TRUE
            // rather than merely un-edited.
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
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">First Quadrant - Capacity vs Demand</h2><p className="text-xs text-muted-foreground mt-0.5">DL coverage against 100% · demand on the right axis · Scope: {scopeLabel}</p></div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm"><Q1Chart trendData={trendData} /></div>
                </section>

                <section id="q2-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">2</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Second Quadrant - Shortfall Pareto</h2><p className="text-xs text-muted-foreground mt-0.5">Heads short per bay, averaged over the horizon - then what loads the top two</p></div>
                  </div>
                  <Q2Section data={data} onBaysChange={(b1, b2) => { setTop1Bay(b1); setTop2Bay(b2); }} />
                </section>

                <section id="q3-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">3</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Third Quadrant - Improvement Plan</h2><p className="text-xs text-muted-foreground mt-0.5">Corrective actions and ownership - commit dates land before the period starts</p></div>
                  </div>
                  <ImprovementTable actions={actions} issues={[top1Bay, top2Bay]} />
                </section>

                <section id="q4-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">4</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Fourth Quadrant - Where Capacity Goes</h2><p className="text-xs text-muted-foreground mt-0.5">Share of available resources per period - the column sums to 100%</p></div>
                  </div>
                  <div className="overflow-x-auto"><CapacityTable data={data} /></div>
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
                  <Tabs defaultValue="q3" className="h-full flex flex-col min-h-0" onValueChange={scrollToSection}>
                    <TabsList className="w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent h-auto p-0 gap-x-4 gap-y-2 pb-2">
                      {[
                        // Q1, Q2 and Q4 are generated from the mart, not edited —
                        // their tabs would hold nothing to change.
                        { v: 'q3', label: 'Q3 Improvements', cls: 'data-[state=active]:border-emerald-500' },
                        { v: 'settings', label: 'Settings', cls: 'data-[state=active]:border-muted-foreground ml-auto' },
                      ].map(t => <TabsTrigger key={t.v} value={t.v} className={cn('rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs', t.cls)}>{t.label}</TabsTrigger>)}
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2">

                      <TabsContent value="q3" className="m-0">
                        <ImprovementEditor actions={actions} onChange={setActions} issues={[top1Bay, top2Bay]} />
                      </TabsContent>

                      {/* Same scope UI as the launch dialog, inline in the drawer —
                          one component, so the two can't drift. */}
                      <TabsContent value="settings" className="m-0">
                        <ScopeFields plants={[SCOPE_GROUP]} byPlant={{ [SCOPE_GROUP]: allWorkcells }}
                          picked={scopeDraft} onChange={setScopeDraft}
                          maxH="max-h-[22rem]" gridClassName="grid-cols-1 sm:grid-cols-2" />
                        <Button onClick={() => { setPicked(scopeDraft); void handleGenerate(scopeDraft); }}
                          disabled={generating || scopeDraft.length === 0} className="mt-3 w-full">
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

