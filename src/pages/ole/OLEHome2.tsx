/**
 * OLEHome2.tsx — Full Scroll / Editorial
 * ─────────────────────────────────────────────────────────────────────────────
 * Story unfolds top-to-bottom as you scroll. No tabs. Clean sections.
 * Every indicator is clickable and drills deeper into the OLE formula.
 *
 * Layer order:
 *  1. Site Hero          — one number, one feeling
 *  2. Plant Split        — Plant 1 vs Plant 2
 *  3. Weekly OLE Trend   — full-width chart (click → shift breakdown)
 *  4. OLE Formula Strip  — Output SMH ÷ Input Hours (each clickable)
 *  5. Workcell Grid      — all workcells sorted worst-first (click → detail)
 *  6. Loss Breakdown     — NVA / Lunch / MFG DT / Unexplained
 *  7. Attention Items    — flagged issues only
 */

import { cn } from '@/lib/utils';
import {
  getOleStatus, oleColor,
  OLE_COLOR, OLE_BAR, STATUS_BADGE, STATUS_LABEL,
  WORKCELL_LOGOS, fmtDate, shiftLabel,
} from '@/lib/oleConstants';
import {
  MOCK_SUMMARY, MOCK_WEEKLY, MOCK_MH_BREAKDOWN, MOCK_MH_BY_WC,
  MOCK_SHIFTS, MOCK_PRODUCTION, MOCK_PAID_HOURS, MOCK_SMH_LOOKUP,
  MOCK_ATTENTION, MOCK_WORKCELLS,
  getSiteAggregate, getPlantAggregate, getSiteWeekly,
} from './mockOleData';
import {
  AlertTriangle, ArrowRight, ChevronRight, TrendingUp, TrendingDown,
  X, Clock, Layers, BarChart2, Users, Zap, Info,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, Sector,
} from 'recharts';

// ─── Shared tooltip style ─────────────────────────────────────────────────────
const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 11,
  color: 'hsl(var(--foreground))',
};

// ─── Drill-down drawer ────────────────────────────────────────────────────────
type DrawerContent =
  | { kind: 'ole_formula'; workcell?: string }
  | { kind: 'output_smh'; workcell: string }
  | { kind: 'input_hours'; workcell: string }
  | { kind: 'shift_detail'; workcell: string }
  | { kind: 'loss_detail'; workcell?: string }
  | null;

function Drawer({ content, onClose }: { content: DrawerContent; onClose: () => void }) {
  const navigate = useNavigate();
  if (!content) return null;

  const wc = (content as any).workcell;
  const summary = wc ? MOCK_SUMMARY.find(s => s.workcell === wc) : null;
  const mhData  = wc ? MOCK_MH_BY_WC[wc] : MOCK_MH_BREAKDOWN;
  const shifts  = wc ? MOCK_SHIFTS.filter(s => s.workcell === wc) : MOCK_SHIFTS;
  const prod    = wc ? MOCK_PRODUCTION.filter(p => p.workcell === wc) : MOCK_PRODUCTION;
  const hours   = wc ? MOCK_PAID_HOURS.filter(h => h.workcell === wc) : MOCK_PAID_HOURS;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className="w-[520px] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">
              {content.kind === 'ole_formula'  && `OLE Formula Breakdown${wc ? ` — ${wc}` : ' — Site'}`}
              {content.kind === 'output_smh'   && `Output SMH — ${wc}`}
              {content.kind === 'input_hours'  && `Input Hours — ${wc}`}
              {content.kind === 'shift_detail' && `Shift Detail — ${wc}`}
              {content.kind === 'loss_detail'  && `Loss Breakdown${wc ? ` — ${wc}` : ' — Site'}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {content.kind === 'ole_formula'  && 'OLE = Σ(Qty × SMH/unit) ÷ Σ(Paid Hours) × 100%'}
              {content.kind === 'output_smh'   && 'Assembly-level: Qty × SMH/unit'}
              {content.kind === 'input_hours'  && 'Paid hours per employee per shift'}
              {content.kind === 'shift_detail' && 'Shift-level OLE breakdown'}
              {content.kind === 'loss_detail'  && '% of total paid hours by category'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* OLE Formula breakdown */}
          {content.kind === 'ole_formula' && (
            <>
              {/* Formula boxes */}
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output SMH</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {summary ? summary.total_output_smh.toLocaleString(undefined, { maximumFractionDigits: 0 }) : MOCK_MH_BREAKDOWN.slices[0].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Σ(Qty × SMH/unit)</p>
                  {wc && (
                    <button onClick={() => {}} className="mt-2 text-[10px] text-primary underline">
                      → drill into assemblies
                    </button>
                  )}
                </div>
                <div className="text-2xl font-bold text-muted-foreground">÷</div>
                <div className="flex-1 rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input Hours</p>
                  <p className="text-2xl font-mono font-bold text-violet-400">
                    {summary ? summary.total_input_hours.toLocaleString(undefined, { maximumFractionDigits: 0 }) : (MOCK_MH_BREAKDOWN.total_input_hours).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Σ(Paid Hours)</p>
                </div>
                <div className="text-2xl font-bold text-muted-foreground">×100</div>
              </div>

              {/* Result */}
              <div className="rounded-xl border-2 border-border bg-muted/20 p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">OLE %</p>
                {(() => {
                  const ole = summary
                    ? (summary.total_output_smh / summary.total_input_hours) * 100
                    : (MOCK_MH_BREAKDOWN.slices[0].value / MOCK_MH_BREAKDOWN.total_input_hours) * 100;
                  const st  = getOleStatus(ole);
                  return (
                    <p className={cn('text-4xl font-mono font-bold', OLE_COLOR[st])}>
                      {ole.toFixed(1)}%
                    </p>
                  );
                })()}
                <p className="text-xs text-muted-foreground mt-1">= Output SMH ÷ Input Hours × 100</p>
              </div>

              {/* Shift-level rows */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Per-Shift Breakdown</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid bg-muted/50 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                    style={{ gridTemplateColumns: '4rem 4rem 6rem 6rem 6rem' }}>
                    {['Date', 'Shift', 'Output', 'Input', 'OLE'].map(h => (
                      <div key={h} className="px-3 py-2">{h}</div>
                    ))}
                  </div>
                  {shifts.slice(0, 6).map((s, i) => {
                    const st = getOleStatus(s.ole_pct);
                    return (
                      <div key={i} className="grid items-center text-xs border-b border-border last:border-0 hover:bg-muted/20"
                        style={{ gridTemplateColumns: '4rem 4rem 6rem 6rem 6rem', height: 40 }}>
                        <div className="px-3 font-mono text-muted-foreground">{fmtDate(s.date)}</div>
                        <div className="px-3 font-mono">{shiftLabel(s.shift)}</div>
                        <div className="px-3 font-mono">{s.effective_output_smh.toFixed(1)}</div>
                        <div className="px-3 font-mono">{s.total_input_hours.toFixed(1)}</div>
                        <div className={cn('px-3 font-mono font-bold', OLE_COLOR[st])}>
                          {s.ole_pct !== null ? `${s.ole_pct}%` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {wc && (
                <button onClick={() => navigate(`/ole/${encodeURIComponent(wc)}`)}
                  className="w-full rounded-xl border border-primary/30 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                  View Full Workcell Detail <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          {/* Output SMH breakdown — assembly level */}
          {content.kind === 'output_smh' && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Output SMH</p>
                <p className="text-3xl font-mono font-bold text-primary">
                  {summary?.total_output_smh.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
                <p className="text-xs text-muted-foreground mt-1">= Σ(Assembly Qty × SMH/unit)</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Assembly Breakdown</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid bg-muted/50 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                    style={{ gridTemplateColumns: '1fr 4rem 5rem 6rem' }}>
                    {['Assembly', 'Qty', 'SMH/unit', 'Output SMH'].map(h => <div key={h} className="px-3 py-2">{h}</div>)}
                  </div>
                  {prod.map((p, i) => {
                    const smh    = MOCK_SMH_LOOKUP[p.assembly] ?? null;
                    const outSmh = smh !== null ? p.qty * smh : null;
                    return (
                      <div key={i} className="grid items-center text-xs border-b border-border last:border-0 hover:bg-muted/20"
                        style={{ gridTemplateColumns: '1fr 4rem 5rem 6rem', height: 44 }}>
                        <div className="px-3 font-mono truncate text-foreground" title={p.assembly}>{p.assembly}</div>
                        <div className="px-3 font-mono font-semibold text-foreground">{p.qty}</div>
                        <div className="px-3 font-mono text-muted-foreground">{smh !== null ? smh.toFixed(4) : '—'}</div>
                        <div className="px-3 font-mono font-bold text-primary">{outSmh !== null ? outSmh.toFixed(2) : '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-400">
                <Info className="h-3.5 w-3.5 inline mr-1.5" />
                SMH values come from OLE Webtools. Missing SMH reduces reported OLE.
              </div>
            </>
          )}

          {/* Input Hours breakdown — employee level */}
          {content.kind === 'input_hours' && (
            <>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Input Hours</p>
                <p className="text-3xl font-mono font-bold text-violet-400">
                  {summary?.total_input_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
                <p className="text-xs text-muted-foreground mt-1">TPHDirect — includes direct + support headcount</p>
              </div>
              {/* Chart: HC distribution */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Headcount & Hours Distribution</p>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hours.map(h => ({ name: h.name.split(' ')[0], hrs: h.tph_direct * h.thc_direct, type: h.value_type }))}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={TT} />
                      <Bar dataKey="hrs" name="Hours" radius={[4, 4, 0, 0]} maxBarSize={32}>
                        {hours.map((h, i) => (
                          <Cell key={i} fill={h.value_type === 'VA' ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Employee Detail</p>
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
              </div>
            </>
          )}

          {/* Loss breakdown */}
          {content.kind === 'loss_detail' && (
            <>
              <div>
                <p className="text-xs font-semibold text-foreground mb-3">Hours Distribution</p>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mhData?.slices.map(s => ({ name: s.name.split('/')[0].trim(), value: s.value, color: s.color }))}
                      layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={80} />
                      <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)} hrs`]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {mhData?.slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2">
                {mhData?.slices.map(s => {
                  const pct = mhData.total_input_hours > 0 ? (s.value / mhData.total_input_hours * 100).toFixed(1) : '0';
                  return (
                    <div key={s.name} className="flex items-center gap-3 text-sm">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-foreground">{s.name}</span>
                      <span className="font-mono text-muted-foreground">{s.value.toFixed(1)} hrs</span>
                      <span className="font-mono font-bold text-foreground w-12 text-right">{pct}%</span>
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

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHdr({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-foreground">{label}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Clickable metric chip ────────────────────────────────────────────────────
function MetricChip({ label, value, color, onClick }: {
  label: string; value: string; color?: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn('flex flex-col gap-1 text-left group', onClick && 'cursor-pointer')}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</span>
      <span className="text-2xl font-mono font-bold transition-opacity group-hover:opacity-70" style={color ? { color } : undefined}>
        {value}
      </span>
      {onClick && <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">click to drill down →</span>}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEHome2() {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<DrawerContent>(null);
  const [plant, setPlant] = useState<'all' | 'Plant 1' | 'Plant 2'>('all');
  const [pieSlice, setPieSlice] = useState(0);

  // Derived data based on plant filter
  const filteredSummary = useMemo(() =>
    plant === 'all' ? MOCK_SUMMARY :
    MOCK_SUMMARY.filter(r => MOCK_WORKCELLS.find(w => w.workcell === r.workcell)?.plant === plant)
  , [plant]);

  const site = useMemo(() => getSiteAggregate(filteredSummary), [filteredSummary]);

  const p1    = useMemo(() => getPlantAggregate('Plant 1'), []);
  const p2    = useMemo(() => getPlantAggregate('Plant 2'), []);

  const siteWeekly = useMemo(() => {
    const rows = plant === 'all' ? MOCK_WEEKLY : MOCK_WEEKLY.filter(r =>
      MOCK_WORKCELLS.find(w => w.workcell === r.workcell)?.plant === plant
    );
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

  const last2    = siteWeekly.slice(-2);
  const trendUp  = last2.length === 2 && last2[1].ole > last2[0].ole;
  const trendDiff = last2.length === 2 ? Math.abs(last2[1].ole - last2[0].ole).toFixed(1) : null;
  const siteOle  = site.ole_pct;
  const siteStatus = getOleStatus(siteOle);
  const siteColor  = oleColor(siteOle);

  const oles   = siteWeekly.map(d => d.ole).filter(Boolean);
  const yMin   = oles.length ? Math.max(0, Math.floor(Math.min(...oles) / 10) * 10 - 10) : 0;
  const yMax   = oles.length ? Math.ceil(Math.max(...oles)   / 10) * 10 + 10 : 100;

  const mh     = MOCK_MH_BREAKDOWN;
  const donutTotal = mh.slices.reduce((s, d) => s + d.value, 0);
  const attention  = MOCK_ATTENTION;

  return (
    <div className="relative">
      {/* Drawer */}
      {drawer && <Drawer content={drawer} onClose={() => setDrawer(null)} />}

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-8 py-3 flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-foreground">OLE Overview</span>
          <span className="ml-2 text-xs text-muted-foreground">Home 2 · Scroll View</span>
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

      <div className="max-w-5xl mx-auto px-8 py-10 space-y-16">

        {/* ── 1. SITE HERO ── */}
        <section>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-6">
            Penang · Overall Labor Effectiveness
          </p>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Site OLE</p>
              <button
                onClick={() => setDrawer({ kind: 'ole_formula' })}
                className="group flex items-baseline gap-3 hover:opacity-80 transition-opacity"
              >
                <span className="text-7xl font-mono font-black leading-none" style={{ color: siteColor }}>
                  {siteOle.toFixed(1)}%
                </span>
                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity mb-2">
                  how is this calculated? →
                </span>
              </button>
              <div className="flex items-center gap-3 mt-3">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', STATUS_BADGE[siteStatus])}>
                  {STATUS_LABEL[siteStatus]}
                </span>
                {trendDiff && (
                  <span className={cn('text-xs flex items-center gap-1 font-medium', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                    {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {trendDiff}% vs last week
                  </span>
                )}
                <span className="text-xs text-muted-foreground">Target: 80%</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-6 pb-2">
              <MetricChip label="Output SMH"  value={`${(site.total_output_smh / 1000).toFixed(1)}k`}  color="hsl(var(--primary))" onClick={() => setDrawer({ kind: 'ole_formula' })} />
              <MetricChip label="Input Hours"  value={`${(site.total_input_hours / 1000).toFixed(1)}k`}  color="#8b5cf6"             onClick={() => setDrawer({ kind: 'ole_formula' })} />
              <MetricChip label="Units Produced" value={`${(site.total_qty / 1000).toFixed(1)}k`}        color="#f59e0b"             />
            </div>
          </div>
        </section>

        {/* ── 2. PLANT SPLIT ── */}
        <section>
          <SectionHdr label="Plant Breakdown" sub="Plant 1 (Penang Main) vs Plant 2 (Batu Kawan)" />
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Plant 1', sub: 'Penang Main · 7 workcells', data: p1 },
              { label: 'Plant 2', sub: 'Batu Kawan · 2 workcells',  data: p2 },
            ].map(({ label, sub, data }) => {
              const st  = getOleStatus(data.ole_pct);
              const clr = oleColor(data.ole_pct);
              return (
                <div key={label} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                    <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                      className="text-3xl font-mono font-black hover:opacity-70 transition-opacity" style={{ color: clr }}>
                      {data.ole_pct.toFixed(1)}%
                    </button>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-4">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(data.ole_pct, 100)}%`, background: clr }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      ['Output SMH', `${(data.total_output_smh / 1000).toFixed(1)}k`],
                      ['Input Hrs',  `${(data.total_input_hours / 1000).toFixed(1)}k`],
                      ['Units',      `${(data.total_qty / 1000).toFixed(1)}k`],
                    ].map(([lbl, val]) => (
                      <div key={lbl}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{lbl}</p>
                        <p className="text-sm font-mono font-bold text-foreground mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. WEEKLY TREND ── */}
        <section>
          <SectionHdr label="Weekly OLE Trend — FY26"
            sub="Click on any week bar to see shift-level detail for that period" />
          <div className="rounded-2xl border border-border bg-card p-6">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={siteWeekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  onClick={(d) => { if (d?.activePayload) setDrawer({ kind: 'ole_formula' }); }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']}
                    cursor={{ fill: 'hsl(var(--primary) / 0.08)', radius: 4 }} />
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: '80% Target', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                  <Bar dataKey="ole" name="OLE %" radius={[4, 4, 0, 0]} maxBarSize={36} cursor="pointer">
                    {siteWeekly.map((d, i) => (
                      <Cell key={i} fill={d.ole >= 80 ? '#22c55e' : d.ole >= 60 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
              <Info className="h-3 w-3" /> Click any bar to explore OLE formula for that period
            </p>
          </div>
        </section>

        {/* ── 4. OLE FORMULA STRIP ── */}
        <section>
          <SectionHdr label="OLE Formula" sub="Click each component to understand what drives the number" />
          <div className="grid grid-cols-3 gap-0 rounded-2xl border border-border overflow-hidden">
            <button onClick={() => setDrawer({ kind: 'ole_formula' })}
              className="bg-primary/5 border-r border-border p-6 text-left hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Output SMH</span>
                <ChevronRight className="h-3.5 w-3.5 text-primary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl font-mono font-bold text-primary">
                {(site.total_output_smh / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Σ(Qty × SMH/unit)</p>
            </button>
            <div className="bg-muted/20 border-r border-border p-6 flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-light text-muted-foreground">÷</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">divided by</span>
            </div>
            <button onClick={() => setDrawer({ kind: 'ole_formula' })}
              className="bg-violet-500/5 p-6 text-left hover:bg-violet-500/10 transition-colors group">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-violet-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Input Hours</span>
                <ChevronRight className="h-3.5 w-3.5 text-violet-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-3xl font-mono font-bold text-violet-400">
                {(site.total_input_hours / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Σ(Paid Direct Hours)</p>
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">= Site OLE</p>
              <p className="text-2xl font-mono font-bold mt-0.5" style={{ color: siteColor }}>{siteOle.toFixed(2)}%</p>
            </div>
            <button onClick={() => setDrawer({ kind: 'ole_formula' })}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              View full formula breakdown <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* ── 5. WORKCELL GRID ── */}
        <section>
          <SectionHdr label="Workcell Performance"
            sub="Sorted lowest OLE first — click OLE % to see formula breakdown, click name to open full detail" />
          <div className="space-y-3">
            {workcellsSorted.map(wc => {
              const ole    = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
              const st     = getOleStatus(ole);
              const clr    = oleColor(ole);
              const k      = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
              const lk     = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
              const logo   = lk ? WORKCELL_LOGOS[lk] : null;
              const wcConf = MOCK_WORKCELLS.find(w => w.workcell === wc.workcell);
              return (
                <div key={wc.workcell}
                  className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 hover:border-border/80 transition-all">
                  {/* Logo / badge */}
                  <div className="w-10 h-10 rounded-lg border border-border flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={logo ? { background: '#fff' } : undefined}>
                    {logo
                      ? <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-1.5" />
                      : <span className="text-[10px] font-black text-foreground">{wc.workcell.slice(0, 3)}</span>}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block text-left">
                      {wc.workcell}
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {wcConf?.plant} · {wc.stage_label} · {wc.total_shifts} shifts
                    </p>
                  </div>

                  {/* OLE bar */}
                  <div className="w-48 flex-shrink-0">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>0%</span><span>80%</span><span>100%</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div className="absolute top-0 bottom-0 w-px bg-emerald-500/40" style={{ left: '80%' }} />
                      <div className="h-full rounded-full" style={{ width: `${Math.min(ole, 100)}%`, background: clr }} />
                    </div>
                  </div>

                  {/* OLE % — clickable */}
                  <button onClick={() => setDrawer({ kind: 'ole_formula', workcell: wc.workcell })}
                    className={cn('text-xl font-mono font-bold w-16 text-right hover:opacity-70 transition-opacity flex-shrink-0', OLE_COLOR[st])}>
                    {ole.toFixed(1)}%
                  </button>

                  {/* Flagged */}
                  {wc.flagged_shifts > 0 && (
                    <div className="flex items-center gap-1 text-amber-400 flex-shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold">{wc.flagged_shifts}</span>
                    </div>
                  )}

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 6. LOSS BREAKDOWN ── */}
        <section>
          <SectionHdr label="Hours Loss Breakdown"
            sub="Where do paid hours go? Click any slice to see workcell detail" />
          <div className="grid grid-cols-5 gap-0 rounded-2xl border border-border overflow-hidden">
            {mh.slices.map((s, i) => {
              const pct = (s.value / mh.total_input_hours * 100).toFixed(1);
              return (
                <button key={s.name}
                  onClick={() => setDrawer({ kind: 'loss_detail' })}
                  className={cn('p-5 text-left hover:brightness-110 transition-all group border-r border-border last:border-r-0',
                    i === 0 && 'bg-emerald-500/5', i > 0 && 'bg-card')}>
                  <div className="w-3 h-3 rounded-sm mb-3" style={{ background: s.color }} />
                  <p className="text-[10px] text-muted-foreground font-semibold leading-tight mb-2">{s.name}</p>
                  <p className="text-xl font-mono font-bold text-foreground">{pct}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.value.toFixed(0)} hrs</p>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 7. ATTENTION ITEMS ── */}
        {attention.length > 0 && (
          <section>
            <SectionHdr label="Attention Required"
              sub="Issues that need to be addressed to improve OLE" />
            <div className="space-y-2">
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
                  <span className={cn('text-sm font-mono font-bold',
                    item.severity === 'high' ? 'text-red-400' : item.severity === 'medium' ? 'text-amber-400' : 'text-muted-foreground')}>
                    {item.value}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
