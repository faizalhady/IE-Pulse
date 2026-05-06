import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OleWeeklyResult, OleWorkcellConfig } from '@/lib/oleApi';
import { oleApi } from '@/lib/oleApi';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Download, Eye, EyeOff, GripVertical, Info, Plus, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupMode = 'plant' | 'workcell';
type ActionItem = { id: string; issue: string; problemDescription: string; rootCause: string; containmentAction: string; correctiveAction: string; impactPct: string; ecnPcn: string; fia: string; responsible: string; commitDate: string; status: string; };
type TrendPoint = { id: string; label: string; ole: number; target: number; projected?: boolean; hidden?: boolean };

const genId = () => Math.random().toString(36).substr(2, 9);

const TT_PROPS = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: 4, fontWeight: 500 },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

const SLICE_COLORS: Record<string, string> = {
  'Output SMH': '#22c55e',
  'NVA Input': '#ef4444',
  'Lunch / Break': '#94a3b8',
  'MFG DT': '#f59e0b',
  'Unexplained Lost Hours': '#6366f1',
};

const LOSS_CATS = ['NVA Input', 'Lunch / Break', 'MFG DT', 'Unexplained Lost Hours'];

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
    points.push({
      week_label: `${py}-W${String(pw).padStart(2, '0')}`,
      actual: null, proj_bar: null,
      sma3: s3, sma5: s5, wma3: w3, ema_fast: ef, ema_slow: es, cma: cm, linear_reg: lr,
      projected: true,
    });
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
    id: genId(),
    label: p.week_label,
    ole: p.projected
      ? (best && p[best] != null ? Math.round((p[best] as number) * 100) / 100 : 0)
      : (p.actual ?? 0),
    target: 61,
    projected: p.projected ?? false,
  }));
}

function fmtWeekLabel(v: string): string {
  const m = v.match(/\d+$/);
  return m ? `WW${m[0].padStart(2, '0')}` : v;
}

// ─── DatePicker Helpers ──────────────────────────────────────────────────────

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3) return undefined;
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

function DatePickerField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);
  return (
    <div className="w-full">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline"
            className={cn('mt-1 w-full h-7 justify-start text-left font-normal px-2 text-xs shadow-none', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{date ? format(date, 'MMM d, yyyy') : 'Any date'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date}
            onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs"
                onClick={() => { onChange(''); setOpen(false); }}
              >Clear date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Pareto helpers ───────────────────────────────────────────────────────────

interface ParetoBar { name: string; value: number; color: string; cum: number; }

function buildPareto(data: { name: string; value: number; color: string }[]): ParetoBar[] {
  // Use absolute values — negative slices (e.g. Unexplained Lost) still represent loss magnitude
  const abs = data.map(x => ({ ...x, value: Math.abs(x.value) })).filter(x => x.value > 0);
  const sorted = abs.sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  let cum = 0;
  return sorted.map(x => {
    cum += x.value;
    return { ...x, cum: total > 0 ? Math.min((cum / total) * 100, 100) : 0 };
  });
}

// ─── Setup Step ───────────────────────────────────────────────────────────────

function SetupStep({
  workcellConfigs, mode, setMode,
  selectedPlants, setSelectedPlants,
  selectedWorkcells, setSelectedWorkcells,
  onGenerate, generating,
  plants, byPlant
}: {
  workcellConfigs: OleWorkcellConfig[];
  mode: SetupMode; setMode: (m: SetupMode) => void;
  selectedPlants: string[]; setSelectedPlants: (p: string[]) => void;
  selectedWorkcells: string[]; setSelectedWorkcells: (w: string[]) => void;
  onGenerate: () => void; generating: boolean;
  plants: string[]; byPlant: Record<string, string[]>;
}) {
  const canGen = (mode === 'plant' && selectedPlants.length > 0) || (mode === 'workcell' && selectedWorkcells.length > 0);
  const togglePlant = (p: string) => setSelectedPlants(selectedPlants.includes(p) ? selectedPlants.filter(x => x !== p) : [...selectedPlants, p]);
  const toggleWC = (wc: string) => setSelectedWorkcells(selectedWorkcells.includes(wc) ? selectedWorkcells.filter(x => x !== wc) : [...selectedWorkcells, wc]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Setup 4Q Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose the scope for your trend data</p>
        </div>
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['plant', 'workcell'] as SetupMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('flex-1 py-3 text-sm font-medium transition-colors',
                mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              {m === 'plant' ? 'By Plant' : 'By Workcell'}
            </button>
          ))}
        </div>
        {mode === 'plant' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Select Plants <span className="text-primary">({selectedPlants.length} selected)</span>
            </Label>
            <div className="flex gap-3">
              {plants.map(p => (
                <button key={p} onClick={() => togglePlant(p)}
                  className={cn('flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all',
                    selectedPlants.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                  {p}<p className="text-[10px] font-normal mt-0.5 opacity-70">{byPlant[p]?.length ?? 0} workcells</p>
                </button>
              ))}
            </div>
            {selectedPlants.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">
                  Included Workcells
                </p>

                {/* Grid container for two columns */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {selectedPlants
                    .flatMap((p) => byPlant[p] ?? [])
                    .map((wc, index) => (
                      <div key={wc} className="flex gap-2 text-[11px] text-foreground/80 tabular-nums">
                        <span className="text-muted-foreground font-medium w-4 shrink-0">
                          {index + 1}.
                        </span>
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
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Select Workcells <span className="text-primary">({selectedWorkcells.length} selected)</span>
            </Label>
            <div className="space-y-3">
              {plants.map(p => (
                <div key={p}>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">{p}</p>
                  <div className="flex flex-wrap gap-2">
                    {byPlant[p]?.map(wc => (
                      <button key={wc} onClick={() => toggleWC(wc)}
                        className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                          selectedWorkcells.includes(wc) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                        {wc}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
          <span>Trend uses latest <strong className="text-foreground">13 weeks</strong>. Q2 Paretos use last <strong className="text-foreground">4 actual weeks</strong> averaged.</span>
        </div>
        <button onClick={onGenerate} disabled={!canGen || generating}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {generating ? 'Loading data…' : 'Generate 4Q Report →'}
        </button>
      </div>
    </div>
  );
}

// ─── Q1 Chart ─────────────────────────────────────────────────────────────────

function Q1Chart({ trendData, fillHeight = false }: { trendData: TrendPoint[]; fillHeight?: boolean }) {
  const visible = trendData.filter(p => !p.hidden);
  if (!visible.length) return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data — go back to setup</div>
  );
  return (
    <div style={fillHeight ? { height: '100%' } : { height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visible} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtWeekLabel} />
          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip {...TT_PROPS} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} labelFormatter={fmtWeekLabel} />
          <Bar dataKey="ole" name="OLE %" maxBarSize={32} radius={[4, 4, 0, 0]}>
            {visible.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
          </Bar>
          <Line type="monotone" dataKey="target" name="Target 61%" stroke="#22c55e"
            strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Q2 SmallPareto ───────────────────────────────────────────────────────────

// Custom SVG tick that wraps long labels to 2 short lines instead of angling
const WrappedTick = ({ x, y, payload }: any) => {
  const words: string[] = String(payload.value).split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > 9) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 2);
  return (
    <g transform={`translate(${x},${y + 2})`}>
      {shown.map((line, i) => (
        <text key={i} x={0} y={0} dy={i * 10} textAnchor="middle" fontSize={8.5} fill="hsl(var(--muted-foreground))">
          {line}
        </text>
      ))}
    </g>
  );
};

function SmallPareto({ title, data, loading, height = 180, fillHeight = false }: {
  title: string; data: ParetoBar[]; loading: boolean; height?: number; fillHeight?: boolean;
}) {
  if (loading) return <div className={cn('rounded-lg bg-muted/40 animate-pulse', fillHeight ? 'flex-1 min-h-0' : '')} style={fillHeight ? undefined : { height }} />;
  if (!data.length) return (
    <div className={cn('flex items-center justify-center border border-border rounded-lg text-xs text-muted-foreground', fillHeight ? 'flex-1 min-h-0' : '')} style={fillHeight ? undefined : { height }}>No data</div>
  );
  return (
    <div className={cn('border border-border rounded-lg flex flex-col', fillHeight ? 'flex-1 min-h-0 p-0 gap-0 bg-card' : 'p-2 gap-1 bg-card')}>
      <p className={cn('text-[10px] font-semibold text-foreground flex-shrink-0', fillHeight ? 'px-1.5 pt-1' : '')}>{title}</p>
      <div className={fillHeight ? 'flex-1 min-h-0' : ''} style={fillHeight ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 18, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={24} tick={<WrappedTick />} />
            <YAxis yAxisId="left" domain={[0, 'auto']} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip {...TT_PROPS} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} />
            <Bar yAxisId="left" dataKey="value" name="Share %" radius={[3, 3, 0, 0]} maxBarSize={40}>
              {data.map((entry, i) => <Cell key={i} fill="hsl(var(--primary)" />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="Cumulative %"
              stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Q2 Section ───────────────────────────────────────────────────────────────

function Q2Section({ aggregateRows, scopeWorkcells, scopePlants, compact = false, onCatsChange }: {
  aggregateRows: OleWeeklyResult[];
  scopeWorkcells: string[];
  scopePlants: string[];
  compact?: boolean;
  onCatsChange?: (c1: string, c2: string) => void;
}) {
  const [pareto1, setPareto1] = useState<ParetoBar[]>([]);
  const [pareto2, setPareto2] = useState<ParetoBar[]>([]);
  const [pareto3, setPareto3] = useState<ParetoBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [top1Cat, setTop1Cat] = useState('');
  const [top2Cat, setTop2Cat] = useState('');

  useEffect(() => {
    if (!aggregateRows.length) return;
    setLoading(true);
    (async () => {
      try {
        const actWeeks = aggregateRows
          .filter(r => r.ole_pct !== null)
          .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week)
          .slice(-4);
        if (!actWeeks.length) { setLoading(false); return; }
        const dateFrom = actWeeks[0].week_start_date;
        const dateTo = actWeeks[actWeeks.length - 1].week_end_date;

        // Fetch and aggregate site breakdown
        let total = 0;
        const sliceSums: Record<string, number> = {};

        if (scopePlants.length > 1) {
          const bds = await Promise.all(scopePlants.map(p => oleApi.ole.mhBreakdown({ plant: p, date_from: dateFrom, date_to: dateTo })));
          bds.forEach(bd => {
            total += bd.total_input_hours;
            bd.slices.forEach(s => { sliceSums[s.name] = (sliceSums[s.name] ?? 0) + s.value; });
          });
        } else {
          const siteBd = await oleApi.ole.mhBreakdown({
            date_from: dateFrom, date_to: dateTo,
            plant: scopePlants[0] || undefined,
            workcell: !scopePlants.length && scopeWorkcells.length === 1 ? scopeWorkcells[0] : undefined,
          });
          total = siteBd.total_input_hours;
          siteBd.slices.forEach(s => { sliceSums[s.name] = s.value; });
        }

        const p1raw = LOSS_CATS.map(name => ({
          name,
          value: total > 0 ? parseFloat(((sliceSums[name] / total) * 100).toFixed(2)) : 0,
          color: SLICE_COLORS[name] || '#94a3b8',
        }));

        const p1 = buildPareto(p1raw);
        setPareto1(p1);
        const cat1 = p1[0]?.name ?? ''; const cat2 = p1[1]?.name ?? '';
        setTop1Cat(cat1); setTop2Cat(cat2);
        onCatsChange?.(cat1, cat2);

        const allWcList = scopeWorkcells.length > 0
          ? scopeWorkcells
          : (await oleApi.workcells.list()).filter((w: any) => !scopePlants.length || scopePlants.includes(w.plant)).map((w: any) => w.workcell);
        const wcBds = await Promise.all(
          allWcList.map((wc: string) => oleApi.ole.mhBreakdown({ workcell: wc, date_from: dateFrom, date_to: dateTo })
            .then((res: any) => ({ wc, res })).catch(() => null))
        );
        const validBds = wcBds.filter(Boolean) as { wc: string; res: any }[];
        const wcPct = (wc: string, cat: string) => { const f = validBds.find(x => x.wc === wc); if (!f) return 0; const sl = f.res.slices.find((s: any) => s.name === cat); const t = f.res.total_input_hours; return t > 0 && sl ? (sl.value / t) * 100 : 0; };
        const shortName = (wc: string) => wc.length > 12 ? wc.slice(0, 12) + '…' : wc;
        if (cat1) {
          const p2raw = validBds.map(({ wc }) => ({ name: shortName(wc), value: parseFloat(wcPct(wc, cat1).toFixed(2)), color: SLICE_COLORS[cat1] ?? '#94a3b8' })).filter(x => x.value > 0);
          setPareto2(buildPareto(p2raw.sort((a, b) => b.value - a.value).slice(0, 3)));
        }
        if (cat2) {
          const p3raw = validBds.map(({ wc }) => ({ name: shortName(wc), value: parseFloat(wcPct(wc, cat2).toFixed(2)), color: SLICE_COLORS[cat2] ?? '#94a3b8' })).filter(x => x.value > 0);
          setPareto3(buildPareto(p3raw.sort((a, b) => b.value - a.value).slice(0, 3)));
        }
      } catch (e) { console.error('Q2 load failed', e); }
      finally { setLoading(false); }
    })();
  }, [aggregateRows.map(r => r.week_label).join(','), scopeWorkcells.slice().sort().join('|'), scopePlants.join('|')]);

  if (compact) {
    return (
      <div className="flex gap-2 h-full min-h-0">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <SmallPareto title="Man-hrs Loss Distribution" data={pareto1} loading={loading} fillHeight />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <SmallPareto title={`Top 3 Workcells — ${top1Cat || '#1 Loss'}`} data={pareto2} loading={loading} fillHeight />
          <SmallPareto title={`Top 3 Workcells — ${top2Cat || '#2 Loss'}`} data={pareto3} loading={loading} fillHeight />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SmallPareto title="Man-hrs Loss Distribution" data={pareto1} loading={loading} height={200} />
      <div className="grid grid-cols-2 gap-3">
        <SmallPareto title={`Top 3 Workcells — ${top1Cat || '#1 Loss'}`} data={pareto2} loading={loading} height={180} />
        <SmallPareto title={`Top 3 Workcells — ${top2Cat || '#2 Loss'}`} data={pareto3} loading={loading} height={180} />
      </div>
    </div>
  );
}

// ─── Q3 Improvement Plan Table ──────────────────────────────────────────────

// Loss categories only — OLE % tracked separately in Q1
const MH_ROWS = [
  { key: 'nva', label: 'NVA Input', color: '#ef4444' },
  { key: 'lunch', label: 'Lunch / Break', color: '#94a3b8' },
  { key: 'mfg_dt', label: 'MFG DT', color: '#f59e0b' },
  { key: 'non_identified', label: 'Non Identified Loss', color: '#6366f1' },
];

interface MhWeekData {
  week_label: string;
  nva: number; lunch: number; mfg_dt: number; non_identified: number;
  total: number; // sum of loss categories only
}

function PaynterTable({ aggregateRows, scopeWorkcells, scopePlants, isPrint = false }: {
  aggregateRows: OleWeeklyResult[];
  scopeWorkcells: string[];
  scopePlants: string[];
  isPrint?: boolean;
}) {
  const [weekData, setWeekData] = useState<MhWeekData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aggregateRows.length) return;
    setLoading(true);
    (async () => {
      try {
        const actWeeks = aggregateRows
          .filter(r => r.ole_pct !== null)
          .sort((a, b) => a.iso_year !== b.iso_year ? a.iso_year - b.iso_year : a.iso_week - b.iso_week);

        const results = await Promise.all(actWeeks.map(async w => {
          try {
            let totalHours = 0;
            const sliceSums: Record<string, number> = {};

            if (!scopePlants.length && scopeWorkcells.length > 1) {
              const bds = await Promise.all(
                scopeWorkcells.map(wc => oleApi.ole.mhBreakdown({ workcell: wc, date_from: w.week_start_date, date_to: w.week_end_date }).catch(() => null))
              );
              bds.filter(Boolean).forEach((bd: any) => {
                totalHours += bd.total_input_hours ?? 0;
                bd.slices?.forEach((sl: any) => { sliceSums[sl.name] = (sliceSums[sl.name] ?? 0) + (sl.value ?? 0); });
              });
            } else if (scopePlants.length > 1) {
              const bds = await Promise.all(
                scopePlants.map(p => oleApi.ole.mhBreakdown({ plant: p, date_from: w.week_start_date, date_to: w.week_end_date }).catch(() => null))
              );
              bds.filter(Boolean).forEach((bd: any) => {
                totalHours += bd.total_input_hours ?? 0;
                bd.slices?.forEach((sl: any) => { sliceSums[sl.name] = (sliceSums[sl.name] ?? 0) + (sl.value ?? 0); });
              });
            } else {
              const bd = await oleApi.ole.mhBreakdown({
                date_from: w.week_start_date, date_to: w.week_end_date,
                plant: scopePlants[0] || undefined,
                workcell: !scopePlants.length && scopeWorkcells.length === 1 ? scopeWorkcells[0] : undefined,
              });
              totalHours = bd.total_input_hours ?? 0;
              bd.slices?.forEach((sl: any) => { sliceSums[sl.name] = (sl.value ?? 0); });
            }

            if (!totalHours) return null;
            const pct = (name: string) => sliceSums[name] ? parseFloat(((sliceSums[name] / totalHours) * 100).toFixed(2)) : 0;
            const nva = pct('NVA Input');
            const lunch = pct('Lunch / Break');
            const mfg = pct('MFG DT');
            const nonId = pct('Unexplained Lost Hours');
            return {
              week_label: w.week_label, nva, lunch, mfg_dt: mfg, non_identified: nonId,
              total: parseFloat((nva + lunch + mfg + nonId).toFixed(2))
            } as MhWeekData;
          } catch { return null; }
        }));
        setWeekData(results.filter(Boolean) as MhWeekData[]);
      } catch (e) { console.error('Q3 mh load failed', e); }
      finally { setLoading(false); }
    })();
  }, [aggregateRows.map(r => r.week_label).join(','), scopeWorkcells.slice().sort().join('|'), scopePlants.join('|')]);

  const last4 = weekData.slice(-4);
  const avg4 = (key: keyof Omit<MhWeekData, 'week_label'>) =>
    last4.length ? last4.reduce((s, w) => s + w[key], 0) / last4.length : null;

  const fs = isPrint ? 'text-[10px]' : 'text-xs';
  const px = isPrint ? 'px-1.5 py-1' : 'px-3 py-1.5';
  const ph = isPrint ? 'px-1.5 py-1.5' : 'px-3 py-2';

  if (loading) return (
    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground animate-pulse">Loading Paynter data…</div>
  );
  if (!weekData.length) return (
    <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No data</div>
  );

  return (
    <div className={cn(isPrint ? 'w-full h-full overflow-hidden flex flex-col' : 'overflow-x-auto rounded-xl bg-card w-full h-full')}>
      <table className={cn('w-full text-left border-collapse table-fixed', isPrint ? 'h-full' : '', fs)}>
        <thead>
          {isPrint && (
            <tr>
              <th colSpan={weekData.length + 2} className="text-center py-1 text-[10px] font-bold uppercase text-primary-foreground bg-primary border-0">
                Fourth Quadrant — Paynter Chart
              </th>
            </tr>
          )}
          <tr className="bg-primary text-primary-foreground uppercase tracking-wider">
            <th className={cn(ph, 'border border-primary/70 font-semibold', isPrint ? 'text-[9px] w-28' : 'sticky left-0 bg-primary z-10 w-24 max-w-[96px] text-[10px]')}>
              {isPrint ? 'Category' : 'Man Hrs Distribution'}
            </th>
            {weekData.map(w => (
              <th key={w.week_label} className={cn(ph, 'border border-primary/70 text-right font-semibold')}>
                {fmtWeekLabel(w.week_label)}
              </th>
            ))}
            <th className={cn(ph, 'border border-primary/70 text-right font-bold bg-primary/80')}>
              Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {MH_ROWS.map(row => {
            const key = row.key as keyof Omit<MhWeekData, 'week_label'>;
            const a4 = avg4(key);
            return (
              <tr key={row.key} className="border-b border-border">
                <td className={cn(px, 'border border-border font-semibold', isPrint ? 'break-words' : 'sticky left-0 bg-card z-10 w-24 max-w-[96px] leading-snug')}>
                  {row.label}
                </td>
                {weekData.map(w => (
                  <td key={w.week_label} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>
                    {w[key].toFixed(2)}%
                  </td>
                ))}
                <td className={cn(px, 'border border-primary/20 text-right font-mono font-bold tabular-nums text-primary')}>
                  {a4 != null ? `${a4.toFixed(2)}%` : '—'}
                </td>
              </tr>
            );
          })}
          <tr className="font-bold text-foreground bg-muted/60">
            <td className={cn(px, 'border border-border uppercase tracking-wider', isPrint ? '' : 'sticky left-0 bg-muted/60 z-10 w-24 max-w-[96px]')}>Total</td>
            {weekData.map(w => (
              <td key={w.week_label} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>
                {w.total.toFixed(2)}%
              </td>
            ))}
            <td className={cn(px, 'border border-primary/20 text-right font-mono tabular-nums bg-primary/10 text-primary')}>
              {last4.length ? `${(last4.reduce((s, w) => s + w.total, 0) / last4.length).toFixed(2)}%` : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Q3 Improvement Plan Table ─────────────────────────────────────────────

function ImprovementTable({ actions, isPrint = false, top1Cat = '', top2Cat = '' }: {
  actions: ActionItem[]; isPrint?: boolean; top1Cat?: string; top2Cat?: string;
}) {
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
        s?.toLowerCase() === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
          'bg-muted text-muted-foreground border-border');

  const COLS = [
    { label: 'Issue', th: 'sticky left-0 bg-primary z-10 w-20 max-w-[80px]' },
    { label: 'Problem Description', th: 'min-w-[100px]' },
    { label: 'Root Cause', th: 'min-w-[90px]' },
    { label: 'Containment Action', th: 'min-w-[90px]' },
    { label: 'Corrective & Preventive Actions', th: 'min-w-[90px]' },
    { label: 'Impact vs Overall', th: 'w-14 text-center' },
    { label: 'ECN PCN NA', th: 'w-14 text-center' },
    { label: 'FIA - NA', th: 'w-14 text-center' },
    { label: 'Responsible', th: 'w-16' },
    { label: 'Commit Date', th: 'w-16' },
    { label: 'Status', th: 'w-14' },
  ];

  const renderDataCells = (a: ActionItem) => <>
    <td className={cn(pd, 'border border-border min-w-[100px]')}>{a.problemDescription || '—'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.rootCause || '—'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.containmentAction || '—'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.correctiveAction || '—'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.impactPct || '—'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.ecnPcn || '—'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.fia || '—'}</td>
    <td className={cn(pd, 'border border-border w-16')}>{a.responsible || '—'}</td>
    <td className={cn(pd, 'border border-border font-mono w-16')}>{a.commitDate || '—'}</td>
    <td className={cn(pd, 'border border-border w-14')}><span className={sBadge(a.status)}>{a.status || 'Open'}</span></td>
  </>;

  return (
    <div className={cn('overflow-x-auto rounded-xl w-full', !isPrint && 'bg-card')}>
      <table className={cn('w-full text-left border-collapse', sz)}>
        <thead>
          {isPrint && <tr><th colSpan={11} className="text-center py-1 text-[8px] font-bold uppercase text-primary-foreground bg-primary border-0">Third Quadrant — Improvement Plan</th></tr>}
          <tr className="bg-primary text-primary-foreground uppercase">
            {COLS.map(c => <th key={c.label} className={cn(ph, 'border border-primary/70 font-semibold leading-snug', isPrint ? 'text-[8px]' : 'text-[8px]', c.th)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && ungrouped.length === 0
            ? <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground text-xs italic">No actions added — use the editor panel to add corrective actions</td></tr>
            : <>
              {groups.map(({ issue, rows }) => rows.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  {ri === 0 && <td rowSpan={rows.length} className={cn(pd, 'border border-primary/70 font-semibold sticky left-0 bg-primary/10 z-10 w-20 max-w-[80px] align-middle leading-snug')}>{issue}</td>}
                  {renderDataCells(a)}
                </tr>
              )))}
              {ungrouped.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  <td className={cn(pd, 'border border-border sticky left-0 bg-card z-10 w-20')}>—</td>
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

// INIT_PARETO removed — Q2 Pareto is auto-computed

export default function FourQGenerator() {
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

  const scrollToSection = (tab: string) => {
    const map: Record<string, string> = { q1: 'q1-section', q2: 'q2-section', q3: 'q3-section', q4: 'q4-section' };
    const id = map[tab];
    if (!id) return;
    setTimeout(() => {
      const el = bodyRef.current?.querySelector(`#${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
      byWeek[r.week_label].smh += r.total_output_smh;
      byWeek[r.week_label].hrs += r.total_input_hours;
    });
    return Object.values(byWeek)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
      .slice(-13)
      .map(w => ({
        workcell: 'All', iso_year: w.year, iso_week: w.week, week_label: w.label,
        week_start_date: w.ws, week_end_date: w.we, stage_label: 'All', scan_stage: 'All',
        total_qty: 0, shift_count: 0, total_output_smh: w.smh, total_input_hours: w.hrs,
        avg_hc_direct: 0, total_va_hours: 0, total_nva_hours: 0,
        ole_pct: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : null,
        ole_pct_avg_shifts: null, shifts_ok: 0, shifts_flagged: 0, smh_coverage_pct: null,
      } as OleWeeklyResult));
  }, [weeklyRows]);

  const scopeWorkcells = mode === 'workcell' ? selectedWorkcells : selectedPlants.flatMap(p => byPlant[p] ?? []);

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
      if (!canvasRef.current) return;
      setDownloading(true);
      try {
        const { toPng } = await import('html-to-image');
        const dataUrl = await toPng(canvasRef.current, {
          cacheBust: true,
          pixelRatio: 2,
        });
        const link = document.createElement('a');
        link.download = `4Q-Report-${title.replace(/\s+/g, '-')}.png`;
        link.href = dataUrl;
        link.click();
      } catch (e) {
        console.error('Download failed', e);
      } finally {
        setDownloading(false);
      }
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="gap-2"><Eye className="w-4 h-4" /> Preview Report</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] p-0 flex flex-col gap-0 border border-border bg-card shadow-2xl rounded-xl overflow-hidden">
          <div className="bg-card border-b border-border px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <Button onClick={handleDownload} disabled={downloading} size="sm" className="gap-2 flex-shrink-0 h-8 px-3">
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Capturing...' : 'Download Image'}
            </Button>
            {/* Dark / Light toggle removed */}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm leading-tight">Report Preview</h2>
              <p className="text-xs text-muted-foreground">PNG download at 2x resolution</p>
            </div>
            <div className="w-10 flex-shrink-0" />
          </div>

          {/* Report canvas — theme controlled by previewDark, not the app theme */}
          <div className="flex-1 overflow-hidden bg-muted/40 min-h-0">
            <div
              ref={canvasRef}
              className="bg-card text-foreground h-full w-full flex flex-col overflow-hidden"
              style={{ minWidth: 900 }}
            >

              {/* Report title bar */}
              <div className="flex items-center justify-between flex-shrink-0 px-4 py-1.5">
                <h1 className="text-sm font-bold uppercase tracking-wide">{title}</h1>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">JABIL 4Q REPORT</span>
              </div>

              {/* 2×2 grid — each cell gets exactly 1/2 of remaining height */}
              <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0 overflow-hidden">

                {/* Q1 */}
                <div className="border border-border bg-card rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center -mx-3 -mt-3 px-3 py-1.5 rounded-t-lg bg-primary mb-2 flex-shrink-0">
                    <span className="flex-1 text-center text-xs font-bold uppercase text-primary-foreground">First Quadrant - OLE Trend</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Q1Chart trendData={trendData} fillHeight />
                  </div>
                </div>

                {/* Q2 */}
                <div className="border border-border bg-card rounded-lg p-3 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center -mx-3 -mt-3 px-3 py-1.5 rounded-t-lg bg-primary mb-2 flex-shrink-0">
                    <span className="flex-1 text-center text-xs font-bold uppercase text-primary-foreground">Second Quadrant - Pareto Four Weeks</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <Q2Section
                      aggregateRows={aggregateRows}
                      scopeWorkcells={scopeWorkcells}
                      scopePlants={mode === 'plant' ? selectedPlants : []}
                      compact
                      onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }}
                    />
                  </div>
                </div>

                {/* Q4 — Paynter Chart */}
                <div className="border border-border bg-card rounded-lg overflow-hidden min-h-0 flex flex-col items-start">
                  <PaynterTable aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlants={mode === 'plant' ? selectedPlants : []} isPrint />
                </div>

                {/* Q3 — Improvement Plan */}
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
            <p className="text-xs text-muted-foreground mt-0.5">
              {tab === 'setup' ? 'Set up scope to generate trend data' : `Scope: ${trendScope} · ${trendData.filter(p => !p.hidden).length} weeks visible`}
            </p>
          </div>
          {tab === 'editor' && (
            <button onClick={() => setTab('setup')} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
              ← Change Scope
            </button>
          )}
        </div>
        {tab === 'editor' && <PreviewModal />}
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {tab === 'setup' && (
          <SetupStep
            workcellConfigs={workcellConfigs} mode={mode} setMode={setMode}
            selectedPlants={selectedPlants} setSelectedPlants={setSelectedPlants}
            selectedWorkcells={selectedWorkcells} setSelectedWorkcells={setSelectedWorkcells}
            onGenerate={handleGenerate} generating={generating}
            plants={plants} byPlant={byPlant}
          />
        )}

        {tab === 'editor' && (
          <>
            <div className="flex-1 overflow-y-auto p-8" ref={bodyRef}>
              <div className="max-w-5xl mx-auto space-y-12 pb-16">

                {/* ── Q1 ── */}
                <section id="q1-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">1</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">First Quadrant - OLE Trend</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Scope: {trendScope}</p>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <Q1Chart trendData={trendData} />
                  </div>
                </section>

                {/* ── Q2 ── */}
                <section id="q2-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">2</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Second Quadrant - Pareto Four Weeks</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg of last 4 actual weeks</p>
                    </div>
                  </div>
                  <Q2Section
                    aggregateRows={aggregateRows}
                    scopeWorkcells={scopeWorkcells}
                    scopePlants={mode === 'plant' ? selectedPlants : []}
                    onCatsChange={(c1, c2) => { setTop1Cat(c1); setTop2Cat(c2); }}
                  />
                </section>
                {/* ── Q3 ── */}
                <section id="q3-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">3</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Third Quadrant - Improvement Plan</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Corrective actions and ownership</p>
                    </div>
                  </div>
                  <ImprovementTable actions={actions} top1Cat={top1Cat} top2Cat={top2Cat} />
                </section>

                {/* ── Q4 ── */}
                <section id="q4-section" className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">4</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Fourth Quadrant - Paynter Chart</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Man-hours loss distribution per week</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <PaynterTable aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlants={mode === 'plant' ? selectedPlants : []} />
                  </div>
                </section>



              </div>
            </div>

            <div className={cn('border-l border-border bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out shadow-xl flex flex-col flex-shrink-0 z-10', rightOpen ? 'w-[460px]' : 'w-12')}>
              <div
                className={cn('flex items-center cursor-pointer hover:bg-muted/40 transition-colors border-b border-border flex-shrink-0 group', rightOpen ? 'justify-between px-5 h-13' : 'justify-center h-13')}
                style={{ height: 52 }}
                onClick={() => setRightOpen(!rightOpen)}>
                {rightOpen
                  ? <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Editor</span>
                    </div>
                    <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary text-muted-foreground transition-colors">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </>
                  : <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary text-muted-foreground transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </div>
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
                      ].map(t => (
                        <TabsTrigger key={t.v} value={t.v}
                          className={cn('rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent px-1 py-1 shadow-none text-xs', t.cls)}>
                          {t.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <div className="flex-1 overflow-y-auto mt-4 pr-2">

                      <TabsContent value="q1" className="m-0 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground">
                            Auto-populated · {trendData.filter(p => !p.hidden).length} of {trendData.length} weeks visible.
                          </p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setTrendData([...trendData, { id: genId(), label: `WW${String(trendData.length + 1).padStart(2, '00')}`, ole: 0, target: 61, projected: false, hidden: false }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        <div className="grid text-[10px] text-muted-foreground uppercase tracking-wider px-7 gap-2" style={{ gridTemplateColumns: '1fr 5rem 5rem 2rem' }}>
                          <span>Label</span><span className="text-right">OLE %</span><span className="text-right">Target</span><span />
                        </div>
                        {trendData.map((t, i) => (
                          <div key={t.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); handleTrendDrop(Number(e.dataTransfer.getData('text/plain')), i); }}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded border transition-all',
                              t.hidden
                                ? 'bg-muted/10 border-border/40 opacity-50 cursor-grab active:cursor-grabbing'
                                : 'bg-muted/30 border-border cursor-grab active:cursor-grabbing active:opacity-60'
                            )}>
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1" style={{ display: 'grid', gridTemplateColumns: '1fr 5rem 5rem' }}>
                              <Input
                                value={t.label}
                                onChange={e => { const n = [...trendData]; n[i] = { ...n[i], label: e.target.value }; setTrendData(n); }}
                                placeholder="Label"
                                className={cn('h-7 text-xs', t.hidden && 'text-muted-foreground line-through')}
                              />
                              <Input type="number" value={t.ole} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], ole: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" disabled={t.hidden} />
                              <Input type="number" value={t.target} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], target: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" disabled={t.hidden} />
                            </div>
                            <button
                              title={t.hidden ? 'Show week' : 'Hide week'}
                              onClick={() => { const n = [...trendData]; n[i] = { ...n[i], hidden: !n[i].hidden }; setTrendData(n); }}
                              className={cn(
                                'h-7 w-7 flex items-center justify-center rounded flex-shrink-0 transition-colors',
                                t.hidden
                                  ? 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                              )}
                            >
                              {t.hidden
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="q2" className="m-0 space-y-3">
                        <p className="text-[11px] text-muted-foreground">Auto-computed from last 4 weeks MH breakdown. Reflects the current scope selection.</p>
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
                                onClick={() => {
                                  const newAction: ActionItem = {
                                    id: genId(),
                                    issue: cat,
                                    problemDescription: '',
                                    rootCause: '',
                                    containmentAction: '',
                                    correctiveAction: '',
                                    impactPct: '',
                                    ecnPcn: '',
                                    fia: '',
                                    responsible: '',
                                    commitDate: '',
                                    status: 'Open'
                                  };
                                  setActions([...actions, newAction]);
                                }}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Action
                              </Button>
                            </div>

                            <div className="space-y-4">
                              <Accordion type="multiple" className="w-full space-y-2">
                                {actions.filter(a => a.issue === cat).map((a) => {
                                  const globalIdx = actions.findIndex(x => x.id === a.id);
                                  const update = (fields: Partial<ActionItem>) => {
                                    const n = [...actions];
                                    n[globalIdx] = { ...n[globalIdx], ...fields };
                                    setActions(n);
                                  };
                                  return (
                                    <AccordionItem key={a.id} value={a.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm group/item">
                                      <div className="flex items-center relative hover:bg-muted/20 transition-colors">
                                        <AccordionTrigger className="hover:no-underline px-4 py-3 group flex-1 [&>svg]:order-first [&>svg]:mr-3 justify-start">
                                          <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                                            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", a.status === 'Closed' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                            <div className="flex flex-col min-w-0 flex-1">
                                              <span className="text-xs font-bold text-foreground truncate">{a.problemDescription || 'New Problem...'}</span>
                                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                                {a.responsible || 'No Owner'} · {a.status}
                                              </span>
                                            </div>
                                          </div>
                                        </AccordionTrigger>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActions(actions.filter(x => x.id !== a.id));
                                          }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                      <AccordionContent className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/20 relative">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Problem Description</Label>
                                            <Input value={a.problemDescription} onChange={e => update({ problemDescription: e.target.value })} placeholder="New Problem..." className="h-7 text-xs bg-background" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Responsible</Label>
                                            <select
                                              value={a.responsible}
                                              onChange={e => update({ responsible: e.target.value })}
                                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                              <option value="">Select Owner</option>
                                              <option value="Syuhada (IE SME)">Syuhada (IE SME)</option>
                                              <option value="ChoHui (IE SME)">ChoHui (IE SME)</option>
                                            </select>
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Root Cause</Label>
                                          <textarea
                                            value={a.rootCause}
                                            onChange={e => update({ rootCause: e.target.value })}
                                            placeholder="Root cause..."
                                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Containment Action</Label>
                                          <textarea
                                            value={a.containmentAction}
                                            onChange={e => update({ containmentAction: e.target.value })}
                                            placeholder="Interim fix"
                                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Corrective & Preventive Actions</Label>
                                          <textarea
                                            value={a.correctiveAction}
                                            onChange={e => update({ correctiveAction: e.target.value })}
                                            placeholder="Long-term solution"
                                            className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                                          />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Impact %</Label>
                                            <Input value={a.impactPct} onChange={e => update({ impactPct: e.target.value })} placeholder="e.g. 15%" className="h-7 text-xs bg-background" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">ECN/PCN</Label>
                                            <Input value={a.ecnPcn} onChange={e => update({ ecnPcn: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">FIA</Label>
                                            <Input value={a.fia} onChange={e => update({ fia: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-0">
                                            <DatePickerField
                                              id={`commit-date-${a.id}`}
                                              label="Commit Date"
                                              value={a.commitDate}
                                              onChange={val => update({ commitDate: val })}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
                                            <select
                                              value={a.status}
                                              onChange={e => update({ status: e.target.value })}
                                              className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                              <option value="Open">Open</option>
                                              <option value="Closed">Closed</option>
                                            </select>
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  );
                                })}
                              </Accordion>
                              {actions.filter(a => a.issue === cat).length === 0 && (
                                <div className="py-4 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2">
                                  <p className="text-[11px] text-muted-foreground">No actions for this category.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {actions.filter(a => a.issue !== top1Cat && a.issue !== top2Cat).length > 0 && (
                          <div className="space-y-3 pt-6 border-t border-border">
                            <h3 className="text-xs font-bold uppercase text-muted-foreground">Other Actions</h3>
                            <Accordion type="multiple" className="w-full space-y-2">
                              {actions.filter(a => a.issue !== top1Cat && a.issue !== top2Cat).map((a) => {
                                const globalIdx = actions.findIndex(x => x.id === a.id);
                                const update = (fields: Partial<ActionItem>) => {
                                  const n = [...actions];
                                  n[globalIdx] = { ...n[globalIdx], ...fields };
                                  setActions(n);
                                };
                                return (
                                  <AccordionItem key={a.id} value={a.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm group/item">
                                    <div className="flex items-center relative hover:bg-muted/20 transition-colors">
                                      <AccordionTrigger className="hover:no-underline px-4 py-3 group flex-1 [&>svg]:order-first [&>svg]:mr-3 justify-start">
                                        <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", a.status === 'Closed' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold uppercase tracking-wider">{a.issue || 'Misc'}</span>
                                              <span className="text-xs font-bold text-foreground truncate">{a.problemDescription || 'New Problem...'}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                              {a.responsible || 'No Owner'} · {a.status}
                                            </span>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActions(actions.filter(x => x.id !== a.id));
                                        }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                    <AccordionContent className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/20 relative">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Issue Name</Label>
                                        <Input value={a.issue} onChange={e => update({ issue: e.target.value })} placeholder="Issue category..." className="h-7 text-xs bg-background" />
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Problem Description</Label>
                                          <Input value={a.problemDescription} onChange={e => update({ problemDescription: e.target.value })} placeholder="Small desc..." className="h-7 text-xs bg-background" />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Responsible</Label>
                                          <select
                                            value={a.responsible}
                                            onChange={e => update({ responsible: e.target.value })}
                                            className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                          >
                                            <option value="">Select Owner</option>
                                            <option value="Syuhada (IE SME)">Syuhada (IE SME)</option>
                                            <option value="ChoHui (IE SME)">ChoHui (IE SME)</option>
                                          </select>
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Root Cause</Label>
                                        <textarea
                                          value={a.rootCause}
                                          onChange={e => update({ rootCause: e.target.value })}
                                          placeholder="Root cause..."
                                          className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Containment Action</Label>
                                        <textarea
                                          value={a.containmentAction}
                                          onChange={e => update({ containmentAction: e.target.value })}
                                          placeholder="Interim fix"
                                          className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px]"
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <Label className="text-[10px] uppercase text-muted-foreground">Corrective & Preventive Actions</Label>
                                        <textarea
                                          value={a.correctiveAction}
                                          onChange={e => update({ correctiveAction: e.target.value })}
                                          placeholder="Long-term solution"
                                          className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px]"
                                        />
                                      </div>

                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Impact %</Label>
                                          <Input value={a.impactPct} onChange={e => update({ impactPct: e.target.value })} placeholder="e.g. 15%" className="h-7 text-xs bg-background" />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">ECN/PCN</Label>
                                          <Input value={a.ecnPcn} onChange={e => update({ ecnPcn: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">FIA</Label>
                                          <Input value={a.fia} onChange={e => update({ fia: e.target.value })} placeholder="N/A" className="h-7 text-xs bg-background" />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-0">
                                          <DatePickerField
                                            id={`commit-date-other-${a.id}`}
                                            label="Commit Date"
                                            value={a.commitDate}
                                            onChange={val => update({ commitDate: val })}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
                                          <select
                                            value={a.status}
                                            onChange={e => update({ status: e.target.value })}
                                            className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                          >
                                            <option value="Open">Open</option>
                                            <option value="Closed">Closed</option>
                                          </select>
                                        </div>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="q4" className="m-0 space-y-2">
                        <p className="text-[11px] text-muted-foreground">Auto-computed from MH breakdown API per week. Read-only.</p>
                        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                          {MH_ROWS.map(r => (
                            <div key={r.key} className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                              <span className="flex-1 text-muted-foreground">{r.label}</span>
                              <span className="font-mono text-[10px] text-muted-foreground/60">% of total paid hrs</span>
                            </div>
                          ))}
                          <div className="border-t border-border pt-1.5 mt-1.5 text-xs font-semibold text-foreground flex items-center gap-2">
                            <span className="w-2 h-2 flex-shrink-0" />
                            <span className="flex-1">Total (loss categories only)</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">&lt; 100%</span>
                          </div>
                        </div>
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-[11px] text-blue-600">
                          Shows loss categories only. OLE % is tracked in Q1 trend chart.
                        </div>
                      </TabsContent>

                      <TabsContent value="settings" className="m-0 space-y-4 max-w-sm">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Report Title</Label>
                          <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" />
                        </div>

                        <div className="pt-4 border-t border-border space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Report Scope</Label>
                            <div className="flex rounded-lg border border-border overflow-hidden">
                              {(['plant', 'workcell'] as SetupMode[]).map(m => (
                                <button key={m} onClick={() => setMode(m)}
                                  className={cn('flex-1 py-2 text-[10px] font-medium transition-colors',
                                    mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                                  {m === 'plant' ? 'By Plant' : 'By Workcell'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {mode === 'plant' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Select Plants <span className="text-primary">({selectedPlants.length} selected)</span>
                              </Label>
                              <div className="flex gap-2">
                                {plants.map(p => (
                                  <button key={p} onClick={() => setSelectedPlants(selectedPlants.includes(p) ? selectedPlants.filter(x => x !== p) : [...selectedPlants, p])}
                                    className={cn('flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-all',
                                      selectedPlants.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {mode === 'workcell' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Select Workcells <span className="text-primary">({selectedWorkcells.length})</span>
                              </Label>
                              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {plants.map(p => (
                                  <div key={p} className="space-y-1">
                                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">{p}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {byPlant[p]?.map(wc => (
                                        <button key={wc}
                                          onClick={() => setSelectedWorkcells(selectedWorkcells.includes(wc) ? selectedWorkcells.filter(x => x !== wc) : [...selectedWorkcells, wc])}
                                          className={cn('px-2 py-1 rounded-md border text-[10px] font-medium transition-all',
                                            selectedWorkcells.includes(wc) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                                          {wc}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={handleGenerate}
                            disabled={generating || (mode === 'plant' && selectedPlants.length === 0) || (mode === 'workcell' && selectedWorkcells.length === 0)}
                            className="w-full h-8 text-xs font-bold"
                          >
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

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          body > :not([role="dialog"]) { display: none !important; }
        }
      `}} />
    </div>
  );
}
