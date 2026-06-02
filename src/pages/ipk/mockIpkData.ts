/**
 * mockIpkData.ts
 * ───────────────
 * Mock data for the IPK module. All hooks in src/hooks/ipk/ read from here.
 * Structured so each export maps 1:1 to a future backend endpoint (noted in
 * the hook files) for an easy real-API swap.
 */

import type { IPKStatus, IPKSource, IPKCalcType } from '@/lib/ipk/ipkConstants';

// ─── Workcells (portfolio) ──────────────────────────────────────────────────────
export interface IPKWorkcell {
  id: string;
  name: string;
  division: string;
  lastRun: string | null;
  period: string | null;
  periodType: 'monthly' | 'weekly';
  processGroupCount: number;
  totalRequired: number;
  onFloor: number;
  variance: number;
  status: IPKStatus;
}

export const MOCK_WORKCELLS: IPKWorkcell[] = [
  { id: 'bd-pca',    name: 'BD PCA',     division: 'Becton Dickinson', lastRun: '2024-06-15', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 12, totalRequired: 87, onFloor: 79, variance: 8,  status: 'critical'  },
  { id: 'lamres-be', name: 'LAMRES BE',  division: 'Lam Research',     lastRun: '2024-06-10', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 9,  totalRequired: 41, onFloor: 43, variance: -2, status: 'healthy'   },
  { id: 'arista',    name: 'Arista PCA', division: 'Arista Networks',  lastRun: null,         period: null,       periodType: 'weekly',  processGroupCount: 0,  totalRequired: 0,  onFloor: 0,  variance: 0,  status: 'never_run' },
  { id: 'imed',      name: 'IMED PCA',   division: 'ICU Medical',      lastRun: '2024-06-01', period: 'Jun 2024', periodType: 'monthly', processGroupCount: 7,  totalRequired: 32, onFloor: 30, variance: 2,  status: 'warning'   },
];

// ─── Summary rows (one per process group) ───────────────────────────────────────
export interface IPKSummaryRow {
  processGroup: string;
  loadingQty: number;
  effectiveUph: number;
  ipkUnits: number;
  wipWithBuffer: number;
  ipkTrolleys: number;
  inOutTrolleys: number;
  rejectTrolleys: number;
  onHoldTrolleys: number;
  totalRequired: number;   // computed
  actualOnFloor: number;
  variance: number;        // computed
  // for expanded breakdown
  bottleneckCtSec: number;
  fpy: number;
  efficiency: number;
  conversionPct: number;
  qtyEquipment: number;
  uphUpstream: number;
  uphDownstream: number;
  boardsPerTrolley: number;
}

export const MOCK_SUMMARY_ROWS: IPKSummaryRow[] = [
  { processGroup: 'SMT Bot',          loadingQty: 2800, effectiveUph: 35.1, ipkUnits: 184,  wipWithBuffer: 211, ipkTrolleys: 8,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 12, actualOnFloor: 10, variance: 2,  bottleneckCtSec: 102, fpy: 0.99, efficiency: 0.85, conversionPct: 0.94, qtyEquipment: 1, uphUpstream: 35.1, uphDownstream: 27.4, boardsPerTrolley: 20 },
  { processGroup: 'SMT Top',          loadingQty: 2800, effectiveUph: 35.1, ipkUnits: 184,  wipWithBuffer: 211, ipkTrolleys: 8,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 12, actualOnFloor: 12, variance: 0,  bottleneckCtSec: 102, fpy: 0.99, efficiency: 0.85, conversionPct: 0.94, qtyEquipment: 1, uphUpstream: 35.1, uphDownstream: 27.4, boardsPerTrolley: 20 },
  { processGroup: 'Wash Top 1',       loadingQty: 2800, effectiveUph: 63.3, ipkUnits: 42,   wipWithBuffer: 48,  ipkTrolleys: 3,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 4,  actualOnFloor: 2,  variance: 2,  bottleneckCtSec: 56,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 63.3, uphDownstream: 28.4, boardsPerTrolley: 20 },
  { processGroup: 'LF Wave Top',      loadingQty: 2800, effectiveUph: 28.4, ipkUnits: 310,  wipWithBuffer: 357, ipkTrolleys: 12, inOutTrolleys: 2, rejectTrolleys: 2, onHoldTrolleys: 1, totalRequired: 17, actualOnFloor: 15, variance: 2,  bottleneckCtSec: 126, fpy: 0.95, efficiency: 0.85, conversionPct: 0.92, qtyEquipment: 1, uphUpstream: 28.4, uphDownstream: 22.1, boardsPerTrolley: 20 },
  { processGroup: 'Wash Bot 2',       loadingQty: 2800, effectiveUph: 63.3, ipkUnits: 38,   wipWithBuffer: 44,  ipkTrolleys: 2,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 3,  actualOnFloor: 4,  variance: -1, bottleneckCtSec: 56,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 63.3, uphDownstream: 30.2, boardsPerTrolley: 20 },
  { processGroup: 'Xray',             loadingQty: 2800, effectiveUph: 83.0, ipkUnits: 22,   wipWithBuffer: 25,  ipkTrolleys: 1,  inOutTrolleys: 0, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 1,  actualOnFloor: 1,  variance: 0,  bottleneckCtSec: 43,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 83.0, uphDownstream: 45.0, boardsPerTrolley: 20 },
  { processGroup: 'LF Wave Bot',      loadingQty: 2800, effectiveUph: 30.2, ipkUnits: 288,  wipWithBuffer: 331, ipkTrolleys: 11, inOutTrolleys: 2, rejectTrolleys: 2, onHoldTrolleys: 1, totalRequired: 16, actualOnFloor: 14, variance: 2,  bottleneckCtSec: 119, fpy: 0.95, efficiency: 0.85, conversionPct: 0.92, qtyEquipment: 1, uphUpstream: 30.2, uphDownstream: 22.1, boardsPerTrolley: 20 },
  { processGroup: 'Router',           loadingQty: 2800, effectiveUph: 45.0, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 1,  actualOnFloor: 2,  variance: -1, bottleneckCtSec: 80,  fpy: 1.00, efficiency: 0.85, conversionPct: 1.00, qtyEquipment: 1, uphUpstream: 45.0, uphDownstream: 45.0, boardsPerTrolley: 20 },
  { processGroup: 'Backend MA',       loadingQty: 2800, effectiveUph: 22.1, ipkUnits: 95,   wipWithBuffer: 109, ipkTrolleys: 4,  inOutTrolleys: 1, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 7,  actualOnFloor: 5,  variance: 2,  bottleneckCtSec: 163, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 22.1, uphDownstream: 18.5, boardsPerTrolley: 20 },
  { processGroup: 'ICT',              loadingQty: 2800, effectiveUph: 18.5, ipkUnits: 60,   wipWithBuffer: 69,  ipkTrolleys: 3,  inOutTrolleys: 1, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 4,  actualOnFloor: 3,  variance: 1,  bottleneckCtSec: 194, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 18.5, uphDownstream: 14.2, boardsPerTrolley: 20 },
  { processGroup: 'FVT',              loadingQty: 2800, effectiveUph: 14.2, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 1, rejectTrolleys: 1, onHoldTrolleys: 0, totalRequired: 2,  actualOnFloor: 2,  variance: 0,  bottleneckCtSec: 253, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 14.2, uphDownstream: 12.0, boardsPerTrolley: 20 },
  { processGroup: 'FNI / OBA / Pack', loadingQty: 2800, effectiveUph: 12.0, ipkUnits: 0,    wipWithBuffer: 0,   ipkTrolleys: 0,  inOutTrolleys: 2, rejectTrolleys: 1, onHoldTrolleys: 1, totalRequired: 4,  actualOnFloor: 3,  variance: 1,  bottleneckCtSec: 300, fpy: 0.99, efficiency: 0.85, conversionPct: 0.90, qtyEquipment: 1, uphUpstream: 12.0, uphDownstream: 12.0, boardsPerTrolley: 20 },
];

// ─── Run history ────────────────────────────────────────────────────────────────
export interface IPKHistoryRun {
  id: string;
  date: string;
  period: string;
  source: IPKSource;
  processGroups: number;
  totalRequired: number;
  onFloor: number;
  variance: number;
}

export const MOCK_HISTORY: IPKHistoryRun[] = [
  { id: 'run-006', date: '2024-06-15', period: 'Jun 2024', source: 'Excel',  processGroups: 12, totalRequired: 87, onFloor: 79, variance: 8  },
  { id: 'run-005', date: '2024-05-18', period: 'May 2024', source: 'Wizard', processGroups: 12, totalRequired: 79, onFloor: 79, variance: 0  },
  { id: 'run-004', date: '2024-04-14', period: 'Apr 2024', source: 'Excel',  processGroups: 12, totalRequired: 83, onFloor: 75, variance: 8  },
  { id: 'run-003', date: '2024-03-16', period: 'Mar 2024', source: 'Manual', processGroups: 12, totalRequired: 71, onFloor: 75, variance: -4 },
  { id: 'run-002', date: '2024-02-17', period: 'Feb 2024', source: 'Excel',  processGroups: 12, totalRequired: 68, onFloor: 70, variance: -2 },
  { id: 'run-001', date: '2024-01-20', period: 'Jan 2024', source: 'Excel',  processGroups: 12, totalRequired: 65, onFloor: 60, variance: 5  },
];

// ─── IPK Matrix (demand tier × process group) ───────────────────────────────────
export interface IPKMatrix {
  demandTiers: number[];
  processGroups: string[];
  values: number[][];
}

export const MOCK_MATRIX: IPKMatrix = {
  demandTiers:   [1000, 1500, 2000, 2500, 3000],
  processGroups: ['SMT Bot', 'SMT Top', 'Wash Top 1', 'LF Wave Top', 'Wash Bot 2', 'LF Wave Bot', 'Backend MA', 'ICT'],
  values: [
    [3,  3,  1, 5,  1, 4,  2, 1],
    [5,  5,  2, 7,  2, 6,  3, 2],
    [6,  6,  2, 9,  2, 8,  4, 2],
    [8,  8,  3, 11, 3, 10, 5, 3],
    [10, 10, 4, 13, 4, 12, 6, 3],
  ],
};

// ─── Process group config ───────────────────────────────────────────────────────
export interface IPKProcessGroup {
  id: string;
  name: string;
  calcType: IPKCalcType;
  upstreamGroup: string | null;
  processes: string[];
}

export const MOCK_PROCESS_GROUPS: IPKProcessGroup[] = [
  { id: 'pg-1',  name: 'SMT Bot',          calcType: 'normal',      upstreamGroup: null,    processes: ['Solder Print Bot', 'Koh Young Bot', 'SMT Bot', 'Reflow Bot'] },
  { id: 'pg-2',  name: 'SMT Top',          calcType: 'double_pass', upstreamGroup: 'pg-1',  processes: ['Solder Print Top', 'Koh Young Top', 'SMT Top', 'Reflow Top'] },
  { id: 'pg-3',  name: 'Wash Top 1',       calcType: 'normal',      upstreamGroup: 'pg-2',  processes: ['Wash 1'] },
  { id: 'pg-4',  name: 'LF Wave Top',      calcType: 'normal',      upstreamGroup: 'pg-3',  processes: ['Manual Insert', 'Wave', 'PWTU', 'TSTH'] },
  { id: 'pg-5',  name: 'Wash Bot 2',       calcType: 'normal',      upstreamGroup: 'pg-4',  processes: ['Wash 2'] },
  { id: 'pg-6',  name: 'Xray',             calcType: 'normal',      upstreamGroup: 'pg-5',  processes: ['Xray'] },
  { id: 'pg-7',  name: 'LF Wave Bot',      calcType: 'normal',      upstreamGroup: 'pg-6',  processes: ['Manual Insert Bot', 'Wave Bot', 'PWTU Bot'] },
  { id: 'pg-8',  name: 'Router',           calcType: 'normal',      upstreamGroup: 'pg-7',  processes: ['Router'] },
  { id: 'pg-9',  name: 'Backend MA',       calcType: 'normal',      upstreamGroup: 'pg-8',  processes: ['BE Manual Assembly'] },
  { id: 'pg-10', name: 'ICT',              calcType: 'normal',      upstreamGroup: 'pg-9',  processes: ['Genrad ICT', 'HP3070'] },
  { id: 'pg-11', name: 'FVT',              calcType: 'normal',      upstreamGroup: 'pg-10', processes: ['FVT'] },
  { id: 'pg-12', name: 'FNI / OBA / Pack', calcType: 'normal',      upstreamGroup: 'pg-11', processes: ['FNI', 'OBA', 'Packout'] },
];

// ─── Trolley types (config) ─────────────────────────────────────────────────────
export interface IPKTrolleyType {
  id: string;
  assemblyPN: string;
  trolleyType: string;
  cavities: number;
  boardsPerCavity: number;
}

export const MOCK_TROLLEY_TYPES: IPKTrolleyType[] = [
  { id: 'tt-1', assemblyPN: '00-27000-0-001F', trolleyType: 'ESD Rack A', cavities: 4, boardsPerCavity: 5 },
  { id: 'tt-2', assemblyPN: '00-27000-0-002F', trolleyType: 'ESD Rack A', cavities: 4, boardsPerCavity: 5 },
  { id: 'tt-3', assemblyPN: '00-31200-1-110R', trolleyType: 'Slim Cart',  cavities: 2, boardsPerCavity: 8 },
  { id: 'tt-4', assemblyPN: '00-44510-2-300X', trolleyType: 'Bin Cart',   cavities: 6, boardsPerCavity: 4 },
];

// ─── Period options ─────────────────────────────────────────────────────────────
export const PERIOD_OPTIONS = ['Monthly', 'Weekly'];
