/**
 * IPKWorkcells.tsx
 * ─────────────────
 * "League table" view of every workcell — ranked standings, club-style.
 * Logo + name on the left, IPK stats on the right. Click a row to drill into
 * that workcell's dashboard (/ipk/:workcell).
 *
 * Route: /ipk/workcells
 *
 * Ranking (like a football table, best at top):
 *   1. Workcells that have run rank above "never run".
 *   2. Then by trolley coverage % (on-floor ÷ required) — highest first.
 *   3. Tie-break by variance (fewest trolleys short first).
 */

import { cn } from '@/lib/utils';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import {
  getIPKStatus, IPK_STATUS_BADGE, IPK_STATUS_BAR, IPK_STATUS_LABEL, IPK_VARIANCE_TEXT,
} from '@/lib/ipk/ipkConstants';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';
import type { IPKWorkcell } from './mockIpkData';
import { ChevronRight, Factory, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(10rem,1fr) 4.5rem 5.5rem 4.5rem 4.5rem 8rem 5.5rem 1.5rem';
const HEADERS = ['#', 'Workcell', 'Groups', 'Required', 'Floor', 'Var', 'Coverage', 'Status', ''];

const coverageOf = (w: IPKWorkcell) =>
  w.totalRequired > 0 ? Math.round((w.onFloor / w.totalRequired) * 100) : w.lastRun ? 100 : 0;

export default function IPKWorkcells() {
  const navigate = useNavigate();
  const { data: workcells = [], refetch, isFetching } = useIPKWorkcells();

  const ranked = useMemo(() => {
    return [...workcells].sort((a, b) => {
      const aRun = a.lastRun ? 1 : 0;
      const bRun = b.lastRun ? 1 : 0;
      if (aRun !== bRun) return bRun - aRun;             // ran above never-run
      const cov = coverageOf(b) - coverageOf(a);          // higher coverage first
      if (cov !== 0) return cov;
      return a.variance - b.variance;                     // fewest short first
    });
  }, [workcells]);

  return (
    <div className="relative">
      {/* ─── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Factory className="h-4 w-4 text-emerald-500" />
              Workcells
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              League standings · ranked by trolley coverage · {workcells.length} workcells
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* table header */}
          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}
          >
            {HEADERS.map((h, i) => (
              <div key={i} className={cn('px-2 py-2.5', i >= 2 && i <= 7 && 'text-right')}>{h}</div>
            ))}
          </div>

          {/* rows */}
          {ranked.map((row, idx) => {
            const hasRun = Boolean(row.lastRun);
            const st = getIPKStatus(row.variance, hasRun);
            const coverage = coverageOf(row);
            const logo = getWorkcellLogo(row.name);
            const pos = idx + 1;
            return (
              <button
                key={row.id}
                onClick={() => navigate(`/ipk/${encodeURIComponent(row.id)}`)}
                className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                style={{ gridTemplateColumns: GRID, height: 60 }}
              >
                {/* status zone accent */}
                <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', IPK_STATUS_BAR[st])} />

                {/* position */}
                <div className="px-2">
                  <span className="text-sm font-mono font-bold text-muted-foreground tabular-nums">{pos}</span>
                </div>

                {/* club: logo + name */}
                <div className="px-2 flex items-center gap-3 min-w-0">
                  {logo ? (
                    <div className="w-12 h-7 rounded border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={logo} alt={row.name} className="w-full h-full object-contain p-0.5" />
                    </div>
                  ) : (
                    <div className="w-12 h-7 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{row.name.slice(0, 3).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{row.division}</p>
                  </div>
                </div>

                {/* groups (played) */}
                <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                  {row.processGroupCount || '—'}
                </div>

                {/* required */}
                <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">
                  {hasRun ? row.totalRequired : '—'}
                </div>

                {/* on floor */}
                <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                  {hasRun ? row.onFloor : '—'}
                </div>

                {/* variance (goal difference) */}
                <div className={cn('px-2 text-right text-[12px] font-mono font-bold tabular-nums', IPK_VARIANCE_TEXT(row.variance))}>
                  {hasRun ? (row.variance > 0 ? `+${row.variance}` : row.variance) : '—'}
                </div>

                {/* coverage (points) — headline stat with a bar */}
                <div className="px-2">
                  {hasRun ? (
                    <>
                      <p className="text-right text-sm font-mono font-black text-foreground tabular-nums leading-none">{coverage}%</p>
                      <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div className={cn('h-full rounded-full', IPK_STATUS_BAR[st])} style={{ width: `${Math.min(coverage, 100)}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-right text-[11px] font-mono text-muted-foreground">—</p>
                  )}
                </div>

                {/* status */}
                <div className="px-2 flex justify-end">
                  <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', IPK_STATUS_BADGE[st])}>
                    {IPK_STATUS_LABEL[st]}
                  </span>
                </div>

                {/* chevron */}
                <div className="px-1 flex justify-center">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}
        </div>

        {/* legend */}
        <p className="text-[10px] text-muted-foreground mt-3">
          Ranked by trolley coverage (on-floor ÷ required). Coloured bar at the left of each row reflects status —
          fewest trolleys short sit at the top of the table.
        </p>
      </div>
    </div>
  );
}
