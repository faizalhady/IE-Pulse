/**
 * PPQTAssemblyDetail.tsx
 * ───────────────────────
 * Layer 5 (deepest) — Assembly @ Process detail page.
 *
 * Route: /ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process/asm/:assembly
 *
 * The IE's question this page answers:
 *   "What's the CT composition for this assembly here, and is it trustworthy?"
 *
 * The deepest leaf. Shows:
 *   • Mach / IMT / Hand breakdown (raw + adjusted)
 *   • Capacity, scrap, FPY, efficiency context
 *   • CT source (MOST / SW / Estimate) with study date
 *   • Flag-for-restudy action if it's an estimate
 */

import { Button } from '@/components/ui/button';
import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import {
  PPQT_AREA_BADGE,
  PPQT_AREA_LABEL,
  PPQT_CT_SOURCE_BADGE,
  PPQT_CT_SOURCE_LABEL,
} from '@/lib/ppqt/ppqtConstants';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Beaker,
  Calendar,
  CircuitBoard,
  Hammer,
  Hand,
  Layers,
} from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import PPQTBreadcrumb from './PPQTBreadcrumb';
import {
  getAssembly,
  getCT,
  getProcess,
  getSubWorkcenter,
  getWorkcell,
  MOCK_WORKCELLS,
} from './mockPpqtData';

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

export default function PPQTAssemblyDetail() {
  const {
    workcell: paramWc, subWorkcenter: paramSwc, process: paramProc, assembly: paramAsm,
  } = useParams<{
    workcell: string; subWorkcenter: string; process: string; assembly: string;
  }>();

  const workcellId = decodeURIComponent(paramWc ?? '');
  const swcId      = decodeURIComponent(paramSwc ?? '');
  const procId     = decodeURIComponent(paramProc ?? '');
  const asmId      = decodeURIComponent(paramAsm ?? '');

  const workcell = getWorkcell(workcellId) ?? MOCK_WORKCELLS[0];
  const swc      = getSubWorkcenter(swcId);
  const process  = getProcess(procId);
  const assembly = getAssembly(asmId);
  const ct       = useMemo(() => (assembly && process) ? getCT(assembly.id, process.id) : undefined, [assembly, process]);
  const logo     = resolveLogo(workcell.id);

  if (!swc || !process || !assembly || !ct) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Assembly CT not found.
      </div>
    );
  }

  // ── Compute composition percentages for the stacked bar ──
  const total = ct.machAdj + ct.imtAdj + ct.handAdj || 1;
  const machPct = (ct.machAdj / total) * 100;
  const imtPct  = (ct.imtAdj  / total) * 100;
  const handPct = (ct.handAdj / total) * 100;

  const isEstimate = ct.ctSource === 'Est';

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
              { label: process.name,     href: `/ppqt/workcell/${encodeURIComponent(workcell.id)}/swc/${encodeURIComponent(swc.id)}/proc/${encodeURIComponent(process.id)}` },
              { label: `${assembly.partNumber} / ${assembly.rev}` },
            ]}
          />
        </div>
      </div>

      {/* ─── Two-column body ─────────────────────────────────────────────── */}
      <div className="p-5 flex gap-5">

        {/* ─── LEFT: assembly hero + context ────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">

          {/* Hero — assembly identity, workcell logo persists */}
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
                    Assembly · {workcell.period}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5 font-mono">
                    {assembly.partNumber}
                    <span className="text-muted-foreground"> / {assembly.rev}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{assembly.family}</p>
                </div>
                <span className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0',
                  PPQT_CT_SOURCE_BADGE[ct.ctSource]
                )}>
                  {ct.ctSource}
                </span>
              </div>

              <p className="text-5xl font-mono font-black mt-4 leading-none tabular-nums text-foreground">
                {ct.totalAdj.toFixed(1)}<span className="text-2xl text-muted-foreground">s</span>
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                Effective CT at {process.name}
              </p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Demand</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {assembly.demand.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">{assembly.demandPct}% of workcell</p>
              </div>
              <div className="p-3">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Raw total</p>
                <p className="text-xl font-mono font-bold text-foreground mt-0.5 tabular-nums">
                  {(ct.mach + ct.imt + ct.hand).toFixed(1)}<span className="text-xs text-muted-foreground">s</span>
                </p>
                <p className="text-[9px] text-muted-foreground">before adjustments</p>
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Context</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <Setting label="Process step"  value={`${process.name}`} />
              <Setting label="Area"          value={PPQT_AREA_LABEL[process.area]}
                       badgeClass={PPQT_AREA_BADGE[process.area]} />
              <Setting label="Parallel machines" value={`${ct.cap}×`} />
              <Setting label="Scrap"         value={`${ct.sPct}%`} />
              <Setting label="FPY (line)"    value={`${swc.fpy}%`} />
              <Setting label="Efficiency"    value={`${swc.efficiency}%`} />
            </div>
          </div>

          {/* Estimate warning + action */}
          {isEstimate && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-400">This CT is an estimate</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    The current CT for this assembly at {process.name} has never been formally studied.
                    Resources Needed at this process may be inaccurate until a MOST or stopwatch study is completed.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-[10px]">
                    Flag for CT study
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT: CT composition breakdown ──────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Stacked composition bar */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3 w-3" />
                CT Composition (Adjusted)
              </p>
              <p className="text-[9px] text-muted-foreground">Total: {ct.totalAdj.toFixed(1)} sec</p>
            </div>

            <div className="p-5">
              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex bg-muted/40">
                {ct.machAdj > 0 && <div className="bg-blue-500"    style={{ width: `${machPct}%` }} title={`Mach ${ct.machAdj.toFixed(1)}s`} />}
                {ct.imtAdj  > 0 && <div className="bg-violet-500"  style={{ width: `${imtPct}%`  }} title={`IMT ${ct.imtAdj.toFixed(1)}s`} />}
                {ct.handAdj > 0 && <div className="bg-orange-500"  style={{ width: `${handPct}%` }} title={`Hand ${ct.handAdj.toFixed(1)}s`} />}
              </div>

              {/* Legend / values */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <CompositionBlock
                  icon={<CircuitBoard className="h-4 w-4" />}
                  label="Machine"
                  raw={ct.mach}
                  adjusted={ct.machAdj}
                  pct={machPct}
                  swatchClass="bg-blue-500"
                  description="Time the machine works on its own — operator can attend other machines."
                />
                <CompositionBlock
                  icon={<Hammer className="h-4 w-4" />}
                  label="Interaction"
                  raw={ct.imt}
                  adjusted={ct.imtAdj}
                  pct={imtPct}
                  swatchClass="bg-violet-500"
                  description="Operator time AT the machine — loading, unloading, button press."
                />
                <CompositionBlock
                  icon={<Hand className="h-4 w-4" />}
                  label="Hand"
                  raw={ct.hand}
                  adjusted={ct.handAdj}
                  pct={handPct}
                  swatchClass="bg-orange-500"
                  description="Pure manual work — hand soldering, inspection, packing."
                />
              </div>
            </div>
          </div>

          {/* Raw vs adjusted side-by-side */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Raw vs Adjusted</p>
            </div>

            <div
              className="grid bg-muted/40 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
              style={{ gridTemplateColumns: 'minmax(8rem, 1fr) 5rem 5rem 6rem' }}
            >
              {['Component', 'Raw (s)', 'Adj (s)', 'Formula'].map(h => (
                <div key={h} className="px-3 py-2">{h}</div>
              ))}
            </div>

            <Row label="Machine"     raw={ct.mach} adjusted={ct.machAdj} formula={`mach / ${ct.cap} × ${ct.sPct}%`} />
            <Row label="Interaction" raw={ct.imt}  adjusted={ct.imtAdj}  formula={`imt × ${ct.sPct}%`} />
            <Row label="Hand"        raw={ct.hand} adjusted={ct.handAdj} formula={`hand × ${ct.sPct}%`} />

            <div className="grid items-center bg-muted/30 border-t border-border"
                 style={{ gridTemplateColumns: 'minmax(8rem, 1fr) 5rem 5rem 6rem', height: 40 }}>
              <div className="px-3 text-[11px] font-bold text-foreground">Total</div>
              <div className="px-3 text-[11px] font-mono text-foreground tabular-nums">
                {(ct.mach + ct.imt + ct.hand).toFixed(1)}
              </div>
              <div className="px-3 text-[11px] font-mono font-bold text-foreground tabular-nums">
                {ct.totalAdj.toFixed(1)}
              </div>
              <div className="px-3 text-[9px] text-muted-foreground">effective CT</div>
            </div>
          </div>

          {/* Study metadata */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">CT Source</p>
            </div>
            <div className="px-4 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Beaker className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Source</p>
                  <p className="text-sm font-semibold text-foreground">{PPQT_CT_SOURCE_LABEL[ct.ctSource]}</p>
                </div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Last studied</p>
                  <p className="text-sm font-semibold text-foreground">
                    {ct.studyDate ?? <span className="text-amber-400">Never</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composition block (for the legend area below the stacked bar) ────────
function CompositionBlock({
  icon, label, raw, adjusted, pct, swatchClass, description,
}: {
  icon: React.ReactNode;
  label: string;
  raw: number;
  adjusted: number;
  pct: number;
  swatchClass: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-3 h-3 rounded-sm', swatchClass)} />
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <p className="text-2xl font-mono font-bold text-foreground tabular-nums">
        {adjusted.toFixed(1)}<span className="text-sm text-muted-foreground">s</span>
      </p>
      <p className="text-[10px] text-muted-foreground">
        {pct.toFixed(0)}% · raw {raw.toFixed(1)}s
      </p>
      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Row in the raw vs adjusted table ───────────────────────────────────────
function Row({ label, raw, adjusted, formula }: { label: string; raw: number; adjusted: number; formula: string }) {
  return (
    <div
      className="grid items-center border-b border-border last:border-0"
      style={{ gridTemplateColumns: 'minmax(8rem, 1fr) 5rem 5rem 6rem', height: 36 }}
    >
      <div className="px-3 text-[11px] text-foreground">{label}</div>
      <div className="px-3 text-[11px] font-mono text-muted-foreground tabular-nums">{raw.toFixed(1)}</div>
      <div className="px-3 text-[11px] font-mono font-semibold text-foreground tabular-nums">{adjusted.toFixed(1)}</div>
      <div className="px-3 text-[9px] text-muted-foreground font-mono">{formula}</div>
    </div>
  );
}

// ─── Small setting cell ──────────────────────────────────────────────────────
function Setting({ label, value, badgeClass }: { label: string; value: string; badgeClass?: string }) {
  return (
    <div className="px-4 py-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      {badgeClass ? (
        <span className={cn('inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border', badgeClass)}>
          {value}
        </span>
      ) : (
        <p className="text-sm font-mono font-bold mt-0.5 tabular-nums text-foreground">{value}</p>
      )}
    </div>
  );
}
