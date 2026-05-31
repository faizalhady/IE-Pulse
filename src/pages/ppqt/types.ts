/**
 * PPQT TypeScript types
 * ──────────────────────
 * Hierarchical data model for the PPQT module.
 *
 * Hierarchy: Workcell → Sub-workcenter → Process → Assembly × Revision
 *
 * Each layer has its own typed entity. Cross-references use IDs (strings).
 */

// ─── Atoms ───────────────────────────────────────────────────────────────────
export type ProcessArea = 'SMT' | 'TH' | 'BE';
export type CTSource = 'MOST' | 'SW' | 'Est';
export type PPQTStatus = 'bottleneck' | 'warning' | 'healthy' | 'idle';

// ─── Layer 1: Workcell ───────────────────────────────────────────────────────
/** Top-level customer-dedicated production area. One per customer in this system. */
export interface PPQTWorkcell {
  id: string;                  // 'WABTEC'  (also acts as the URL slug)
  name: string;                // 'WABTEC'
  customer: string;            // 'WABTEC'
  division: string;            // 'Locomotive Electronics'
  period: string;              // 'May 2026'
  // Aggregated stats across all sub-workcenters
  totalDemand: number;
  subWorkcenterCount: number;
  processCount: number;
  bottlenecks: number;
  avgUtil: number;
  ctEstimates: number;
  lastUpdated: string;
}

// ─── Layer 2: Sub-workcenter ─────────────────────────────────────────────────
/** Physical production line within a workcell. PPQT analysis is per sub-workcenter. */
export interface PPQTSubWorkcenter {
  id: string;                  // 'WAB-SMT-P1A-1-B5a' (URL-safe slug)
  name: string;                // 'WAB SMT P1A-1 B5a'
  workcellId: string;          // 'WABTEC'
  area: ProcessArea;           // 'SMT'

  // Operating parameters (constant per period)
  shiftHours: number;
  workingDays: number;
  changeoverQty: number;
  changeoverTime: number;
  fpy: number;                 // 0-100 (e.g. 99)
  efficiency: number;          // 0-100 (e.g. 85)

  // Aggregated stats across processes
  totalDemand: number;
  processCount: number;
  bottlenecks: number;
  avgUtil: number;
  ctEstimates: number;
}

// ─── Layer 3: Process ────────────────────────────────────────────────────────
/** One process step on one sub-workcenter (e.g. SCR BOT 1 on WAB SMT P1A-1 B5a). */
export interface PPQTProcess {
  id: string;                  // 'wab-smt-p1a-1-b5a__scr-bot-1' (full slug)
  name: string;                // 'SCR BOT 1'
  subWorkcenterId: string;     // 'WAB-SMT-P1A-1-B5a'
  area: ProcessArea;           // 'SMT' (denormalized from sub-workcenter)
  sequence: number;            // physical flow order, 1..N

  // Calculated metrics (from CT × demand aggregation)
  wct: number;                 // Weighted Cycle Time (sec)
  takt: number;                // Takt Time (sec per unit)
  eqAvail: number;             // Equipment Available (from SBWC)
  resNeeded: number;           // Resources Needed (ROUNDUP output)
  gap: number;                 // resNeeded - eqAvail
  util: number;                // Utilisation %

  // CT source breakdown across assemblies routing through this process
  primaryCtSource: CTSource;   // dominant source — used for the row badge
  ctSourceCounts: { MOST: number; SW: number; Est: number };
}

// ─── Layer 4: Assembly × Revision ────────────────────────────────────────────
/** A product manufactured at this workcell. */
export interface PPQTAssembly {
  id: string;                  // '17FB130C6-N' (partNumber + rev as slug)
  partNumber: string;          // '17FB130C6'
  rev: string;                 // 'N'
  family: string;              // 'Locomotive Control'
  workcellId: string;          // 'WABTEC'
  demand: number;              // monthly demand (units)
  demandPct: number;           // share of workcell demand (%)
}

// ─── The CT bridge — Assembly × Process ──────────────────────────────────────
/** Cycle time data for one assembly at one process. The atomic unit of PPQT. */
export interface PPQTAssemblyCT {
  id: string;                  // '17FB130C6-N__wab-smt-p1a-1-b5a__scr-bot-1'
  assemblyId: string;
  processId: string;

  // Raw CT (from time study or estimate)
  mach: number;                // machine time (sec)
  imt: number;                 // interaction time (sec, operator-at-machine)
  hand: number;                // hand time (sec, pure manual)
  cap: number;                 // parallel machines
  sPct: number;                // scrap % (e.g. 99 = 99% yield)

  // Source & study metadata
  ctSource: CTSource;
  studyDate: string | null;    // ISO date if studied

  // Adjusted (calculated)
  machAdj: number;             // mach / cap × (sPct/100)
  imtAdj: number;              // imt × (sPct/100)
  handAdj: number;             // hand × (sPct/100)
  totalAdj: number;            // machAdj + imtAdj + handAdj  (effective CT)
}

// ─── Dashboard / portfolio aggregate ─────────────────────────────────────────
export interface PPQTPortfolioKpi {
  totalDemand: number;
  totalWorkcells: number;
  totalProcesses: number;
  totalBottlenecks: number;
  avgUtilisation: number;
  totalEstimates: number;
}
