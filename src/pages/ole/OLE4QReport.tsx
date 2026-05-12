import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OleWeeklyResult, OleWorkcellConfig } from '@/lib/ole/oleApi';
import { oleApi } from '@/lib/ole/oleApi';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Download, Eye, EyeOff, GripVertical, Info, Plus, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type SetupMode = 'plant' | 'workcell';
type ActionItem = { id: string; issue: string; problemDescription: string; rootCause: string; containmentAction: string; correctiveAction: string; impactPct: string; ecnPcn: string; fia: string; responsible: string; commitDate: string; status: string; };
type TrendPoint = { id: string; label: string; ole: number; target: number; projected?: boolean; hidden?: boolean };

const genId = () => Math.random().toString(36).substr(2, 9);

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

// ─── DatePicker ───────────────────────────────────────────────────────────────

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const [y, mo, d] = s.trim().split('-').map(Number);
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

function DatePickerField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (ymd: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);
  return (
    <div className="w-full">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className={cn('mt-1 w-full h-7 justify-start text-left font-normal px-2 text-xs shadow-none', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{date ? format(date, 'MMM d, yyyy') : 'Any date'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date} onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }} initialFocus />
          {value && <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => { onChange(''); setOpen(false); }}>Clear date</Button></div>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Pareto helpers ───────────────────────────────────────────────────────────

interface ParetoBar { name: string; value: number; color: string; cum: number; }

function buildPareto(data: { name: string; value: number; color: string }[]): ParetoBar[] {
  const sorted = data.map(x => ({ ...x, value: Math.abs(x.value) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  let cum = 0;
  return sorted.map(x => { cum += x.value; return { ...x, cum: total > 0 ? Math.min((cum / total) * 100, 100) : 0 }; });
}

// ─── Setup Step ───────────────────────────────────────────────────────────────

function SetupStep({ workcellConfigs, mode, setMode, selectedPlants, setSelectedPlants, selectedWorkcells, setSelectedWorkcells, onGenerate, generating, plants, byPlant }: {
  workcellConfigs: OleWorkcellConfig[]; mode: SetupMode; setMode: (m: SetupMode) => void;
  selectedPlants: string[]; setSelectedPlants: (p: string[]) => void;
  selectedWorkcells: string[]; setSelectedWorkcells: (w: string[]) => void;
  onGenerate: () => void; generating: boolean; plants: string[]; byPlant: Record<string, string[]>;
}) {
  const canGen = (mode === 'plant' && selectedPlants.length > 0) || (mode === 'workcell' && selectedWorkcells.length > 0);
  const togglePlant = (p: string) => setSelectedPlants(selectedPlants.includes(p) ? selectedPlants.filter(x => x !== p) : [...selectedPlants, p]);
  const toggleWC = (wc: string) => setSelectedWorkcells(selectedWorkcells.includes(wc) ? selectedWorkcells.filter(x => x !== wc) : [...selectedWorkcells, wc]);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const calc = () => setZoom(Math.min(1, Math.max(0.8, (window.innerHeight - 72) / 720)));
    calc(); window.addEventListener('resize', calc); return () => window.removeEventListener('resize', calc);
  }, []);
  return (
    <div className="flex-1 flex items-center justify-center p-4 lg:p-8 overflow-y-auto min-h-0">
      <div className="w-full max-w-lg space-y-4 lg:space-y-6" style={{ zoom }}>
        <div className="text-center">
          <div className="h-9 w-9 lg:h-12 lg:w-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-2 lg:mb-4"><Settings className="h-5 w-5 lg:h-6 lg:w-6 text-primary" /></div>
          <h2 className="text-lg lg:text-xl font-bold text-foreground">Setup 4Q Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose the scope for your trend data</p>
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['plant', 'workcell'] as SetupMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} className={cn('flex-1 py-2 text-sm font-medium transition-colors', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>{m === 'plant' ? 'By Plant' : 'By Workcell'}</button>
          ))}
        </div>
        {mode === 'plant' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Select Plants <span className="text-primary">({selectedPlants.length} selected)</span></Label>
            <div className="flex gap-3">
              {plants.map(p => (
                <button key={p} onClick={() => togglePlant(p)} className={cn('flex-1 py-2 px-3 rounded-xl border text-sm font-semibold transition-all', selectedPlants.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                  {p}<p className="text-[10px] font-normal mt-0.5 opacity-70">{byPlant[p]?.length ?? 0} workcells</p>
                </button>
              ))}
            </div>
            {selectedPlants.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">Included Workcells</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {selectedPlants.flatMap(p => byPlant[p] ?? []).map((wc, i) => (
                    <div key={wc} className="flex gap-2 text-[11px] text-foreground/80 tabular-nums">
                      <span className="text-muted-foreground font-medium w-4 shrink-0">{i + 1}.</span>
                      <span className="truncate">{wc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {mode === 'workcell' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Select Workcells <span className="text-primary">({selectedWorkcells.length} selected)</span></Label>
            <div className="space-y-3">
              {plants.map(p => (
                <div key={p}>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">{p}</p>
                  <div className="flex flex-wrap gap-2">
                    {byPlant[p]?.map(wc => (
                      <button key={wc} onClick={() => toggleWC(wc)} className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all', selectedWorkcells.includes(wc) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>{wc}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
          <span>Trend uses latest <strong className="text-foreground">13 weeks</strong>. Q2 Paretos use last <strong className="text-foreground">4 actual weeks</strong> averaged.</span>
        </div>
        <button onClick={onGenerate} disabled={!canGen || generating} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {generating ? 'Loading data...' : 'Generate 4Q Report ->'}
        </button>
      </div>
    </div>
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

// ─── Q2 SmallPareto ───────────────────────────────────────────────────────────

const WrappedTick = ({ x, y, payload }: any) => {
  const words: string[] = String(payload.value).split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length >= 9) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  return (
    <g transform={`translate(${x},${y + 2})`}>
      {lines.slice(0, 2).map((line, i) => <text key={i} x={0} y={0} dy={i * 10} textAnchor="middle" fontSize={8.5} fill="hsl(var(--muted-foreground))">{line}</text>)}
    </g>
  );
};

function SmallPareto({ title, data, loading, height = 180, fillHeight = false }: { title: string; data: ParetoBar[]; loading: boolean; height?: number; fillHeight?: boolean }) {
  if (loading) return <div className={cn('rounded-lg bg-muted/40 animate-pulse', fillHeight ? 'flex-1 min-h-0' : '')} style={fillHeight ? undefined : { height }} />;
  if (!data.length) return <div className={cn('flex items-center justify-center border border-border rounded-lg text-xs text-muted-foreground', fillHeight ? 'flex-1 min-h-0' : '')} style={fillHeight ? undefined : { height }}>No data</div>;
  return (
    <div className={cn('border border-border rounded-lg flex flex-col', fillHeight ? 'flex-1 min-h-0 p-0 gap-0 bg-card' : 'p-2 gap-1 bg-card')}>
      <p className={cn('text-[10px] font-semibold text-foreground flex-shrink-0', fillHeight ? 'px-1.5 pt-1' : '')}>{title}</p>
      <div className={fillHeight ? 'flex-1 min-h-0' : ''} style={fillHeight ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 18, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={24} tick={<WrappedTick />} />
            <YAxis yAxisId="left" domain={[0, (max: number) => max * 1.2]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip {...TT_PROPS} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} />
            <Bar yAxisId="left" dataKey="value" name="Share %" radius={[3, 3, 0, 0]} maxBarSize={40}>
              <LabelList dataKey="value" position="top" offset={8} formatter={(v: number) => `${v.toFixed(0)}%`} style={{ fontSize: 9, fill: 'hsl(var(--foreground))' }} />
              {data.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="Cumulative %" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Q2 Section ──────────────────────────────────────────────────────────────
// Derives directly from PAYNTER_CATS + buildPaynterRow -- same math as Q4.
// Chart 1: avg of last 4 weeks Paynter values (same as the Avg column in Q4 table).
// Chart 2: top 3 workcells by #1 loss category.
// Chart 3: top 3 workcells by #2 loss category.

function wcNameSeed(name: string): number {
  return Math.abs(name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 52 + 1;
}

function Q2Section({ aggregateRows, weeklyRows, compact = false, onCatsChange }: {
  aggregateRows: OleWeeklyResult[];
  weeklyRows: OleWeeklyResult[];
  compact?: boolean;
  onCatsChange?: (c1: string, c2: string) => void;
}) {
  const { pareto1, pareto2, pareto3, top1Cat, top2Cat } = useMemo(() => {
    const last4 = aggregateRows
      .filter(r => r.ole_pct !== null)
      .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week)
      .slice(-4);

    if (!last4.length) return { pareto1: [], pareto2: [], pareto3: [], top1Cat: '', top2Cat: '' };

    // Chart 1: avg Paynter category values -- mirrors the Avg column in Q4
    const catAvgs = PAYNTER_CATS.map(cat => {
      const avg = last4.reduce((s, w) => s + (buildPaynterRow(w.iso_week, w.ole_pct)[cat.key] ?? 0), 0) / last4.length;
      return { name: cat.label, value: parseFloat(avg.toFixed(2)), color: cat.color };
    });
    const p1 = buildPareto(catAvgs);
    const top1 = p1[0]?.name ?? '';
    const top2 = p1[1]?.name ?? '';

    // Per-workcell OLE for last 4 weeks
    const last4Labels = new Set(last4.map(w => w.week_label));
    const wcMap = new Map<string, { smh: number; hrs: number }>();
    weeklyRows.filter(r => last4Labels.has(r.week_label)).forEach(r => {
      const acc = wcMap.get(r.workcell) ?? { smh: 0, hrs: 0 };
      wcMap.set(r.workcell, { smh: acc.smh + r.total_output_smh, hrs: acc.hrs + r.total_input_hours });
    });

    const shortName = (wc: string) => wc.length > 12 ? wc.slice(0, 12) + '...' : wc;
    const top1Key = PAYNTER_CATS.find(c => c.label === top1)?.key ?? '';
    const top2Key = PAYNTER_CATS.find(c => c.label === top2)?.key ?? '';
    const top1Color = PAYNTER_CATS.find(c => c.label === top1)?.color ?? '#94a3b8';
    const top2Color = PAYNTER_CATS.find(c => c.label === top2)?.color ?? '#94a3b8';

    // Each workcell gets a stable seed from its name for consistent distribution
    const wcEntries = [...wcMap.entries()].map(([wc, { smh, hrs }]) => ({
      wc, vals: buildPaynterRow(wcNameSeed(wc), hrs > 0 ? (smh / hrs) * 100 : 0),
    }));

    const top3 = (key: string, color: string) => buildPareto(
      wcEntries
        .map(({ wc, vals }) => ({ name: shortName(wc), value: parseFloat((vals[key] ?? 0).toFixed(2)), color }))
        .filter(x => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
    );

    return { pareto1: p1, pareto2: top3(top1Key, top1Color), pareto3: top3(top2Key, top2Color), top1Cat: top1, top2Cat: top2 };
  }, [aggregateRows, weeklyRows]);

  useEffect(() => { onCatsChange?.(top1Cat, top2Cat); }, [top1Cat, top2Cat, onCatsChange]);

  if (compact) {
    return (
      <div className="flex gap-2 h-full min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <SmallPareto title="Man-hrs Loss Distribution" data={pareto1} loading={false} fillHeight />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <SmallPareto title={`Top 3 Workcells - ${top1Cat || '#1 Loss'}`} data={pareto2} loading={false} fillHeight />
          <SmallPareto title={`Top 3 Workcells - ${top2Cat || '#2 Loss'}`} data={pareto3} loading={false} fillHeight />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SmallPareto title="Man-hrs Loss Distribution" data={pareto1} loading={false} height={200} />
      <div className="grid grid-cols-2 gap-3">
        <SmallPareto title={`Top 3 Workcells - ${top1Cat || '#1 Loss'}`} data={pareto2} loading={false} height={180} />
        <SmallPareto title={`Top 3 Workcells - ${top2Cat || '#2 Loss'}`} data={pareto3} loading={false} height={180} />
      </div>
    </div>
  );
}

// ─── Q4 Paynter Chart ────────────────────────────────────────────────────────

const PAYNTER_CATS = [
  { key: 'lunch', label: 'Lunch, Break time', color: '#94a3b8', share: 0.136 },
  { key: 'mfg_manh', label: 'Mfg ManH. Lost', color: '#f59e0b', share: 0.383 },
  { key: 'nva_input', label: 'NVA Input', color: '#ef4444', share: 0.456 },
  { key: 'support_dt', label: 'Support DT', color: '#6366f1', share: 0.025 },
];

function seededRand(seed: number, idx: number): number {
  const x = Math.sin(seed * 9301 + idx * 49297 + 233) * 8393;
  return x - Math.floor(x);
}

function buildPaynterRow(isoWeek: number, olePct: number | null): Record<string, number> {
  const loss = olePct != null ? Math.max(0, 100 - olePct) : 0;
  if (loss === 0) return Object.fromEntries(PAYNTER_CATS.map(c => [c.key, 0]));
  const raw = PAYNTER_CATS.map((c, i) => c.share * (0.80 + seededRand(isoWeek, i) * 0.40));
  const sum = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(PAYNTER_CATS.map((c, i) => [c.key, parseFloat(((raw[i] / sum) * loss).toFixed(2))]));
}

interface MhWeekData { week_label: string; values: Record<string, number>; total: number; }

function PaynterTable({ aggregateRows, isPrint = false }: { aggregateRows: OleWeeklyResult[]; isPrint?: boolean }) {
  const weekData = useMemo((): MhWeekData[] =>
    aggregateRows
      .filter(r => r.ole_pct !== null)
      .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week)
      .map(r => {
        const vals = buildPaynterRow(r.iso_week, r.ole_pct);
        return { week_label: r.week_label, values: vals, total: parseFloat(Object.values(vals).reduce((a, b) => a + b, 0).toFixed(2)) };
      }),
    [aggregateRows]);

  const last4 = weekData.slice(-4);
  const avg4 = (key: string) => last4.length ? parseFloat((last4.reduce((s, w) => s + (w.values[key] ?? 0), 0) / last4.length).toFixed(2)) : null;
  const avgTotal = last4.length ? parseFloat((last4.reduce((s, w) => s + w.total, 0) / last4.length).toFixed(2)) : null;
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
            <th className={cn(ph, 'border border-primary/70 text-right font-bold bg-primary/80')}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {PAYNTER_CATS.map(cat => {
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

// ─── Q3 Improvement Plan ─────────────────────────────────────────────────────

function ImprovementTable({ actions, isPrint = false, top1Cat = '', top2Cat = '' }: { actions: ActionItem[]; isPrint?: boolean; top1Cat?: string; top2Cat?: string }) {
  const sz = isPrint ? 'text-[10px]' : 'text-xs';
  const ph = isPrint ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const pd = isPrint ? 'px-1.5 py-1.5' : 'px-2 py-2';
  const issueOrder: string[] = [];
  [top1Cat, top2Cat].filter(Boolean).forEach(c => { if (!issueOrder.includes(c)) issueOrder.push(c); });
  actions.forEach(a => { if (a.issue && !issueOrder.includes(a.issue)) issueOrder.push(a.issue); });
  const groups = issueOrder.map(issue => ({ issue, rows: actions.filter(a => a.issue === issue) })).filter(g => g.rows.length > 0);
  const ungrouped = actions.filter(a => !a.issue);
  const sBadge = (s: string) => cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border',
    s?.toLowerCase() === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
      s?.toLowerCase() === 'closed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
        s?.toLowerCase() === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-muted text-muted-foreground border-border');
  const COLS = [
    { label: 'Issue', th: 'sticky left-0 bg-primary z-10 w-20 max-w-[80px]' },
    { label: 'Problem Description', th: 'min-w-[100px]' }, { label: 'Root Cause', th: 'min-w-[90px]' },
    { label: 'Containment Action', th: 'min-w-[90px]' }, { label: 'Corrective & Preventive Actions', th: 'min-w-[90px]' },
    { label: 'Impact vs Overall', th: 'w-14 text-center' }, { label: 'ECN PCN NA', th: 'w-14 text-center' },
    { label: 'FIA - NA', th: 'w-14 text-center' }, { label: 'Responsible', th: 'w-16' },
    { label: 'Commit Date', th: 'w-16' }, { label: 'Status', th: 'w-14' },
  ];
  const renderDataCells = (a: ActionItem) => <>
    <td className={cn(pd, 'border border-border min-w-[100px]')}>{a.problemDescription || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.rootCause || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.containmentAction || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.correctiveAction || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.impactPct || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.ecnPcn || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.fia || '-'}</td>
    <td className={cn(pd, 'border border-border w-16')}>{a.responsible || '-'}</td>
    <td className={cn(pd, 'border border-border font-mono w-16')}>{a.commitDate || '-'}</td>
    <td className={cn(pd, 'border border-border w-14')}><span className={sBadge(a.status)}>{a.status || 'Open'}</span></td>
  </>;
  return (
    <div className={cn('overflow-x-auto rounded-xl w-full', !isPrint && 'bg-card')}>
      <table className={cn('w-full text-left border-collapse', sz)}>
        <thead>
          {isPrint && <tr><th colSpan={11} className="text-center py-1 text-[8px] font-bold uppercase text-primary-foreground bg-primary border-0">Third Quadrant - Improvement Plan</th></tr>}
          <tr className="bg-primary text-primary-foreground uppercase">
            {COLS.map(c => <th key={c.label} className={cn(ph, 'border border-primary/70 font-semibold leading-snug text-[8px]', c.th)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && ungrouped.length === 0
            ? <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground text-xs italic">No actions added - use the editor panel to add corrective actions</td></tr>
            : <>
              {groups.map(({ issue, rows }) => rows.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  {ri === 0 && <td rowSpan={rows.length} className={cn(pd, 'border border-primary/70 font-semibold sticky left-0 bg-primary/10 z-10 w-20 max-w-[80px] align-middle leading-snug')}>{issue}</td>}
                  {renderDataCells(a)}
                </tr>
              )))}
              {ungrouped.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  <td className={cn(pd, 'border border-border sticky left-0 bg-card z-10 w-20')}>-</td>
                  {renderDataCells(a)}
                </tr>
              ))}
            </>}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLE4QReport() {
  const [title, setTitle] = useState('Weekly OLE Performance Review');
  const [tab, setTab] = useState<'setup' | 'editor'>('setup');
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
  const [top1Cat, setTop1Cat] = useState('');
  const [top2Cat, setTop2Cat] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

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

  async function handleGenerate() {
    setGenerating(true);
    try {
      let rows: OleWeeklyResult[] = []; let label = '';
      if (mode === 'plant') { const res = await Promise.all(selectedPlants.map(p => oleApi.ole.weekly({ plant: p }))); rows = res.flat(); label = selectedPlants.join(' + '); }
      else { const res = await Promise.all(selectedWorkcells.map(wc => oleApi.ole.weekly({ workcell: wc }))); rows = res.flat(); label = selectedWorkcells.join(', '); }
      setWeeklyRows(rows); setTrendScope(label);
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

  const PreviewModal = () => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    async function handleDownload() {
      if (!canvasRef.current) return; setDownloading(true);
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
        const link = document.createElement('a'); link.download = `4Q-Report-${title.replace(/\s+/g, '-')}.png`; link.href = dataUrl; link.click();
      } catch (e) { console.error('Download failed', e); } finally { setDownloading(false); }
    }
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="gap-2"><Eye className="w-4 h-4" /> Preview Report</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] p-0 flex flex-col gap-0 border border-border bg-card shadow-2xl rounded-xl overflow-hidden">
          <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-2 flex-shrink-0 h-8 px-3">
              <Download className="w-3.5 h-3.5" />{downloading ? 'Capturing...' : 'Download Image'}
            </Button>
            <div className="flex-1 min-w-0"><h2 className="font-semibold text-sm leading-tight">Report Preview</h2><p className="text-xs text-muted-foreground">PNG download at 2x resolution</p></div>
            <div className="w-10 flex-shrink-0" />
          </div>
          <div className="flex-1 overflow-hidden bg-muted/40 min-h-0">
            <div ref={canvasRef} className="bg-card text-foreground h-full w-full flex flex-col overflow-hidden" style={{ minWidth: 900 }}>
              <div className="flex items-center justify-between flex-shrink-0 px-4 py-1.5">
                <h1 className="text-sm font-bold uppercase tracking-wide">{title}</h1>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">JABIL 4Q REPORT</span>
              </div>
              <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0 overflow-hidden">
                <div className="border border-border bg-card rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center -mx-3 -mt-3 px-3 py-1.5 rounded-t-lg bg-primary mb-2 flex-shrink-0"><span className="flex-1 text-center text-xs font-bold uppercase text-primary-foreground">First Quadrant - OLE Trend</span></div>
                  <div className="flex-1 min-h-0"><Q1Chart trendData={trendData} fillHeight /></div>
                </div>
                <div className="border border-border bg-card rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center -mx-3 -mt-3 px-3 py-1.5 rounded-t-lg bg-primary mb-2 flex-shrink-0"><span className="flex-1 text-center text-xs font-bold uppercase text-primary-foreground">Second Quadrant - Pareto Four Weeks</span></div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <Q2Section aggregateRows={aggregateRows} weeklyRows={weeklyRows} compact onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }} />
                  </div>
                </div>
                <div className="border border-border bg-card rounded-lg overflow-hidden min-h-0 flex flex-col items-start">
                  <PaynterTable aggregateRows={aggregateRows} isPrint />
                </div>
                <div className="border border-border bg-card rounded-lg overflow-hidden min-h-0 flex flex-col">
                  <ImprovementTable actions={actions} top1Cat={top1Cat} top2Cat={top2Cat} isPrint />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">4Q Generator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{tab === 'setup' ? 'Set up scope to generate trend data' : `Scope: ${trendScope} · ${trendData.filter(p => !p.hidden).length} weeks visible`}</p>
          </div>
          {tab === 'editor' && <button onClick={() => setTab('setup')} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">&larr; Change Scope</button>}
        </div>
        {tab === 'editor' && <PreviewModal />}
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {tab === 'setup' && (
          <SetupStep workcellConfigs={workcellConfigs} mode={mode} setMode={setMode}
            selectedPlants={selectedPlants} setSelectedPlants={setSelectedPlants}
            selectedWorkcells={selectedWorkcells} setSelectedWorkcells={setSelectedWorkcells}
            onGenerate={handleGenerate} generating={generating} plants={plants} byPlant={byPlant} />
        )}

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
                  <Q2Section aggregateRows={aggregateRows} weeklyRows={weeklyRows} onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }} />
                </section>

                <section id="q3-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">3</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Third Quadrant - Improvement Plan</h2><p className="text-xs text-muted-foreground mt-0.5">Corrective actions and ownership</p></div>
                  </div>
                  <ImprovementTable actions={actions} top1Cat={top1Cat} top2Cat={top2Cat} />
                </section>

                <section id="q4-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">4</span>
                    <div><h2 className="text-sm font-bold uppercase tracking-widest text-primary">Fourth Quadrant - Paynter Chart</h2><p className="text-xs text-muted-foreground mt-0.5">Man-hours loss distribution per week</p></div>
                  </div>
                  <div className="overflow-x-auto"><PaynterTable aggregateRows={aggregateRows} /></div>
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
                        { v: 'q2', label: 'Q2 Pareto', cls: 'data-[state=active]:border-orange-500' },
                        { v: 'q3', label: 'Q3 Improvements', cls: 'data-[state=active]:border-emerald-500' },
                        { v: 'q4', label: 'Q4 Paynter', cls: 'data-[state=active]:border-blue-500' },
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
                        <p className="text-[11px] text-muted-foreground">Derived from Paynter categories - same data as Q4. Chart 1 shows avg of last 4 weeks. Charts 2 and 3 show top 3 workcells for the top 2 loss categories.</p>
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

                      <TabsContent value="q3" className="m-0 space-y-6">
                        <p className="text-[11px] text-muted-foreground">Track corrective actions for top loss categories.</p>
                        {[top1Cat, top2Cat].map((cat, catIdx) => (
                          <div key={catIdx} className="space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-1">
                              <h3 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px]">{catIdx + 1}</span>
                                {cat || `Top Loss Category ${catIdx + 1}`}
                              </h3>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                                onClick={() => setActions([...actions, { id: genId(), issue: cat, problemDescription: '', rootCause: '', containmentAction: '', correctiveAction: '', impactPct: '', ecnPcn: '', fia: '', responsible: '', commitDate: '', status: 'Open' }])}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Action
                              </Button>
                            </div>
                            <Accordion type="multiple" className="w-full space-y-2">
                              {actions.filter(a => a.issue === cat).map(a => {
                                const gi = actions.findIndex(x => x.id === a.id);
                                const update = (fields: Partial<ActionItem>) => { const n = [...actions]; n[gi] = { ...n[gi], ...fields }; setActions(n); };
                                return (
                                  <AccordionItem key={a.id} value={a.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm group/item">
                                    <div className="flex items-center relative hover:bg-muted/20 transition-colors">
                                      <AccordionTrigger className="hover:no-underline px-4 py-3 group flex-1 [&>svg]:order-first [&>svg]:mr-3 justify-start">
                                        <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                                          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', a.status === 'Closed' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-bold text-foreground truncate">{a.problemDescription || 'New Action...'}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{a.responsible || 'No Owner'} · {a.status}</span>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); setActions(actions.filter(x => x.id !== a.id)); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                    <AccordionContent className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/20">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Problem Description</Label><Input value={a.problemDescription} onChange={e => update({ problemDescription: e.target.value })} placeholder="New Problem..." className="h-7 text-xs bg-background" /></div>
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Responsible</Label>
                                          <select value={a.responsible} onChange={e => update({ responsible: e.target.value })} className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                            <option value="">Select Owner</option>
                                            <option value="Syuhada (IE SME)">Syuhada (IE SME)</option>
                                            <option value="ChoHui (IE SME)">ChoHui (IE SME)</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Root Cause</Label><textarea value={a.rootCause} onChange={e => update({ rootCause: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]" /></div>
                                      <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Containment Action</Label><textarea value={a.containmentAction} onChange={e => update({ containmentAction: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]" /></div>
                                      <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Corrective & Preventive Actions</Label><textarea value={a.correctiveAction} onChange={e => update({ correctiveAction: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]" /></div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Impact %</Label><Input value={a.impactPct} onChange={e => update({ impactPct: e.target.value })} placeholder="e.g. 15%" className="h-7 text-xs bg-background" /></div>
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">ECN/PCN</Label><Input value={a.ecnPcn} onChange={e => update({ ecnPcn: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" /></div>
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">FIA</Label><Input value={a.fia} onChange={e => update({ fia: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" /></div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <DatePickerField id={`cd-${a.id}`} label="Commit Date" value={a.commitDate} onChange={val => update({ commitDate: val })} />
                                        <div className="space-y-1"><Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
                                          <select value={a.status} onChange={e => update({ status: e.target.value })} className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                            <option value="Open">Open</option><option value="Closed">Closed</option>
                                          </select>
                                        </div>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                            {actions.filter(a => a.issue === cat).length === 0 && (
                              <div className="py-4 border-2 border-dashed border-border rounded-xl flex items-center justify-center"><p className="text-[11px] text-muted-foreground">No actions for this category.</p></div>
                            )}
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="q4" className="m-0 space-y-2">
                        {/* <p className="text-[11px] text-muted-foreground">Derived from OLE% per week. Total = 100% - OLE%. Categories use seeded randomization calibrated to reference averages.</p>
                        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                          {PAYNTER_CATS.map(c => (
                            <div key={c.key} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="flex-1 text-muted-foreground">{c.label}</span>
                              <span className="font-mono text-[10px] text-muted-foreground/60">{(c.share * 100).toFixed(0)}% avg share</span>
                            </div>
                          ))}
                          <div className="border-t border-border pt-1.5 mt-1.5 text-xs font-semibold text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 flex-shrink-0" /><span className="flex-1">Total = 100% - OLE%</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">always balances</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-600">Numbers are seeded per week number - same values on every refresh.</div> */}
                      </TabsContent>

                      <TabsContent value="settings" className="m-0 space-y-4 max-w-sm">
                        <div className="space-y-1.5"><Label className="text-xs">Report Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" /></div>
                        <div className="pt-4 border-t border-border space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Report Scope</Label>
                            <div className="flex rounded-lg border border-border overflow-hidden">
                              {(['plant', 'workcell'] as SetupMode[]).map(m => (
                                <button key={m} onClick={() => setMode(m)} className={cn('flex-1 py-2 text-[10px] font-medium transition-colors', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>{m === 'plant' ? 'By Plant' : 'By Workcell'}</button>
                              ))}
                            </div>
                          </div>
                          {mode === 'plant' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Select Plants <span className="text-primary">({selectedPlants.length} selected)</span></Label>
                              <div className="flex gap-2">
                                {plants.map(p => (
                                  <button key={p} onClick={() => setSelectedPlants(selectedPlants.includes(p) ? selectedPlants.filter(x => x !== p) : [...selectedPlants, p])}
                                    className={cn('flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all', selectedPlants.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>{p}</button>
                                ))}
                              </div>
                            </div>
                          )}
                          {mode === 'workcell' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Select Workcells <span className="text-primary">({selectedWorkcells.length})</span></Label>
                              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                {plants.map(p => (
                                  <div key={p} className="space-y-1">
                                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">{p}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {byPlant[p]?.map(wc => (
                                        <button key={wc} onClick={() => setSelectedWorkcells(selectedWorkcells.includes(wc) ? selectedWorkcells.filter(x => x !== wc) : [...selectedWorkcells, wc])}
                                          className={cn('px-2 py-1 rounded-md border text-[10px] font-medium transition-all', selectedWorkcells.includes(wc) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>{wc}</button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <Button onClick={handleGenerate} disabled={generating || (mode === 'plant' && selectedPlants.length === 0) || (mode === 'workcell' && selectedWorkcells.length === 0)} className="w-full h-8 text-xs font-bold">
                            {generating ? 'Updating...' : 'Update Report Scope'}
                          </Button>
                        </div>
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
