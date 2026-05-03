/**
 * OLEHome4.tsx — Compact Executive / Dense
 * ─────────────────────────────────────────────────────────────────────────────
 * Maximum information density. Built for monitors and always-on screens.
 * Everything above or near the fold. Small charts, tight spacing.
 * Every number is still clickable with the same drill-down drawer.
 *
 * Layout (2 columns):
 *  Left col (40%): Site hero + plant comparison + attention items
 *  Right col (60%): Weekly chart + Workcell table + Loss mini-chart
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
  getSiteAggregate, getPlantAggregate,
} from './mockOleData';
import {
  AlertTriangle, ChevronRight, TrendingUp, TrendingDown,
  X, ArrowRight, Info,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';

const TT = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8, fontSize: 10,
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
      <div className="w-[480px] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-foreground">
              {content.kind === 'ole_formula' && `OLE Breakdown${wc ? ` — ${wc}` : ' — Site'}`}
              {content.kind === 'output_smh'  && `Output SMH — ${wc}`}
              {content.kind === 'input_hours' && `Input Hours — ${wc}`}
              {content.kind === 'loss_detail' && `Loss Categories${wc ? ` — ${wc}` : ' — Site'}`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {content.kind === 'ole_formula' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Output SMH</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {(summary?.total_output_smh ?? MOCK_MH_BREAKDOWN.slices[0].value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Σ(Qty × SMH/unit)</p>
                </div>
                <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-3 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Input Hours</p>
                  <p className="text-2xl font-mono font-bold text-violet-400">
                    {(summary?.total_input_hours ?? MOCK_MH_BREAKDOWN.total_input_hours).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Σ(Paid Hours)</p>
                </div>
              </div>
              <div className="rounded-xl border-2 border-border bg-muted/20 p-3 text-center">
                {(() => {
                  const out = summary?.total_output_smh ?? MOCK_MH_BREAKDOWN.slices[0].value;
                  const inp = summary?.total_input_hours ?? MOCK_MH_BREAKDOWN.total_input_hours;
                  const ole = inp > 0 ? (out / inp) * 100 : 0;
                  const st  = getOleStatus(ole);
                  return (
                    <>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">OLE %</p>
                      <p className={cn('text-4xl font-mono font-bold', OLE_COLOR[st])}>{ole.toFixed(1)}%</p>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs font-semibold text-foreground">Shift Breakdown</p>
              <div className="rounded-xl border border-border overflow-hidden text-xs">
                <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '5rem 4rem 5.5rem 5.5rem 4.5rem' }}>
                  {['Date', 'Shift', 'Output', 'Input', 'OLE'].map(h => <div key={h} className="px-2 py-1.5">{h}</div>)}
                </div>
                {shifts.slice(0, 6).map((s, i) => {
                  const st = getOleStatus(s.ole_pct);
                  return (
                    <div key={i} className="grid items-center border-b border-border last:border-0 hover:bg-muted/20"
                      style={{ gridTemplateColumns: '5rem 4rem 5.5rem 5.5rem 4.5rem', height: 36 }}>
                      <div className="px-2 font-mono text-[9px] text-muted-foreground">{fmtDate(s.date)}</div>
                      <div className="px-2 font-mono text-[9px]">{shiftLabel(s.shift)}</div>
                      <div className="px-2 font-mono text-[9px]">{s.effective_output_smh.toFixed(1)}</div>
                      <div className="px-2 font-mono text-[9px]">{s.total_input_hours.toFixed(1)}</div>
                      <div className={cn('px-2 font-mono text-[9px] font-bold', OLE_COLOR[st])}>{s.ole_pct ?? '—'}%</div>
                    </div>
                  );
                })}
              </div>
              {wc && (
                <button onClick={() => navigate(`/ole/${encodeURIComponent(wc)}`)}
                  className="w-full rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                  Open Full Workcell Detail <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          {content.kind === 'output_smh' && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Total Output SMH</p>
                <p className="text-3xl font-mono font-bold text-primary">
                  {summary?.total_output_smh.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden text-xs">
                <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '1fr 3.5rem 4.5rem 5rem' }}>
                  {['Assembly', 'Qty', 'SMH/unit', 'Output'].map(h => <div key={h} className="px-2 py-1.5">{h}</div>)}
                </div>
                {prod.map((p, i) => {
                  const smh = MOCK_SMH_LOOKUP[p.assembly] ?? null;
                  const out = smh !== null ? p.qty * smh : null;
                  return (
                    <div key={i} className="grid items-center border-b border-border last:border-0 hover:bg-muted/20"
                      style={{ gridTemplateColumns: '1fr 3.5rem 4.5rem 5rem', height: 40 }}>
                      <div className="px-2 font-mono text-[9px] truncate text-foreground">{p.assembly}</div>
                      <div className="px-2 font-mono text-[9px] font-semibold text-foreground">{p.qty}</div>
                      <div className="px-2 font-mono text-[9px] text-muted-foreground">{smh !== null ? smh.toFixed(4) : '—'}</div>
                      <div className="px-2 font-mono text-[9px] font-bold text-primary">{out !== null ? out.toFixed(2) : '—'}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {content.kind === 'input_hours' && (
            <>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Total Input Hours</p>
                <p className="text-3xl font-mono font-bold text-violet-400">
                  {summary?.total_input_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })} hrs
                </p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden text-xs">
                <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase font-semibold border-b border-border"
                  style={{ gridTemplateColumns: '1fr 3.5rem 3.5rem 4.5rem' }}>
                  {['Name', 'Type', 'HC', 'Hours'].map(h => <div key={h} className="px-2 py-1.5">{h}</div>)}
                </div>
                {hours.map((h, i) => (
                  <div key={i} className="grid items-center border-b border-border last:border-0 hover:bg-muted/20"
                    style={{ gridTemplateColumns: '1fr 3.5rem 3.5rem 4.5rem', height: 36 }}>
                    <div className="px-2 text-[9px] text-foreground truncate">{h.name}</div>
                    <div className="px-2">
                      <span className={cn('text-[8px] font-semibold px-1 py-0.5 rounded-full border',
                        h.value_type === 'VA' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30')}>
                        {h.value_type}
                      </span>
                    </div>
                    <div className="px-2 font-mono text-[9px] text-foreground">{h.thc_direct}</div>
                    <div className="px-2 font-mono text-[9px] font-semibold text-violet-400">{h.tph_direct.toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {content.kind === 'loss_detail' && (
            <div className="space-y-2">
              {mhData?.slices.map(s => {
                const pct = (s.value / mhData.total_input_hours * 100).toFixed(1);
                return (
                  <div key={s.name} className="flex items-center gap-3 text-sm">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    <span className="flex-1 text-foreground text-xs">{s.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{s.value.toFixed(1)} hrs</span>
                    <span className="font-mono text-xs font-bold text-foreground w-10 text-right">{pct}%</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function OLEHome4() {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<DrawerContent>(null);
  const [plant, setPlant]   = useState<'all' | 'Plant 1' | 'Plant 2'>('all');

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
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-foreground">OLE Overview</span>
          <span className="text-[10px] text-muted-foreground">Home 4 · Compact Executive</span>
          {/* Inline KPI strip */}
          <div className="hidden xl:flex items-center gap-4 ml-2 pl-4 border-l border-border">
            {[
              { label: 'Site OLE', val: `${siteOle.toFixed(1)}%`, color: siteColor },
              { label: 'Output', val: `${(site.total_output_smh / 1000).toFixed(1)}k SMH`, color: undefined },
              { label: 'Input', val: `${(site.total_input_hours / 1000).toFixed(1)}k hrs`, color: undefined },
              { label: 'Units', val: `${(site.total_qty / 1000).toFixed(1)}k`, color: undefined },
              { label: 'Flagged', val: `${site.flagged_shifts}`, color: site.flagged_shifts > 0 ? '#f59e0b' : undefined },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
                <span className="text-xs font-mono font-bold" style={color ? { color } : undefined}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'Plant 1', 'Plant 2'] as const).map(p => (
            <button key={p} onClick={() => setPlant(p)}
              className={cn('px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all',
                plant === p ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:text-foreground hover:border-foreground/30')}>
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex gap-5" style={{ minHeight: 'calc(100vh - 48px)' }}>

        {/* ── LEFT COLUMN ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-4">

          {/* Site OLE hero */}
          <button onClick={() => setDrawer({ kind: 'ole_formula' })}
            className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Site OLE</p>
                <p className="text-5xl font-mono font-black mt-1 leading-none" style={{ color: siteColor }}>
                  {siteOle.toFixed(1)}%
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors mt-1" />
            </div>
            <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(siteOle, 100)}%`, background: siteColor }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', STATUS_BADGE[siteStatus])}>
                {STATUS_LABEL[siteStatus]}
              </span>
              {trendDiff && (
                <span className={cn('text-[10px] flex items-center gap-1 font-medium', trendUp ? 'text-emerald-400' : 'text-red-400')}>
                  {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trendDiff}% WoW
                </span>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1.5">Target 80% · Gap {Math.max(0, 80 - siteOle).toFixed(1)}pp</p>
          </button>

          {/* OLE formula strip — compact */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                className="p-3 text-left hover:bg-primary/5 transition-colors group">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Output SMH</p>
                <p className="text-xl font-mono font-bold text-primary mt-0.5">
                  {(site.total_output_smh / 1000).toFixed(1)}k
                </p>
                <p className="text-[9px] text-muted-foreground">Σ(Qty × SMH/unit)</p>
              </button>
              <button onClick={() => setDrawer({ kind: 'ole_formula' })}
                className="p-3 text-left hover:bg-violet-500/5 transition-colors group">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Input Hours</p>
                <p className="text-xl font-mono font-bold text-violet-400 mt-0.5">
                  {(site.total_input_hours / 1000).toFixed(1)}k
                </p>
                <p className="text-[9px] text-muted-foreground">Σ(Paid Direct Hrs)</p>
              </button>
            </div>
          </div>

          {/* Plant comparison */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Plant Comparison</p>
            </div>
            {[
              { label: 'Plant 1', sub: 'Penang Main', data: p1 },
              { label: 'Plant 2', sub: 'Batu Kawan',  data: p2 },
            ].map(({ label, sub, data }, i) => {
              const clr = oleColor(data.ole_pct);
              return (
                <button key={label} onClick={() => setDrawer({ kind: 'ole_formula' })}
                  className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors', i === 0 && 'border-b border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[9px] text-muted-foreground">{sub}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(data.ole_pct, 100)}%`, background: clr }} />
                    </div>
                  </div>
                  <span className="text-xl font-mono font-bold flex-shrink-0" style={{ color: clr }}>
                    {data.ole_pct.toFixed(1)}%
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Loss breakdown — mini */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">Hours Distribution</p>
            <div className="space-y-2">
              {mh.slices.map(s => {
                const pct = (s.value / mh.total_input_hours * 100);
                return (
                  <button key={s.name} onClick={() => setDrawer({ kind: 'loss_detail' })}
                    className="w-full flex items-center gap-2 hover:bg-muted/20 rounded px-1 py-0.5 transition-colors">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[9px] text-muted-foreground flex-1 text-left truncate">{s.name}</span>
                    <span className="text-[9px] font-mono font-bold text-foreground">{pct.toFixed(1)}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attention items */}
          {attention.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Attention</p>
              </div>
              {attention.slice(0, 4).map((item, i) => (
                <button key={i} onClick={() => navigate(`/ole/${encodeURIComponent(item.workcell)}`)}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors border-b border-border last:border-b-0 group')}>
                  <AlertTriangle className={cn('h-3.5 w-3.5 flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : 'text-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-foreground truncate">{item.workcell}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{item.message}</p>
                  </div>
                  <span className={cn('text-[10px] font-mono font-bold flex-shrink-0',
                    item.severity === 'high' ? 'text-red-400' : 'text-amber-400')}>{item.value}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Weekly chart */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Weekly OLE Trend — FY26</p>
                <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-2.5 w-2.5" /> Click any bar to see formula breakdown
                </p>
              </div>
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> ≥80%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 60–80%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt;60%</span>
              </div>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={siteWeekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  onClick={() => setDrawer({ kind: 'ole_formula' })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="w" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} domain={[yMin, yMax]} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${Number(v).toFixed(1)}%`, 'OLE']}
                    cursor={{ fill: 'hsl(var(--primary) / 0.06)' }} />
                  <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="ole" radius={[3, 3, 0, 0]} maxBarSize={24} cursor="pointer">
                    {siteWeekly.map((d, i) => (
                      <Cell key={i} fill={d.ole >= 80 ? '#22c55e' : d.ole >= 60 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Workcell compact table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden flex-1">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                Workcell Performance · {workcellsSorted.length} workcells
              </p>
              <p className="text-[9px] text-muted-foreground">Sorted lowest OLE first · click OLE% for formula · click name for full detail</p>
            </div>
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 5rem 7rem 6rem 5rem 5rem 4.5rem 5rem' }}>
                {['#', 'Workcell', 'Plant', 'OLE %', 'Output SMH', 'Input Hrs', 'Units', 'Shifts', 'Status'].map(h => (
                  <div key={h} className="px-2 py-2">{h}</div>
                ))}
              </div>
              {workcellsSorted.map((wc, idx) => {
                const ole    = wc.total_input_hours > 0 ? (wc.total_output_smh / wc.total_input_hours) * 100 : 0;
                const st     = getOleStatus(ole);
                const clr    = oleColor(ole);
                const wcConf = MOCK_WORKCELLS.find(w => w.workcell === wc.workcell);
                const k      = wc.workcell.toLowerCase().replace(/[^a-z]/g, '');
                const lk     = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
                const logo   = lk ? WORKCELL_LOGOS[lk] : null;
                return (
                  <div key={wc.workcell}
                    className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 5rem 7rem 6rem 5rem 5rem 4.5rem 5rem', height: 44 }}>
                    <div className="px-2 text-[9px] text-muted-foreground font-mono">{idx + 1}</div>
                    <div className="px-2 flex items-center gap-1.5">
                      {logo && (
                        <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center overflow-hidden border border-border bg-white">
                          <img src={logo} alt={wc.workcell} className="w-full h-full object-contain p-0.5" />
                        </div>
                      )}
                      <button onClick={() => navigate(`/ole/${encodeURIComponent(wc.workcell)}`)}
                        className="text-[10px] font-semibold text-foreground hover:text-primary transition-colors truncate text-left">
                        {wc.workcell}
                      </button>
                      {wc.flagged_shifts > 0 && <AlertTriangle className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />}
                    </div>
                    <div className="px-2 text-[9px] text-muted-foreground">{wcConf?.plant}</div>
                    <div className="px-2">
                      <button onClick={() => setDrawer({ kind: 'ole_formula', workcell: wc.workcell })}
                        className={cn('text-sm font-mono font-bold hover:opacity-70 transition-opacity block', OLE_COLOR[st])}>
                        {ole.toFixed(1)}%
                      </button>
                      <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden mt-0.5" style={{ width: 56 }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(ole, 100)}%`, background: clr }} />
                      </div>
                    </div>
                    <button onClick={() => setDrawer({ kind: 'output_smh', workcell: wc.workcell })}
                      className="px-2 text-[10px] font-mono text-foreground hover:text-primary transition-colors text-right">
                      {Math.round(wc.total_output_smh).toLocaleString()}
                    </button>
                    <button onClick={() => setDrawer({ kind: 'input_hours', workcell: wc.workcell })}
                      className="px-2 text-[10px] font-mono text-foreground hover:text-violet-400 transition-colors text-right">
                      {Math.round(wc.total_input_hours).toLocaleString()}
                    </button>
                    <div className="px-2 text-[10px] font-mono text-foreground text-right">{wc.total_qty.toLocaleString()}</div>
                    <div className="px-2 text-[10px] font-mono text-foreground text-right">{wc.total_shifts}</div>
                    <div className="px-2">
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', STATUS_BADGE[st])}>
                        {STATUS_LABEL[st]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
