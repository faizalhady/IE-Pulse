/**
 * StepDrawer.tsx
 * ───────────────
 * The "why" behind one process step — right-side overlay drawer shared by the
 * PPQT dashboard tabs (DASH chart click, Report row click).
 *
 * Contents: NEED/HAVE/GAP/Load KPI strip, the math trail (WCT ÷ Takt ÷
 * (FPY × Eff) → round up), estimate warning, and the load-driver evidence
 * table with expand-in-place CT composition per assembly.
 */

import {
  PPQT_AREA_BADGE,
  PPQT_CT_SOURCE_BADGE,
  PPQT_UTIL_TEXT,
  getPPQTStatus,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PPQTProcess, PPQTSubWorkcenter } from '../types';
import { getEvidenceForProcess, getMathTrail } from './ppqt2Data';

export function StepDrawer({
  process, line, onClose,
}: {
  process: PPQTProcess;
  line: PPQTSubWorkcenter;
  onClose: () => void;
}) {
  const trail = useMemo(() => getMathTrail(process, line), [process, line]);
  const evidence = useMemo(() => getEvidenceForProcess(process.id), [process.id]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const status = getPPQTStatus(process.util);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[640px] bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{process.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{line.name}</p>
            </div>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', PPQT_AREA_BADGE[process.area])}>
              {process.area}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* KPI strip — the verdict numbers */}
        <div className="grid grid-cols-4 divide-x divide-border border-b border-border flex-shrink-0">
          {[
            { label: 'Have', value: String(trail.eqAvail), tone: 'text-foreground' },
            { label: 'Need', value: String(trail.resNeeded), tone: trail.gap > 0 ? 'text-red-400' : 'text-foreground' },
            { label: 'Gap', value: trail.gap > 0 ? `−${trail.gap}` : '0', tone: trail.gap > 0 ? 'text-red-400' : 'text-emerald-400' },
            { label: 'Load', value: `${Math.round(process.util)}%`, tone: PPQT_UTIL_TEXT[status] },
          ].map(k => (
            <div key={k.label} className="px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className={cn('text-xl font-mono font-bold mt-0.5', k.tone)}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* math trail */}
          <div className="px-6 py-4 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              How NEED is calculated
            </p>
            <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
              <TrailBox label="WCT" value={`${trail.wct.toFixed(1)}s`} />
              <span className="text-muted-foreground">÷</span>
              <TrailBox label="Takt" value={`${trail.takt.toFixed(1)}s`} />
              <span className="text-muted-foreground">÷</span>
              <TrailBox label="FPY" value={`${trail.fpy}%`} />
              <span className="text-muted-foreground">×</span>
              <TrailBox label="Eff" value={`${trail.efficiency}%`} />
              <span className="text-muted-foreground">=</span>
              <TrailBox label="Raw" value={trail.rawNeed.toFixed(2)} highlight />
              <span className="text-muted-foreground">→ round up →</span>
              <TrailBox
                label="Need"
                value={String(trail.resNeeded)}
                highlight
                tone={trail.gap > 0 ? 'text-red-400' : 'text-emerald-400'}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
              One unit must leave this step every {trail.takt.toFixed(0)}s to meet demand. The demand-weighted
              average build time is {trail.wct.toFixed(1)}s, inflated by yield ({trail.fpy}%) and operator
              efficiency ({trail.efficiency}%) losses. You can't own {trail.rawNeed.toFixed(2)} machines — round up.
            </p>
          </div>

          {/* estimate warning */}
          {evidence.estCount > 0 && (
            <div className="mx-6 mt-4 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                <span className="font-semibold text-amber-400">{evidence.estCount} of {evidence.rows.length} cycle
                times are estimates</span> carrying {evidence.estLoadShare}% of this step's load. The gap may not be
                real — confirm with a time study before requesting equipment.
              </p>
            </div>
          )}

          {/* evidence table — which assemblies drive the load */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              What drives this step's load
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              {evidence.demandThruStep.toLocaleString()} units route through this step. Ranked by demand × CT.
              Click a row for the CT composition.
            </p>

            <div className="rounded-lg border border-border overflow-hidden">
              <div
                className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                style={{ gridTemplateColumns: '1.8rem minmax(9rem,1fr) 4.5rem 4.5rem minmax(5.5rem,0.8fr) 4.5rem' }}
              >
                {['#', 'Assembly', 'Demand', 'CT (s)', 'Load share', 'Source'].map((h, i) => (
                  <div key={h} className={cn('px-2 py-2', (i === 2 || i === 3) && 'text-right')}>{h}</div>
                ))}
              </div>

              {evidence.rows.map((r, i) => {
                const isOpen = expanded === r.assemblyId;
                return (
                  <div key={r.assemblyId} className="border-b border-border last:border-0">
                    <button
                      onClick={() => setExpanded(isOpen ? null : r.assemblyId)}
                      className="grid items-center w-full text-left hover:bg-muted/30 transition-colors"
                      style={{ gridTemplateColumns: '1.8rem minmax(9rem,1fr) 4.5rem 4.5rem minmax(5.5rem,0.8fr) 4.5rem', height: 44 }}
                    >
                      <div className="px-2 text-[10px] font-mono text-muted-foreground">{i + 1}</div>
                      <div className="px-2 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{r.partNumber} / {r.rev}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{r.family}</p>
                      </div>
                      <div className="px-2 text-right text-xs font-mono text-foreground tabular-nums">{r.demand.toLocaleString()}</div>
                      <div className="px-2 text-right text-xs font-mono text-foreground tabular-nums">{r.ctAdj.toFixed(1)}</div>
                      <div className="px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.loadShare}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-7 text-right">{r.loadShare}%</span>
                        </div>
                      </div>
                      <div className="px-2">
                        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border', PPQT_CT_SOURCE_BADGE[r.ctSource])}>
                          {r.ctSource}
                        </span>
                      </div>
                    </button>

                    {/* CT composition — expand in place */}
                    {isOpen && (
                      <div className="px-4 pb-3 pt-1 bg-muted/20">
                        <div className="flex h-2.5 rounded-full overflow-hidden border border-border/50">
                          {r.machAdj > 0 && <div className="bg-blue-500" style={{ width: `${(r.machAdj / r.ctAdj) * 100}%` }} />}
                          {r.imtAdj > 0 && <div className="bg-violet-500" style={{ width: `${(r.imtAdj / r.ctAdj) * 100}%` }} />}
                          {r.handAdj > 0 && <div className="bg-orange-500" style={{ width: `${(r.handAdj / r.ctAdj) * 100}%` }} />}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                          <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />Mach {r.machAdj.toFixed(1)}s</span>
                          <span><span className="inline-block w-2 h-2 rounded-sm bg-violet-500 mr-1" />IMT {r.imtAdj.toFixed(1)}s</span>
                          <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-500 mr-1" />Hand {r.handAdj.toFixed(1)}s</span>
                          <span className="ml-auto">
                            {r.studyDate ? `Studied ${r.studyDate}` : 'Never studied — estimate'}
                          </span>
                        </div>
                      </div>
                    )}
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

function TrailBox({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: string }) {
  return (
    <span className={cn(
      'inline-flex flex-col items-center px-2.5 py-1.5 rounded-lg border',
      highlight ? 'border-border bg-muted/50' : 'border-border/60 bg-card',
    )}>
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums', tone ?? 'text-foreground')}>{value}</span>
    </span>
  );
}
