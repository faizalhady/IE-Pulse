/**
 * PPQTHome.tsx
 * ─────────────
 * PPQT Dashboard — portfolio-level overview across ALL workcells.
 *
 * Route: /ppqt
 *
 * Layer 1 of the hierarchy. High-level "what needs my attention today?".
 * Drill into a workcell via the attention list or ranking table →
 * navigates to /ppqt/workcell/:workcell.
 *
 * Mirrors src/pages/ole/OlePlantReport.tsx — two-column layout.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import {
  getPPQTStatus,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt-legacy/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FlaskConical,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_WORKCELLS, PERIOD_OPTIONS } from './mockPpqtData';
import { PPQTStatus } from './types';

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function PPQTHome() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>('May 2026');

  const workcells = MOCK_WORKCELLS;

  // ── Portfolio aggregates ──
  const portfolio = useMemo(() => {
    const totalDemand = workcells.reduce((s, r) => s + r.totalDemand, 0);
    const totalProcesses = workcells.reduce((s, r) => s + r.processCount, 0);
    const totalBottlenecks = workcells.reduce((s, r) => s + r.bottlenecks, 0);
    const totalEstimates = workcells.reduce((s, r) => s + r.ctEstimates, 0);
    const weightedSum = workcells.reduce((s, r) => s + r.avgUtil * r.totalDemand, 0);
    const avgUtil = totalDemand > 0 ? Math.round(weightedSum / totalDemand) : 0;
    return { totalDemand, totalProcesses, totalBottlenecks, totalEstimates, avgUtil };
  }, [workcells]);

  const portfolioStatus = getPPQTStatus(portfolio.avgUtil);
  const portfolioUtilWidth = Math.min(portfolio.avgUtil, 100);

  // ── Workcell counts by status ──
  const byStatus = useMemo(() => {
    const counts = { bottleneck: 0, warning: 0, healthy: 0, idle: 0 };
    workcells.forEach(r => { counts[getPPQTStatus(r.avgUtil)]++; });
    return counts;
  }, [workcells]);

  // ── Attention list — workcells with bottlenecks or hot util ──
  const attention = useMemo(() => {
    return workcells
      .filter(r => r.bottlenecks > 0 || getPPQTStatus(r.avgUtil) === 'bottleneck' || getPPQTStatus(r.avgUtil) === 'warning')
      .sort((a, b) => b.avgUtil - a.avgUtil);
  }, [workcells]);

  // ── Workcell ranking (sorted by util desc) ──
  const ranked = useMemo(() => [...workcells].sort((a, b) => b.avgUtil - a.avgUtil), [workcells]);

  const drillTo = (workcellId: string) => {
    navigate(`/ppqt-legacy/workcell/${encodeURIComponent(workcellId)}`);
  };

  return (
    <div className="relative">

      {/* ─── Sticky header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Layers className="h-4 w-4 text-emerald-500" />
              PPQT Dashboard
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Portfolio health across {workcells.length} workcells · {period}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              onClick={() => { /* refetch hook later */ }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── Two-column body ─────────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Portfolio hero */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Portfolio · {period}
                  </p>
                  <p className={cn('text-5xl font-mono font-black mt-1 leading-none tabular-nums', PPQT_UTIL_TEXT[portfolioStatus])}>
                    {portfolio.avgUtil}%
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                    Avg utilisation
                  </p>
                </div>
                <span className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0',
                  PPQT_STATUS_BADGE[portfolioStatus]
                )}>
                  {PPQT_STATUS_LABEL[portfolioStatus]}
                </span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[portfolioStatus])}
                  style={{ width: `${portfolioUtilWidth}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total demand</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {portfolio.totalDemand.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">units / month</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Processes</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {portfolio.totalProcesses}
                </p>
                <p className="text-[9px] text-muted-foreground">across portfolio</p>
              </div>
            </div>
          </div>

          {/* Workcells by status */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workcells by Status</p>
              <span className="text-base font-mono font-bold text-foreground tabular-nums">{workcells.length}</span>
            </div>
            {([
              { key: 'bottleneck' as PPQTStatus, label: 'Bottleneck', color: 'text-red-400',     bar: 'bg-red-500'     },
              { key: 'warning'    as PPQTStatus, label: 'Warning',    color: 'text-amber-400',   bar: 'bg-amber-400'   },
              { key: 'healthy'    as PPQTStatus, label: 'Healthy',    color: 'text-emerald-400', bar: 'bg-emerald-500' },
              { key: 'idle'       as PPQTStatus, label: 'Idle',       color: 'text-muted-foreground', bar: 'bg-muted-foreground/40' },
            ]).map((r, i, arr) => {
              const count = byStatus[r.key];
              const total = workcells.length || 1;
              const pct = (count / total) * 100;
              return (
                <div key={r.key}
                  className={cn('flex items-center gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{r.label}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className={cn('h-full rounded-full', r.bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className={cn('text-xl font-mono font-bold flex-shrink-0 tabular-nums', r.color)}>
                    {count > 0 ? count : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Portfolio quick stats */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Portfolio Stats</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="Workcells"    value={workcells.length.toString()} />
              <Setting label="Processes"    value={portfolio.totalProcesses.toString()} />
              <Setting label="Bottlenecks"  value={portfolio.totalBottlenecks.toString()}
                       tone={portfolio.totalBottlenecks > 0 ? 'red' : undefined} />
              <Setting label="CT estimates" value={portfolio.totalEstimates.toString()}
                       tone={portfolio.totalEstimates > 0 ? 'amber' : undefined} />
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Attention list */}
          {attention.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  Needs Attention · {attention.length} workcell{attention.length !== 1 ? 's' : ''}
                </p>
                <span className="text-[9px] text-muted-foreground">Click to drill in</span>
              </div>
              {attention.map((row, i) => {
                const st = getPPQTStatus(row.avgUtil);
                const logo = resolveLogo(row.id);
                return (
                  <button
                    key={row.id}
                    onClick={() => drillTo(row.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors group',
                      i < attention.length - 1 && 'border-b border-border'
                    )}
                  >
                    {logo ? (
                      <div className="w-12 h-7 rounded border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img src={logo} alt={row.name} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="w-12 h-7 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {row.name.slice(0, 3).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {row.subWorkcenterCount} sub-workcenter{row.subWorkcenterCount !== 1 ? 's' : ''} · {row.division}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={cn('text-base font-mono font-bold tabular-nums block', PPQT_UTIL_TEXT[st])}>
                        {row.avgUtil}%
                      </span>
                      {row.bottlenecks > 0 && (
                        <span className="text-[9px] text-red-400 font-semibold">
                          {row.bottlenecks} bottleneck{row.bottlenecks !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Workcell ranking */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                Workcell Performance · {ranked.length} workcells
              </p>
              <p className="text-[9px] text-muted-foreground">Sorted by utilisation · click row to drill in</p>
            </div>

            <div
              className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
              style={{ gridTemplateColumns: '1.5rem 4rem minmax(8rem, 1fr) 4rem 5rem 9rem 4.5rem 5rem 6rem' }}
            >
              {['#', 'Logo', 'Workcell', 'Demand', 'SWC', 'Avg util', 'Bottlenecks', 'CT est', 'Status'].map(h => (
                <div key={h} className="px-2 py-2">{h}</div>
              ))}
            </div>

            {ranked.map((row, idx) => {
              const st = getPPQTStatus(row.avgUtil);
              const logo = resolveLogo(row.id);
              const utilWidth = Math.min(row.avgUtil, 100);
              return (
                <div
                  key={row.id}
                  onClick={() => drillTo(row.id)}
                  className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: '1.5rem 4rem minmax(8rem, 1fr) 4rem 5rem 9rem 4.5rem 5rem 6rem', height: 48 }}
                >
                  <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                  <div className="px-2">
                    {logo ? (
                      <div className="w-12 h-6 rounded border border-border bg-white flex items-center justify-center overflow-hidden">
                        <img src={logo} alt={row.name} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ) : (
                      <div className="w-12 h-6 rounded border border-border bg-muted flex items-center justify-center">
                        <span className="text-[9px] font-bold text-muted-foreground">{row.name.slice(0, 3)}</span>
                      </div>
                    )}
                  </div>
                  <div className="px-2 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{row.division}</p>
                  </div>
                  <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">
                    {row.totalDemand.toLocaleString()}
                  </div>
                  <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{row.subWorkcenterCount}</div>
                  <div className="px-2">
                    <span className={cn('text-sm font-mono font-bold block tabular-nums', PPQT_UTIL_TEXT[st])}>
                      {row.avgUtil}%
                    </span>
                    <div className="h-0.5 rounded-full bg-muted/40 overflow-hidden mt-0.5">
                      <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[st])} style={{ width: `${utilWidth}%` }} />
                    </div>
                  </div>
                  <div className="px-2">
                    <span className={cn('text-[11px] font-mono font-semibold tabular-nums', row.bottlenecks > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                      {row.bottlenecks > 0 ? row.bottlenecks : '—'}
                    </span>
                  </div>
                  <div className="px-2 flex items-center gap-1">
                    {row.ctEstimates > 0 && <FlaskConical className="h-2.5 w-2.5 text-amber-400" />}
                    <span className={cn('text-[11px] font-mono font-semibold tabular-nums', row.ctEstimates > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                      {row.ctEstimates > 0 ? row.ctEstimates : '—'}
                    </span>
                  </div>
                  <div className="px-2">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', PPQT_STATUS_BADGE[st])}>
                      {PPQT_STATUS_LABEL[st]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* "View all workcells" link */}
          <button
            onClick={() => navigate('/ppqt-legacy/workcell')}
            className="self-end flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all workcells
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small setting cell ──────────────────────────────────────────────────────
function Setting({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'amber' }) {
  const valueClass =
    tone === 'red'   ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-foreground';
  return (
    <div className="px-4 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-mono font-bold mt-0.5 tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}
