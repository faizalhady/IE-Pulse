/**
 * types.ts — LBR module TypeScript interfaces.
 */

export type LBRStatus = 'critical' | 'warning' | 'healthy' | 'never_studied';
export type StationType = 'operator' | 'machine_only' | 'shared';
export type ElementCategory = 'VA' | 'NVA';

export interface LBRWorkcell {
  id: string;
  name: string;
  customer: string;
  division: string;
  activeAssemblies: number;
  totalPlaybooks: number;
  avgLbr: number;              // 0-100
  avgUph: number;
  bottlenecks: number;         // # assemblies with bottleneck > 95% TAKT
  lastStudyDate: string | null;
  status: LBRStatus;
}

export interface LBRAssembly {
  id: string;                  // e.g. 'aspca-01133-02'
  assembly: string;            // part number
  revision: string;
  line: string;                // sub-workcenter — shown as badge
  family: string;
  demand: number;
  playbookCount: number;
  bestLbr: number;
  bestUph: number;
  bestUpph: number;
  bestLbl: number;
  bottleneckStation: string;
  lastStudyDate: string | null;
  status: LBRStatus;
}

export interface LBRWorkElement {
  id: string;
  name: string;
  timeSec: number;
  category: ElementCategory;
  movable: boolean;
  movableTo: string[];         // station IDs this element can move to
}

export interface LBRStation {
  id: string;                  // e.g. 'MA1', 'TEST'
  type: StationType;
  operator: string | null;     // null if machine_only
  cycleTimeSec: number;
  isBottleneck: boolean;
  elements: LBRWorkElement[];
}

export interface LBRPlaybook {
  id: string;
  name: string;                // e.g. '6-op High Demand'
  scenario: string;            // human-readable purpose
  operators: number;
  lbr: number;
  uph: number;
  upph: number;
  lbl: number;                 // seconds
  takt: number;                // seconds per unit
  bottleneckStation: string;
  bottleneckCt: number;
  vsTaktPct: number;           // bottleneck CT vs TAKT (target ≤ 95)
  isActive: boolean;
  lastUpdated: string;
  stations: LBRStation[];
}

/** Computed metrics returned by the live LBR calculator (Simulate tab). */
export interface LBRMetrics {
  lbr: number;
  lbl: number;
  uph: number;
  upph: number;
  tBottleneckSec: number;
  tctoSec: number;
  nO: number;
  bottleneckStation: string;
  vsTaktPct: number;
}
