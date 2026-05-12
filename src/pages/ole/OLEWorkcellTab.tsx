import { useOlePredictions, useOleWeekly } from '@/hooks/ole/useOleData';
import { oleApi } from '@/lib/ole/oleApi';
import type { OleWeeklyResult } from '@/lib/ole/oleApi';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ComposedChart, Line, Pie, PieChart,
  ReferenceArea, ReferenceLine,
  ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
} from 'recharts';

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 11,
  color: 'hsl(var(--foreground))',
};

// ─── Backtesting helpers ──────────────────────────────────────────────────────

type FormulaKey = 'sma3' | 'sma5' | 'wma3' | 'ema_fast' | 'ema_slow' | 'cma' | 'linear_reg' | 'arima' | 'hw';

const FORMULA_COLORS: Record<string, string> = {
  sma3: '#3b82f6', sma5: '#6366f1', wma3: '#f59e0b',
  ema_fast: '#10b981', ema_slow: '#06b6d4',
  cma: '#a855f7', linear_reg: '#f43f5e',
  arima: '#f97316', hw: '#ec4899',
};

const FORMULA_LABELS: Record<string, string> = {
  sma3: 'SMA (3w)', sma5: 'SMA (5w)', wma3: 'WMA (3w)',
  ema_fast: 'EMA Fast', ema_slow: 'EMA Slow',
  cma: 'Cumulative MA', linear_reg: 'Linear Reg',
  arima: 'ARIMA', hw: 'Holt-Winters',
};

const ALL_FORMULA_KEYS = Object.keys(FORMULA_LABELS) as FormulaKey[];

function _sma(v: number[], n: number) { if (v.length < n) return null; const w = v.slice(-n); return w.reduce((a, b) => a + b, 0) / n; }
function _wma(v: number[], n: number) { if (v.length < n) return null; const w = v.slice(-n); let num = 0, den = 0; w.forEach((x, i) => { const wt = i + 1; num += x * wt; den += wt; }); return num / den; }
function _ema(v: number[], p: number) { if (!v.length) return null; const a = 2 / (p + 1); let e = v[0]; for (let i = 1; i < v.length; i++) e = a * v[i] + (1 - a) * e; return e; }
function _linReg(v: number[], s = 1) { const n = v.length; if (n < 2) return null; const xs = v.map((_, i) => i); const mx = xs.reduce((a, b) => a + b, 0) / n; const my = v.reduce((a, b) => a + b, 0) / n; const num = xs.reduce((s2, x, i) => s2 + (x - mx) * (v[i] - my), 0); const den = xs.reduce((s2, x) => s2 + (x - mx) ** 2, 0); if (!den) return null; const slope = num / den; return slope * (n - 1 + s) + (my - slope * mx); }

interface ChartPoint { week_label: string; actual: number | null; sma3?: number | null; sma5?: number | null; wma3?: number | null; ema_fast?: number | null; ema_slow?: number | null; cma?: number | null; linear_reg?: number | null; arima?: number | null; hw?: number | null; projected?: boolean; }

function buildChartData(rows: OleWeeklyResult[], projectionWeeks: number): ChartPoint[] {
  const valid = rows.filter(r => r.ole_pct !== null);
  if (!valid.length) return [];
  const actuals = valid.map(r => r.ole_pct as number);
  const points: ChartPoint[] = valid.map((r, i) => ({
    week_label: r.week_label, actual: r.ole_pct,
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
    if (s3) s3d.push(s3); if (s5) s5d.push(s5); if (w3) w3d.push(w3); if (ef) efd.push(ef); if (es) esd.push(es); if (cm) cmd.push(cm);
    points.push({ week_label: `${py}-W${String(pw).padStart(2, '0')}`, actual: null, sma3: s3, sma5: s5, wma3: w3, ema_fast: ef, ema_slow: es, cma: cm, linear_reg: lr, projected: true });
  }
  return points;
}

function mae(points: ChartPoint[], key: keyof ChartPoint) {
  const pairs = points.filter(p => !p.projected && p.actual !== null && p[key] !== null && p[key] !== undefined);
  if (!pairs.length) return null;
  return pairs.reduce((s, p) => s + Math.abs((p.actual as number) - (p[key] as number)), 0) / pairs.length;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Hdr({ title, sub, badge }: { title: string; sub?: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {badge}
    </div>
  );
}

function Skeleton() { return <div className="h-full rounded-xl bg-muted/40 animate-pulse" />; }

function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>{payload.name}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={fill} fontSize={18} fontWeight={800}>{payload.value.toFixed(1)}</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Chart 1: OLE Weekly Trend ────────────────────────────────────────────────

function OleTrendChart({ rows, loading }: { rows: OleWeeklyResult[]; loading: boolean }) {
  const data = useMemo(() =>
    rows.map(r => ({ w: `WW${String(r.iso_week).padStart(2, '0')}`, ole: r.ole_pct !== null ? Math.round(r.ole_pct * 100) / 100 : null })).filter(r => r.ole !== null)
  , [rows]);
  const oles = data.map(d => d.ole as number);
  const yMin = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax = oles.length ? Math.ceil(Math.max(...oles) / 10) * 10 + 10 : 100;
  const sub = data.length ? `${data[0].w} → ${data[data.length - 1].w} · ${data.length} weeks` : 'No data';
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Hdr title="OLE weekly trend" sub={sub} />
      <div style={{ height: 240 }}>
        {loading ? <Skeleton /> : !data.length ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No OLE data for this selection</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="wcGO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']} />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: '80%', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="ole" name="OLE" stroke="hsl(var(--primary))" fill="url(#wcGO)" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Chart 2: HC Ratio Trend (VA% vs NVA% stacked) ──────────────────────────

function HcTrendChart({ rows, loading }: { rows: OleWeeklyResult[]; loading: boolean }) {
  const data = useMemo(() =>
    rows.map(r => {
      const total = r.total_input_hours;
      const va  = total > 0 ? Math.round((r.total_va_hours  / total) * 10000) / 100 : 0;
      const nva = total > 0 ? Math.round((r.total_nva_hours / total) * 10000) / 100 : 0;
      return { w: `WW${String(r.iso_week).padStart(2, '0')}`, va, nva };
    })
  , [rows]);
  const sub = data.length ? `${data[0].w} → ${data[data.length - 1].w} · VA vs NVA ratio` : 'No data';
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Hdr title="HC Ratio Trend — VA vs NVA %" sub={sub} />
      <div style={{ height: 240 }}>
        {loading ? <Skeleton /> : !data.length ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No headcount data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }} stackOffset="expand">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TT}
                formatter={(v: number, name: string, props: any) => {
                  const total = props.payload.va + props.payload.nva;
                  const raw = name === 'VA %' ? props.payload.va : props.payload.nva;
                  return [`${raw.toFixed(1)}%`, name];
                }} />
              <Bar dataKey="va"  name="VA %"  stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill="#0d9488">
                    {/* label inside bar */}
                  </Cell>
                ))}
              </Bar>
              <Bar dataKey="nva" name="NVA %" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center gap-5 mt-2 justify-center">
        {[['VA %', '#0d9488'], ['NVA %', '#eab308']].map(([n, c]) => (
          <span key={n} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-2.5 inline-block rounded" style={{ background: c }} />{n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Chart 3: Predictive Backtesting ─────────────────────────────────────────

function BacktestingChart({ rows, loading, wcLabel }: { rows: OleWeeklyResult[]; loading: boolean; wcLabel: string }) {
  const isAll = !wcLabel || wcLabel === '__all__';
  const predictions = useOlePredictions({ workcell: wcLabel, projection_weeks: 3 }, isAll || loading);
  const chartData = useMemo(() => {
    const base = buildChartData(rows, 3);
    if (isAll || !predictions.data?.length) return base;
    return base.map(b => { const pred = predictions.data!.find(p => p.week_label === b.week_label); return pred ? { ...b, arima: pred.arima, hw: pred.hw } : b; });
  }, [rows, predictions.data, isAll]);
  const firstProjected = chartData.find(p => p.projected)?.week_label;
  const maes = ALL_FORMULA_KEYS.filter(f => !isAll || (f !== 'arima' && f !== 'hw')).map(f => ({ f, m: mae(chartData, f as any) })).filter(x => x.m !== null);
  const best = maes.length ? maes.reduce((a, b) => a.m! < b.m! ? a : b).f : null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
      <Hdr title={`Predictive backtesting — ${isAll ? 'all workcells' : wcLabel}`} sub={rows.filter(r => r.ole_pct !== null).length + ' weeks · 3w projection'}
        badge={best ? <span className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 whitespace-nowrap">Best: {FORMULA_LABELS[best]}</span> : undefined} />
      <div className="flex flex-wrap gap-2 mb-3">
        {maes.map(({ f, m }) => (
          <div key={f} className={cn('text-center px-2 py-1 rounded border', f === best ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-muted/30')}>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{FORMULA_LABELS[f]}</p>
            <p className="text-[11px] font-mono font-semibold" style={{ color: FORMULA_COLORS[f] }}>{m!.toFixed(1)}%</p>
          </div>
        ))}
      </div>
      <div style={{ height: 220 }}>
        {loading ? <Skeleton /> : !chartData.length ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Not enough data to backtest</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
              <XAxis dataKey="week_label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 130]} tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={38} />
              <Tooltip contentStyle={TT} formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, name]} />
              {firstProjected && <ReferenceArea x1={firstProjected} fill="hsl(var(--primary) / 0.08)" strokeOpacity={0} label={{ value: 'PREDICTION', position: 'insideTop', fill: 'hsl(var(--primary))', fontSize: 9, fontWeight: 700, offset: 6 }} />}
              <Bar dataKey="actual" name="Actual OLE" maxBarSize={28} radius={[4, 4, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.projected ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--primary))'} stroke={e.projected ? 'hsl(var(--primary))' : 'none'} strokeDasharray={e.projected ? '4 4' : '0'} />)}
              </Bar>
              {ALL_FORMULA_KEYS.filter(f => !isAll || (f !== 'arima' && f !== 'hw')).map(f => (
                <Line key={f} dataKey={f} name={FORMULA_LABELS[f]} stroke={FORMULA_COLORS[f]} strokeWidth={f === best ? 2.5 : 1.5} strokeDasharray={f === 'linear_reg' ? '5 3' : f === 'arima' || f === 'hw' ? '3 3' : undefined} dot={false} connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Chart 4: Man-Hours Distribution (real data) ──────────────────────────────

function DonutChart({ workcell, dateFrom, dateTo }: { workcell?: string; dateFrom?: string; dateTo?: string }) {
  const [slice, setSlice] = useState(0);
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    oleApi.ole.mhBreakdown({
      workcell:  workcell  || undefined,
      date_from: dateFrom  || undefined,
      date_to:   dateTo    || undefined,
    })
      .then(res => { setData(res.slices.filter(s => s.value > 0)); setLoading(false); })
      .catch(() => { setData([]); setLoading(false); });
  }, [workcell, dateFrom, dateTo]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col">
      <Hdr title="Man-hours distribution" sub="Hover a slice · hours" />
      <div style={{ height: 200 }}>
        {loading ? <Skeleton /> : !data.length ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={80}
                dataKey="value" activeIndex={slice}
                activeShape={(props: any) => {
                  const total = data.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? (props.payload.value / total * 100).toFixed(1) : '0.0';
                  const hrs = props.payload.value.toFixed(1);
                  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
                  return (
                    <g>
                      <text x={cx} y={cy - 18} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>{payload.name}</text>
                      <text x={cx} y={cy + 4} textAnchor="middle" fill={fill} fontSize={16} fontWeight={800}>{pct}%</text>
                      <text x={cx} y={cy + 20} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>{hrs} hrs</text>
                      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 11} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                    </g>
                  );
                }}
                onMouseEnter={(_, i) => setSlice(i)}>
                {data.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="space-y-1.5 mt-3">
        {data.map(d => {
          const total = data.reduce((s, x) => s + x.value, 0);
          const pct = total > 0 ? (d.value / total * 100).toFixed(1) : '0.0';
          return (
            <div key={d.name} className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
              <span className="font-mono text-muted-foreground">{d.value.toFixed(1)} hrs</span>
              <span className="font-mono font-semibold text-foreground w-10 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEWorkcellTab({ workcell, dateFrom, dateTo }: { workcell: string; dateFrom: string; dateTo: string }) {
  const { data: rawWeekly, loading } = useOleWeekly();

  const rows = useMemo((): OleWeeklyResult[] => {
    const all = rawWeekly ?? [];

    // Apply workcell + date filters in-browser (hooks now return all data)
    const filtered = all.filter(r =>
      (!workcell  || r.workcell === workcell) &&
      (!dateFrom  || r.week_start_date >= dateFrom) &&
      (!dateTo    || r.week_start_date <= dateTo)
    );

    // If a specific workcell is selected, return its rows directly
    if (workcell) return filtered;

    // No workcell selected — aggregate across all workcells by week
    if (!filtered.length) return [];
    const byWeek: Record<string, { smh: number; hrs: number; qty: number; shifts: number; hc: number; va: number; nva: number; count: number; label: string; year: number; week: number; ws: string; we: string; }> = {};
    filtered.forEach(r => {
      if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, qty: 0, shifts: 0, hc: 0, va: 0, nva: 0, count: 0, label: r.week_label, year: r.iso_year, week: r.iso_week, ws: r.week_start_date, we: r.week_end_date };
      const b = byWeek[r.week_label];
      b.smh += r.total_output_smh; b.hrs += r.total_input_hours; b.qty += r.total_qty;
      b.shifts += r.shift_count; b.hc += r.avg_hc_direct; b.va += r.total_va_hours; b.nva += r.total_nva_hours; b.count++;
    });
    return Object.values(byWeek).sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week).map(w => ({
      workcell: 'All', iso_year: w.year, iso_week: w.week, week_label: w.label,
      week_start_date: w.ws, week_end_date: w.we, stage_label: 'All', scan_stage: 'All',
      total_qty: w.qty, shift_count: w.shifts, total_output_smh: w.smh, total_input_hours: w.hrs,
      avg_hc_direct: w.count > 0 ? Math.round((w.hc / w.count) * 10) / 10 : 0,
      total_va_hours: w.va, total_nva_hours: w.nva,
      ole_pct: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : null,
      ole_pct_avg_shifts: null, shifts_ok: 0, shifts_flagged: 0, smh_coverage_pct: null,
    } as OleWeeklyResult));
  }, [rawWeekly, workcell, dateFrom, dateTo]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <OleTrendChart    rows={rows} loading={loading} />
      <HcTrendChart     rows={rows} loading={loading} />
      <BacktestingChart rows={rows} loading={loading} wcLabel={workcell || '__all__'} />
      <DonutChart workcell={workcell || undefined} dateFrom={dateFrom || undefined} dateTo={dateTo || undefined} />
    </div>
  );
}
