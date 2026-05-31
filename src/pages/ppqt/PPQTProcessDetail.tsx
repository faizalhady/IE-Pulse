/**
 * PPQTProcessDetail.tsx
 * ──────────────────────
 * Layer 4 (out of 5 with assembly) — Process detail page.
 *
 * Route: /ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process
 *
 * The IE's question this page answers:
 *   "Which assemblies are driving this process's load?"
 *
 * Shows the assemblies routing through this process, ranked by their
 * contribution to the WCT (demand × CT). The IE can see at a glance
 * whether the bottleneck is being driven by one dominant assembly or
 * by many. Click an assembly → drills to its CT composition page.
 */

import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import {
  getPPQTStatus,
  PPQT_AREA_BADGE,
  PPQT_AREA_LABEL,
  PPQT_CT_SOURCE_BADGE,
  PPQT_STATUS_BADGE,
  PPQT_STATUS_LABEL,
  PPQT_UTIL_BAR,
  PPQT_UTIL_TEXT,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import { Beaker, FlaskConical, Gauge } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PPQTBreadcrumb from './PPQTBreadcrumb';
import {
  getAssembly,
  getCTsForProcess,
  getProcess,
  getSubWorkcenter,
  getWorkcell,
  MOCK_WORKCELLS,
} from './mockPpqtData';
import { PPQTAssembly, PPQTAssemblyCT } from './types';

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

export default function PPQTProcessDetail() {
  const navigate = useNavigate();
  const { workcell: paramWc, subWorkcenter: paramSwc, process: paramProc } = useParams<{
    workcell: string; subWorkcenter: string; process: string;
  }>();

  const workcellId = decodeURIComponent(paramWc ?? '');
  const swcId      = decodeURIComponent(paramSwc ?? '');
  const procId     = decodeURIComponent(paramProc ?? '');

  const workcell = getWorkcell(workcellId) ?? MOCK_WORKCELLS[0];
  const swc      = getSubWorkcenter(swcId);
  const process  = getProcess(procId);
  const logo     = resolveLogo(workcell.id);

  // ── Build the assembly × CT contribution rows ──
  const rows = useMemo(() => {
    if (!process) return [];
    const cts = getCTsForProcess(process.id);
    const list = cts
      .map(ct => {
        const asm = getAssembly(ct.assemblyId);
        if (!asm) return null;
        return {
          assembly: asm,
          ct,
          contribution: asm.demand * ct.totalAdj, // demand × CT
        };
      })
      .filter((r): r is { assembly: PPQTAssembly; ct: PPQTAssemblyCT; contribution: number } => r !== null);

    // Sort by contribution desc — drives the WCT
    return list.sort((a, b) => b.contribution - a.contribution);
  }, [process]);

  const totalContribution = rows.reduce((s, r) => s + r.contribution, 0);

  if (!process || !swc) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Process not found.
      </div>
    );
  }

  const status = getPPQTStatus(process.util);
  const utilWidth = Math.min(process.util, 100);

  const onAssemblyClick = (asm: PPQTAssembly) => {
    navigate(`/ppqt/workcell/${encodeURIComponent(workcell.id)}/swc/${encodeURIComponent(swc.id)}/proc/${encodeURIComponent(process.id)}/asm/${encodeURIComponent(asm.id)}`);
  };

  return (
    <div className="relative">

      {/* ─── Sticky header with breadcrumb ──────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <PPQTBreadcrumb
            items={[
              { label: 'PPQT Dashboard', href: '/ppqt' },
              { label: 'Workcells',      href: '/ppqt/workcell' },
              { label: workcell.name,    href: `/ppqt/workcell/${encodeURIComponent(workcell.id)}`, workcellLogoKey: workcell.id },
              { label: swc.name,         href: `/ppqt/workcell/${encodeURIComponent(workcell.id)}/swc/${encodeURIComponent(swc.id)}` },
              { label: process.name },
            ]}
          />
        </div>
      </div>

      {/* ─── Two-column body ─────────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT: process hero + the 4 verdict numbers ──────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Hero */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                {logo && (
                  <div className="w-20 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={logo} alt={workcell.name} className="w-full h-full object-contain p-1" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Process · {workcell.period}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">{process.name}</p>
                  <div className="mt-0.5 inline-flex">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border', PPQT_AREA_BADGE[process.area])}>
                      Step {process.sequence} · {PPQT_AREA_LABEL[process.area]}
                    </span>
                  </div>
                </div>
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', PPQT_STATUS_BADGE[status])}>
                  {PPQT_STATUS_LABEL[status]}
                </span>
              </div>

              <p className={cn('text-5xl font-mono font-black mt-4 leading-none tabular-nums', PPQT_UTIL_TEXT[status])}>
                {process.util}%
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Utilisation</p>

              <div className="mt-3 h-1 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn('h-full rounded-full', PPQT_UTIL_BAR[status])} style={{ width: `${utilWidth}%` }} />
              </div>
            </div>
          </div>

          {/* The 4-number verdict */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">The Verdict</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="Weighted CT" value={`${process.wct.toFixed(1)}s`} />
              <Setting label="Takt Time"   value={`${process.takt.toFixed(1)}s`} />
              <Setting label="Eq. Available" value={process.eqAvail.toString()} />
              <Setting
                label="Resources Needed"
                value={process.resNeeded.toString()}
                tone={process.resNeeded > process.eqAvail ? 'red' : undefined}
              />
              <div className="col-span-2 px-4 py-3 border-t border-border">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Gap</p>
                <p className={cn(
                  'text-2xl font-mono font-black mt-0.5 tabular-nums',
                  process.gap > 0 ? 'text-red-400' : process.gap < 0 ? 'text-emerald-400' : 'text-muted-foreground'
                )}>
                  {process.gap > 0 ? `+${process.gap}` : process.gap === 0 ? '—' : process.gap}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {process.gap > 0   ? `Short by ${process.gap} machine${process.gap !== 1 ? 's' : ''}`
                  : process.gap < 0   ? `Excess of ${Math.abs(process.gap)} machine${Math.abs(process.gap) !== 1 ? 's' : ''}`
                  :                     'Capacity matches demand'}
                </p>
              </div>
            </div>
          </div>

          {/* CT source mix for this process */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">CT Source</p>
              {process.ctSourceCounts.Est > 0 && (
                <span className="flex items-center gap-1 text-[9px] text-amber-400 font-semibold">
                  <FlaskConical className="h-2.5 w-2.5" />
                  {process.ctSourceCounts.Est} estimate{process.ctSourceCounts.Est !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 divide-x divide-border">
              <SourceTile label="MOST"      count={process.ctSourceCounts.MOST} color="text-emerald-400" />
              <SourceTile label="Stopwatch" count={process.ctSourceCounts.SW}   color="text-blue-400" />
              <SourceTile label="Estimate"  count={process.ctSourceCounts.Est}  color="text-amber-400" />
            </div>
          </div>
        </div>

        {/* ─── RIGHT: assembly contribution table ──────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="h-3 w-3" />
                Assembly Contribution to WCT · {rows.length} assemblies
              </p>
              <p className="text-[9px] text-muted-foreground">Ranked by demand × CT · click row to inspect CT</p>
            </div>

            <div
              className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
              style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 3.5rem 4.5rem 5rem 12rem 5rem' }}
            >
              {['#', 'Assembly · Rev', 'Demand', 'CT (sec)', 'Demand × CT', 'Share of WCT', 'CT Src'].map(h => (
                <div key={h} className="px-2 py-2">{h}</div>
              ))}
            </div>

            {rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No assemblies route through this process.
              </div>
            ) : (
              rows.map((row, idx) => {
                const pct = totalContribution > 0 ? (row.contribution / totalContribution) * 100 : 0;
                return (
                  <div
                    key={row.ct.id}
                    onClick={() => onAssemblyClick(row.assembly)}
                    className="grid items-center border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: '1.5rem minmax(9rem, 1fr) 3.5rem 4.5rem 5rem 12rem 5rem', height: 44 }}
                  >
                    <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                    <div className="px-2 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {row.assembly.partNumber}
                        <span className="text-muted-foreground"> / {row.assembly.rev}</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate">{row.assembly.family}</p>
                    </div>
                    <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">
                      {row.assembly.demand.toLocaleString()}
                    </div>
                    <div className="px-2 text-[11px] font-mono text-foreground tabular-nums">
                      {row.ct.totalAdj.toFixed(1)}
                    </div>
                    <div className="px-2 text-[11px] font-mono font-semibold text-foreground tabular-nums">
                      {Math.round(row.contribution).toLocaleString()}
                    </div>
                    <div className="px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="px-2 flex items-center">
                      <span className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap',
                        PPQT_CT_SOURCE_BADGE[row.ct.ctSource]
                      )}>
                        {row.ct.ctSource}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drill-deeper hint */}
          <div className="rounded-xl border border-border border-dashed bg-card/40 px-4 py-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <Beaker className="inline h-3 w-3 align-text-bottom" />
              {' '}Click any assembly to see its CT composition (Mach / IMT / Hand) and study history at this process.
            </p>
          </div>
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

function SourceTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-lg font-mono font-bold mt-0.5 tabular-nums', color)}>{count}</p>
    </div>
  );
}
