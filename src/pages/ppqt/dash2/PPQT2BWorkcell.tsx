/**
 * PPQT2BWorkcell.tsx — Dashboard 2 · Variant B ("Triage" approach)
 * ─────────────────────────────────────────────────────────────────
 * Guided triage for one workcell. Two-column layout (PPQT house style):
 *
 *   Left rail   →  production lines with their shortfall — the scope selector
 *   Right feed  →  verdict sentence, then one card per PAIN POINT (short or
 *                  tight step). Each card expands IN PLACE: math trail + the
 *                  assemblies driving the load. No drawer, no extra routes.
 *                  Healthy steps live in a collapsed section at the bottom.
 *
 * Versus the Report tab: Report is "see everything, filter down" (dense grid +
 * drawer); Triage is "show me only what's wrong, explain each one".
 *
 * Used as the "Triage" tab in PPQT2AWorkcell — no standalone route.
 * Data: mock (ppqt2Data.ts derived layer) — same numbers as the other tabs.
 */

import {
  PPQT_AREA_BADGE,
  PPQT_CT_SOURCE_BADGE,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
  PPQT_VERDICT_DOT,
  getPPQTStatus,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PERIOD_OPTIONS } from '../mockPpqtData';
import { PPQTProcess, PPQTSubWorkcenter } from '../types';
import {
  buildWorkcellCapacity,
  getEvidenceForProcess,
  getMathTrail,
} from './ppqt2Data';

/**
 * Triage body (line rail + pain-point feed) — embeddable.
 * Rendered as the "Triage" tab in the PPQT dashboard workcell page.
 */
export function PPQT2BWorkcellContent({
  workcellId, period = PERIOD_OPTIONS[0],
}: {
  workcellId: string;
  period?: string;
}) {
  const [scope, setScope] = useState<string>('all'); // 'all' | swc id
  const [showHealthy, setShowHealthy] = useState(false);

  const data = useMemo(() => buildWorkcellCapacity(workcellId), [workcellId]);
  if (!data) return null;

  const scopedLines = data.lines.filter(l => scope === 'all' || l.swc.id === scope);

  // Pain points = short or tight steps across the scoped lines, worst first.
  const painPoints: Array<{ process: PPQTProcess; line: PPQTSubWorkcenter }> = [];
  const healthySteps: Array<{ process: PPQTProcess; line: PPQTSubWorkcenter }> = [];
  for (const line of scopedLines) {
    for (const p of line.processes) {
      if (p.gap > 0 || p.util >= 90) painPoints.push({ process: p, line: line.swc });
      else healthySteps.push({ process: p, line: line.swc });
    }
  }
  painPoints.sort((a, b) => b.process.gap - a.process.gap || b.process.util - a.process.util);

  const machinesShort = scopedLines.reduce((s, l) => s + l.machinesShort, 0);
  const stepsShort = scopedLines.reduce((s, l) => s + l.stepsShort, 0);

  return (
      <div className="p-5 flex gap-5 items-start">
        {/* ── left rail: lines ──────────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Production lines
            </div>

            <RailItem
              active={scope === 'all'}
              onClick={() => setScope('all')}
              title="All lines"
              subtitle={`${data.stepsTotal} steps across ${data.lines.length} lines`}
              metric={data.machinesShort > 0 ? `−${data.machinesShort}` : '✓'}
              metricTone={data.machinesShort > 0 ? 'text-red-400' : 'text-emerald-400'}
            />

            {data.lines.map(line => (
              <RailItem
                key={line.swc.id}
                active={scope === line.swc.id}
                onClick={() => setScope(line.swc.id)}
                title={line.swc.name}
                area={line.swc.area}
                subtitle={
                  line.machinesShort > 0
                    ? `${line.stepsShort} of ${line.processes.length} steps short`
                    : line.stepsTight > 0
                      ? `${line.stepsTight} step${line.stepsTight !== 1 ? 's' : ''} above 90%`
                      : `${line.processes.length} steps, all OK`
                }
                metric={line.machinesShort > 0 ? `−${line.machinesShort}` : '✓'}
                metricTone={line.machinesShort > 0 ? 'text-red-400' : line.stepsTight > 0 ? 'text-amber-400' : 'text-emerald-400'}
                dot={PPQT_VERDICT_DOT[line.verdict]}
              />
            ))}
          </div>

          {/* operating params of scoped line(s) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Operating parameters
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {(scope === 'all' ? [data.lines[0]?.swc] : [data.lines.find(l => l.swc.id === scope)?.swc])
                .filter((s): s is PPQTSubWorkcenter => !!s)
                .map(s => (
                  <div key={s.id} className="text-[11px] font-mono text-muted-foreground space-y-1">
                    <Param label="Shift hours / day" value={`${s.shiftHours} h`} />
                    <Param label="Working days" value={`${s.workingDays} d`} />
                    <Param label="Changeovers" value={`${s.changeoverQty}× ${s.changeoverTime} min/day`} />
                    <Param label="FPY" value={`${s.fpy}%`} />
                    <Param label="Efficiency" value={`${s.efficiency}%`} />
                    {scope === 'all' && (
                      <p className="text-[9px] text-muted-foreground/70 pt-1">Shown for {data.lines[0]?.swc.name}; params are per line.</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ── right: triage feed ────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* verdict sentence */}
          <div className={cn(
            'rounded-xl border px-5 py-4',
            machinesShort > 0
              ? 'border-red-500/30 bg-red-500/10'
              : painPoints.length > 0
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-emerald-500/30 bg-emerald-500/10',
          )}>
            <p className={cn(
              'text-sm font-bold',
              machinesShort > 0 ? 'text-red-400' : painPoints.length > 0 ? 'text-amber-400' : 'text-emerald-400',
            )}>
              {machinesShort > 0
                ? `✕ ${period}: ${stepsShort} step${stepsShort !== 1 ? 's' : ''} cannot keep up — ${machinesShort} machine${machinesShort !== 1 ? 's' : ''} short.`
                : painPoints.length > 0
                  ? `⚠ ${period}: demand fits, but ${painPoints.length} step${painPoints.length !== 1 ? 's run' : ' runs'} above 90% — no headroom.`
                  : `✓ ${period}: demand fits with current equipment.`}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {data.wc.totalDemand.toLocaleString()} units demanded · {scopedLines.length} line{scopedLines.length !== 1 ? 's' : ''} ·{' '}
              {scopedLines.reduce((s, l) => s + l.processes.length, 0)} steps checked
            </p>
          </div>

          {/* pain point cards */}
          {painPoints.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pain points ({painPoints.length})
              </p>
              {painPoints.map(({ process, line }) => (
                <PainPointCard key={process.id} process={process} line={line} />
              ))}
            </div>
          )}
          {painPoints.length === 0 && (
            <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              No pain points in this scope. 🎉
            </div>
          )}

          {/* healthy steps — collapsed */}
          {healthySteps.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setShowHealthy(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              >
                {showHealthy
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs font-semibold text-foreground">Healthy steps</span>
                <span className="text-[10px] text-muted-foreground">({healthySteps.length} — capacity sufficient)</span>
              </button>
              {showHealthy && (
                <div className="border-t border-border">
                  {healthySteps.map(({ process, line }) => {
                    const status = getPPQTStatus(process.util);
                    return (
                      <div
                        key={process.id}
                        className="grid items-center border-b border-border last:border-0"
                        style={{ gridTemplateColumns: 'minmax(10rem,1fr) minmax(8rem,1fr) 5rem 5rem 6rem', height: 40 }}
                      >
                        <div className="px-4 text-xs font-medium text-foreground truncate">{process.name}</div>
                        <div className="px-2 text-[10px] text-muted-foreground truncate">{line.name}</div>
                        <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                          {process.resNeeded}/{process.eqAvail}
                          <span className="text-[8px] ml-1">need/have</span>
                        </div>
                        <div className={cn('px-2 text-right text-[11px] font-mono tabular-nums', PPQT_UTIL_TEXT[status])}>
                          {Math.round(process.util)}%
                        </div>
                        <div className="px-4">
                          <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                            <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[status])} style={{ width: `${Math.min(100, process.util)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

// ─── Left rail item ───────────────────────────────────────────────────────────
function RailItem({
  active, onClick, title, subtitle, metric, metricTone, area, dot,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  metric: string;
  metricTone: string;
  area?: 'SMT' | 'TH' | 'BE';
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-3 border-b border-border last:border-0 text-left transition-colors',
        active ? 'bg-muted/50' : 'hover:bg-muted/30',
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn('text-xs truncate', active ? 'font-bold text-foreground' : 'font-medium text-foreground/90')}>
            {title}
          </p>
          {area && (
            <span className={cn('text-[8px] font-semibold px-1 py-px rounded border flex-shrink-0', PPQT_AREA_BADGE[area])}>
              {area}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
      </div>
      <span className={cn('text-sm font-mono font-bold tabular-nums flex-shrink-0', metricTone)}>{metric}</span>
    </button>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

// ─── Pain point card with inline "why" expansion ─────────────────────────────
function PainPointCard({ process, line }: { process: PPQTProcess; line: PPQTSubWorkcenter }) {
  const [open, setOpen] = useState(false);
  const status = getPPQTStatus(process.util);
  const isShort = process.gap > 0;

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden',
      isShort ? 'border-red-500/40' : 'border-amber-500/40',
    )}>
      {/* card face */}
      <button onClick={() => setOpen(v => !v)} className="w-full text-left hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-4 px-5 py-4">
          {/* NEED vs HAVE — the headline */}
          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span className={cn('text-3xl font-mono font-bold tabular-nums', isShort ? 'text-red-400' : 'text-foreground')}>
              {process.resNeeded}
            </span>
            <span className="text-lg font-mono text-muted-foreground">/</span>
            <span className="text-3xl font-mono font-bold text-foreground tabular-nums">{process.eqAvail}</span>
          </div>
          <div className="flex flex-col flex-shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight">need / have</span>
            {isShort ? (
              <span className="text-[11px] font-bold text-red-400 leading-tight">−{process.gap} machine{process.gap !== 1 ? 's' : ''}</span>
            ) : (
              <span className="text-[11px] font-bold text-amber-400 leading-tight">no headroom</span>
            )}
          </div>

          {/* identity */}
          <div className="min-w-0 flex-1 border-l border-border pl-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground truncate">{process.name}</p>
              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0', PPQT_AREA_BADGE[process.area])}>
                {process.area}
              </span>
              {process.ctSourceCounts.Est > 0 && (
                <span title={`${process.ctSourceCounts.Est} estimated CTs — gap may not be real`}>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{line.name}</p>
          </div>

          {/* load */}
          <div className="w-32 flex-shrink-0">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">load</span>
              <span className={cn('text-[11px] font-mono font-bold tabular-nums', PPQT_UTIL_TEXT[status])}>
                {Math.round(process.util)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[status])} style={{ width: `${Math.min(100, process.util)}%` }} />
            </div>
          </div>

          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        </div>
      </button>

      {/* inline "why" */}
      {open && <PainPointWhy process={process} line={line} />}
    </div>
  );
}

function PainPointWhy({ process, line }: { process: PPQTProcess; line: PPQTSubWorkcenter }) {
  const trail = useMemo(() => getMathTrail(process, line), [process, line]);
  const evidence = useMemo(() => getEvidenceForProcess(process.id), [process.id]);
  const top = evidence.rows.slice(0, 5);
  const rest = evidence.rows.length - top.length;

  return (
    <div className="border-t border-border bg-muted/10">
      {/* math sentence */}
      <div className="px-5 py-3 border-b border-border/60">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          A unit must leave every <span className="font-mono font-semibold text-foreground">{trail.takt.toFixed(0)}s</span> to
          meet demand; this step's weighted build time is <span className="font-mono font-semibold text-foreground">{trail.wct.toFixed(1)}s</span>.
          After yield ({trail.fpy}%) and efficiency ({trail.efficiency}%) losses that's{' '}
          <span className="font-mono font-semibold text-foreground">{trail.rawNeed.toFixed(2)}</span> machines →
          rounds up to <span className={cn('font-mono font-bold', trail.gap > 0 ? 'text-red-400' : 'text-foreground')}>{trail.resNeeded}</span>,
          and the line has <span className="font-mono font-bold text-foreground">{trail.eqAvail}</span>.
        </p>
        {evidence.estCount > 0 && (
          <p className="text-[11px] text-amber-400/90 mt-1.5 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {evidence.estCount} of {evidence.rows.length} cycle times are estimates ({evidence.estLoadShare}% of the
            load) — verify with a time study before acting.
          </p>
        )}
      </div>

      {/* top load drivers */}
      <div className="px-5 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top load drivers — demand × CT
        </p>
        <div className="space-y-1.5">
          {top.map(r => (
            <div key={r.assemblyId} className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono text-foreground w-40 truncate flex-shrink-0">
                {r.partNumber} / {r.rev}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground w-16 text-right tabular-nums flex-shrink-0">
                {r.demand.toLocaleString()} u
              </span>
              <span className="text-[10px] font-mono text-muted-foreground w-12 text-right tabular-nums flex-shrink-0">
                {r.ctAdj.toFixed(1)}s
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.loadShare}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-8 text-right tabular-nums flex-shrink-0">
                {r.loadShare}%
              </span>
              <span className={cn('text-[8px] font-semibold px-1 py-px rounded border flex-shrink-0', PPQT_CT_SOURCE_BADGE[r.ctSource])}>
                {r.ctSource}
              </span>
            </div>
          ))}
        </div>
        {rest > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            + {rest} more assembl{rest !== 1 ? 'ies' : 'y'} ({evidence.demandThruStep.toLocaleString()} units total through this step)
          </p>
        )}
      </div>
    </div>
  );
}
