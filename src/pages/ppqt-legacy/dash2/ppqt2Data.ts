/**
 * ppqt2Data.ts
 * ─────────────
 * Adapter + derived layer for the PPQT "Dashboard 2" pages.
 *
 * The backend (GET /api/ppqt/capacity) already runs the forward chain —
 * demand-weighted WCT, Takt, Resources Needed, Gap, Utilisation — over real
 * IEDB cycle time × planner demand. This file only reshapes that response into
 * the line/workcell rollups the dash2 components render:
 *
 *   Step verdict     →  NEED (machines) vs HAVE (machines), Gap
 *   Line rollup      →  steps short / tight, machines short  (per sub-workcenter)
 *   Workcell rollup  →  worst-line-wins verdict + worst step
 *
 * No mock data. No recomputation of the formulas — the numbers come from the
 * API so every tab and the league table always agree.
 */

import { getPPQTVerdict, PPQTVerdict } from '@/lib/ppqt/ppqtConstants';
import type {
  PPQTApiCapacity,
  PPQTApiEvidence,
  PPQTApiProcess,
  PPQTApiSubWorkcenter,
} from '@/lib/ppqt/ppqtApi';
import { PPQTProcess, PPQTSubWorkcenter } from '../types';

// ─── Line (sub-workcenter) rollup ────────────────────────────────────────────
export interface Ppqt2Line {
  swc: PPQTSubWorkcenter;
  processes: PPQTProcess[];     // in flow order
  stepsShort: number;           // steps where NEED > HAVE
  stepsTight: number;           // steps in the warning band (90-100%) but not short
  machinesShort: number;        // Σ positive gaps
  verdict: PPQTVerdict;
}

// ─── Workcell rollup ─────────────────────────────────────────────────────────
export interface Ppqt2Workcell {
  wc: {
    id: string;
    name: string;
    division: string;
    totalDemand: number;
  };
  lines: Ppqt2Line[];
  stepsTotal: number;
  stepsShort: number;
  stepsTight: number;
  machinesShort: number;
  verdict: PPQTVerdict;
  /** The single worst step across all lines (largest gap, then highest util). */
  worstStep: { process: PPQTProcess; line: PPQTSubWorkcenter } | null;
  /** Productive seconds in the demand period — the Takt numerator. */
  availableSeconds: number;
  /** Demand units routing through each step, keyed by process id. */
  demandThru: Map<string, number>;
}

function adaptSwc(s: PPQTApiSubWorkcenter, workcellId: string): PPQTSubWorkcenter {
  return {
    id: s.id,
    name: s.name,
    workcellId,
    area: s.area,
    shiftHours: s.shiftHours,
    workingDays: s.workingDays,
    changeoverQty: s.changeoverQty,
    changeoverTime: s.changeoverTime,
    fpy: s.fpy,
    efficiency: s.efficiency,
    totalDemand: s.totalDemand,
    processCount: s.processCount,
    bottlenecks: s.bottlenecks,
    avgUtil: s.avgUtil,
    ctEstimates: s.processes.reduce((n, p) => n + (p.ctSourceCounts?.Est ?? 0), 0),
  };
}

function adaptProcess(p: PPQTApiProcess): PPQTProcess {
  return {
    id: p.id,
    name: p.name,
    subWorkcenterId: p.subWorkcenterId,
    area: p.area,
    sequence: p.sequence,
    wct: p.wct,
    takt: p.takt,
    eqAvail: p.eqAvail,
    resNeeded: p.resNeeded,
    gap: p.gap,
    util: p.util,
    dwell: p.dwell,
    primaryCtSource: p.primaryCtSource,
    ctSourceCounts: p.ctSourceCounts,
  };
}

/** Reshape one /capacity response into the rollups the dash2 components render. */
export function adaptCapacity(api: PPQTApiCapacity): Ppqt2Workcell {
  const demandThru = new Map<string, number>();

  const lines: Ppqt2Line[] = api.sub_workcenters.map(s => {
    const swc = adaptSwc(s, api.workcell);
    const processes = s.processes
      .map(adaptProcess)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);

    for (const p of s.processes) demandThru.set(p.id, p.demandThrough);

    let stepsShort = 0, stepsTight = 0, machinesShort = 0;
    for (const p of processes) {
      if (p.dwell) continue;   // dwell steps aren't serially sized — mirror the backend
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
  });

  let stepsTotal = 0, stepsShort = 0, stepsTight = 0, machinesShort = 0;
  let worstStep: Ppqt2Workcell['worstStep'] = null;
  for (const line of lines) {
    stepsTotal += line.processes.length;
    stepsShort += line.stepsShort;
    stepsTight += line.stepsTight;
    machinesShort += line.machinesShort;
    for (const p of line.processes) {
      if (p.dwell) continue;   // never let a dwell step (huge gap) be the worst
      if (!worstStep
        || p.gap > worstStep.process.gap
        || (p.gap === worstStep.process.gap && p.util > worstStep.process.util)) {
        worstStep = { process: p, line: line.swc };
      }
    }
  }

  return {
    wc: {
      id: api.workcell,
      name: api.workcell,
      division: `${api.process_count} steps across ${api.sub_workcenters.length} lines`,
      totalDemand: api.total_demand,
    },
    lines, stepsTotal, stepsShort, stepsTight, machinesShort,
    verdict: getPPQTVerdict(machinesShort, stepsTight),
    worstStep,
    availableSeconds: api.available_seconds,
    demandThru,
  };
}

// ─── Evidence — which assemblies drive a step's load ─────────────────────────
// Mirrors the Excel DASH "TOP Demand" block: per assembly at this step,
// demand × adjusted CT = load share. Answers "which product is the hog?"
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
  rows: Ppqt2EvidenceRow[];     // sorted by load desc (backend already sorts)
  demandThruStep: number;       // Σ demand of assemblies routed through this step
  estCount: number;             // how many CTs are mere estimates
  estLoadShare: number;         // 0-100 — load % carried by estimated CTs
  /** Assemblies through this step in total — exceeds rows.length when capped. */
  assemblyCount: number;
  /** True when the row list is capped for display. */
  truncated: boolean;
}

/** Reshape one /evidence response for the drawer / pain-point card. */
export function adaptEvidence(api: PPQTApiEvidence | undefined): Ppqt2Evidence {
  if (!api) {
    return { rows: [], demandThruStep: 0, estCount: 0, estLoadShare: 0, assemblyCount: 0, truncated: false };
  }
  return {
    rows: api.assemblies.map(a => ({
      assemblyId: `${a.assembly}-${a.revision}`,
      partNumber: a.assembly,
      rev: a.revision,
      family: '',
      demand: a.demand,
      ctAdj: a.ctAdj,
      load: a.load,
      loadShare: a.loadShare,
      ctSource: a.ctSource,
      studyDate: a.studyDate,
      machAdj: a.machAdj,
      imtAdj: a.imtAdj,
      handAdj: a.handAdj,
    })),
    demandThruStep: api.demandThruStep,
    estCount: api.estCount,
    estLoadShare: api.estLoadShare,
    assemblyCount: api.assemblyCount,
    truncated: api.truncated,
  };
}

// ─── Math trail — the formula chain behind one step's NEED ──────────────────
// WCT ÷ Takt ÷ (FPY × Eff) = raw machines → ROUNDUP → NEED. Shown in the
// detail drawer / pain-point card so the engineer can audit the number.
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
  return {
    wct: process.wct,
    takt: process.takt,
    fpy: swc.fpy,
    efficiency: swc.efficiency,
    // ponytail: recomputed rather than threaded through — identical to the
    // backend's rawNeed, and keeps this a pure function of the two entities.
    rawNeed: process.wct / process.takt / (swc.fpy / 100) / (swc.efficiency / 100),
    resNeeded: process.resNeeded,
    eqAvail: process.eqAvail,
    gap: process.gap,
  };
}
