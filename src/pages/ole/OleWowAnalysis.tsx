import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DL_WEEKLY_DATA,
  PLANT_OLE_GOAL,
  useAnalysisData,
  useAnalysisDerived,
} from '@/hooks/ole/useAnalysisData';
import { ChartCard } from '@/components/ole/ChartCard';
import { ExpandModal } from '@/components/ole/ExpandModal';
import { TEMP_EXCLUDED_WORKCELLS } from '@/lib/ole/oleConstants';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';

const MOCK_TREND_WEEKS = ['WW05', 'WW06', 'WW07', 'WW08', 'WW09', 'WW10', 'WW11', 'WW12', 'WW13', 'WW14', 'WW15', 'WW16', 'WW17', 'WW18'];
const MOCK_BUILD_UNIT = MOCK_TREND_WEEKS.map((w, i) => ({ week: w, units: [246205, 250980, 279903, 230100, 306014, 306940, 374289, 195906, 329074, 363706, 390703, 394433, 351715, 403557][i] }));
const MOCK_INPUT_HRS = MOCK_TREND_WEEKS.map((w, i) => ({ week: w, hrs: [144710, 133057, 155484, 114545, 142020, 150222, 151427, 93413, 141783, 170450, 176851, 171134, 194193, 204081][i] }));
const MOCK_DL = DL_WEEKLY_DATA;

const TT = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 11,
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))', fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.1)' },
};

const OLEPrevLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return <text x={x + width / 2} y={y - 6} textAnchor="end" fontSize={13} fontWeight={700} fill="#93c5fd">{value}%</text>;
};
const OLECurrLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return <text x={x + width / 2} y={y - 6} textAnchor="start" fontSize={13} fontWeight={700} fill="hsl(var(--foreground))">{value}%</text>;
};

const GapBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value == null) return null;
  const pos = value >= 0;
  const barW = Math.abs(width);
  const text = value === 0 ? '0' : `${pos ? '+' : '-'}${Math.abs(value).toLocaleString()}`;
  const fits = barW > text.length * 6.5 + 10;
  // For negative bars: x = zero-line (right end), bar extends LEFT, so left edge = x - barW
  const leftEnd = pos ? x : x - barW;
  const labelX = pos
    ? fits ? x + barW - 6 : x + barW + 4          // positive: inside-right or outside-right
    : fits ? leftEnd + 6  : x - 6;                 // negative: inside-left or inside near zero
  const anchor = pos
    ? fits ? 'end'   : 'start'
    : fits ? 'start' : 'end';
  return <text x={labelX} y={y + height / 2}
    dominantBaseline="central" textAnchor={anchor}
    fontSize={12} fontWeight={700} fill="hsl(var(--foreground))">{text}</text>;
};

const IMPACT_COLORS = ['#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5'];

function BuildUnitRecharts() {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={MOCK_BUILD_UNIT} margin={{ top: 4, right: 4, left: 0, bottom: -10 }}><defs><linearGradient id="buGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6b7280" stopOpacity={0.35} /><stop offset="95%" stopColor="#6b7280" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} /><Tooltip {...TT} formatter={(v: number) => [`${(v / 1000).toFixed(0)}K`, 'Units']} /><Area type="monotone" dataKey="units" stroke="#9ca3af" strokeWidth={2} fill="url(#buGrad)" dot={false} /></AreaChart></ResponsiveContainer>;
}
function DLWeeklyRecharts() {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={MOCK_DL} margin={{ top: 4, right: 4, left: 0, bottom: -10 }}><defs><linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} /><Tooltip {...TT} formatter={(v: number) => [v?.toLocaleString() ?? '—', 'DL']} /><Area type="monotone" dataKey="dl" stroke="#3b82f6" strokeWidth={2} fill="url(#dlGrad)" dot={false} /></AreaChart></ResponsiveContainer>;
}
function InputHrsRecharts() {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={MOCK_INPUT_HRS} margin={{ top: 4, right: 4, left: 0, bottom: -10 }}><defs><linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="week" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} /><YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} /><Tooltip {...TT} formatter={(v: number) => [`${(v / 1000).toFixed(1)}K`, 'Hrs']} /><Area type="monotone" dataKey="hrs" stroke="#10b981" strokeWidth={2} fill="url(#hrGrad)" dot={false} /></AreaChart></ResponsiveContainer>;
}

function OLECompareRecharts({ data, prevWeek, currWeek }: { data: { name: string; prev: number; curr: number }[]; prevWeek: string; currWeek: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 26, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 110]} tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={36} />
        <Bar dataKey="prev" fill="#60a5fa" radius={[3, 3, 0, 0]} label={<OLEPrevLabel />} />
        <Bar dataKey="curr" fill="#1d4ed8" radius={[3, 3, 0, 0]} label={<OLECurrLabel />} />
        <ReferenceLine y={PLANT_OLE_GOAL * 100} stroke="#10b981" strokeDasharray="4 3" strokeWidth={1.5} />
        <Tooltip {...TT} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} formatter={(v: number, n: string) => [`${v}%`, n === 'prev' ? prevWeek : currWeek]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ImpactRecharts({ data }: { data: { name: string; value: number }[] }) {
  const visible = data.filter(d => d.value > 0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  return (
    <div className="flex gap-3 w-full h-full">
      <div className="min-w-0 min-h-0" style={{ flex: '0 0 55%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={visible} cx="50%" cy="50%" innerRadius="45%" outerRadius="78%" dataKey="value" labelLine={false} label={false} strokeWidth={0}
              onMouseEnter={(_, i) => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}>
              {visible.map((_, i) => <Cell key={i} fill={IMPACT_COLORS[i % IMPACT_COLORS.length]} opacity={activeIdx === null || activeIdx === i ? 1 : 0.35} style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }} />)}
            </Pie>
            <Tooltip {...TT} formatter={(v: number, _: any, p: any) => [`${v}%`, p.payload?.name]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center gap-1 overflow-y-auto min-w-0" style={{ flex: '1 1 0' }}>
        {visible.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2 rounded-md px-2 py-0.5 cursor-pointer hover:bg-accent transition-colors"
            onMouseEnter={() => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)}>
            <span className="inline-block shrink-0 rounded-sm" style={{ width: 8, height: 8, background: IMPACT_COLORS[i % IMPACT_COLORS.length] }} />
            <span className="text-[9px] text-muted-foreground truncate flex-1" title={entry.name}>{entry.name}</span>
            <span className="text-[10px] font-bold text-foreground shrink-0 tabular-nums ml-2">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildGapRecharts({ data, prevWeek, currWeek }: { data: { name: string; gap: number; curr_qty: number; prev_qty: number }[]; prevWeek: string; currWeek: string }) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const positive = d.gap >= 0;
    return (
      <div style={TT.contentStyle}>
        <p className="font-semibold text-foreground mb-1.5" style={{ fontSize: 11 }}>{d.name}</p>
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between gap-4">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{prevWeek}</span>
            <span className="font-mono font-bold" style={{ color: 'hsl(var(--foreground))' }}>{d.prev_qty.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{currWeek}</span>
            <span className="font-mono font-bold" style={{ color: 'hsl(var(--foreground))' }}>{d.curr_qty.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-1 mt-0.5">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Gap</span>
            <span className="font-mono font-bold" style={{ color: positive ? '#22c55e' : '#f87171' }}>
              {positive ? '+' : ''}{d.gap.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: -30, bottom: -15 }}>
        <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={130} interval={0} />
        <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
        <Bar dataKey="gap" radius={[0, 3, 3, 0]} label={<GapBarLabel />}>
          {data.map((e, i) => <Cell key={i} fill={e.gap >= 0 ? '#22c55e' : '#f87171'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function OLECompareSection({ data, prevWeek, currWeek }: { data: { name: string; prev: number; curr: number }[]; prevWeek: string; currWeek: string }) {
  const goalPct = PLANT_OLE_GOAL * 100;
  const legend = (
    <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-2 shrink-0">
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-blue-400" />{prevWeek}</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 rounded-sm bg-blue-700" />{currWeek}</span>
      <span className="flex items-center gap-1"><span className="inline-block w-6 h-[1.5px] bg-emerald-500" />Goal {goalPct}%</span>
    </div>
  );
  return (
    <ChartCard title={`OLE ${prevWeek} vs OLE ${currWeek}`} className="flex-1 min-h-0"
      expandContent={<div className="flex flex-col h-full">{legend}<div className="flex-1 min-h-0"><OLECompareRecharts data={data} prevWeek={prevWeek} currWeek={currWeek} /></div></div>}>
      {legend}
      <div className="flex-1 min-h-0"><OLECompareRecharts data={data} prevWeek={prevWeek} currWeek={currWeek} /></div>
    </ChartCard>
  );
}

export default function OleWowAnalysis() {
  const { rawRows, weekPairs, loading, error } = useAnalysisData();
  const [selectedPairIdx, setSelectedPairIdx] = useState(0);
  const pair = weekPairs[selectedPairIdx] ?? { curr: '', prev: '' };
  const derived = useAnalysisDerived(rawRows, pair.curr, pair.prev);

  return (
    <div className="flex flex-col gap-3 p-4 h-screen overflow-hidden bg-background text-foreground">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight">OLE Analysis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Penang Island · Week-over-Week Performance</p>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Week</Label>
          <Select value={String(selectedPairIdx)} onValueChange={v => setSelectedPairIdx(Number(v))} disabled={loading || !!error}>
            <SelectTrigger className="mt-1 h-9 min-w-[180px]"><SelectValue placeholder="Select week…" /></SelectTrigger>
            <SelectContent>
              {weekPairs.map((p, i) => <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>)}
              {!weekPairs.length && <SelectItem value="0" disabled>Loading…</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Loading…</div>}
      {!loading && error && <div className="flex flex-1 items-center justify-center"><div className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-red-400 text-center"><p className="font-semibold mb-1">Could not load data</p><p className="text-xs opacity-70">{error}</p></div></div>}

      {/* {!loading && !error && derived && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400 shrink-0">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span><strong>{pair.curr} vs {pair.prev}</strong> — Site build unit delta: <strong>{derived.siteGap >= 0 ? '+' : ''}{derived.siteGap.toLocaleString()} units</strong>.{derived.topImpact && <> Largest impact: <strong>{derived.topImpact.name}</strong> ({derived.topImpact.value}%).</>}</span>
        </div>
      )} */}

      {!loading && !error && derived && (
        <div className="flex gap-3 flex-1 min-h-0">
          <div className="flex flex-col gap-3 w-[22%] shrink-0">
            <ChartCard title="Pen Island Build Unit" className="flex-1 min-h-0" expandContent={<BuildUnitRecharts />}><div className="flex-1 min-h-0"><BuildUnitRecharts /></div></ChartCard>
            <ChartCard title="Pen Island DL Weekly Data" className="flex-1 min-h-0" expandContent={<DLWeeklyRecharts />}><div className="flex-1 min-h-0"><DLWeeklyRecharts /></div></ChartCard>
            <ChartCard title="Pen Island Input Working Hrs" className="flex-1 min-h-0" expandContent={<InputHrsRecharts />}><div className="flex-1 min-h-0"><InputHrsRecharts /></div></ChartCard>
          </div>
          <div className="flex flex-col gap-3 flex-1 min-h-0 min-w-0">
            <div className="flex-1 min-h-0 flex flex-col"><OLECompareSection data={derived.oleCompareSeries} prevWeek={pair.prev} currWeek={pair.curr} /></div>
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
              <ChartCard title="Impact by Workcell" className="flex-1 min-h-[200px]" expandContent={<ImpactRecharts data={derived.impactSeries} />}><div className="flex-1 min-h-0"><ImpactRecharts data={derived.impactSeries} /></div></ChartCard>
              <ChartCard title="Build Unit Gap by Workcell" className="flex-1 min-h-[200px]" expandContent={<BuildGapRecharts data={derived.buildGapSeries} prevWeek={pair.prev} currWeek={pair.curr} />}><div className="flex-1 min-h-0"><BuildGapRecharts data={derived.buildGapSeries} prevWeek={pair.prev} currWeek={pair.curr} /></div></ChartCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
