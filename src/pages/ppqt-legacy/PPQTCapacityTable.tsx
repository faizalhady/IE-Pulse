/**
 * PPQTCapacityTable.tsx
 * ──────────────────────
 * The core process capacity table for PPQT.
 *
 * Used on the Sub-workcenter Profile page. Manual CSS grid table with
 * gridTemplateColumns — same pattern as OLEDashboard's Summary tab.
 *
 * Columns: # · Area · Process · WCT / Takt · Eq / Need · Gap · Utilisation · CT Source · Status
 *
 * Behaviors:
 *   • Sortable column headers (controlled by parent)
 *   • Optional row click → drill into the process
 *   • Optional hideAreaColumn for when the table is scoped to one sub-workcenter
 */

import { cn } from '@/lib/utils';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getPPQTStatus,
  gapTextClass,
  PPQT_AREA_BADGE,
  PPQT_AREA_LABEL,
  PPQT_CT_SOURCE_BADGE,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
} from '@/lib/ppqt-legacy/ppqtConstants';
import { PPQTProcess } from './types';
import PPQTUtilisationBar from './PPQTUtilisationBar';

type SortDir = 'asc' | 'desc';

interface PPQTCapacityTableProps {
  rows: PPQTProcess[];
  sortCol: keyof PPQTProcess | '';
  sortDir: SortDir;
  onToggleSort: (col: keyof PPQTProcess) => void;
  onRowClick?: (row: PPQTProcess) => void;
  hideAreaColumn?: boolean;
  loading?: boolean;
  error?: Error | null;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1" />
    : <ChevronDown className="w-3 h-3 ml-1" />;
}

export default function PPQTCapacityTable({
  rows, sortCol, sortDir, onToggleSort, onRowClick, hideAreaColumn, loading, error,
}: PPQTCapacityTableProps) {

  // Grid columns — area column shows/hides based on prop
  const GT = hideAreaColumn
    ? '2.5rem minmax(11rem, 1fr) 7rem 6rem 4rem 11rem 5rem 8rem'
    : '2.5rem 4rem minmax(11rem, 1fr) 7rem 6rem 4rem 11rem 5rem 8rem';

  type Col = { key: keyof PPQTProcess; label: string; align: 'left' | 'center' };
  const cols: Col[] = [
    ...(hideAreaColumn ? [] : [{ key: 'area' as keyof PPQTProcess, label: 'Area', align: 'left' as const }]),
    { key: 'name',        label: 'Process',     align: 'left'   },
    { key: 'wct',         label: 'WCT / Takt',  align: 'center' },
    { key: 'eqAvail',     label: 'Eq / Need',   align: 'center' },
    { key: 'gap',         label: 'Gap',         align: 'center' },
    { key: 'util',        label: 'Utilisation', align: 'left'   },
    { key: 'primaryCtSource', label: 'CT Src',  align: 'center' },
    { key: 'util',        label: 'Status',      align: 'center' },
  ];

  // ── Loading skeleton ──
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">

      {/* ── Header row ── */}
      <div
        className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
        style={{ gridTemplateColumns: GT }}
      >
        <div className="px-4 py-3 text-center">#</div>
        {cols.map((c, i) => (
          <button
            key={`${c.key}-${i}`}
            onClick={() => onToggleSort(c.key)}
            className={cn(
              'px-3 py-3 flex items-center hover:text-foreground transition-colors',
              c.align === 'center' ? 'justify-center' : 'justify-start'
            )}
          >
            {c.label}
            <SortIcon active={sortCol === c.key} dir={sortDir} />
          </button>
        ))}
      </div>

      {/* ── Empty / error states ── */}
      {rows.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          {error
            ? 'Unable to load PPQT data — backend unreachable'
            : 'No processes match the current filters.'}
        </div>
      )}

      {/* ── Data rows ── */}
      {rows.map((row, idx) => {
        const status = getPPQTStatus(row.util);
        const clickable = !!onRowClick;
        return (
          <div
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'grid items-center text-sm border-b border-border last:border-0 transition-colors',
              clickable ? 'hover:bg-muted/40 cursor-pointer' : 'hover:bg-muted/20'
            )}
            style={{ gridTemplateColumns: GT }}
          >
            {/* # */}
            <div className="px-4 py-3.5 text-center text-xs text-muted-foreground font-mono">
              {idx + 1}
            </div>

            {/* Area badge (optional) */}
            {!hideAreaColumn && (
              <div className="px-3 py-3.5 flex items-center">
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                  PPQT_AREA_BADGE[row.area]
                )}>
                  {PPQT_AREA_LABEL[row.area]}
                </span>
              </div>
            )}

            {/* Process name + sub-workcenter (sequence shown as helper) */}
            <div className="px-3 py-3.5 min-w-0">
              <p className="font-semibold text-foreground truncate">{row.name}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                Step {row.sequence} of line
              </p>
            </div>

            {/* WCT / Takt */}
            <div className="px-3 py-3.5 text-center">
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {row.wct.toFixed(1)}<span className="text-muted-foreground"> / </span>{row.takt.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">sec</p>
            </div>

            {/* Eq Avail / Resources Needed */}
            <div className="px-3 py-3.5 text-center">
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums">
                {row.eqAvail}<span className="text-muted-foreground"> / </span>{row.resNeeded}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">avail / need</p>
            </div>

            {/* Gap */}
            <div className="px-3 py-3.5 text-center">
              <span className={cn('font-mono text-sm tabular-nums', gapTextClass(row.gap))}>
                {row.gap > 0 ? `+${row.gap}` : row.gap === 0 ? '—' : row.gap}
              </span>
            </div>

            {/* Utilisation bar */}
            <div className="px-3 py-3.5">
              <PPQTUtilisationBar util={row.util} />
            </div>

            {/* Primary CT Source */}
            <div className="px-3 py-3.5 flex items-center justify-center">
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                PPQT_CT_SOURCE_BADGE[row.primaryCtSource]
              )}>
                {row.primaryCtSource}
              </span>
            </div>

            {/* Status */}
            <div className="px-3 py-3.5 flex items-center justify-center">
              <span className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap',
                PPQT_STATUS_BADGE[status]
              )}>
                {PPQT_STATUS_LABEL[status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
