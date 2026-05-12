/**
 * OLEHome3.tsx — Magazine Grid / Bento
 * ─────────────────────────────────────────────────────────────────────────────
 * Asymmetric bento-box layout. Hero OLE card on the left, supporting cards
 * in a responsive grid on the right. Content is scannable at a glance.
 * Every metric card is clickable and opens a drill-down drawer.
 *
 * Layer order (same content as all homes):
 *  1. Site Hero card      — big OLE number, trend, target gap
 *  2. Plant cards         — Plant 1 vs Plant 2 compact tiles
 *  3. Weekly trend chart  — inline card, clickable bars
 *  4. OLE formula row     — Output ÷ Input = OLE, each clickable
 *  5. Workcell grid       — compact tiles sorted worst-first
 *  6. Loss breakdown      — horizontal bar chart card
 *  7. Attention strip     — compact flagged items
 */

import { cn } from '@/lib/utils';
import {
  getOleStatus, oleColor,
  OLE_COLOR, STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS, fmtDate, shiftLabel,
} from '@/lib/ole/oleConstants';
import {
  MOCK_SUMMARY, MOCK_WEEKLY, MOCK_MH_BREAKDOWN, MOCK_MH_BY_WC,
  MOCK_SHIFTS, MOCK_PRODUCTION, MOCK_PAID_HOURS, MOCK_SMH_LOOKUP,
  MOCK_ATTENTION, MOCK_WORKCELLS,
  getSiteAggregate, getPlantAggregate,
} from './mockOleData';
import {
  AlertTriangle, ArrowRight, ChevronRight,
  TrendingUp, TrendingDown, Info, X,
  Clock, Layers, BarChart2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 11,
  color: 'hsl(var(--foreground))',
};

// ─── Drill-down drawer (same logic as Home 2) ─────────────────────────────────
type DrawerContent =
  | { kind: 'ole_formula'; workcell?: string }
  | { kind: 'output_smh'; workcell: string }
  | { kind: 'input_hours'; workcell: string }
  | { kind: 'loss_detail'; workcell?: string }
  | null;

function Drawer({ content, onClose }: { content: DrawerContent; onClose: () => void }) {
  const navigate = useNavigate();
  if (!content) return null;
  const wc      = (content as any).workcell;
  const summary = wc ? MOCK_SUMMARY.find(s => s.workcell === wc) : null;
  const mhData  = wc ? MOCK_MH_BY_WC[wc] : MOCK_MH_BREAKDOWN;
  const shifts  = wc ? MOCK_SHIFTS.filter(s => s.workcell === wc) : MOCK_SHIFTS;
  const prod    = wc ? MOCK_PRODUCTION.filter(p => p.workcell === wc) : MOCK_PRODUCTION;
  const hours   = wc ? MOCK_PAID_HOURS.filter(h => h.workcell === wc) : MOCK_PAID_HOURS;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[500px] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">
              {content.kind === 'ole_formula' && `OLE Breakdown${wc ? ` — ${wc}` : ' — Site'}`}
              {content.kind === 'output_smh'  && `Output SMH — ${wc}`}
              {content.kind === 'input_hours' && `Input Hours — ${wc}`}
              {content.kind === 'loss_detail' && `Loss Categories${wc ? ` — ${wc}` : ' — Site'}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {content.kind === 'ole_formula' && 'OLE = Σ(Qty × SMH/unit) ÷ Σ(Paid Hours) × 100%'}
              {content.kind === 'output_smh'  && 'Assembly-level: Qty × SMH/unit'}
              {content.kind === 'input_hours' && 'Direct paid hours per employee'}
              {content.kind === 'loss_detail' && '% of total paid hours by category'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {content.kind === 'ole_formula' && (
            <>
              <div className="flex items-stretch gap-3">
                <div className="flex-1 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output SMH</p>
                  <p className="text-3xl font-mono font-bold text-primary">
                    {(summary?.total_output_smh ?? MOCK_MH_BREAKDOWN.slices[0].value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Σ(Qty × SMH/unit)</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <span className="text-3xl font-light text-muted-foreground">÷</span>
                </div>
                <div className="flex-1 rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input Hours</p>
                  <p className="text-3xl font-mono font-bold text-violet-400">
                    {(summary?.total_input_hours ?? MOCK_MH_BREAKDOWN.total_input_hours).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Σ(Paid Hours)</p>
                </div>
              </div>
              <div className="rounded-xl border-2 border-border bg-muted/20 p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">OLE Result</p>
                {(() => {
                  const out = summary?.total_output_smh ?? MOCK_MH_BREAKDOWN.slices[0].value;
                  const inp = summary?.total_input_hours ?? MOCK_MH_BREAKDOWN.total_input_hours;
                  const ole = inp > 0 ? (out / inp) * 100 : 0;
                  const st  = getOleStatus(ole);
                  return <p className={cn('text-5xl font-mono font-bold', OLE_COLOR[st])}>{ole.toFixed(1)}%</p>;
                })()}
              </div>
              <p className="text-xs font-semibold text-foreground">Shift Breakdown</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid bg-muted/50 text-[10px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '5rem 4rem 6rem 6rem 5rem' }}>
                  {['Date', 'Shift', 'Output', 'Input', 'OLE'].map(h => <div key={h} className="px-3 py-2">{h}</div>)}
                </div>
                {shifts.slice(0, 5).map((s, i) => {
                  const st = getOleStatus(s.ole_pct);
                  return (
                    <div key={i} className="grid items-center text-xs border-b border-border last:border-0 hover:bg-muted/20"
                      style={{ gridTemplateColumns: '5rem 4rem 6rem 6rem 5rem', height: 40 }}>
                      <div className="px-3 font-mono text-muted-foreground">{fmtDate(s.date)}</div>
                      <div className="px-3 font-mono">{shiftLabel(s.shift)}</div>
                      <div className="px-3 font-mono">{s.effective_output_smh.toFixed(1)}</div>
                      <div className="px-3 font-mono">{s.total_input_hours.toFixed(1)}</div>
                      <div className={cn('px-3 font-mono font-bold', OLE_COLOR[st])}>{s.ole_pct ?? '—'}%</div>
                    </div>
                  );
                })}
              </div>
              {wc && (
                <button onClick={() => navigate(`/ole/${encodeURIComponent(wc)}`)}
                  className="w-full rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                  Open Full Workcell Detail <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          {content.kind === 'output_smh' && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Output SMH</p>
                <p className="text-4xl font-mono font-bold text-primary">
                  {summary?.total_output_smh.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
                <p className="text-xs text-muted-foreground mt-1">= Σ(Assembly Qty × SMH/unit)</p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid bg-muted/50 text-[10px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '1fr 4rem 5rem 6rem' }}>
                  {['Assembly', 'Qty', 'SMH/unit', 'Output'].map(h => <div key={h} className="px-3 py-2">{h}</div>)}
                </div>
                {prod.map((p, i) => {
                  const smh = MOCK_SMH_LOOKUP[p.assembly] ?? null;
                  const out = smh !== null ? p.qty * smh : null;
                  return (
                    <div key={i} className="grid items-center text-xs border-b border-border last:border-0 hover:bg-muted/20"
                      style={{ gridTemplateColumns: '1fr 4rem 5rem 6rem', height: 44 }}>
                      <div className="px-3 font-mono truncate text-foreground">{p.assembly}</div>
                      <div className="px-3 font-mono font-semibold text-foreground">{p.qty}</div>
                      <div className="px-3 font-mono text-muted-foreground">{smh !== null ? smh.toFixed(4) : '—'}</div>
                      <div className="px-3 font-mono font-bold text-primary">{out !== null ? out.toFixed(2) : '—'}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {content.kind === 'input_hours' && (
            <>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Input Hours</p>
                <p className="text-4xl font-mono font-bold text-violet-400">
                  {summary?.total_input_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
                <p className="text-xs text-muted-foreground mt-1">TPHDirect — direct + support</p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid bg-muted/50 text-[10px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '1fr 4rem 4rem 5rem' }}>
                  {['Name', 'Type', 'HC', 'Hours'].map(h => <div key={h} className="px-3 py-2">{h}</div>)}
                </div>
                {hours.map((h, i) => (
                  <div key={i} className="grid items-center text-xs border-b border-border last:border-0 hover:bg-muted/20"
                    style={{ gridTemplateColumns: '1fr 4rem 4rem 5rem', height: 40 }}>
                    <div className="px-3 text-foreground truncate">{h.name}</div>
                    <div className="px-3">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                        h.value_type === 'VA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30')}>
                        {h.value_type}
                      </span>
                    </div>
                    <div className="px-3 font-mono text-foreground">{h.thc_direct}</div>
                    <div className="px-3 font-mono font-semibold text-violet-400">{h.tph_direct.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {content.kind === 'loss_detail' && (
            <>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mhData?.slices.map(s => ({ name: s.name.split('/')[0].trim(), value: s.value, color: s.color }))}
                    layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)} hrs`]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {mhData?.slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {mhData?.slices.map(s => {
                  const pct = (s.value / mhData.total_input_hours * 100).toFixed(1);
                  return (
                    <div key={s.name} className="flex items-center gap-3 text-sm">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-foreground">{s.name}</span>
                      <span className="font-mono text-muted-foreground">{s.value.toFixed(1)} hrs</span>
                      <span className="font-mono font-bold text-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEHome3() {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<DrawerContent>(null);
  const [plant, setPlant] = useState<'all' | 'Plant 1' | 'Plant 2'>('all');

  const filteredSummary = useMemo(() =>
    plant === 'all' ? MOCK_SUMMARY :
    MOCK_SUMMARY.filter(r => MOCK_WORKCELLS.find(w => w.workcell === r.workcell)?.plant === plant)
  , [plant]);

  const site = useMemo(() => getSiteAggregate(filteredSummary), [filteredSummary]);
  const p1   = useMemo(() => getPlantAggregate('Plant 1'), []);
  const p2   = useMemo(() => getPlantAggregate('Plant 2'), []);

  const siteWeekly = useMemo(() => {
    const rows = plant === 'all' ? MOCK_WEEKLY : MOCK_WEEKLY.filter(r =>
      MOCK_WORKCELLS.find(w => w.workcell === r.workcell)?.plant === plant);
    const byWeek: Record<string, { smh: number; hrs: number; week: number }> = {};
    rows.forEach(r => {
      if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, week: r.iso_week };
      byWeek[r.week_label].smh += r.total_output_smh;
      byWeek[r.week_label].hrs += r.total_input_hours;
    });
    return Object.values(byWeek)
      .sort((a, b) => a.week - b.week)
      .map(w => ({
        w:   `WW${String(w.week).padStart(2, '0')}`,
        ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
      }));
  }, [plant]);

  const workcellsSorted = useMemo(() =>
    [...filteredSummary].sort((a, b) => (a.avg_ole_pct ?? 0) - (b.avg_ole_pct ?? 0))
  , [filteredSummary]);

  const last2     = siteWeekly.slice(-2);
  const trendUp   = last2.length === 2 && last2[1].ole > last2[0].ole;
  const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;
  const siteOle   = site.ole_pct;
  const siteStatus= getOleStatus(siteOle);
  const siteColor = oleColor(siteOle);
  const oles      = siteWeekly.map(d => d.ole).filter(Boolean);
  const yMin      = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax      = oles.length ? Math.ceil(Math.max(...oles) / 10) * 10 + 10 : 100;
  const mh        = MOCK_MH_BREAKDOWN;
  const attention = MOCK_ATTENTION;

  return (
    <div className="relative">
      {drawer && <Drawer content={drawer} onClose={() => setDrawer(null)} />}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-foreground">OLE Overview</span>
          <span className="ml-2 text-xs text-muted-foreground">Home 3 · Magazine Grid</span>
        </div>
        <div className="flex gap-2">
          {(['all', 'Plant 1', 'Plant 2'] as const).map(p => (
            <button key={p} onClick={() => setPlant(p)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                plant === p ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30')}>
              {p === 'all' ? 'All Plants' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">

        {/* ── ROW 1: Hero + Plant cards + Weekly chart (bento grid) ── */}
        <div className="grid grid-cols-12 gap-4" style={{ gridTemplateRows: 'auto' }}>

          {/* Hero — 3 cols */}
          <button
            onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="col-span-3 rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/30 hover:shadow-lg transition-all group text-left"
            style={{ minHeight: 280 }}>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Site OLE</p>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <p className="text-6xl font-mono font-black leading-none mt-3" style={{ color: siteColor }}>
                {siteOle.toFixed(1)}%
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(siteOle, 100)}%`, background: siteColor }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Target: 80%  ·  Gap: {Math.max(0, 80 - siteOle).toFixed(1)}pp</p>
            </div>
            <div>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', STATUS_BADGE[siteStatus])}>
                {STATUS_LABEL[siteStatus]}
              </span>
              {trendDiff && (
                <p className={cn('text-xs flex items-center gap-1 mt-2 font-medium', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                  {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {trendDiff}% vs last week
                </p>
              )}
              <p className="text-[10px] text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                click to see OLE formula →
              </p>
            </div>
          </button>

          {/* Plant 1 — 2 cols */}
          <button onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="col-span-2 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between hover:border-primary/30 hover:shadow-lg transition-all group text-left">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Plant 1</p>
              <p className="text-[10px] text-muted-foreground">Penang Main</p>
            </div>
            <div>
              <p className="text-4xl font-mono font-bold" style={{ color: oleColor(p1.ole_pct) }}>
                {p1.ole_pct.toFixed(1)}%
              </p>
              <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(p1.ole_pct, 100)}%`, background: oleColor(p1.ole_pct) }} />
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Output</span><span className="font-mono">{(p1.total_output_smh / 1000).toFixed(1)}k SMH</span></div>
              <div className="flex justify-between"><span>Input</span><span className="font-mono">{(p1.total_input_hours / 1000).toFixed(1)}k hrs</span></div>
              <div className="flex justify-between"><span>Units</span><span className="font-mono">{(p1.total_qty / 1000).toFixed(1)}k</span></div>
            </div>
          </button>

          {/* Plant 2 — 2 cols */}
          <button onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="col-span-2 rounded-2xl border border-border bg-card p-5 flex flex-col justify-between hover:border-primary/30 hover:shadow-lg transition-all group text-left">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Plant 2</p>
              <p className="text-[10px] text-muted-foreground">Batu Kawan</p>
            </div>
            <div>
              <p className="text-4xl font-mono font-bold" style={{ color: oleColor(p2.ole_pct) }}>
                {p2.ole_pct.toFixed(1)}%
              </p>
              <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(p2.ole_pct, 100)}%`, background: oleColor(p2.ole_pct) }} />
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Output</span><span className="font-mono">{(p2.total_output_smh / 1000).toFixed(1)}k SMH</span></div>
              <div className="flex justify-between"><span>Input</span><span className="font-mono">{(p2.total_input_hours / 1000).toFixed(1)}k hrs</span></div>
              <div className="flex justify-between"><span>Units</span><span className="font-mono">{(p2.total_qty / 1000).toFixed(1)}k</span></div>
            </div>
          </button>

          {/* Weekly chart — 5 cols */}
          <div className="col-span-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Weekly OLE Trend</p>
                <p className="text-[10px] text-muted-foreground">Click bar → shift detail</p>
              </div>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={siteWeekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  onClick={() => setDrawer({ kind: 'ole_formula' })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']}
                    cursor={{ fill: 'hsl(var(--primary) / 0.08)' }} />
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5} />
                  <Bar dataKey="ole" radius={[3, 3, 0, 0]} maxBarSize={28} cursor="pointer">
                    {siteWeekly.map((d, i) => (
                      <Cell key={i} fill={d.ole >= 80 ? '#22c55e' : d.ole >= 60 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── ROW 2: OLE formula cards ── */}
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-left hover:bg-primary/10 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Output SMH</p>
              <ChevronRight className="h-3.5 w-3.5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-mono font-bold text-primary">{(site.total_output_smh / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground mt-1">Σ(Assembly Qty × SMH/unit)</p>
          </button>

          <div className="rounded-2xl border border-border bg-muted/20 p-5 flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-5xl font-light text-muted-foreground">÷</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">divided by</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-mono font-black" style={{ color: siteColor }}>{siteOle.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">= Site OLE</p>
            </div>
          </div>

          <button onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-left hover:bg-violet-500/10 hover:shadow-md transition-all group">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-violet-400" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Input Hours</p>
              <ChevronRight className="h-3.5 w-3.5 text-violet-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-mono font-bold text-violet-400">{(site.total_input_hours / 1000).toFixed(1)}k</p>
            <p className="text-[10px] text-muted-foreground mt-1">Σ(Paid Direct Hours)</p>
          </button>
        </div>

        {/* ── ROW 3: Workcell tiles + Loss breakdown ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* Workcell tiles — 7 cols */}
          <div className="col-span-7 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Workcell Performance</p>
                <p className="text-[10px] text-muted-foreground">Sorted lowest OLE first · click OLE% to drill down</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {workcellsSorted.map(wc => {
                const ole = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
                const st  = getOleStatus(ole);
                const clr = oleColor(ole);
                const k   = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                const lk  = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
                const logo= lk ? WORKCELL_LOGOS[lk] : null;
                return (
                  <div key={wc.workcell}
                    className="rounded-xl border border-border bg-background p-3 hover:border-border/60 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-border"
                        style={logo ? { background: '#fff' } : undefined}>
                        {logo
                          ? <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-0.5" />
                          : <span className="text-[8px] font-black text-foreground">{wc.workcell.slice(0, 3)}</span>}
                      </div>
                      <button onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                        className="text-[10px] font-semibold text-foreground hover:text-primary transition-colors truncate text-left leading-tight">
                        {wc.workcell}
                      </button>
                    </div>
                    <div className="flex items-end justify-between">
                      <button onClick={() => setDrawer({ kind: 'ole_formula', workcell: wc.workcell })}
                        className={cn('text-xl font-mono font-black hover:opacity-70 transition-opacity leading-none', OLE_COLOR[st])}>
                        {ole.toFixed(0)}%
                      </button>
                      {wc.flagged_shifts > 0 && (
                        <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(ole, 100)}%`, background: clr }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Loss breakdown — 5 cols */}
          <div className="col-span-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Hours Loss Breakdown</p>
                <p className="text-[10px] text-muted-foreground">Click any category for detail</p>
              </div>
            </div>
            <div className="space-y-3">
              {mh.slices.map(s => {
                const pct = (s.value / mh.total_input_hours * 100);
                return (
                  <button key={s.name} onClick={() => setDrawer({ kind: 'loss_detail' })}
                    className="w-full text-left hover:bg-muted/20 rounded-lg px-2 py-1.5 transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-muted-foreground">{s.value.toFixed(0)} hrs</span>
                        <span className="text-xs font-mono font-bold text-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: s.color }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Attention items inline */}
            {attention.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Attention</p>
                <div className="space-y-1.5">
                  {attention.slice(0, 3).map((item, i) => (
                    <button key={i} onClick={() => navigate(`/ole/${encodeURIComponent(item.workcell)}`)}
                      className="w-full flex items-center gap-2.5 text-left hover:bg-muted/20 rounded-lg px-2 py-1.5 transition-colors group">
                      <AlertTriangle className={cn('h-3 w-3 flex-shrink-0',
                        item.severity === 'high' ? 'text-red-400' : 'text-amber-400')} />
                      <span className="text-[10px] text-foreground flex-1 truncate">{item.workcell}</span>
                      <span className={cn('text-[10px] font-mono font-bold',
                        item.severity === 'high' ? 'text-red-400' : 'text-amber-400')}>
                        {item.value}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
