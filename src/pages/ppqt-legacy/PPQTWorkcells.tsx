/**
 * PPQTWorkcells.tsx
 * ──────────────────
 * Layer 2 entry point — Workcells "league table" (portfolio standings).
 *
 * Route: /ppqt/workcell
 *
 * League-style ranking of every workcell: logo + name on the left, the
 * high-level capacity stats on the right (demand, sub-workcenters, processes,
 * bottlenecks, CT estimates, avg utilisation). Ranked by utilisation — the
 * busiest / most-at-risk workcells sit at the top, so bottlenecks surface
 * first. Click a row → /ppqt/workcell/:workcell (per-workcell profile).
 */

import { Input } from '@/components/ui/input';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import {
  getPPQTStatus,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt-legacy/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ChevronRight, Factory, FlaskConical, RefreshCw, Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_WORKCELLS } from './mockPpqtData';

const GRID = '2.5rem minmax(10rem,1fr) 5.5rem 3.5rem 4rem 5rem 5rem 8rem 6rem 1.5rem';
const HEADERS = ['#', 'Workcell', 'Demand', 'SWC', 'Proc', 'Bottle.', 'CT Est', 'Avg Util', 'Status', ''];

export default function PPQTWorkcells() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const workcells = MOCK_WORKCELLS;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? workcells.filter(r => r.name.toLowerCase().includes(term) || r.division.toLowerCase().includes(term))
      : workcells;
    // Standings: highest utilisation at the top, bottlenecks break ties.
    return [...filtered].sort((a, b) => b.avgUtil - a.avgUtil || b.bottlenecks - a.bottlenecks);
  }, [workcells, search]);

  const drillTo = (workcellId: string) => navigate(`/ppqt-legacy/workcell/${encodeURIComponent(workcellId)}`);

  // ── Portfolio summary stats ──
  const totalBottlenecks = workcells.reduce((s, r) => s + r.bottlenecks, 0);
  const totalEstimates = workcells.reduce((s, r) => s + r.ctEstimates, 0);
  const workcellsWithBottlenecks = workcells.filter(r => r.bottlenecks > 0).length;

  return (
    <div className="relative">
      {/* ─── Sticky header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6">
        <div className="pt-4 pb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Factory className="h-5 w-5 text-emerald-500" />
              PPQT Workcells
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              League standings · ranked by utilisation · {workcells.length} workcells · May 2026
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

      <div className="p-5">
        {/* ─── Search ───────────────────────────────────────────────────── */}
        <div className="relative w-[280px] mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workcell or division…"
            className="pl-8 h-9"
          />
        </div>

        {/* ─── League table ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: GRID }}
          >
            {HEADERS.map((h, i) => (
              <div key={i} className={cn('px-2 py-2.5', i >= 2 && i <= 8 && 'text-right')}>{h}</div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No workcells match the search.</div>
          ) : (
            rows.map((row, idx) => {
              const st = getPPQTStatus(row.avgUtil);
              const logo = getWorkcellLogo(row.name);
              const utilWidth = Math.min(row.avgUtil, 100);
              const pos = idx + 1;
              return (
                <button
                  key={row.id}
                  onClick={() => drillTo(row.id)}
                  className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                  style={{ gridTemplateColumns: GRID, height: 60 }}
                >
                  {/* status zone accent */}
                  <span className={cn('absolute left-0 top-0 bottom-0 w-0.5', PPQT_UTIL_BAR[st])} />

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

                  {/* demand */}
                  <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">
                    {row.totalDemand.toLocaleString()}
                  </div>

                  {/* sub-workcenters */}
                  <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                    {row.subWorkcenterCount}
                  </div>

                  {/* processes */}
                  <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                    {row.processCount}
                  </div>

                  {/* bottlenecks */}
                  <div className={cn('px-2 text-right text-[11px] font-mono font-semibold tabular-nums',
                    row.bottlenecks > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                    {row.bottlenecks > 0 ? row.bottlenecks : '—'}
                  </div>

                  {/* CT estimates */}
                  <div className="px-2 flex items-center justify-end gap-1">
                    {row.ctEstimates > 0 && <FlaskConical className="h-2.5 w-2.5 text-amber-400" />}
                    <span className={cn('text-[11px] font-mono font-semibold tabular-nums',
                      row.ctEstimates > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                      {row.ctEstimates > 0 ? row.ctEstimates : '—'}
                    </span>
                  </div>

                  {/* avg util — headline stat with bar */}
                  <div className="px-2">
                    <p className={cn('text-right text-sm font-mono font-black tabular-nums leading-none', PPQT_UTIL_TEXT[st])}>
                      {row.avgUtil}%
                    </p>
                    <div className="mt-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[st])} style={{ width: `${utilWidth}%` }} />
                    </div>
                  </div>

                  {/* status */}
                  <div className="px-2 flex justify-end">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', PPQT_STATUS_BADGE[st])}>
                      {PPQT_STATUS_LABEL[st]}
                    </span>
                  </div>

                  {/* chevron */}
                  <div className="px-1 flex justify-center">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* legend */}
        <p className="text-[10px] text-muted-foreground mt-3">
          Ranked by average utilisation — the busiest workcells sit at the top, so bottlenecks (&gt; 100%) surface first.
          Coloured bar at the left of each row reflects status.
        </p>
      </div>
    </div>
  );
}
