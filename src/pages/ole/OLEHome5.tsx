/**
 * OLEHome5.tsx — Sectioned / Accordion
 * ─────────────────────────────────────────────────────────────────────────────
 * Page is divided into clearly numbered sections. Each section header shows
 * a summary number — you can read the headers alone and get the full story.
 * Expand any section for detail. Workcell section collapses by default,
 * showing only critical/warning items until expanded.
 *
 * Every metric is still clickable with the same drill-down drawer.
 */

import { cn } from '@/lib/utils';
import {
  getOleStatus, oleColor,
  OLE_COLOR, OLE_BAR, STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS, fmtDate, shiftLabel, OLE_TARGET,
} from '@/lib/oleConstants';
import {
  MOCK_SUMMARY, MOCK_WEEKLY, MOCK_MH_BREAKDOWN, MOCK_MH_BY_WC,
  MOCK_SHIFTS, MOCK_PRODUCTION, MOCK_PAID_HOURS, MOCK_SMH_LOOKUP,
  MOCK_ATTENTION, MOCK_WORKCELLS,
  getSiteAggregate, getPlantAggregate,
} from './mockOleData';
import {
  AlertTriangle, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, X, ArrowRight, Info,
  CheckCircle2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, ComposedChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 11,
  color: 'hsl(var(--foreground))',
};

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
              {content.kind === 'loss_detail' && `Loss Categories`}
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
                <div className="flex items-center justify-center px-2">
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
                {(() => {
                  const out = summary?.total_output_smh ?? MOCK_MH_BREAKDOWN.slices[0].value;
                  const inp = summary?.total_input_hours ?? MOCK_MH_BREAKDOWN.total_input_hours;
                  const ole = inp > 0 ? (out / inp) * 100 : 0;
                  const st  = getOleStatus(ole);
                  return (
                    <>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">OLE %</p>
                      <p className={cn('text-5xl font-mono font-bold', OLE_COLOR[st])}>{ole.toFixed(1)}%</p>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs font-semibold text-foreground">Per-Shift</p>
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
                  Full Workcell Detail <ArrowRight className="h-4 w-4" />
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
            <div className="space-y-3">
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
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accordion section ────────────────────────────────────────────────────────
function AccordionSection({
  num, title, summary, badge, badgeColor, open, onToggle, children,
}: {
  num: number; title: string; summary: string;
  badge?: string; badgeColor?: string;
  open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-muted/20 transition-colors group">
        {/* Section number */}
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors',
          open ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary')}>
          {num}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
        </div>
        {badge && (
          <span className="text-sm font-mono font-bold flex-shrink-0" style={badgeColor ? { color: badgeColor } : undefined}>
            {badge}
          </span>
        )}
        <div className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEHome5() {
  const navigate  = useNavigate();
  const [drawer, setDrawer] = useState<DrawerContent>(null);
  const [plant, setPlant]   = useState<'all' | 'Plant 1' | 'Plant 2'>('all');
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1, 2]));
  const [showAllWorkcells, setShowAllWorkcells] = useState(false);

  const toggle = (n: number) => setOpenSections(prev => {
    const s = new Set(prev);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });

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

  const criticalWcs = workcellsSorted.filter(wc => {
    const ole = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
    return getOleStatus(ole) !== 'optimal';
  });

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
  const critCount = criticalWcs.length;

  const displayedWcs = showAllWorkcells ? workcellsSorted : criticalWcs;

  return (
    <div className="relative">
      {drawer && <Drawer content={drawer} onClose={() => setDrawer(null)} />}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-8 py-3 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-foreground">OLE Overview</span>
          <span className="ml-2 text-xs text-muted-foreground">Home 5 · Sectioned View</span>
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

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-3">

        {/* ── SECTION 1: Site OLE ── */}
        <AccordionSection
          num={1} open={openSections.has(1)} onToggle={() => toggle(1)}
          title="Site Performance"
          summary={`Penang · ${filteredSummary.length} active workcells · Target: ${OLE_TARGET}%`}
          badge={`${siteOle.toFixed(1)}%`}
          badgeColor={siteColor}>
          <div className="p-6 space-y-5">
            {/* Big OLE number + formula */}
            <div className="flex items-start gap-8">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Site OLE</p>
                <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                  className="group flex items-baseline gap-2 hover:opacity-80 transition-opacity">
                  <span className="text-6xl font-mono font-black leading-none" style={{ color: siteColor }}>
                    {siteOle.toFixed(1)}%
                  </span>
                  <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                    how? →
                  </span>
                </button>
                <div className="flex items-center gap-3 mt-2">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', STATUS_BADGE[siteStatus])}>
                    {STATUS_LABEL[siteStatus]}
                  </span>
                  {trendDiff && (
                    <span className={cn('text-xs flex items-center gap-1 font-medium', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                      {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {trendDiff}% WoW
                    </span>
                  )}
                </div>
              </div>
              {/* Formula boxes inline */}
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                  className="flex-1 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center hover:bg-primary/10 transition-colors group">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Output SMH</p>
                  <p className="text-xl font-mono font-bold text-primary">{(site.total_output_smh / 1000).toFixed(1)}k</p>
                  <p className="text-[9px] text-muted-foreground">Σ(Qty × SMH/unit)</p>
                </button>
                <span className="text-xl font-light text-muted-foreground px-1">÷</span>
                <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                  className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-center hover:bg-violet-500/10 transition-colors group">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Input Hours</p>
                  <p className="text-xl font-mono font-bold text-violet-400">{(site.total_input_hours / 1000).toFixed(1)}k</p>
                  <p className="text-[9px] text-muted-foreground">Σ(Paid Hours)</p>
                </button>
              </div>
            </div>

            {/* Plant comparison */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Plant 1', data: p1 },
                { label: 'Plant 2', data: p2 },
              ].map(({ label, sub, data }) => {
                const clr = oleColor(data.ole_pct);
                const st  = getOleStatus(data.ole_pct);
                return (
                  <button key={label} onClick={() => setDrawer({ kind: 'ole_formula' })}
                    className="rounded-xl border border-border bg-background p-4 text-left hover:border-primary/30 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">{label}</p>
                      </div>
                      <span className="text-2xl font-mono font-black" style={{ color: clr }}>
                        {data.ole_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(data.ole_pct, 100)}%`, background: clr }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1.5">
                      <span>Output: {(data.total_output_smh / 1000).toFixed(1)}k SMH</span>
                      <span>Input: {(data.total_input_hours / 1000).toFixed(1)}k hrs</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </AccordionSection>

        {/* ── SECTION 2: Weekly Trend ── */}
        <AccordionSection
          num={2} open={openSections.has(2)} onToggle={() => toggle(2)}
          title="Weekly OLE Trend — FY26"
          summary={`${siteWeekly.length} weeks of data · latest: ${siteWeekly[siteWeekly.length - 1]?.ole.toFixed(1)}% · target: ${OLE_TARGET}%`}
          badge={trendDiff ? `${trendUp ? '▲' : '▼'} ${trendDiff}%` : undefined}
          badgeColor={trendUp ? '#22c55e' : '#ef4444'}>
          <div className="p-6">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={siteWeekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  onClick={() => setDrawer({ kind: 'ole_formula' })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']}
                    cursor={{ fill: 'hsl(var(--primary) / 0.08)' }} />
                  <ReferenceLine y={OLE_TARGET} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: `${OLE_TARGET}% Target`, fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                  <Bar dataKey="ole" radius={[4, 4, 0, 0]} maxBarSize={32} cursor="pointer">
                    {siteWeekly.map((d, i) => (
                      <Cell key={i} fill={d.ole >= OLE_TARGET ? '#22c55e' : d.ole >= 45 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
              <Info className="h-3 w-3" /> Click any bar to explore the OLE formula breakdown
            </p>
          </div>
        </AccordionSection>

        {/* ── SECTION 4: Workcells ── */}
        <AccordionSection
          num={4} open={openSections.has(4)} onToggle={() => toggle(4)}
          title="Workcell Performance"
          summary={critCount > 0
            ? `${critCount} workcells need attention · ${workcellsSorted.length - critCount} on track`
            : `All ${workcellsSorted.length} workcells on track`}
          badge={critCount > 0 ? `${critCount} issues` : '✓ All OK'}
          badgeColor={critCount > 0 ? '#f59e0b' : '#22c55e'}>
          <div className="p-6 space-y-4">
            {/* Show only critical/warning by default, expand to show all */}
            <div className="space-y-2">
              {displayedWcs.map(wc => {
                const ole    = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
                const st     = getOleStatus(ole);
                const clr    = oleColor(ole);
                const k      = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                const lk     = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
                const logo   = lk ? WORKCELL_LOGOS[lk] : null;
                const wcConf = MOCK_WORKCELLS.find(w => w.workcell === wc.workcell);
                return (
                  <div key={wc.workcell}
                    className="rounded-xl border border-border bg-background p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg border border-border flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={logo ? { background: '#fff' } : undefined}>
                      {logo
                        ? <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-1" />
                        : <span className="text-[8px] font-black text-foreground">{wc.workcell.slice(0, 3)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block text-left">
                        {wc.workcell}
                      </button>
                      <p className="text-[10px] text-muted-foreground">{wcConf?.plant} · {wc.stage_label} · {wc.total_shifts} shifts</p>
                    </div>
                    <div className="w-40 flex-shrink-0">
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(ole, 100)}%`, background: clr }} />
                      </div>
                    </div>
                    <button onClick={() => setDrawer({ kind: 'ole_formula', workcell: wc.workcell })}
                      className={cn('text-xl font-mono font-bold w-16 text-right hover:opacity-70 transition-opacity flex-shrink-0', OLE_COLOR[st])}>
                      {ole.toFixed(1)}%
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {wc.flagged_shifts > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowAllWorkcells(!showAllWorkcells)}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-2">
              {showAllWorkcells
                ? <><ChevronUp className="h-3.5 w-3.5" /> Show critical only ({critCount})</>
                : <><ChevronDown className="h-3.5 w-3.5" /> Show all {workcellsSorted.length} workcells</>}
            </button>
          </div>
        </AccordionSection>

        {/* ── SECTION 5: Loss Breakdown ── */}
        <AccordionSection
          num={5} open={openSections.has(5)} onToggle={() => toggle(5)}
          title="Hours Loss Breakdown"
          summary="Where do paid hours go? Output SMH + 4 loss categories = total input hours"
          badge={`${((mh.slices[0].value / mh.total_input_hours) * 100).toFixed(1)}% productive`}
          badgeColor="#22c55e">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-5 gap-3">
              {mh.slices.map((s, i) => {
                const pct = (s.value / mh.total_input_hours * 100).toFixed(1);
                return (
                  <button key={s.name} onClick={() => setDrawer({ kind: 'loss_detail' })}
                    className="rounded-xl border border-border bg-background p-3 text-center hover:border-border/60 hover:shadow-sm transition-all group">
                    <div className="w-3 h-3 rounded-sm mx-auto mb-2" style={{ background: s.color }} />
                    <p className="text-[9px] text-muted-foreground leading-tight mb-1">{s.name}</p>
                    <p className="text-xl font-mono font-bold text-foreground">{pct}%</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.value.toFixed(0)} hrs</p>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
            {/* Stacked bar */}
            <div className="h-6 rounded-full overflow-hidden flex">
              {mh.slices.map(s => {
                const pct = (s.value / mh.total_input_hours * 100);
                return (
                  <div key={s.name} style={{ width: `${pct}%`, background: s.color }}
                    className="h-full transition-all" title={`${s.name}: ${pct.toFixed(1)}%`} />
                );
              })}
            </div>
          </div>
        </AccordionSection>

        {/* ── SECTION 6: Attention ── */}
        {attention.length > 0 && (
          <AccordionSection
            num={6} open={openSections.has(6)} onToggle={() => toggle(6)}
            title="Attention Required"
            summary={`${attention.filter(a => a.severity === 'high').length} high · ${attention.filter(a => a.severity === 'medium').length} medium · ${attention.filter(a => a.severity === 'low').length} low`}
            badge={`${attention.length} items`}
            badgeColor="#ef4444">
            <div className="p-6 space-y-2">
              {attention.map((item, i) => (
                <button key={i} onClick={() => navigate(`/ole/${encodeURIComponent(item.workcell)}`)}
                  className={cn('w-full flex items-center gap-4 rounded-xl border px-5 py-3.5 text-left hover:shadow-md transition-all group',
                    item.severity === 'high'   ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/8' :
                    item.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/8' :
                    'border-border bg-muted/20 hover:bg-muted/30')}>
                  <AlertTriangle className={cn('h-4 w-4 flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : item.severity === 'medium' ? 'text-amber-400' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{item.workcell}</span>
                    <span className="text-xs text-muted-foreground ml-2">{item.message}</span>
                  </div>
                  <span className={cn('text-sm font-mono font-bold flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : item.severity === 'medium' ? 'text-amber-400' : 'text-muted-foreground')}>
                    {item.value}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </AccordionSection>
        )}

      </div>
    </div>
  );
}
