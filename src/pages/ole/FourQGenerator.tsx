import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { OleWeeklyResult, OleWorkcellConfig } from '@/lib/oleApi';
import { oleApi } from '@/lib/oleApi';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Eye, GripVertical, Info, Plus, Printer, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line,
  ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupMode = 'plant' | 'workcell';
type ActionItem = { id: string; issue: string; rootCause: string; containmentAction: string; correctiveAction: string; impactPct: string; ecnPcn: string; fia: string; responsible: string; commitDate: string; status: string; };
// RawRow removed — Q3 is now auto-computed from mhBreakdown
type ParetoRow = { id: string; issue: string; count: number };
type TrendPoint = { id: string; label: string; ole: number; target: number; projected?: boolean };

const genId = () => Math.random().toString(36).substr(2, 9);

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 11,
  color: 'hsl(var(--foreground))',
};

const SLICE_COLORS: Record<string, string> = {
  'Output SMH': '#22c55e',
  'NVA Input': '#ef4444',
  'Lunch / Break': '#94a3b8',
  'MFG DT': '#f59e0b',
  'Unexplained Lost Hours': '#6366f1',
};

const LOSS_CATS = ['NVA Input', 'Lunch / Break', 'MFG DT', 'Unexplained Lost Hours'];

const FORMULA_COLORS: Record<string, string> = {
  sma3: '#3b82f6', sma5: '#6366f1', wma3: '#f59e0b',
  ema_fast: '#10b981', ema_slow: '#06b6d4',
  cma: '#a855f7', linear_reg: '#f43f5e',
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
    target: 80,
    projected: p.projected ?? false,
  }));
}

function fmtWeekLabel(v: string): string {
  const m = v.match(/\d+$/);
  return m ? `WW${m[0].padStart(2, '0')}` : v;
}

// ─── Pareto helpers ───────────────────────────────────────────────────────────

interface ParetoBar { name: string; value: number; color: string; cum: number; }

function buildPareto(data: { name: string; value: number; color: string }[]): ParetoBar[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, x) => s + x.value, 0);
  let cum = 0;
  return sorted.map(x => { cum += x.value; return { ...x, cum: total > 0 ? (cum / total) * 100 : 0 }; });
}

// ─── Setup Step ───────────────────────────────────────────────────────────────

function SetupStep({
  workcellConfigs, mode, setMode,
  selectedPlant, setSelectedPlant,
  selectedWorkcells, setSelectedWorkcells,
  onGenerate, generating,
}: {
  workcellConfigs: OleWorkcellConfig[];
  mode: SetupMode; setMode: (m: SetupMode) => void;
  selectedPlant: string; setSelectedPlant: (p: string) => void;
  selectedWorkcells: string[]; setSelectedWorkcells: (w: string[]) => void;
  onGenerate: () => void; generating: boolean;
}) {
  const plants = useMemo(() => Array.from(new Set(workcellConfigs.map(w => w.plant))).sort(), [workcellConfigs]);
  const byPlant = useMemo(() => {
    const map: Record<string, string[]> = {};
    workcellConfigs.forEach(w => { if (!map[w.plant]) map[w.plant] = []; map[w.plant].push(w.workcell); });
    return map;
  }, [workcellConfigs]);
  const canGen = (mode === 'plant' && !!selectedPlant) || (mode === 'workcell' && selectedWorkcells.length > 0);
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
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Select Plant</Label>
            <div className="flex gap-3">
              {plants.map(p => (
                <button key={p} onClick={() => setSelectedPlant(p)}
                  className={cn('flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all',
                    selectedPlant === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground')}>
                  {p}<p className="text-[10px] font-normal mt-0.5 opacity-70">{byPlant[p]?.length ?? 0} workcells</p>
                </button>
              ))}
            </div>
            {selectedPlant && (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Included workcells</p>
                <div className="flex flex-wrap gap-1.5">
                  {byPlant[selectedPlant]?.map(wc => (
                    <span key={wc} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{wc}</span>
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
  if (!trendData.length) return (
    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data — go back to setup</div>
  );
  const firstProj = trendData.find(p => p.projected)?.label;

  return (
    <div style={fillHeight ? { height: '100%' } : { height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtWeekLabel} />
          <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} labelFormatter={fmtWeekLabel} />
          {firstProj && <ReferenceArea x1={firstProj} fill="hsl(var(--primary) / 0.05)" strokeOpacity={0} />}
          <Bar dataKey="ole" name="OLE %" maxBarSize={32} radius={[4, 4, 0, 0]}>
            {trendData.map((e, i) => (
              <Cell key={i}
                fill={e.projected ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--primary))'}
                stroke={e.projected ? 'hsl(var(--primary))' : 'none'}
                strokeWidth={e.projected ? 1.5 : 0}
                strokeDasharray={e.projected ? '5 3' : '0'}
              />
            ))}
          </Bar>
          <Line type="monotone" dataKey="target" name="Target 80%" stroke="#22c55e"
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
        <text key={i} x={0} y={0} dy={i * 9} textAnchor="middle" fontSize={7} fill="hsl(var(--muted-foreground))">
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
            <YAxis yAxisId="left" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={TT} formatter={(v: number, n: string) => [`${Number(v).toFixed(1)}%`, n]} />
            <Bar yAxisId="left" dataKey="value" name="Share %" radius={[3, 3, 0, 0]} maxBarSize={40} fill="hsl(var(--primary))" />
            <Line yAxisId="right" type="monotone" dataKey="cum" name="Cumulative %"
              stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Q2 Section ───────────────────────────────────────────────────────────────

function Q2Section({ aggregateRows, scopeWorkcells, scopePlant, compact = false, onCatsChange }: {
  aggregateRows: OleWeeklyResult[];
  scopeWorkcells: string[];
  scopePlant: string;
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
        const siteBd = await oleApi.ole.mhBreakdown({
          date_from: dateFrom, date_to: dateTo,
          plant: scopePlant || undefined,
          workcell: !scopePlant && scopeWorkcells.length === 1 ? scopeWorkcells[0] : undefined,
        });
        const total = siteBd.total_input_hours;
        const lossSlices = siteBd.slices.filter((s: any) => LOSS_CATS.includes(s.name));
        const p1raw = lossSlices.map((s: any) => ({
          name: s.name,
          value: total > 0 ? parseFloat(((s.value / total) * 100).toFixed(2)) : 0,
          color: s.color,
        }));
        const p1 = buildPareto(p1raw);
        setPareto1(p1);
        const cat1 = p1[0]?.name ?? ''; const cat2 = p1[1]?.name ?? '';
        setTop1Cat(cat1); setTop2Cat(cat2);
        onCatsChange?.(cat1, cat2);
        const allWcList = scopeWorkcells.length > 0
          ? scopeWorkcells
          : (await oleApi.workcells.list()).filter((w: any) => !scopePlant || w.plant === scopePlant).map((w: any) => w.workcell);
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
  }, [aggregateRows.map(r => r.week_label).join(','), scopeWorkcells.join(','), scopePlant]);

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

// ─── Q3 Table: Man-Hrs Distribution Paynter ──────────────────────────────────

// Loss categories only — OLE % tracked separately in Q1
const MH_ROWS = [
  { key: 'nva', label: 'NVA Input', color: '#ef4444' },
  { key: 'lunch', label: 'Lunch / Break', color: '#94a3b8' },
  { key: 'mfg_dt', label: 'MFG DT', color: '#f59e0b' },
  { key: 'unexplained', label: 'Unexplained Lost Hrs', color: '#6366f1' },
];

interface MhWeekData {
  week_label: string;
  nva: number; lunch: number; mfg_dt: number; unexplained: number;
  total: number; // sum of loss categories only
}

function Q3Table({ aggregateRows, scopeWorkcells, scopePlant, isPrint = false }: {
  aggregateRows: OleWeeklyResult[];
  scopeWorkcells: string[];
  scopePlant: string;
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
            const bd = await oleApi.ole.mhBreakdown({
              date_from: w.week_start_date, date_to: w.week_end_date,
              plant: scopePlant || undefined,
              workcell: !scopePlant && scopeWorkcells.length === 1 ? scopeWorkcells[0] : undefined,
            });
            const t = bd.total_input_hours;
            if (!t) return null;
            const pct = (name: string) => {
              const s = bd.slices.find((sl: any) => sl.name === name);
              return s ? parseFloat(((s.value / t) * 100).toFixed(2)) : 0;
            };
            const nva = pct('NVA Input');
            const lunch = pct('Lunch / Break');
            const mfg = pct('MFG DT');
            const unexp = pct('Unexplained Lost Hours');
            return {
              week_label: w.week_label, nva, lunch, mfg_dt: mfg, unexplained: unexp,
              total: parseFloat((nva + lunch + mfg + unexp).toFixed(2))
            } as MhWeekData;
          } catch { return null; }
        }));
        setWeekData(results.filter(Boolean) as MhWeekData[]);
      } catch (e) { console.error('Q3 mh load failed', e); }
      finally { setLoading(false); }
    })();
  }, [aggregateRows.map(r => r.week_label).join(','), scopeWorkcells.join(','), scopePlant]);

  const last4 = weekData.slice(-4);
  const avg4 = (key: keyof Omit<MhWeekData, 'week_label'>) =>
    last4.length ? last4.reduce((s, w) => s + w[key], 0) / last4.length : null;

  const fs = isPrint ? 'text-[9px]' : 'text-xs';
  const px = isPrint ? 'px-2 py-1' : 'px-3 py-1.5';
  const ph = isPrint ? 'px-2 py-1.5' : 'px-3 py-2';

  if (loading) return (
    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground animate-pulse">Loading Paynter data…</div>
  );
  if (!weekData.length) return (
    <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">No data</div>
  );

  return (
    <div className={cn('overflow-x-auto w-full h-full rounded-xl', !isPrint && 'bg-card')}>
      <table className={cn('w-full h-full text-left border-collapse', fs)}>
        <thead>
          {isPrint && (
            <tr>
              <th colSpan={weekData.length + 2} className="text-center py-1.5 text-xs font-bold uppercase text-primary-foreground bg-primary border-0">
                Fourth Quadrant — Paynter Chart
              </th>
            </tr>
          )}
          <tr className="bg-primary text-primary-foreground uppercase tracking-wider">
            <th className={cn(ph, 'border border-primary/70 font-semibold sticky left-0 bg-primary z-10 w-24 max-w-[96px] leading-snug', !isPrint && 'text-[10px]')}>
              Man Hrs Distribution
            </th>
            {weekData.map(w => (
              <th key={w.week_label} className={cn(ph, 'border border-primary/70 text-right font-semibold whitespace-nowrap')}>
                {fmtWeekLabel(w.week_label)}
              </th>
            ))}
            <th className={cn(ph, 'border border-primary/70 text-right font-bold whitespace-nowrap bg-primary/80')}>
              Avg 4 Wks
            </th>
          </tr>
        </thead>
        <tbody>
          {MH_ROWS.map(row => {
            const key = row.key as keyof Omit<MhWeekData, 'week_label'>;
            const a4 = avg4(key);
            return (
              <tr key={row.key} className="border-b border-border hover:bg-muted/20 transition-colors">
                <td className={cn(px, 'border border-border font-semibold sticky left-0 bg-card z-10 w-24 max-w-[96px] leading-snug')}>
                  <div className={cn("flex items-center gap-1.5", !isPrint && row.key === 'unexplained' && 'text-[10px]')}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: row.color }} />
                    {row.label}
                  </div>
                </td>
                {weekData.map(w => (
                  <td key={w.week_label} className={cn(px, 'border border-border text-right font-mono tabular-nums')}>
                    {w[key].toFixed(2)}%
                  </td>
                ))}
                <td className={cn(px, 'border border-primary/20 text-right font-mono font-bold tabular-nums bg-primary/8 text-primary')}>
                  {a4 != null ? `${a4.toFixed(2)}%` : '—'}
                </td>
              </tr>
            );
          })}
          <tr className="bg-muted/60 font-bold text-foreground">
            <td className={cn(px, 'border border-border sticky left-0 bg-muted/60 z-10 uppercase tracking-wider w-24 max-w-[96px] leading-snug')}>Total</td>
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

// ─── Q4 Table ─────────────────────────────────────────────────────────────────

function Q4Table({ actions, isPrint = false, top1Cat = '', top2Cat = '' }: {
  actions: ActionItem[]; isPrint?: boolean; top1Cat?: string; top2Cat?: string;
}) {
  const sz = isPrint ? 'text-[9px]' : 'text-xs';
  const ph = isPrint ? 'px-1 py-1' : 'px-2 py-1.5';
  const pd = isPrint ? 'px-1 py-1' : 'px-2 py-2';
  const TOTAL = 10;

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
          {isPrint && <tr><th colSpan={TOTAL} className="text-center py-1.5 text-xs font-bold uppercase text-primary-foreground bg-primary border-0">Third Quadrant — Improvement Plan</th></tr>}
          <tr className="bg-primary text-primary-foreground uppercase">
            {COLS.map(c => <th key={c.label} className={cn(ph, 'border border-primary/70 font-semibold leading-snug', c.th)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && ungrouped.length === 0
            ? <tr><td colSpan={TOTAL} className="px-3 py-8 text-center text-muted-foreground text-xs italic">No actions added — use the editor panel to add corrective actions</td></tr>
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

// INIT_RAW removed — Q3 is auto-computed
const INIT_PARETO: ParetoRow[] = [
  { id: genId(), issue: 'NVA Input', count: 0 },
  { id: genId(), issue: 'Unexplained Lost Hours', count: 0 },
  { id: genId(), issue: 'MFG DT', count: 0 },
  { id: genId(), issue: 'Lunch / Break', count: 0 },
];

export default function FourQGenerator() {
  const [title, setTitle] = useState('Weekly OLE Performance Review');
  const [tab, setTab] = useState<'setup' | 'editor'>('setup');
  const [rightOpen, setRightOpen] = useState(true);

  const [workcellConfigs, setWorkcellConfigs] = useState<OleWorkcellConfig[]>([]);
  const [mode, setMode] = useState<SetupMode>('plant');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedWorkcells, setSelectedWorkcells] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [trendScope, setTrendScope] = useState('');
  const [paretoRows, setParetoRows] = useState<ParetoRow[]>(INIT_PARETO);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [weeklyRows, setWeeklyRows] = useState<OleWeeklyResult[]>([]);
  const [top1Cat, setTop1Cat] = useState('');
  const [top2Cat, setTop2Cat] = useState('');

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

  const scopeWorkcells = mode === 'workcell' ? selectedWorkcells : [];

  async function handleGenerate() {
    setGenerating(true);
    try {
      let rows: OleWeeklyResult[] = []; let label = '';
      if (mode === 'plant') { rows = await oleApi.ole.weekly({ plant: selectedPlant }); label = selectedPlant; }
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
      const basePoints = buildChartData(aggRows, 3);
      const best = getBestFormula(basePoints);
      setTrendData(chartDataToTrend(injectProjBars(basePoints, best), best));
      setTab('editor');
    } catch (e) { console.error(e); } finally { setGenerating(false); }
  }

  function handleTrendDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const n = [...trendData]; const [moved] = n.splice(fromIdx, 1); n.splice(toIdx, 0, moved); setTrendData(n);
  }

  const PreviewModal = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2"><Eye className="w-4 h-4" /> Preview Report</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] p-0 flex flex-col gap-0 border border-border bg-card shadow-2xl rounded-xl overflow-hidden">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-4 flex-shrink-0 print:hidden">
          <Button onClick={() => window.print()} size="sm" className="gap-2 flex-shrink-0 h-9 px-4">
            <Printer className="w-4 h-4" /> Print PDF
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base leading-tight">Report Preview</h2>
            <p className="text-xs text-muted-foreground">Print-ready layout</p>
          </div>
          <div className="w-10 flex-shrink-0" />
        </div>

        {/* White report canvas — fills modal minus header, no scroll */}
        <div className="flex-1 overflow-hidden bg-muted/40 p-4 min-h-0">
          <div className="bg-card text-foreground h-full w-full rounded-lg shadow-sm p-5 flex flex-col gap-3 overflow-hidden" style={{ minWidth: 900 }}>

            {/* Report title bar */}
            <div className="border-b-2 border-primary pb-2 flex items-center justify-between flex-shrink-0">
              <h1 className="text-lg font-bold uppercase tracking-wide">{title}</h1>
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
                  <Q2Section aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlant={mode === 'plant' ? selectedPlant : ''} compact />
                </div>
              </div>

              {/* Q3 — table fills cell, no header bar */}
              <div className="border border-border bg-card rounded-lg overflow-hidden min-h-0 flex flex-col">
                <Q3Table aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlant={mode === 'plant' ? selectedPlant : ''} isPrint />
              </div>

              {/* Q4 — table fills cell, no header bar */}
              <div className="border border-border bg-card rounded-lg overflow-hidden min-h-0 flex flex-col">
                <Q4Table actions={actions} isPrint />
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">4Q Generator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tab === 'setup' ? 'Set up scope to generate trend data' : `Scope: ${trendScope} · ${trendData.filter(p => !p.projected).length} weeks`}
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
            selectedPlant={selectedPlant} setSelectedPlant={setSelectedPlant}
            selectedWorkcells={selectedWorkcells} setSelectedWorkcells={setSelectedWorkcells}
            onGenerate={handleGenerate} generating={generating}
          />
        )}

        {tab === 'editor' && (
          <>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto space-y-12 pb-16">

                {/* ── Q1 ── */}
                <section className="space-y-3">
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
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">2</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Second Quadrant - Pareto Four Weeks</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg of last 4 actual weeks</p>
                    </div>
                  </div>
                  <Q2Section aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlant={mode === 'plant' ? selectedPlant : ''} />
                </section>
                {/* ── Q3 ── */}
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">3</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Third Quadrant - Improvement Plan</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Corrective actions and ownership</p>
                    </div>
                  </div>
                  <Q4Table actions={actions} />
                </section>

                {/* ── Q4 ── */}
                <section className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">4</span>
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Fourth Quadrant - Paynter Chart</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Man-hours loss distribution per week</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Q3Table aggregateRows={aggregateRows} scopeWorkcells={scopeWorkcells} scopePlant={mode === 'plant' ? selectedPlant : ''} />
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
                  <Tabs defaultValue="q1" className="h-full flex flex-col min-h-0">
                    <TabsList className="w-full flex-wrap justify-start rounded-none border-b border-border bg-transparent h-auto p-0 gap-x-4 gap-y-2 pb-2">
                      {[
                        { v: 'q1', label: 'Q1 Trend', cls: 'data-[state=active]:border-primary' },
                        { v: 'q2', label: 'Q2 Pareto', cls: 'data-[state=active]:border-orange-500' },
                        { v: 'q3', label: 'Q3 Paynter', cls: 'data-[state=active]:border-blue-500' },
                        { v: 'q4', label: 'Q4 Actions', cls: 'data-[state=active]:border-emerald-500' },
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
                          <p className="text-[11px] text-muted-foreground">Auto-populated · edit or reorder as needed.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setTrendData([...trendData, { id: genId(), label: `WW${String(trendData.length + 1).padStart(2, '0')}`, ole: 0, target: 80, projected: false }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        <div className="grid text-[10px] text-muted-foreground uppercase tracking-wider px-7 gap-2" style={{ gridTemplateColumns: '1fr 5rem 5rem' }}>
                          <span>Label</span><span className="text-right">OLE %</span><span className="text-right">Target</span>
                        </div>
                        {trendData.map((t, i) => (
                          <div key={t.id}
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); handleTrendDrop(Number(e.dataTransfer.getData('text/plain')), i); }}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded border cursor-grab active:cursor-grabbing active:opacity-60 transition-opacity',
                              t.projected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
                            )}>
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            <div className="flex items-center gap-2 flex-1" style={{ display: 'grid', gridTemplateColumns: '1fr 5rem 5rem' }}>
                              <div className="flex items-center gap-1">
                                <Input value={t.label} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], label: e.target.value }; setTrendData(n); }} placeholder="Label" className="h-7 text-xs" />
                                {t.projected && <span className="text-[9px] text-primary font-semibold flex-shrink-0">▲</span>}
                              </div>
                              <Input type="number" value={t.ole} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], ole: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" />
                              <Input type="number" value={t.target} onChange={e => { const n = [...trendData]; n[i] = { ...n[i], target: Number(e.target.value) }; setTrendData(n); }} className="h-7 text-xs" />
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => setTrendData(trendData.filter((_, j) => j !== i))}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="q2" className="m-0 space-y-3">
                        <p className="text-[11px] text-muted-foreground">Auto-computed from last 4 weeks MH breakdown.</p>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Manual override (optional)</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setParetoRows([...paretoRows, { id: genId(), issue: '', count: 0 }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {paretoRows.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded border border-border">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                            <Input value={p.issue} onChange={e => { const n = [...paretoRows]; n[i].issue = e.target.value; setParetoRows(n); }} placeholder="Category" className="h-7 text-xs flex-1" />
                            <Input type="number" value={p.count} onChange={e => { const n = [...paretoRows]; n[i].count = Number(e.target.value); setParetoRows(n); }} placeholder="Count" className="h-7 text-xs w-20" />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setParetoRows(paretoRows.filter(x => x.id !== p.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="q3" className="m-0 space-y-2">
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

                      <TabsContent value="q4" className="m-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] text-muted-foreground">Track corrective actions.</p>
                          <Button variant="outline" size="sm" className="h-7 text-[11px]"
                            onClick={() => setActions([...actions, { id: genId(), issue: '', rootCause: '', action: '', owner: '', targetDate: '', status: 'Open' }])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {actions.map((a, i) => (
                          <div key={a.id} className="flex flex-col gap-2 bg-muted/30 p-2 rounded border border-border">
                            <div className="flex gap-2">
                              <Input value={a.issue} onChange={e => { const n = [...actions]; n[i].issue = e.target.value; setActions(n); }} placeholder="Issue" className="h-7 text-xs flex-1" />
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setActions(actions.filter(x => x.id !== a.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                            <Input value={a.rootCause} onChange={e => { const n = [...actions]; n[i].rootCause = e.target.value; setActions(n); }} placeholder="Root Cause" className="h-7 text-xs" />
                            <Input value={a.action} onChange={e => { const n = [...actions]; n[i].action = e.target.value; setActions(n); }} placeholder="Corrective Action" className="h-7 text-xs" />
                            <div className="flex gap-2">
                              <Input value={a.owner} onChange={e => { const n = [...actions]; n[i].owner = e.target.value; setActions(n); }} placeholder="Owner" className="h-7 text-xs w-1/3" />
                              <Input value={a.targetDate} onChange={e => { const n = [...actions]; n[i].targetDate = e.target.value; setActions(n); }} type="date" className="h-7 text-xs w-1/3" />
                              <Input value={a.status} onChange={e => { const n = [...actions]; n[i].status = e.target.value; setActions(n); }} placeholder="Status" className="h-7 text-xs w-1/3" />
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="settings" className="m-0 space-y-4 max-w-sm">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Report Title</Label>
                          <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs" />
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
