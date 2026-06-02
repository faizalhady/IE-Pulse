/**
 * IPKHome.tsx
 * ────────────
 * IPK landing page — portfolio overview across ALL workcells.
 *
 * Route: /ipk
 *
 * Two-column layout, mirrors PPQTHome.tsx. Drill into a workcell via the
 * "Needs Attention" list or the all-workcells table → /ipk/:workcell.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getIPKStatus,
  IPK_STATUS_BADGE,
  IPK_STATUS_BAR,
  IPK_STATUS_LABEL,
  IPK_VARIANCE_TEXT,
  type IPKStatus,
} from '@/lib/ipk/ipkConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ChevronRight,
  Kanban,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERIOD_OPTIONS } from './mockIpkData';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';

export default function IPKHome() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>('Monthly');
  const { data: workcells = [], refetch, isFetching } = useIPKWorkcells();

  const hasRun = (w: { lastRun: string | null }) => w.lastRun !== null;

  // ── Portfolio aggregates ──
  const portfolio = useMemo(() => {
    const totalVariance = workcells.reduce((s, r) => s + Math.max(r.variance, 0), 0);
    const totalProcessGroups = workcells.reduce((s, r) => s + r.processGroupCount, 0);
    const totalRequired = workcells.reduce((s, r) => s + r.totalRequired, 0);
    const totalOnFloor = workcells.reduce((s, r) => s + r.onFloor, 0);
    const ranWithDates = workcells.filter(hasRun).map(w => w.lastRun!).sort();
    const lastRun = ranWithDates.length ? ranWithDates[ranWithDates.length - 1] : null;
    const healthy = workcells.filter(w => hasRun(w) && getIPKStatus(w.variance, true) === 'healthy').length;
    return { totalVariance, totalProcessGroups, totalRequired, totalOnFloor, lastRun, healthy };
  }, [workcells]);

  const healthyPct = workcells.length ? (portfolio.healthy / workcells.length) * 100 : 0;

  // ── Workcells by status ──
  const byStatus = useMemo(() => {
    const counts: Record<IPKStatus, number> = { critical: 0, warning: 0, healthy: 0, never_run: 0 };
    workcells.forEach(w => { counts[getIPKStatus(w.variance, hasRun(w))]++; });
    return counts;
  }, [workcells]);

  // ── Attention list — variance > 0 OR never run ──
  const attention = useMemo(
    () => workcells
      .filter(w => w.variance > 0 || !hasRun(w))
      .sort((a, b) => b.variance - a.variance),
    [workcells],
  );

  const drillTo = (id: string) => navigate(`/ipk/${encodeURIComponent(id)}`);

  return (
    <div className="relative">

      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Kanban className="h-4 w-4 text-emerald-500" />
              IPK
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              In-Process Kanban Simulation · {workcells.length} workcell{workcells.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── Two-column body ───────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Portfolio hero */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                Portfolio · {period}
              </p>
              <p className={cn('text-5xl font-mono font-black mt-1 leading-none tabular-nums',
                portfolio.totalVariance > 0 ? 'text-red-400' : 'text-emerald-500')}>
                {portfolio.totalVariance}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                Trolleys short across portfolio
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${healthyPct}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono whitespace-nowrap">
                  {portfolio.healthy}/{workcells.length} healthy
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
              <Setting label="Workcells"  value={workcells.length.toString()} />
              <Setting label="Groups"     value={portfolio.totalProcessGroups.toString()} />
              <Setting label="Last run"   value={portfolio.lastRun ?? '—'} small />
            </div>
          </div>

          {/* Workcells by status */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Workcells by Status</p>
              <span className="text-base font-mono font-bold text-foreground tabular-nums">{workcells.length}</span>
            </div>
            {([
              { key: 'critical'  as IPKStatus, label: 'Critical · variance > 5' },
              { key: 'warning'   as IPKStatus, label: 'Warning · variance 1–5' },
              { key: 'healthy'   as IPKStatus, label: 'Healthy · variance ≤ 0' },
              { key: 'never_run' as IPKStatus, label: 'Never Run' },
            ]).map((r, i, arr) => {
              const count = byStatus[r.key];
              const total = workcells.length || 1;
              const pct = (count / total) * 100;
              return (
                <div key={r.key}
                  className={cn('flex items-center gap-3 px-4 py-2.5', i < arr.length - 1 && 'border-b border-border')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{r.label}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className={cn('h-full rounded-full', IPK_STATUS_BAR[r.key])} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className={cn('text-xl font-mono font-bold flex-shrink-0 tabular-nums',
                    count > 0 ? IPK_VARIANCE_TEXT(r.key === 'healthy' || r.key === 'never_run' ? 0 : 1) : 'text-muted-foreground')}>
                    {count > 0 ? count : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick stats */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Quick Stats</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="Trolleys required" value={portfolio.totalRequired.toString()} />
              <Setting label="On floor"          value={portfolio.totalOnFloor.toString()} />
              <Setting label="Portfolio gap"     value={portfolio.totalVariance.toString()}
                       tone={portfolio.totalVariance > 0 ? 'red' : undefined} />
              <Setting label="Most recent"       value={portfolio.lastRun ?? '—'} small />
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Needs attention */}
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
                const st = getIPKStatus(row.variance, hasRun(row));
                return (
                  <button
                    key={row.id}
                    onClick={() => drillTo(row.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors group',
                      i < attention.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{row.division}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={cn('text-base font-mono font-bold tabular-nums block', IPK_VARIANCE_TEXT(row.variance))}>
                        {hasRun(row) ? (row.variance > 0 ? `+${row.variance}` : row.variance) : '—'}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {hasRun(row) ? 'trolleys short' : 'never run'}
                      </span>
                    </div>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0', IPK_STATUS_BADGE[st])}>
                      {IPK_STATUS_LABEL[st]}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* All workcells table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                All Workcells · {workcells.length}
              </p>
              <p className="text-[9px] text-muted-foreground">Click row to drill in</p>
            </div>

            <div
              className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
              style={{ gridTemplateColumns: '1.5rem minmax(8rem,1fr) 7rem 5.5rem 4rem 4.5rem 4rem 4.5rem 5rem 6.5rem' }}
            >
              {['#', 'Workcell', 'Division', 'Last Run', 'Groups', 'Required', 'Floor', 'Variance', 'Status', ''].map((h, i) => (
                <div key={i} className="px-2 py-2">{h}</div>
              ))}
            </div>

            {workcells.map((row, idx) => {
              const st = getIPKStatus(row.variance, hasRun(row));
              return (
                <div
                  key={row.id}
                  onClick={() => drillTo(row.id)}
                  className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  style={{ gridTemplateColumns: '1.5rem minmax(8rem,1fr) 7rem 5.5rem 4rem 4.5rem 4rem 4.5rem 5rem 6.5rem', height: 56 }}
                >
                  <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                  <div className="px-2 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate uppercase tracking-wider">{row.periodType}</p>
                  </div>
                  <div className="px-2 text-[10px] text-muted-foreground truncate">{row.division}</div>
                  <div className="px-2 text-[10px] font-mono text-foreground tabular-nums">{row.lastRun ?? '—'}</div>
                  <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{row.processGroupCount || '—'}</div>
                  <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">{row.totalRequired || '—'}</div>
                  <div className="px-2 text-[11px] font-mono text-muted-foreground tabular-nums">{row.onFloor || '—'}</div>
                  <div className="px-2">
                    <span className={cn('text-[11px] font-mono font-bold tabular-nums', IPK_VARIANCE_TEXT(row.variance))}>
                      {hasRun(row) ? (row.variance > 0 ? `+${row.variance}` : row.variance) : '—'}
                    </span>
                  </div>
                  <div className="px-2">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', IPK_STATUS_BADGE[st])}>
                      {IPK_STATUS_LABEL[st]}
                    </span>
                  </div>
                  <div className="px-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/ipk/${encodeURIComponent(row.id)}/simulate`); }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Play className="h-2.5 w-2.5" />
                      Run
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small setting cell ──────────────────────────────────────────────────────
function Setting({ label, value, tone, small }: { label: string; value: string; tone?: 'red' | 'amber'; small?: boolean }) {
  const valueClass =
    tone === 'red'   ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    'text-foreground';
  return (
    <div className="px-3 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('font-mono font-bold mt-0.5 tabular-nums', small ? 'text-[11px]' : 'text-sm', valueClass)}>{value}</p>
    </div>
  );
}
