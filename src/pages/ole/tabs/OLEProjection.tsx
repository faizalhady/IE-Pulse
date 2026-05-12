import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOleWeekly } from '@/hooks/ole/useOleData';
import type { OleWeeklyResult } from '@/lib/ole/oleApi';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea, ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL = '__all__';

const FORMULA_COLORS: Record<string, string> = {
  sma3: '#3b82f6',
  sma5: '#6366f1',
  wma3: '#f59e0b',
  ema_fast: '#10b981',
  ema_slow: '#06b6d4',
  linear_reg: '#f43f5e',
};

const FORMULA_LABELS: Record<string, string> = {
  sma3: 'SMA (3w)',
  sma5: 'SMA (5w)',
  wma3: 'WMA (3w)',
  ema_fast: 'EMA Fast (3)',
  ema_slow: 'EMA Slow (9)',
  linear_reg: 'Linear Reg',
};

const ALL_FORMULA_KEYS = Object.keys(FORMULA_LABELS) as FormulaKey[];
type FormulaKey = 'sma3' | 'sma5' | 'wma3' | 'ema_fast' | 'ema_slow' | 'linear_reg';

// ─── Projection math ──────────────────────────────────────────────────────────

function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const window = values.slice(-n);
  return window.reduce((a, b) => a + b, 0) / n;
}

function wma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const window = values.slice(-n);
  let num = 0, den = 0;
  window.forEach((v, i) => { const w = i + 1; num += v * w; den += w; });
  return num / den;
}

function ema(values: number[], period: number): number | null {
  if (values.length === 0) return null;
  const alpha = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = alpha * values[i] + (1 - alpha) * e;
  return alpha * values[values.length - 1] + (1 - alpha) * e;
}

function linearReg(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (values[i] - meanY), 0);
  const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  return slope * n + intercept;
}

// ─── Build chart data ──────────────────────────────────────────────────────────

interface ChartPoint {
  week_label: string;
  actual: number | null;
  sma3?: number | null;
  sma5?: number | null;
  wma3?: number | null;
  ema_fast?: number | null;
  ema_slow?: number | null;
  linear_reg?: number | null;
  projected?: boolean;
}

function buildChartData(rows: OleWeeklyResult[], projectionWeeks: number): ChartPoint[] {
  const valid = rows.filter(r => r.ole_pct !== null);
  if (valid.length === 0) return [];

  const actuals = valid.map(r => r.ole_pct as number);

  const points: ChartPoint[] = valid.map((r, i) => ({
    week_label: r.week_label,
    actual: r.ole_pct,
    sma3: i >= 2 ? sma(actuals.slice(0, i + 1), 3) : null,
    sma5: i >= 4 ? sma(actuals.slice(0, i + 1), 5) : null,
    wma3: i >= 2 ? wma(actuals.slice(0, i + 1), 3) : null,
    ema_fast: i >= 1 ? ema(actuals.slice(0, i + 1), 3) : null,
    ema_slow: i >= 1 ? ema(actuals.slice(0, i + 1), 9) : null,
    linear_reg: i >= 1 ? linearReg(actuals.slice(0, i + 1)) : null,
    projected: false,
  }));

  const lastRow = valid[valid.length - 1];
  let projYear = lastRow.iso_year;
  let projWeek = lastRow.iso_week;

  for (let p = 1; p <= projectionWeeks; p++) {
    projWeek++;
    if (projWeek > 52) { projWeek = 1; projYear++; }
    const label = `${projYear}-W${String(projWeek).padStart(2, '0')}`;
    points.push({
      week_label: label,
      actual: null,
      sma3: sma(actuals, 3),
      sma5: sma(actuals, 5),
      wma3: wma(actuals, 3),
      ema_fast: ema(actuals, 3),
      ema_slow: ema(actuals, 9),
      linear_reg: linearReg(actuals),
      projected: true,
    });
  }

  return points;
}

// ─── MAE helper ───────────────────────────────────────────────────────────────

function mae(points: ChartPoint[], key: keyof ChartPoint): number | null {
  const pairs = points.filter(
    p => !p.projected && p.actual !== null && p[key] !== null && p[key] !== undefined
  );
  if (pairs.length === 0) return null;
  const sum = pairs.reduce((s, p) => s + Math.abs((p.actual as number) - (p[key] as number)), 0);
  return sum / pairs.length;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const isProjected = payload[0]?.payload?.projected;
  const ttStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    color: 'hsl(var(--foreground))',
    padding: '10px 14px',
    minWidth: 160,
  };
  return (
    <div style={ttStyle}>
      <p className="font-semibold text-foreground mb-2 text-xs">
        {label}{isProjected && <span className="text-primary ml-1">(projected)</span>}
      </p>
      {payload.map((entry: any) =>
        entry.value !== null && entry.value !== undefined ? (
          <div key={entry.dataKey} className="flex justify-between gap-4 text-xs">
            <span style={{ color: entry.color ?? entry.fill }}>{entry.name}</span>
            <span className="font-mono">{Number(entry.value).toFixed(1)}%</span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── Formula toggle pill ────────────────────────────────────────────────────────

function FormulaToggle({
  formulaKey, label, color, active, onToggle,
}: { formulaKey: string; label: string; color: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
        active
          ? 'border-transparent text-white'
          : 'border-border text-muted-foreground bg-transparent hover:text-foreground'
      )}
      style={active ? { backgroundColor: color, borderColor: color } : {}}
    >
      <span
        className="w-3 h-0.5 rounded-full inline-block"
        style={{ backgroundColor: active ? 'white' : color }}
      />
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OLEProjection() {
  const [workcell, setWorkcell] = useState('');
  const [projectionWeeks, setProjectionWeeks] = useState(3);
  const [activeFormulas, setActiveFormulas] = useState<Set<FormulaKey>>(
    new Set(ALL_FORMULA_KEYS)
  );

  function toggleFormula(key: FormulaKey) {
    setActiveFormulas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const weeklyHook = useOleWeekly({ workcell: workcell || undefined });
  const allRows = weeklyHook.data ?? [];
  const workcells = useMemo(() =>
    Array.from(new Set(allRows.map(r => r.workcell))).sort()
    , [allRows]);

  const byWorkcell = useMemo(() => {
    const map: Record<string, OleWeeklyResult[]> = {};
    allRows.forEach(r => {
      if (!map[r.workcell]) map[r.workcell] = [];
      map[r.workcell].push(r);
    });
    return map;
  }, [allRows]);

  const aggregateRows = useMemo(() => {
    const byWeek: Record<string, { smh: number; hrs: number; label: string; year: number; week: number }> = {};
    allRows.forEach(r => {
      if (!byWeek[r.week_label])
        byWeek[r.week_label] = { smh: 0, hrs: 0, label: r.week_label, year: r.iso_year, week: r.iso_week };
      byWeek[r.week_label].smh += r.total_output_smh;
      byWeek[r.week_label].hrs += r.total_input_hours;
    });
    return Object.values(byWeek)
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)
      .map(w => ({
        ...w,
        week_label: w.label, iso_year: w.year, iso_week: w.week,
        ole_pct: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : null,
      } as OleWeeklyResult));
  }, [allRows]);

  const targetWorkcells = workcell
    ? [[workcell, byWorkcell[workcell] ?? []] as [string, OleWeeklyResult[]]]
    : [['All Workcells', aggregateRows] as [string, OleWeeklyResult[]], ...Object.entries(byWorkcell)];

  if (weeklyHook.loading) return (
    <div className="px-6 py-12 space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse" />)}
    </div>
  );

  if (weeklyHook.error) return (
    <div className="px-6 py-12 text-center text-destructive text-sm">
      Failed to load weekly data — is the OLE backend running?
    </div>
  );

  return (
    <div className="px-6 pt-4 pb-10">
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <div className="min-w-[180px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
          <Select value={workcell || ALL} onValueChange={v => setWorkcell(v === ALL ? '' : v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Workcells</SelectItem>
              {workcells.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Projection Horizon</Label>
          <Select value={String(projectionWeeks)} onValueChange={v => setProjectionWeeks(Number(v))}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 week</SelectItem>
              <SelectItem value="2">2 weeks</SelectItem>
              <SelectItem value="3">3 weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Formula toggles */}
        <div className="flex flex-wrap items-center gap-2 ml-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Formulas</span>
          {ALL_FORMULA_KEYS.map(key => (
            <FormulaToggle
              key={key}
              formulaKey={key}
              label={FORMULA_LABELS[key]}
              color={FORMULA_COLORS[key]}
              active={activeFormulas.has(key)}
              onToggle={() => toggleFormula(key)}
            />
          ))}
        </div>

        {/* <div className="ml-auto text-xs text-muted-foreground">
          {allRows.length > 0
            ? `${allRows.length} weekly records · ${workcells.length} workcells`
            : 'No data'}
        </div> */}
      </div>

      {/* ── Charts ── */}
      <div className="space-y-6">
        {targetWorkcells.map(([wc, rows]) => {
        const chartData = buildChartData(rows, projectionWeeks);
        const firstProjected = chartData.find(p => p.projected)?.week_label;
        if (chartData.length === 0) return null;

        // Best formula by lowest MAE
        const maes = ALL_FORMULA_KEYS.map(f => ({ f, m: mae(chartData, f) })).filter(x => x.m !== null);
        const best = maes.length ? maes.reduce((a, b) => (a.m! < b.m! ? a : b)).f : null;

        return (
          <div key={wc} className="rounded-xl border border-border bg-card overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{wc}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {rows.filter(r => r.ole_pct !== null).length} weeks of data
                    &nbsp;·&nbsp;projecting {projectionWeeks}w ahead
                  </p>
                </div>

                {/* MAE scores */}
                <div className="flex flex-wrap items-center gap-3">
                  {ALL_FORMULA_KEYS.map(f => {
                    const m = mae(chartData, f);
                    if (m === null) return null;
                    const isBest = f === best;
                    return (
                      <div key={f} className={cn(
                        'text-center px-2.5 py-1.5 rounded-lg border',
                        isBest ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-muted/30'
                      )}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {FORMULA_LABELS[f]}{isBest && ' ★'}
                        </p>
                        <p className="text-xs font-mono font-semibold" style={{ color: FORMULA_COLORS[f] }}>
                          {m.toFixed(1)}% err
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="p-5">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="week_label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 130]}
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                  />
                  <Tooltip content={<ProjectionTooltip />} />

                  {/* Projected area highlight */}
                  {firstProjected && (
                    <ReferenceArea
                      x1={firstProjected}
                      fill="hsl(var(--primary) / 0.12)"
                      strokeOpacity={0}
                      label={{ value: 'PROJECTION', position: 'insideTop', fill: 'hsl(var(--primary))', fontSize: 10, fontWeight: 700, offset: 10 }}
                    />
                  )}

                  {/* Actual OLE — bar, matches OLEReport style */}
                  <Bar dataKey="actual" name="Actual OLE" maxBarSize={32} radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.projected ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary))'}
                        stroke={entry.projected ? 'hsl(var(--primary))' : 'none'}
                        strokeDasharray={entry.projected ? '4 4' : '0'}
                      />
                    ))}
                  </Bar>

                  {/* Formula lines — only if toggled on */}
                  {ALL_FORMULA_KEYS.filter(f => activeFormulas.has(f)).map(f => (
                    <Line
                      key={f}
                      dataKey={f}
                      name={FORMULA_LABELS[f]}
                      stroke={FORMULA_COLORS[f]}
                      strokeWidth={f === best ? 2.5 : 1.5}
                      strokeDasharray={f === 'linear_reg' ? '5 3' : undefined}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

