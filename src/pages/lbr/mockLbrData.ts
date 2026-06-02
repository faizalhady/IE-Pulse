/**
 * mockLbrData.ts
 * ───────────────
 * Mock data for the LBR module (Phase 1 — no backend). Hooks in src/hooks/lbr/
 * read from here. Every playbook carries a real `stations` array (with work
 * elements) so the Yamazumi / Stations / Simulate / Compare tabs all work;
 * headline metrics are computed from those stations via lbrCalc for internal
 * consistency.
 */

import type {
  LBRWorkcell, LBRAssembly, LBRPlaybook, LBRStation, LBRWorkElement,
  StationType, ElementCategory,
} from './types';
import { computeLbrMetrics, recomputeStations } from '@/lib/lbr/lbrCalc';

// ─── Tiny builders ────────────────────────────────────────────────────────────
function mkEl(
  id: string, name: string, timeSec: number, category: ElementCategory,
  movable = false, movableTo: string[] = [],
): LBRWorkElement {
  return { id, name, timeSec, category, movable, movableTo };
}

function mkStation(
  id: string, type: StationType, operator: string | null, elements: LBRWorkElement[],
): LBRStation {
  // cycleTimeSec + isBottleneck are finalised by recomputeStations() in mkPlaybook.
  return { id, type, operator, cycleTimeSec: 0, isBottleneck: false, elements };
}

interface PlaybookMeta {
  id: string; name: string; scenario: string; operators: number;
  takt: number; isActive: boolean; lastUpdated: string;
}

/** Build a playbook: derive station CTs + all metrics from the work elements. */
function mkPlaybook(meta: PlaybookMeta, stationSpecs: LBRStation[]): LBRPlaybook {
  const stations = recomputeStations(stationSpecs);
  const m = computeLbrMetrics(stations, meta.operators, meta.takt);
  return {
    ...meta,
    lbr: m.lbr,
    uph: m.uph,
    upph: m.upph,
    lbl: m.lbl,
    bottleneckStation: m.bottleneckStation,
    bottleneckCt: m.tBottleneckSec,
    vsTaktPct: m.vsTaktPct,
    stations,
  };
}

/**
 * Generic station-set generator for secondary assemblies, so every assembly
 * has at least one fully-populated playbook without hand-authoring dozens.
 * Deterministic (varies by index, no Math.random).
 */
function genStations(opCount: number, meanCt: number, withMachine = true): LBRStation[] {
  const vary = (i: number) => 1 + ((i % 3) - 1) * 0.18; // 0.82 / 1.0 / 1.18 cycle
  const ids = ['MA1', 'MA2', 'MA3', 'MA4', 'MA5', 'MA6'].slice(0, opCount);
  const stations: LBRStation[] = ids.map((id, i) => {
    const ct = meanCt * vary(i);
    const next = ids[i + 1] ?? 'PACK';
    const prev = ids[i - 1];
    const moveTargets = [prev, next].filter(Boolean) as string[];
    return mkStation(id, 'operator', `OP${i + 1}`, [
      mkEl(`${id}-load`, 'Load / pick', Math.round(ct * 0.35), 'VA', true, moveTargets),
      mkEl(`${id}-proc`, 'Process', Math.round(ct * 0.45), 'VA', false, []),
      mkEl(`${id}-move`, 'Handoff', Math.round(ct * 0.20), 'NVA', i > 0, prev ? [prev] : []),
    ]);
  });
  if (withMachine) {
    stations.splice(Math.min(2, opCount), 0,
      mkStation('WAVE', 'machine_only', null, [mkEl('WAVE-sol', 'Wave solder', Math.round(meanCt * 0.7), 'VA')]));
  }
  stations.push(mkStation('PACK', 'operator', `OP${opCount + 1}`, [
    mkEl('PACK-insp', 'Visual inspect', Math.round(meanCt * 0.5), 'VA', true, [ids[ids.length - 1]]),
    mkEl('PACK-box', 'Pack box', Math.round(meanCt * 0.4), 'VA'),
    mkEl('PACK-ship', 'Move to ship', Math.round(meanCt * 0.15), 'NVA'),
  ]));
  return stations;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKCELLS (league table)
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_LBR_WORKCELLS: LBRWorkcell[] = [
  { id: 'bd-pca',   name: 'BD PCA',         customer: 'Becton Dickinson', division: 'Becton Dickinson',     activeAssemblies: 8,  totalPlaybooks: 18, avgLbr: 87, avgUph: 52, bottlenecks: 2, lastStudyDate: '2024-06-12', status: 'warning' },
  { id: 'wabtec',   name: 'WABTEC',         customer: 'Wabtec',           division: 'Locomotive Electronics', activeAssemblies: 4, totalPlaybooks: 9,  avgLbr: 92, avgUph: 38, bottlenecks: 0, lastStudyDate: '2024-05-20', status: 'healthy' },
  { id: 'arista',   name: 'ARISTA NETWORKS', customer: 'Arista Networks', division: 'ARISTANETWORKS*',       activeAssemblies: 12, totalPlaybooks: 24, avgLbr: 83, avgUph: 67, bottlenecks: 5, lastStudyDate: '2024-06-01', status: 'critical' },
  { id: 'keysight', name: 'KEYSIGHT HLA',   customer: 'Keysight',         division: 'KEYSIGHT*',             activeAssemblies: 6,  totalPlaybooks: 14, avgLbr: 89, avgUph: 45, bottlenecks: 1, lastStudyDate: '2024-06-08', status: 'warning' },
  { id: 'imed',     name: 'IMED PCA',       customer: 'ICU Medical',      division: 'ICU Medical',           activeAssemblies: 5,  totalPlaybooks: 11, avgLbr: 91, avgUph: 56, bottlenecks: 0, lastStudyDate: '2024-06-10', status: 'healthy' },
  { id: 'aop1',     name: 'AOP1',           customer: 'AOP',              division: 'AOP*',                  activeAssemblies: 3,  totalPlaybooks: 0,  avgLbr: 0,  avgUph: 0,  bottlenecks: 0, lastStudyDate: null,         status: 'never_studied' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ASSEMBLIES (per workcell)
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_LBR_ASSEMBLIES: Record<string, LBRAssembly[]> = {
  'bd-pca': [
    { id: 'aspca-01133-02', assembly: 'ASPCA-01133', revision: '02', line: 'P2B-1', family: 'Drug Delivery', demand: 2800, playbookCount: 3, bestLbr: 90, bestUph: 60, bestUpph: 10.0, bestLbl: 19, bottleneckStation: 'MA2',  lastStudyDate: '2024-06-12', status: 'healthy' },
    { id: 'aspca-01155-a0', assembly: 'ASPCA-01155', revision: 'A0', line: 'P2B-1', family: 'Diagnostics',   demand: 1200, playbookCount: 1, bestLbr: 91, bestUph: 45, bestUpph: 11.3, bestLbl: 14, bottleneckStation: 'TEST', lastStudyDate: '2024-06-10', status: 'healthy' },
    { id: 'aspca-01200-b0', assembly: 'ASPCA-01200', revision: 'B0', line: 'P2B-2', family: 'Infusion',      demand: 980,  playbookCount: 1, bestLbr: 89, bestUph: 52, bestUpph: 10.4, bestLbl: 24, bottleneckStation: 'MA3',  lastStudyDate: '2024-06-08', status: 'warning' },
    { id: 'aspca-01250-c0', assembly: 'ASPCA-01250', revision: 'C0', line: 'P2B-2', family: 'Infusion',      demand: 1450, playbookCount: 1, bestLbr: 84, bestUph: 48, bestUpph: 9.6,  bestLbl: 38, bottleneckStation: 'MA1',  lastStudyDate: '2024-06-05', status: 'critical' },
    { id: 'aspca-01300-a0', assembly: 'ASPCA-01300', revision: 'A0', line: 'P2B-3', family: 'Diagnostics',   demand: 700,  playbookCount: 1, bestLbr: 92, bestUph: 38, bestUpph: 9.5,  bestLbl: 12, bottleneckStation: 'PACK', lastStudyDate: '2024-06-11', status: 'healthy' },
  ],
  'wabtec': [
    { id: 'wab-17fb130-c6', assembly: '17FB130', revision: 'C6', line: 'WAB-SMT-P1A-1', family: 'Locomotive Ctrl', demand: 600, playbookCount: 1, bestLbr: 93, bestUph: 40, bestUpph: 8.0,  bestLbl: 11, bottleneckStation: 'MA2', lastStudyDate: '2024-05-20', status: 'healthy' },
    { id: 'wab-22kc450-a1', assembly: '22KC450', revision: 'A1', line: 'WAB-BE-P1B-1',  family: 'Power Module',    demand: 420, playbookCount: 1, bestLbr: 90, bestUph: 35, bestUpph: 8.8,  bestLbl: 16, bottleneckStation: 'MA3', lastStudyDate: '2024-05-18', status: 'healthy' },
  ],
  'arista': [
    { id: 'ari-7050sx-r1', assembly: '7050SX', revision: 'R1', line: 'ARI-SMT-P3A-1', family: 'Switch PCA',  demand: 3400, playbookCount: 1, bestLbr: 82, bestUph: 70, bestUpph: 11.7, bestLbl: 44, bottleneckStation: 'MA2', lastStudyDate: '2024-06-01', status: 'critical' },
    { id: 'ari-7280cr-a0', assembly: '7280CR', revision: 'A0', line: 'ARI-BE-P3B-2',  family: 'Router PCA',  demand: 2100, playbookCount: 1, bestLbr: 85, bestUph: 64, bestUpph: 10.7, bestLbl: 33, bottleneckStation: 'TEST', lastStudyDate: '2024-05-30', status: 'warning' },
  ],
  'keysight': [
    { id: 'key-n9020b-b2', assembly: 'N9020B', revision: 'B2', line: 'KEY-HLA-P4A-1', family: 'Signal Analyzer', demand: 320, playbookCount: 1, bestLbr: 90, bestUph: 44, bestUpph: 8.8, bestLbl: 18, bottleneckStation: 'MA2', lastStudyDate: '2024-06-08', status: 'healthy' },
    { id: 'key-e36731-a0', assembly: 'E36731', revision: 'A0', line: 'KEY-HLA-P4A-2', family: 'Power Supply',    demand: 480, playbookCount: 1, bestLbr: 88, bestUph: 47, bestUpph: 9.4, bestLbl: 22, bottleneckStation: 'MA1', lastStudyDate: '2024-06-06', status: 'warning' },
  ],
  'imed': [
    { id: 'imed-pl500-a2', assembly: 'PLUM-500', revision: 'A2', line: 'IMED-P5A-1', family: 'Infusion Pump', demand: 1600, playbookCount: 1, bestLbr: 92, bestUph: 58, bestUpph: 9.7,  bestLbl: 14, bottleneckStation: 'MA3', lastStudyDate: '2024-06-10', status: 'healthy' },
    { id: 'imed-lv200-b0', assembly: 'LIFE-200', revision: 'B0', line: 'IMED-P5A-2', family: 'Monitor',       demand: 900,  playbookCount: 1, bestLbr: 90, bestUph: 53, bestUpph: 10.6, bestLbl: 17, bottleneckStation: 'TEST', lastStudyDate: '2024-06-09', status: 'healthy' },
  ],
  'aop1': [
    { id: 'aop-x100-a0', assembly: 'AOP-X100', revision: 'A0', line: 'AOP-P6A-1', family: 'Optics', demand: 500, playbookCount: 0, bestLbr: 0, bestUph: 0, bestUpph: 0, bestLbl: 0, bottleneckStation: '—', lastStudyDate: null, status: 'never_studied' },
    { id: 'aop-x200-a0', assembly: 'AOP-X200', revision: 'A0', line: 'AOP-P6A-1', family: 'Optics', demand: 350, playbookCount: 0, bestLbr: 0, bestUph: 0, bestUpph: 0, bestLbl: 0, bottleneckStation: '—', lastStudyDate: null, status: 'never_studied' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYBOOKS (per assembly) — showcase assembly fully authored
// ═══════════════════════════════════════════════════════════════════════════════
const SHOWCASE_6OP = mkPlaybook(
  { id: '6op-high-demand', name: '6-op High Demand', scenario: 'Normal demand, full headcount', operators: 6, takt: 60, isActive: true, lastUpdated: '2024-06-12' },
  [
    mkStation('MA1', 'operator', 'OP1', [
      mkEl('e1', 'Pick board',       5,  'VA',  true,  ['MA2']),
      mkEl('e2', 'Place in fixture', 12, 'VA',  true,  ['MA2', 'MA3']),
      mkEl('e3', 'Apply paste',      18, 'VA',  false, []),
      mkEl('e4', 'Move to MA2',      4,  'NVA', false, []),
    ]),
    mkStation('MA2', 'operator', 'OP2', [
      mkEl('e5', 'Load components',  14, 'VA',  true,  ['MA1', 'MA3']),
      mkEl('e6', 'Press button',     2,  'NVA', false, []),
      mkEl('e7', 'Inspect',          18, 'VA',  false, []),
      mkEl('e8', 'Move to MA3',      5,  'NVA', false, []),
    ]),
    mkStation('MA3', 'operator', 'OP3', [
      mkEl('e9',  'Final assembly',  22, 'VA',  true,  ['MA2']),
      mkEl('e10', 'Tighten screws',  10, 'VA',  true,  ['MA2']),
      mkEl('e11', 'Move to TEST',    3,  'NVA', false, []),
    ]),
    mkStation('WAVE', 'machine_only', null, [
      mkEl('e12', 'Wave solder',     22, 'VA',  false, []),
    ]),
    mkStation('TEST', 'operator', 'OP4', [
      mkEl('e13', 'Connect tester',  8,  'NVA', true,  ['MA3']),
      mkEl('e14', 'Run test',        18, 'VA',  false, []),
      mkEl('e15', 'Disconnect',      4,  'NVA', false, []),
    ]),
    mkStation('QC', 'shared', 'OP5+OP6', [
      mkEl('e16', 'Visual inspect',  15, 'VA',  true,  []),
      mkEl('e17', 'Pack box',        12, 'VA',  false, []),
      mkEl('e18', 'Move to ship',    6,  'NVA', false, []),
    ]),
  ],
);

const SHOWCASE_5OP = mkPlaybook(
  { id: '5op-standard', name: '5-op Standard', scenario: 'Normal demand, one operator absent', operators: 5, takt: 60, isActive: false, lastUpdated: '2024-06-10' },
  [
    mkStation('MA1', 'operator', 'OP1', [
      mkEl('e1', 'Pick board',       5,  'VA',  true,  ['MA2']),
      mkEl('e2', 'Place in fixture', 12, 'VA',  true,  ['MA2']),
      mkEl('e3', 'Apply paste',      18, 'VA',  false, []),
      mkEl('e4', 'Load components',  11, 'VA',  true,  ['MA2']),
    ]),
    mkStation('MA2', 'operator', 'OP2', [
      mkEl('e5', 'Inspect',          18, 'VA',  false, []),
      mkEl('e6', 'Final assembly',   22, 'VA',  true,  ['MA3']),
      mkEl('e7', 'Move to MA3',      6,  'NVA', false, []),
    ]),
    mkStation('MA3', 'operator', 'OP3', [
      mkEl('e8',  'Tighten screws',  10, 'VA',  true,  ['MA2']),
      mkEl('e9',  'Sub-assembly',    20, 'VA',  false, []),
      mkEl('e10', 'Move to TEST',    4,  'NVA', false, []),
    ]),
    mkStation('WAVE', 'machine_only', null, [
      mkEl('e11', 'Wave solder',     22, 'VA',  false, []),
    ]),
    mkStation('TEST', 'operator', 'OP4', [
      mkEl('e12', 'Connect tester',  8,  'NVA', true,  ['MA3']),
      mkEl('e13', 'Run test',        18, 'VA',  false, []),
      mkEl('e14', 'Disconnect',      4,  'NVA', false, []),
    ]),
    mkStation('PACK', 'operator', 'OP5', [
      mkEl('e15', 'Visual inspect',  15, 'VA',  true,  ['TEST']),
      mkEl('e16', 'Pack box',        12, 'VA',  false, []),
      mkEl('e17', 'Move to ship',    6,  'NVA', false, []),
    ]),
  ],
);

const SHOWCASE_4OP = mkPlaybook(
  { id: '4op-lean', name: '4-op Lean', scenario: 'Low demand, minimum headcount', operators: 4, takt: 60, isActive: false, lastUpdated: '2024-06-08' },
  [
    mkStation('MA1', 'operator', 'OP1', [
      mkEl('e1', 'Pick + place',     17, 'VA',  true,  ['MA2']),
      mkEl('e2', 'Apply paste',      18, 'VA',  false, []),
      mkEl('e3', 'Load components',  14, 'VA',  true,  ['MA2']),
      mkEl('e4', 'Handoff',          9,  'NVA', false, []),
    ]),
    mkStation('MA2', 'operator', 'OP2', [
      mkEl('e5', 'Inspect',          18, 'VA',  false, []),
      mkEl('e6', 'Final assembly',   22, 'VA',  true,  ['MA1']),
      mkEl('e7', 'Tighten screws',   10, 'VA',  true,  ['MA1']),
      mkEl('e8', 'Move to TEST',     6,  'NVA', false, []),
    ]),
    mkStation('WAVE', 'machine_only', null, [
      mkEl('e9', 'Wave solder',      22, 'VA',  false, []),
    ]),
    mkStation('TEST', 'operator', 'OP3', [
      mkEl('e10', 'Connect tester',  8,  'NVA', true,  ['MA2']),
      mkEl('e11', 'Run test',        18, 'VA',  false, []),
      mkEl('e12', 'Disconnect',      4,  'NVA', false, []),
      mkEl('e13', 'Sub-test',        16, 'VA',  false, []),
    ]),
    mkStation('PACK', 'operator', 'OP4', [
      mkEl('e14', 'Visual inspect',  15, 'VA',  true,  ['TEST']),
      mkEl('e15', 'Pack box',        12, 'VA',  false, []),
      mkEl('e16', 'Move to ship',    6,  'NVA', false, []),
    ]),
  ],
);

// Secondary playbooks (one per remaining assembly) via the generic generator.
function genPlaybook(id: string, name: string, scenario: string, opCount: number, meanCt: number, takt: number, lastUpdated: string): LBRPlaybook {
  return mkPlaybook(
    { id, name, scenario, operators: opCount + 1, takt, isActive: true, lastUpdated },
    genStations(opCount, meanCt),
  );
}

export const MOCK_LBR_PLAYBOOKS: Record<string, LBRPlaybook[]> = {
  'aspca-01133-02': [SHOWCASE_6OP, SHOWCASE_5OP, SHOWCASE_4OP],
  'aspca-01155-a0': [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 14, 80, '2024-06-10')],
  'aspca-01200-b0': [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 17, 69, '2024-06-08')],
  'aspca-01250-c0': [genPlaybook('4op-lean', '4-op Lean', 'Low demand', 4, 21, 60, '2024-06-05')],
  'aspca-01300-a0': [genPlaybook('4op-std', '4-op Standard', 'Normal demand', 4, 16, 90, '2024-06-11')],
  'wab-17fb130-c6': [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 18, 90, '2024-05-20')],
  'wab-22kc450-a1': [genPlaybook('4op-std', '4-op Standard', 'Normal demand', 4, 20, 86, '2024-05-18')],
  'ari-7050sx-r1':  [genPlaybook('6op-high', '6-op High Demand', 'Peak demand', 6, 13, 51, '2024-06-01')],
  'ari-7280cr-a0':  [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 15, 56, '2024-05-30')],
  'key-n9020b-b2':  [genPlaybook('4op-std', '4-op Standard', 'Normal demand', 4, 19, 82, '2024-06-08')],
  'key-e36731-a0':  [genPlaybook('4op-std', '4-op Standard', 'Normal demand', 4, 18, 76, '2024-06-06')],
  'imed-pl500-a2':  [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 15, 56, '2024-06-10')],
  'imed-lv200-b0':  [genPlaybook('5op-std', '5-op Standard', 'Normal demand', 5, 16, 68, '2024-06-09')],
  // aop1 assemblies — never studied, no playbooks.
};

// ─── Lookup helpers ─────────────────────────────────────────────────────────
export const getLBRWorkcell = (id: string): LBRWorkcell | undefined =>
  MOCK_LBR_WORKCELLS.find(w => w.id === id);

export const getLBRAssembliesFor = (workcell: string): LBRAssembly[] =>
  MOCK_LBR_ASSEMBLIES[workcell] ?? [];

export const getLBRAssembly = (workcell: string, assembly: string): LBRAssembly | undefined =>
  getLBRAssembliesFor(workcell).find(a => a.id === assembly);

export const getLBRPlaybooksFor = (assembly: string): LBRPlaybook[] =>
  MOCK_LBR_PLAYBOOKS[assembly] ?? [];

export const getLBRPlaybook = (assembly: string, playbook: string): LBRPlaybook | undefined =>
  getLBRPlaybooksFor(assembly).find(p => p.id === playbook);
