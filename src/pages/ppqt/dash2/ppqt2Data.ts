/**
 * ppqt2Data.ts
 * ─────────────
 * Derived data layer for the PPQT "Dashboard 2" prototypes (variants A + B).
 *
 * Built on top of mockPpqtData.ts — no new mock universe, just the Excel-DASH
 * mental model recomputed per scope:
 *
 *   Step verdict     →  NEED (machines) vs HAVE (machines), Gap
 *   Line rollup      →  steps short / tight, machines short  (per sub-workcenter)
 *   Workcell rollup  →  worst-line-wins verdict for the league table
 *   Evidence         →  per step: which assemblies drive the load (Demand × CT)
 *
 * Both dashboard variants consume this file so their numbers always agree.
 * When the real API arrives this maps 1:1 onto the processes/assembly_cts marts.
 */

import { getPPQTVerdict, PPQTVerdict } from '@/lib/ppqt/ppqtConstants';
import {
  MOCK_WORKCELLS,
  getAssembly,
  getCTsForProcess,
  getProcessesForSubWorkcenter,
  getSubWorkcentersForWorkcell,
  getWorkcell,
} from '../mockPpqtData';
import { PPQTProcess, PPQTSubWorkcenter, PPQTWorkcell } from '../types';

// ─── Line (sub-workcenter) rollup ────────────────────────────────────────────
export interface Ppqt2Line {
  swc: PPQTSubWorkcenter;
  processes: PPQTProcess[];     // in flow order
  stepsShort: number;           // steps where NEED > HAVE
  stepsTight: number;           // steps in the warning band (90-100%) but not short
  machinesShort: number;        // Σ positive gaps
  verdict: PPQTVerdict;
}

// ─── Workcell rollup (league table row) ──────────────────────────────────────
export interface Ppqt2Workcell {
  wc: PPQTWorkcell;
  lines: Ppqt2Line[];
  stepsTotal: number;
  stepsShort: number;
  stepsTight: number;
  machinesShort: number;
  verdict: PPQTVerdict;
  /** The single worst step across all lines (largest gap, then highest util). */
  worstStep: { process: PPQTProcess; line: PPQTSubWorkcenter } | null;
}

function buildLine(swc: PPQTSubWorkcenter): Ppqt2Line {
  const processes = getProcessesForSubWorkcenter(swc.id)
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  let stepsShort = 0;
  let stepsTight = 0;
  let machinesShort = 0;
  for (const p of processes) {
    if (p.gap > 0) {
      stepsShort++;
      machinesShort += p.gap;
    } else if (p.util >= 90) {
      stepsTight++;
    }
  }

  return {
    swc, processes, stepsShort, stepsTight, machinesShort,
    verdict: getPPQTVerdict(machinesShort, stepsTight),
  };
}

export function buildWorkcellCapacity(workcellId: string): Ppqt2Workcell | undefined {
  const wc = getWorkcell(workcellId);
  if (!wc) return undefined;

  const lines = getSubWorkcentersForWorkcell(wc.id).map(buildLine);

  let stepsTotal = 0, stepsShort = 0, stepsTight = 0, machinesShort = 0;
  let worstStep: Ppqt2Workcell['worstStep'] = null;
  for (const line of lines) {
    stepsTotal += line.processes.length;
    stepsShort += line.stepsShort;
    stepsTight += line.stepsTight;
    machinesShort += line.machinesShort;
    for (const p of line.processes) {
      if (!worstStep
        || p.gap > worstStep.process.gap
        || (p.gap === worstStep.process.gap && p.util > worstStep.process.util)) {
        worstStep = { process: p, line: line.swc };
      }
    }
  }

  return {
    wc, lines, stepsTotal, stepsShort, stepsTight, machinesShort,
    verdict: getPPQTVerdict(machinesShort, stepsTight),
    worstStep,
  };
}

export function getAllWorkcellCapacities(): Ppqt2Workcell[] {
  return MOCK_WORKCELLS
    .map(w => buildWorkcellCapacity(w.id))
    .filter((w): w is Ppqt2Workcell => !!w)
    // Worst first: machines short desc → steps tight desc → demand desc
    .sort((a, b) =>
      b.machinesShort - a.machinesShort
      || b.stepsTight - a.stepsTight
      || b.wc.totalDemand - a.wc.totalDemand);
}

// ─── Evidence — which assemblies drive a step's load ─────────────────────────
// Mirrors the Excel DASH "TOP Demand" block (rows 37-59): per assembly at this
// step, demand × adjusted CT = load share. Answers "which product is the hog?"
export interface Ppqt2EvidenceRow {
  assemblyId: string;
  partNumber: string;
  rev: string;
  family: string;
  demand: number;
  ctAdj: number;                // effective CT at this step (sec)
  load: number;                 // demand × ctAdj (sec)
  loadShare: number;            // 0-100 (% of step load)
  ctSource: 'MOST' | 'SW' | 'Est';
  studyDate: string | null;
  machAdj: number;
  imtAdj: number;
  handAdj: number;
}

export interface Ppqt2Evidence {
  rows: Ppqt2EvidenceRow[];     // sorted by load desc
  demandThruStep: number;       // Σ demand of assemblies routed through this step
  estCount: number;             // how many CTs are mere estimates
  estLoadShare: number;         // 0-100 — load % carried by estimated CTs
}

export function getEvidenceForProcess(processId: string): Ppqt2Evidence {
  const cts = getCTsForProcess(processId);

  const rows: Ppqt2EvidenceRow[] = [];
  let totalLoad = 0;
  let demandThruStep = 0;
  let estCount = 0;
  let estLoad = 0;

  for (const ct of cts) {
    const asm = getAssembly(ct.assemblyId);
    if (!asm || ct.totalAdj <= 0) continue;
    const load = asm.demand * ct.totalAdj;
    totalLoad += load;
    demandThruStep += asm.demand;
    if (ct.ctSource === 'Est') { estCount++; estLoad += load; }
    rows.push({
      assemblyId: asm.id,
      partNumber: asm.partNumber,
      rev: asm.rev,
      family: asm.family,
      demand: asm.demand,
      ctAdj: ct.totalAdj,
      load,
      loadShare: 0, // filled below
      ctSource: ct.ctSource,
      studyDate: ct.studyDate,
      machAdj: ct.machAdj,
      imtAdj: ct.imtAdj,
      handAdj: ct.handAdj,
    });
  }

  for (const r of rows) r.loadShare = totalLoad > 0 ? Math.round((r.load / totalLoad) * 100) : 0;
  rows.sort((a, b) => b.load - a.load);

  return {
    rows,
    demandThruStep,
    estCount,
    estLoadShare: totalLoad > 0 ? Math.round((estLoad / totalLoad) * 100) : 0,
  };
}

// ─── Math trail — the formula chain behind one step's NEED ──────────────────
// WCT ÷ Takt ÷ (FPY × Eff) = raw machines → ROUNDUP → NEED. Shown in the
// detail drawer / accordion so the engineer can audit the number.
export interface Ppqt2MathTrail {
  wct: number;
  takt: number;
  fpy: number;                  // 0-100
  efficiency: number;           // 0-100
  rawNeed: number;              // before rounding
  resNeeded: number;
  eqAvail: number;
  gap: number;
}

export function getMathTrail(process: PPQTProcess, swc: PPQTSubWorkcenter): Ppqt2MathTrail {
  const rawNeed = process.wct / process.takt / (swc.fpy / 100) / (swc.efficiency / 100);
  return {
    wct: process.wct,
    takt: process.takt,
    fpy: swc.fpy,
    efficiency: swc.efficiency,
    rawNeed,
    resNeeded: process.resNeeded,
    eqAvail: process.eqAvail,
    gap: process.gap,
  };
}
