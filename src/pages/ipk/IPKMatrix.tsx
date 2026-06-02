/**
 * IPKMatrix.tsx
 * ──────────────
 * Demand-tier × process-group trolley lookup table. Cell color scales with the
 * trolley count; the row nearest the latest run's demand is highlighted.
 *
 * Route: /ipk/:workcell/matrix
 */

import { cn } from '@/lib/utils';
import { useIPKMatrix } from '@/hooks/ipk/useIPKMatrix';
import { useIPKSummary } from '@/hooks/ipk/useIPKSummary';
import IPKWorkcellHeader from './IPKWorkcellHeader';
import { Play } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/** Trolley-count → text color tier. */
function cellClass(v: number): string {
  if (v <= 3) return 'text-muted-foreground';
  if (v <= 8) return 'text-foreground';
  if (v <= 15) return 'text-amber-400 font-semibold';
  return 'text-red-400 font-bold';
}

export default function IPKMatrix() {
  const navigate = useNavigate();
  const { workcell = '' } = useParams();
  const { data: matrix } = useIPKMatrix(workcell);
  const { data: summary = [] } = useIPKSummary(workcell);

  // Current demand from latest run → nearest tier row to highlight.
  const currentDemand = summary[0]?.loadingQty ?? 0;
  const highlightRow = useMemo(() => {
    if (!matrix || !currentDemand) return -1;
    let best = 0, bestDiff = Infinity;
    matrix.demandTiers.forEach((t, i) => {
      const d = Math.abs(t - currentDemand);
      if (d < bestDiff) { bestDiff = d; best = i; }
    });
    return best;
  }, [matrix, currentDemand]);

  if (!matrix) return null;

  const runCount = 6; // mock — runs the matrix was generated from

  return (
    <div className="relative">
      <IPKWorkcellHeader
        workcellId={workcell}
        subtitle="IPK Matrix · trolleys needed per process group at each demand level"
        actions={
          <button
            onClick={() => navigate(`/ipk/${encodeURIComponent(workcell)}/simulate`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Run Simulation
          </button>
        }
      />

      <div className="p-5 flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left text-[9px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">
                    Demand ↓ / Group →
                  </th>
                  {matrix.processGroups.map(g => (
                    <th key={g} className="px-3 py-2.5 text-right text-[9px] text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.demandTiers.map((tier, rowIdx) => {
                  const isCurrent = rowIdx === highlightRow;
                  return (
                    <tr key={tier}
                      className={cn('border-b border-border last:border-0 transition-colors',
                        isCurrent ? 'bg-emerald-500/10' : 'hover:bg-muted/20')}>
                      <td className={cn('sticky left-0 z-10 px-3 py-2.5 text-[11px] font-mono font-bold tabular-nums whitespace-nowrap',
                        isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-card text-foreground')}>
                        {tier.toLocaleString()}
                        {isCurrent && <span className="ml-1.5 text-[8px] uppercase tracking-wider">current</span>}
                      </td>
                      {matrix.values[rowIdx].map((v, colIdx) => (
                        <td key={colIdx} className={cn('px-3 py-2.5 text-right text-[12px] font-mono tabular-nums', cellClass(v))}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Generated from {runCount} simulation runs. Refresh by running more simulations.
          </p>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="text-muted-foreground font-mono">1–3</span> low</span>
            <span className="flex items-center gap-1"><span className="text-foreground font-mono">4–8</span></span>
            <span className="flex items-center gap-1"><span className="text-amber-400 font-mono font-semibold">9–15</span></span>
            <span className="flex items-center gap-1"><span className="text-red-400 font-mono font-bold">16+</span> high</span>
          </div>
        </div>
      </div>
    </div>
  );
}
