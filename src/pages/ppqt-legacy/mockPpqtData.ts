/**
 * mockPpqtData.ts
 * ────────────────
 * Mock data for the PPQT module — modeled on the Wabtec customer XLSX.
 *
 * Generated programmatically from a small set of master definitions, so
 * every layer of the hierarchy has consistent data:
 *
 *   Workcell  →  Sub-workcenter  →  Process  →  Assembly × Revision  →  CT
 *
 * When the real API arrives, swap these imports for usePpqtData() hooks
 * in src/hooks/ppqt/. Component contracts stay identical.
 */

import {
  CTSource,
  PPQTAssembly,
  PPQTAssemblyCT,
  PPQTProcess,
  PPQTStatus,
  PPQTSubWorkcenter,
  PPQTWorkcell,
  ProcessArea,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SHIFT = {
  shiftHours: 21, workingDays: 26, changeoverQty: 4, changeoverTime: 20,
  fpy: 99, efficiency: 85,
};

// Process templates per area — what processes exist on each kind of line.
const PROCESS_TEMPLATES: Record<ProcessArea, string[]> = {
  SMT: ['Label 1', 'SCR BOT 1', 'SPI BOT 1', 'P&P TOP', 'Reflow TOP', 'AOI TOP', 'P&P BOT', 'Reflow BOT', 'AOI BOT'],
  TH:  ['ICT', 'FCT'],
  BE:  ['Visual Insp', 'Pack & Label'],
};

// Slug helpers — keep URLs sane.
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Workcell definitions ─────────────────────────────────────────────────────
interface WorkcellDef {
  id: string;
  division: string;
  totalDemand: number;
  lastUpdated: string;
  subWorkcenters: Array<{ slug: string; name: string; area: ProcessArea }>;
  // Assemblies that run at this workcell (with demand share)
  assemblies: Array<{ partNumber: string; rev: string; family: string; demandPct: number }>;
  // Per-process utilisation profile — drives the demonstration of bottleneck/warning/healthy/idle
  utilProfile: Record<string, number>; // process name → utilisation %
}

const WORKCELL_DEFS: WorkcellDef[] = [
  {
    id: 'WABTEC',
    division: 'Locomotive Electronics',
    totalDemand: 2480,
    lastUpdated: '2 days ago',
    subWorkcenters: [
      { slug: 'wab-smt-p1a-1-b5a', name: 'WAB SMT P1A-1 B5a', area: 'SMT' },
      { slug: 'wab-th-p1a-1-b5a',  name: 'WAB TH P1A-1 B5a',  area: 'TH'  },
      { slug: 'wab-be-p1a-1-b5a',  name: 'WAB BE P1A-1 B5a',  area: 'BE'  },
    ],
    assemblies: [
      { partNumber: '17FB130C6', rev: 'N', family: 'Locomotive Control', demandPct: 22 },
      { partNumber: '17FB130A2', rev: 'N', family: 'Locomotive Control', demandPct: 18 },
      { partNumber: '17FB130D1', rev: 'N', family: 'Locomotive Control', demandPct: 14 },
      { partNumber: '17FB130B8', rev: 'N', family: 'Locomotive Control', demandPct: 12 },
      { partNumber: '17FB130F3', rev: 'N', family: 'Brake Control',      demandPct: 10 },
      { partNumber: '17FB130G7', rev: 'N', family: 'Brake Control',      demandPct:  9 },
      { partNumber: '17FB130H1', rev: 'A', family: 'Auxiliary Power',    demandPct:  8 },
      { partNumber: '17FB130J4', rev: 'N', family: 'Auxiliary Power',    demandPct:  7 },
    ],
    utilProfile: {
      'Label 1': 80, 'SCR BOT 1': 142, 'SPI BOT 1': 90, 'P&P TOP': 93,
      'Reflow TOP': 64, 'AOI TOP': 105, 'P&P BOT': 73, 'Reflow BOT': 55, 'AOI BOT': 88,
      'ICT': 99, 'FCT': 86,
      'Visual Insp': 94, 'Pack & Label': 99,
    },
  },
  {
    id: 'KEYSIGHT',
    division: 'Test & Measurement',
    totalDemand: 1820,
    lastUpdated: '5 days ago',
    subWorkcenters: [
      { slug: 'key-smt-p2a-3', name: 'KEY SMT P2A-3', area: 'SMT' },
      { slug: 'key-be-1',      name: 'KEY BE-1',      area: 'BE'  },
    ],
    assemblies: [
      { partNumber: 'N9020A',  rev: 'C', family: 'Signal Analyzer', demandPct: 28 },
      { partNumber: 'N9030B',  rev: 'B', family: 'Signal Analyzer', demandPct: 22 },
      { partNumber: 'E36103B', rev: 'A', family: 'Power Supply',    demandPct: 18 },
      { partNumber: 'E36104B', rev: 'A', family: 'Power Supply',    demandPct: 14 },
      { partNumber: 'M9415A',  rev: 'N', family: 'PXIe',            demandPct: 10 },
      { partNumber: 'M9416A',  rev: 'N', family: 'PXIe',            demandPct:  8 },
    ],
    utilProfile: {
      'Label 1': 65, 'SCR BOT 1': 72, 'SPI BOT 1': 78, 'P&P TOP': 84,
      'Reflow TOP': 58, 'AOI TOP': 88, 'P&P BOT': 67, 'Reflow BOT': 52, 'AOI BOT': 75,
      'Visual Insp': 82, 'Pack & Label': 79,
    },
  },
  {
    id: 'COLLINS',
    division: 'Avionics',
    totalDemand: 980,
    lastUpdated: '1 day ago',
    subWorkcenters: [
      { slug: 'cln-th-1', name: 'CLN TH-1', area: 'TH' },
      { slug: 'cln-be-1', name: 'CLN BE-1', area: 'BE' },
    ],
    assemblies: [
      { partNumber: 'CLN-FCC-100', rev: 'D', family: 'Flight Control',   demandPct: 35 },
      { partNumber: 'CLN-FCC-200', rev: 'C', family: 'Flight Control',   demandPct: 25 },
      { partNumber: 'CLN-NAV-50',  rev: 'B', family: 'Navigation',       demandPct: 18 },
      { partNumber: 'CLN-NAV-75',  rev: 'A', family: 'Navigation',       demandPct: 12 },
      { partNumber: 'CLN-COM-30',  rev: 'N', family: 'Communications',   demandPct: 10 },
    ],
    utilProfile: {
      'ICT': 118, 'FCT': 92,
      'Visual Insp': 88, 'Pack & Label': 76,
    },
  },
  {
    id: 'DYSON',
    division: 'Home Appliances',
    totalDemand: 3420,
    lastUpdated: 'Today',
    subWorkcenters: [
      { slug: 'dys-smt-1', name: 'DYS SMT-1', area: 'SMT' },
      { slug: 'dys-smt-2', name: 'DYS SMT-2', area: 'SMT' },
      { slug: 'dys-be-1',  name: 'DYS BE-1',  area: 'BE'  },
    ],
    assemblies: [
      { partNumber: 'V15-MTR', rev: 'C', family: 'Motor Control',    demandPct: 30 },
      { partNumber: 'V15-PCB', rev: 'C', family: 'Main Board',       demandPct: 25 },
      { partNumber: 'AM09-FAN', rev: 'B', family: 'Fan Controller',  demandPct: 20 },
      { partNumber: 'AM09-PWR', rev: 'B', family: 'Power Module',    demandPct: 15 },
      { partNumber: 'TP07-IO', rev: 'A', family: 'IO Board',         demandPct:  6 },
      { partNumber: 'TP07-SNS', rev: 'A', family: 'Sensor Board',    demandPct:  4 },
    ],
    utilProfile: {
      'Label 1': 95, 'SCR BOT 1': 145, 'SPI BOT 1': 118, 'P&P TOP': 108,
      'Reflow TOP': 86, 'AOI TOP': 132, 'P&P BOT': 102, 'Reflow BOT': 78, 'AOI BOT': 96,
      'Visual Insp': 89, 'Pack & Label': 92,
    },
  },
  {
    id: 'RESMED',
    division: 'Medical Devices',
    totalDemand: 1240,
    lastUpdated: '3 days ago',
    subWorkcenters: [
      { slug: 'res-smt-p1', name: 'RES SMT P1', area: 'SMT' },
    ],
    assemblies: [
      { partNumber: 'AS11-CTRL', rev: 'D', family: 'CPAP Control',  demandPct: 35 },
      { partNumber: 'AS11-SNS',  rev: 'D', family: 'Sensor Board',  demandPct: 25 },
      { partNumber: 'AS10-CTRL', rev: 'C', family: 'CPAP Control',  demandPct: 20 },
      { partNumber: 'AC10-COMM', rev: 'B', family: 'Communications', demandPct: 12 },
      { partNumber: 'AC10-PWR',  rev: 'A', family: 'Power Module',   demandPct:  8 },
    ],
    utilProfile: {
      'Label 1': 52, 'SCR BOT 1': 68, 'SPI BOT 1': 60, 'P&P TOP': 72,
      'Reflow TOP': 48, 'AOI TOP': 65, 'P&P BOT': 55, 'Reflow BOT': 42, 'AOI BOT': 58,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE FLAT ARRAYS
// ═══════════════════════════════════════════════════════════════════════════════

const _workcells: PPQTWorkcell[] = [];
const _subWorkcenters: PPQTSubWorkcenter[] = [];
const _processes: PPQTProcess[] = [];
const _assemblies: PPQTAssembly[] = [];
const _assemblyCTs: PPQTAssemblyCT[] = [];

// Deterministic pseudo-random — keeps mock data stable between renders.
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pickCtSource(rand: () => number): CTSource {
  const r = rand();
  if (r < 0.65) return 'MOST';
  if (r < 0.85) return 'SW';
  return 'Est';
}

// ─── Build hierarchy bottom-up so we can compute aggregates ──
for (const wcDef of WORKCELL_DEFS) {
  const rand = seededRand(wcDef.id.charCodeAt(0) * 13);

  // ── Assemblies for this workcell ──
  const assembliesForWc: PPQTAssembly[] = wcDef.assemblies.map(a => ({
    id: `${slugify(a.partNumber)}-${a.rev.toLowerCase()}`,
    partNumber: a.partNumber,
    rev: a.rev,
    family: a.family,
    workcellId: wcDef.id,
    demand: Math.round(wcDef.totalDemand * (a.demandPct / 100)),
    demandPct: a.demandPct,
  }));
  _assemblies.push(...assembliesForWc);

  // ── Sub-workcenters + processes + CTs ──
  let wcBottlenecks = 0;
  let wcProcessCount = 0;
  let wcEstimates = 0;
  const wcUtilWeighted: { sum: number; total: number } = { sum: 0, total: 0 };

  for (const swcDef of wcDef.subWorkcenters) {
    const processTemplate = PROCESS_TEMPLATES[swcDef.area];

    let swcBottlenecks = 0;
    let swcEstimates = 0;
    const swcUtilWeighted: { sum: number; total: number } = { sum: 0, total: 0 };
    const processesForSwc: PPQTProcess[] = [];

    for (let i = 0; i < processTemplate.length; i++) {
      const procName = processTemplate[i];
      const procId = `${swcDef.slug}__${slugify(procName)}`;

      // Use a defined utilisation if present, otherwise derive one
      const definedUtil = wcDef.utilProfile[procName];
      const util = definedUtil ?? (60 + Math.round(rand() * 50));

      // Reverse-engineer WCT/Takt/Eq from utilisation for plausible numbers
      const takt = 44.1; // sec — constant for demonstration
      const eqAvail = util > 100 ? 1 : Math.max(1, Math.round(rand() * 2));
      const rawRatio = util / 100;
      const wct = Math.round(rawRatio * eqAvail * takt * 0.8415 * 10) / 10;
      const resNeeded = Math.ceil(rawRatio * eqAvail);
      const gap = resNeeded - eqAvail;
      if (gap > 0) { swcBottlenecks++; }

      // ── Build CTs for every assembly that routes through this process ──
      const ctSourceCounts = { MOST: 0, SW: 0, Est: 0 };
      for (const asm of assembliesForWc) {
        const ctSource = pickCtSource(rand);
        ctSourceCounts[ctSource]++;
        if (ctSource === 'Est') swcEstimates++;

        // Generate plausible CT components — Mach dominates on machine-led processes
        const isMachineLed = swcDef.area === 'SMT' || procName.includes('ICT') || procName.includes('FCT');
        const mach = isMachineLed ? Math.round(wct * (0.55 + rand() * 0.25) * 10) / 10 : 0;
        const imt  = isMachineLed ? Math.round(wct * (0.10 + rand() * 0.15) * 10) / 10 : 0;
        const hand = isMachineLed ? Math.round(wct * (0.05 + rand() * 0.10) * 10) / 10 : Math.round(wct * (0.9 + rand() * 0.15) * 10) / 10;
        const sPct = 99;
        const machAdj = Math.round((mach / eqAvail * (sPct / 100)) * 10) / 10;
        const imtAdj  = Math.round((imt * (sPct / 100)) * 10) / 10;
        const handAdj = Math.round((hand * (sPct / 100)) * 10) / 10;
        const totalAdj = Math.round((machAdj + imtAdj + handAdj) * 10) / 10;

        _assemblyCTs.push({
          id: `${asm.id}__${procId}`,
          assemblyId: asm.id,
          processId: procId,
          mach, imt, hand, cap: eqAvail, sPct,
          ctSource,
          studyDate: ctSource === 'Est' ? null : `2026-0${1 + Math.floor(rand() * 4)}-15`,
          machAdj, imtAdj, handAdj, totalAdj,
        });
      }

      // Primary CT source = most common across assemblies
      const primaryCtSource: CTSource =
        ctSourceCounts.MOST >= ctSourceCounts.SW && ctSourceCounts.MOST >= ctSourceCounts.Est ? 'MOST'
        : ctSourceCounts.SW >= ctSourceCounts.Est ? 'SW'
        : 'Est';

      processesForSwc.push({
        id: procId,
        name: procName,
        subWorkcenterId: swcDef.slug,
        area: swcDef.area,
        sequence: i + 1,
        wct, takt, eqAvail, resNeeded, gap, util,
        primaryCtSource, ctSourceCounts,
      });

      swcUtilWeighted.sum += util;
      swcUtilWeighted.total += 1;
    }

    _processes.push(...processesForSwc);
    wcProcessCount += processesForSwc.length;
    wcBottlenecks += swcBottlenecks;
    wcEstimates += swcEstimates;

    // Sub-workcenter aggregate
    const swcDemand = Math.round(wcDef.totalDemand * (processesForSwc.length / 13)); // rough share
    const swcAvgUtil = swcUtilWeighted.total > 0 ? Math.round(swcUtilWeighted.sum / swcUtilWeighted.total) : 0;

    _subWorkcenters.push({
      id: swcDef.slug,
      name: swcDef.name,
      workcellId: wcDef.id,
      area: swcDef.area,
      ...DEFAULT_SHIFT,
      totalDemand: swcDemand,
      processCount: processesForSwc.length,
      bottlenecks: swcBottlenecks,
      avgUtil: swcAvgUtil,
      ctEstimates: swcEstimates,
    });

    wcUtilWeighted.sum += swcUtilWeighted.sum;
    wcUtilWeighted.total += swcUtilWeighted.total;
  }

  // Workcell aggregate
  _workcells.push({
    id: wcDef.id,
    name: wcDef.id,
    customer: wcDef.id,
    division: wcDef.division,
    period: 'May 2026',
    totalDemand: wcDef.totalDemand,
    subWorkcenterCount: wcDef.subWorkcenters.length,
    processCount: wcProcessCount,
    bottlenecks: wcBottlenecks,
    avgUtil: wcUtilWeighted.total > 0 ? Math.round(wcUtilWeighted.sum / wcUtilWeighted.total) : 0,
    ctEstimates: wcEstimates,
    lastUpdated: wcDef.lastUpdated,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export const MOCK_WORKCELLS:        readonly PPQTWorkcell[]       = _workcells;
export const MOCK_SUBWORKCENTERS:   readonly PPQTSubWorkcenter[]  = _subWorkcenters;
export const MOCK_PROCESSES:        readonly PPQTProcess[]        = _processes;
export const MOCK_ASSEMBLIES:       readonly PPQTAssembly[]       = _assemblies;
export const MOCK_ASSEMBLY_CTS:     readonly PPQTAssemblyCT[]     = _assemblyCTs;

// ─── Lookup helpers ─────────────────────────────────────────────────────────
export const getWorkcell = (id: string): PPQTWorkcell | undefined =>
  _workcells.find(w => w.id === id);

export const getSubWorkcentersForWorkcell = (workcellId: string): PPQTSubWorkcenter[] =>
  _subWorkcenters.filter(s => s.workcellId === workcellId);

export const getSubWorkcenter = (id: string): PPQTSubWorkcenter | undefined =>
  _subWorkcenters.find(s => s.id === id);

export const getProcessesForSubWorkcenter = (subWorkcenterId: string): PPQTProcess[] =>
  _processes.filter(p => p.subWorkcenterId === subWorkcenterId);

export const getProcess = (id: string): PPQTProcess | undefined =>
  _processes.find(p => p.id === id);

export const getAssembliesForWorkcell = (workcellId: string): PPQTAssembly[] =>
  _assemblies.filter(a => a.workcellId === workcellId);

export const getAssembly = (id: string): PPQTAssembly | undefined =>
  _assemblies.find(a => a.id === id);

export const getCTsForProcess = (processId: string): PPQTAssemblyCT[] =>
  _assemblyCTs.filter(c => c.processId === processId);

export const getCT = (assemblyId: string, processId: string): PPQTAssemblyCT | undefined =>
  _assemblyCTs.find(c => c.assemblyId === assemblyId && c.processId === processId);

export const getCTsForAssembly = (assemblyId: string): PPQTAssemblyCT[] =>
  _assemblyCTs.filter(c => c.assemblyId === assemblyId);

// ─── Status helper (mirrors what UI components need) ───────────────────────
export function statusFromUtil(util: number): PPQTStatus {
  if (util > 100) return 'bottleneck';
  if (util >= 90) return 'warning';
  if (util >= 70) return 'healthy';
  return 'idle';
}

// ─── Constant period options for selectors ─────────────────────────────────
export const PERIOD_OPTIONS = ['May 2026', 'Apr 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026'] as const;
