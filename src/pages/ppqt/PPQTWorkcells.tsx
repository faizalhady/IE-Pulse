/**
 * PPQTWorkcells.tsx
 * ──────────────────
 * Layer 2 entry point — Workcells list (portfolio view).
 *
 * Route: /ppqt/workcell
 *
 * Card grid showing each workcell's health at a glance: total demand,
 * # sub-workcenters, # processes, # bottlenecks, avg utilisation.
 * Click a card → /ppqt/workcell/:workcell (the per-workcell profile).
 *
 * Sits between the Dashboard (/ppqt) and the Workcell Profile.
 */

import WorkcellBadge from '@/components/ole/WorkcellBadge';
import { Input } from '@/components/ui/input';
import {
  getPPQTStatus,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Factory,
  FlaskConical,
  Layers,
  RefreshCw,
  Search,
  Sigma,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_WORKCELLS } from './mockPpqtData';
import { PPQTWorkcell } from './types';

export default function PPQTWorkcells() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const workcells = MOCK_WORKCELLS;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workcells;
    return workcells.filter(r =>
      r.name.toLowerCase().includes(term) ||
      r.division.toLowerCase().includes(term)
    );
  }, [workcells, search]);

  // ── Drill into a workcell profile ──
  const drillTo = (workcellId: string) => {
    navigate(`/ppqt/workcell/${encodeURIComponent(workcellId)}`);
  };

  // ── Portfolio summary stats ──
  const totalBottlenecks       = workcells.reduce((s, r) => s + r.bottlenecks, 0);
  const totalEstimates         = workcells.reduce((s, r) => s + r.ctEstimates, 0);
  const workcellsWithBottlenecks = workcells.filter(r => r.bottlenecks > 0).length;

  return (
    <div className="space-y-0">

      {/* ─── Sticky header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Factory className="h-5 w-5 text-emerald-500" />
              PPQT Workcells
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Portfolio health across {workcells.length} workcells · May 2026
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-sm font-mono">
              {totalBottlenecks > 0 && (
                <span className="text-red-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {totalBottlenecks} bottlenecks across {workcellsWithBottlenecks} workcells
                </span>
              )}
              {totalEstimates > 0 && (
                <span className="text-amber-400 flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5" />
                  {totalEstimates} CT estimates
                </span>
              )}
            </div>

            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search bar ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3">
        <div className="relative w-[280px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workcell or division…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* ─── Card grid ────────────────────────────────────────────────────── */}
      <div className="px-6 pb-8">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No workcells match the search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map(row => (
              <WorkcellCard key={row.id} row={row} onClick={() => drillTo(row.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Workcell summary card ──────────────────────────────────────────────────
function WorkcellCard({ row, onClick }: { row: PPQTWorkcell; onClick: () => void }) {
  const status = getPPQTStatus(row.avgUtil);
  const utilWidth = Math.min(row.avgUtil, 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left rounded-xl border border-border bg-card p-4 transition-all',
        'hover:border-primary/50 hover:shadow-sm',
        status === 'bottleneck' && 'border-red-500/30'
      )}
    >
      {/* Header — workcell badge + status pill */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <WorkcellBadge
            name={row.name}
            status={
              status === 'bottleneck' ? 'critical' :
              status === 'warning'    ? 'warning'  :
              status === 'healthy'    ? 'optimal'  :
              'idle'
            }
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{row.name}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{row.division}</p>
          </div>
        </div>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
          PPQT_STATUS_BADGE[status]
        )}>
          {PPQT_STATUS_LABEL[status]}
        </span>
      </div>

      {/* Avg utilisation — primary metric */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Avg utilisation
          </span>
          <span className={cn('font-mono text-lg font-bold tabular-nums', PPQT_UTIL_TEXT[status])}>
            {row.avgUtil}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full', PPQT_UTIL_BAR[status])}
            style={{ width: `${utilWidth}%` }}
          />
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat icon={<Sigma className="h-3 w-3" />}         label="Demand"      value={row.totalDemand.toLocaleString()} />
        <Stat icon={<Factory className="h-3 w-3" />}       label="SWC"         value={row.subWorkcenterCount} />
        <Stat
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Bottlenecks"
          value={row.bottlenecks}
          highlight={row.bottlenecks > 0 ? 'text-red-400' : undefined}
        />
      </div>

      {/* Footer — last updated + drill-in arrow */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {row.lastUpdated}
          {row.ctEstimates > 0 && (
            <>
              <span className="mx-1 text-muted-foreground/40">·</span>
              <span className="text-amber-400">
                {row.ctEstimates} CT est{row.ctEstimates !== 1 ? 's' : ''}
              </span>
            </>
          )}
          <span className="mx-1 text-muted-foreground/40">·</span>
          <Layers className="h-3 w-3" />
          {row.processCount} proc
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
          View workcell
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

// ─── Small stat block inside the card ──────────────────────────────────────
function Stat({
  icon, label, value, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: string;
}) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn('font-mono text-sm font-semibold tabular-nums', highlight ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}
