/**
 * mockOleData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mock data for OLE Home 2–5 overview pages.
 * Shapes match real API types exactly (OleSummary, OleWeeklyResult, etc.)
 * so swapping to live data later is a 1-line change per hook call.
 *
 * Workcells: 9 active (7 Plant 1, 2 Plant 2)
 * Weeks: WW01–WW16 FY26
 * OLE target: 80%
 */

import type {
  OleSummary,
  OleWeeklyResult,
  OleResult,
  OlePaidHours,
  OleProduction,
} from '@/lib/ole/oleApi';

// ─── Workcell master list ─────────────────────────────────────────────────────

export const MOCK_WORKCELLS = [
  { workcell: 'AOP1',                plant: 'Plant 1', stage_label: 'Backend',  scan_stage: 'Packout' },
  { workcell: 'WABTEC',              plant: 'Plant 1', stage_label: 'BoxBuild', scan_stage: 'Packout' },
  { workcell: 'ASP',                 plant: 'Plant 1', stage_label: 'Backend',  scan_stage: 'Packout' },
  { workcell: 'KEYSIGHT HLA',        plant: 'Plant 1', stage_label: 'BoxBuild', scan_stage: 'Packout' },
  { workcell: 'UTAS',                plant: 'Plant 1', stage_label: 'Backend',  scan_stage: 'Packout' },
  { workcell: 'BECKMAN COULTER',     plant: 'Plant 1', stage_label: 'BoxBuild', scan_stage: 'Packout' },
  { workcell: 'IMED',                plant: 'Plant 1', stage_label: 'Backend',  scan_stage: 'Packout' },
  { workcell: 'ARISTA NETWORKS',     plant: 'Plant 2', stage_label: 'SMT',      scan_stage: 'SMT' },
  { workcell: 'ARISTA NETWORKS HLA', plant: 'Plant 2', stage_label: 'Backend',  scan_stage: 'Packout' },
];

// ─── OLE summary per workcell ─────────────────────────────────────────────────

export const MOCK_SUMMARY: OleSummary[] = [
  { workcell: 'AOP1',                stage_label: 'Backend',  scan_stage: 'Packout', total_shifts: 48, avg_ole_pct: 84.2,  min_ole_pct: 71.0, max_ole_pct: 97.3, latest_date: '2026-04-15', total_qty: 18420, total_output_smh: 4210.5, total_input_hours: 5000.1, avg_hc_direct: 22, flagged_shifts: 2 },
  { workcell: 'WABTEC',              stage_label: 'BoxBuild', scan_stage: 'Packout', total_shifts: 45, avg_ole_pct: 78.6,  min_ole_pct: 60.1, max_ole_pct: 91.0, latest_date: '2026-04-15', total_qty: 11200, total_output_smh: 3620.0, total_input_hours: 4603.6, avg_hc_direct: 18, flagged_shifts: 5 },
  { workcell: 'ASP',                 stage_label: 'Backend',  scan_stage: 'Packout', total_shifts: 42, avg_ole_pct: 91.1,  min_ole_pct: 82.4, max_ole_pct: 99.8, latest_date: '2026-04-15', total_qty: 9870,  total_output_smh: 5100.3, total_input_hours: 5599.7, avg_hc_direct: 30, flagged_shifts: 0 },
  { workcell: 'KEYSIGHT HLA',        stage_label: 'BoxBuild', scan_stage: 'Packout', total_shifts: 40, avg_ole_pct: 63.4,  min_ole_pct: 41.2, max_ole_pct: 78.9, latest_date: '2026-04-14', total_qty: 7430,  total_output_smh: 2890.2, total_input_hours: 4559.5, avg_hc_direct: 24, flagged_shifts: 8 },
  { workcell: 'UTAS',                stage_label: 'Backend',  scan_stage: 'Packout', total_shifts: 44, avg_ole_pct: 72.8,  min_ole_pct: 55.0, max_ole_pct: 88.2, latest_date: '2026-04-15', total_qty: 6120,  total_output_smh: 3001.1, total_input_hours: 4123.8, avg_hc_direct: 20, flagged_shifts: 3 },
  { workcell: 'BECKMAN COULTER',     stage_label: 'BoxBuild', scan_stage: 'Packout', total_shifts: 38, avg_ole_pct: 55.3,  min_ole_pct: 33.1, max_ole_pct: 71.5, latest_date: '2026-04-13', total_qty: 4320,  total_output_smh: 1980.4, total_input_hours: 3581.2, avg_hc_direct: 16, flagged_shifts: 11 },
  { workcell: 'IMED',                stage_label: 'Backend',  scan_stage: 'Packout', total_shifts: 36, avg_ole_pct: 88.7,  min_ole_pct: 78.0, max_ole_pct: 96.1, latest_date: '2026-04-15', total_qty: 5600,  total_output_smh: 2750.8, total_input_hours: 3102.4, avg_hc_direct: 14, flagged_shifts: 1 },
  { workcell: 'ARISTA NETWORKS',     stage_label: 'SMT',      scan_stage: 'SMT',     total_shifts: 50, avg_ole_pct: 76.1,  min_ole_pct: 58.3, max_ole_pct: 89.4, latest_date: '2026-04-15', total_qty: 32100, total_output_smh: 6201.0, total_input_hours: 8148.5, avg_hc_direct: 35, flagged_shifts: 4 },
  { workcell: 'ARISTA NETWORKS HLA', stage_label: 'Backend',  scan_stage: 'Packout', total_shifts: 46, avg_ole_pct: 81.9,  min_ole_pct: 68.2, max_ole_pct: 93.7, latest_date: '2026-04-15', total_qty: 14800, total_output_smh: 5410.2, total_input_hours: 6604.6, avg_hc_direct: 28, flagged_shifts: 2 },
];

// ─── Weekly OLE per workcell (WW01–WW16) ─────────────────────────────────────

const WW_LABELS = Array.from({ length: 16 }, (_, i) => `2026-W${String(i + 1).padStart(2, '0')}`);

function makeWeeklyRows(workcell: string, plant: string, baseOle: number): OleWeeklyResult[] {
  return WW_LABELS.map((wl, i) => {
    const noise  = (Math.sin(i * 1.3 + baseOle) * 8 + Math.cos(i * 0.7) * 5);
    const olePct = Math.max(30, Math.min(100, baseOle + noise));
    const hrs    = 280 + i * 2;
    const smh    = (olePct / 100) * hrs;
    return {
      workcell,
      iso_year:          2026,
      iso_week:          i + 1,
      week_label:        wl,
      week_start_date:   `2026-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-${String((i % 4) * 7 + 1).padStart(2, '0')}`,
      week_end_date:     `2026-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-${String((i % 4) * 7 + 7).padStart(2, '0')}`,
      stage_label:       plant === 'Plant 2' ? (i % 2 === 0 ? 'SMT' : 'Backend') : 'Backend',
      scan_stage:        'Packout',
      total_qty:         Math.round(smh * 4),
      shift_count:       3,
      total_output_smh:  Math.round(smh * 10) / 10,
      total_input_hours: Math.round(hrs * 10) / 10,
      avg_hc_direct:     20,
      total_va_hours:    Math.round(smh * 0.72 * 10) / 10,
      total_nva_hours:   Math.round(hrs * 0.14 * 10) / 10,
      ole_pct:           Math.round(olePct * 100) / 100,
      ole_pct_avg_shifts: Math.round(olePct * 100) / 100,
      shifts_ok:         2,
      shifts_flagged:    1,
      smh_coverage_pct:  Math.round((90 + Math.sin(i) * 8) * 10) / 10,
    } as OleWeeklyResult;
  });
}

export const MOCK_WEEKLY: OleWeeklyResult[] = [
  ...makeWeeklyRows('AOP1',                'Plant 1', 84),
  ...makeWeeklyRows('WABTEC',              'Plant 1', 78),
  ...makeWeeklyRows('ASP',                 'Plant 1', 91),
  ...makeWeeklyRows('KEYSIGHT HLA',        'Plant 1', 63),
  ...makeWeeklyRows('UTAS',                'Plant 1', 72),
  ...makeWeeklyRows('BECKMAN COULTER',     'Plant 1', 55),
  ...makeWeeklyRows('IMED',                'Plant 1', 88),
  ...makeWeeklyRows('ARISTA NETWORKS',     'Plant 2', 76),
  ...makeWeeklyRows('ARISTA NETWORKS HLA', 'Plant 2', 81),
];

// ─── MH Breakdown (site-level) ────────────────────────────────────────────────

export const MOCK_MH_BREAKDOWN = {
  total_input_hours: 45423.4,
  slices: [
    { name: 'Output SMH',           value: 29400.2, color: '#22c55e' },
    { name: 'NVA Input',            value: 6813.5,  color: '#ef4444' },
    { name: 'Lunch / Break',        value: 4542.3,  color: '#94a3b8' },
    { name: 'MFG DT',               value: 2726.0,  color: '#f59e0b' },
    { name: 'Unexplained Lost Hours', value: 1941.4, color: '#6366f1' },
  ],
};

// Per-workcell MH breakdown
export const MOCK_MH_BY_WC: Record<string, typeof MOCK_MH_BREAKDOWN> = {
  'AOP1':                { total_input_hours: 5000.1, slices: [{ name: 'Output SMH', value: 4210.5, color: '#22c55e' }, { name: 'NVA Input', value: 350.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 220.0, color: '#94a3b8' }, { name: 'MFG DT', value: 120.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 99.6, color: '#6366f1' }] },
  'WABTEC':              { total_input_hours: 4603.6, slices: [{ name: 'Output SMH', value: 3620.0, color: '#22c55e' }, { name: 'NVA Input', value: 500.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 230.0, color: '#94a3b8' }, { name: 'MFG DT', value: 180.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 73.6, color: '#6366f1' }] },
  'ASP':                 { total_input_hours: 5599.7, slices: [{ name: 'Output SMH', value: 5100.3, color: '#22c55e' }, { name: 'NVA Input', value: 210.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 180.0, color: '#94a3b8' }, { name: 'MFG DT', value: 60.0,  color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 49.4, color: '#6366f1' }] },
  'KEYSIGHT HLA':        { total_input_hours: 4559.5, slices: [{ name: 'Output SMH', value: 2890.2, color: '#22c55e' }, { name: 'NVA Input', value: 900.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 380.0, color: '#94a3b8' }, { name: 'MFG DT', value: 250.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 139.3, color: '#6366f1' }] },
  'UTAS':                { total_input_hours: 4123.8, slices: [{ name: 'Output SMH', value: 3001.1, color: '#22c55e' }, { name: 'NVA Input', value: 580.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 310.0, color: '#94a3b8' }, { name: 'MFG DT', value: 150.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 82.7, color: '#6366f1' }] },
  'BECKMAN COULTER':     { total_input_hours: 3581.2, slices: [{ name: 'Output SMH', value: 1980.4, color: '#22c55e' }, { name: 'NVA Input', value: 900.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 380.0, color: '#94a3b8' }, { name: 'MFG DT', value: 220.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 100.8, color: '#6366f1' }] },
  'IMED':                { total_input_hours: 3102.4, slices: [{ name: 'Output SMH', value: 2750.8, color: '#22c55e' }, { name: 'NVA Input', value: 180.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 100.0, color: '#94a3b8' }, { name: 'MFG DT', value: 40.0,  color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 31.6, color: '#6366f1' }] },
  'ARISTA NETWORKS':     { total_input_hours: 8148.5, slices: [{ name: 'Output SMH', value: 6201.0, color: '#22c55e' }, { name: 'NVA Input', value: 900.0, color: '#ef4444' }, { name: 'Lunch / Break', value: 610.0, color: '#94a3b8' }, { name: 'MFG DT', value: 300.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 137.5, color: '#6366f1' }] },
  'ARISTA NETWORKS HLA': { total_input_hours: 6604.6, slices: [{ name: 'Output SMH', value: 5410.2, color: '#22c55e' }, { name: 'NVA Input', value: 593.5, color: '#ef4444' }, { name: 'Lunch / Break', value: 330.0, color: '#94a3b8' }, { name: 'MFG DT', value: 206.0, color: '#f59e0b' }, { name: 'Unexplained Lost Hours', value: 64.9, color: '#6366f1' }] },
};

// ─── Shift detail (sample — for OLE formula drill-down) ────────────────────────

export const MOCK_SHIFTS: OleResult[] = [
  { workcell: 'AOP1',     date: '2026-04-15', shift: 1, stage_label: 'Backend',  scan_stage: 'Packout', assembly_count: 4,  total_qty: 420,  effective_output_smh: 92.4,  qty_missing_smh: 0,  assemblies_missing_smh: 0, hc_direct: 22, tph_direct: 8.0, total_input_hours: 88.0,  va_hours: 63.4, nva_hours: 11.0, ole_pct: 105.0, data_quality: 'OK',          smh_coverage_pct: 100 },
  { workcell: 'AOP1',     date: '2026-04-15', shift: 2, stage_label: 'Backend',  scan_stage: 'Packout', assembly_count: 3,  total_qty: 310,  effective_output_smh: 68.2,  qty_missing_smh: 0,  assemblies_missing_smh: 0, hc_direct: 18, tph_direct: 8.0, total_input_hours: 72.0,  va_hours: 49.1, nva_hours: 9.0,  ole_pct: 94.7,  data_quality: 'OK',          smh_coverage_pct: 100 },
  { workcell: 'WABTEC',   date: '2026-04-15', shift: 1, stage_label: 'BoxBuild', scan_stage: 'Packout', assembly_count: 5,  total_qty: 280,  effective_output_smh: 78.4,  qty_missing_smh: 20, assemblies_missing_smh: 1, hc_direct: 20, tph_direct: 8.0, total_input_hours: 80.0,  va_hours: 56.4, nva_hours: 12.0, ole_pct: 98.0,  data_quality: 'PARTIAL_SMH', smh_coverage_pct: 93.2 },
  { workcell: 'BECKMAN COULTER', date: '2026-04-13', shift: 1, stage_label: 'BoxBuild', scan_stage: 'Packout', assembly_count: 3, total_qty: 110, effective_output_smh: 33.0, qty_missing_smh: 45, assemblies_missing_smh: 2, hc_direct: 16, tph_direct: 8.0, total_input_hours: 80.0, va_hours: 23.8, nva_hours: 20.0, ole_pct: 41.3, data_quality: 'PARTIAL_SMH', smh_coverage_pct: 61.0 },
  { workcell: 'ASP',      date: '2026-04-15', shift: 1, stage_label: 'Backend',  scan_stage: 'Packout', assembly_count: 6,  total_qty: 510,  effective_output_smh: 138.2, qty_missing_smh: 0,  assemblies_missing_smh: 0, hc_direct: 30, tph_direct: 8.0, total_input_hours: 120.0, va_hours: 99.5, nva_hours: 9.0,  ole_pct: 115.2, data_quality: 'OK',          smh_coverage_pct: 100 },
];

// ─── Assembly-level production (for Output SMH drill-down) ─────────────────────

export const MOCK_PRODUCTION: OleProduction[] = [
  { site: 'PEN', workcell: 'AOP1', sub_workcell: 'Packout', assembly: 'ASY-AOP-001-REV3', qty: 120, date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'AOP1', sub_workcell: 'Packout', assembly: 'ASY-AOP-002-REV1', qty: 180, date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'AOP1', sub_workcell: 'Packout', assembly: 'ASY-AOP-003-REV2', qty: 85,  date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'AOP1', sub_workcell: 'Packout', assembly: 'ASY-AOP-004-REV1', qty: 35,  date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'WABTEC', sub_workcell: 'Packout', assembly: 'WBT-MAIN-001', qty: 140, date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'WABTEC', sub_workcell: 'Packout', assembly: 'WBT-MAIN-002', qty: 90,  date: '2026-04-15', shift: 1 },
  { site: 'PEN', workcell: 'WABTEC', sub_workcell: 'Packout', assembly: 'WBT-MAIN-003', qty: 50,  date: '2026-04-15', shift: 1 },
];

// SMH lookup (assembly → SMH value)
export const MOCK_SMH_LOOKUP: Record<string, number> = {
  'ASY-AOP-001-REV3': 0.2200,
  'ASY-AOP-002-REV1': 0.1850,
  'ASY-AOP-003-REV2': 0.1600,
  'ASY-AOP-004-REV1': 0.3100,
  'WBT-MAIN-001': 0.2950,
  'WBT-MAIN-002': 0.3400,
  'WBT-MAIN-003': 0.2100,
};

// ─── Paid hours (for Input Hours drill-down) ────────────────────────────────────

export const MOCK_PAID_HOURS: OlePaidHours[] = [
  { site: 'PEN', cost_center: 'CC-001', workcell: 'AOP1', sub_workcell: 'Packout', thc_direct: 22, tph_direct: 8.0, total_input_hours: 88.0, date: '2026-04-15', shift: 1, value_type: 'NVA', position: 'Operator',  name: 'Ahmad Farid',     category: 'Direct' },
  { site: 'PEN', cost_center: 'CC-001', workcell: 'AOP1', sub_workcell: 'Packout', thc_direct: 18, tph_direct: 8.0, total_input_hours: 72.0, date: '2026-04-15', shift: 2, value_type: 'NVA', position: 'Operator',  name: 'Siti Rahayu',     category: 'Direct' },
  { site: 'PEN', cost_center: 'CC-001', workcell: 'AOP1', sub_workcell: 'Packout', thc_direct: 4,  tph_direct: 8.0, total_input_hours: 32.0, date: '2026-04-15', shift: 1, value_type: 'VA',  position: 'Technician', name: 'Rajan Kumar',     category: 'Support' },
  { site: 'PEN', cost_center: 'CC-002', workcell: 'WABTEC', sub_workcell: 'Packout', thc_direct: 20, tph_direct: 8.0, total_input_hours: 80.0, date: '2026-04-15', shift: 1, value_type: 'NVA', position: 'Operator', name: 'Lim Mei Fong',    category: 'Direct' },
  { site: 'PEN', cost_center: 'CC-002', workcell: 'WABTEC', sub_workcell: 'Packout', thc_direct: 3,  tph_direct: 8.0, total_input_hours: 24.0, date: '2026-04-15', shift: 1, value_type: 'VA',  position: 'Engineer', name: 'Hafiz Roslan',    category: 'Support' },
];

// ─── Attention items ──────────────────────────────────────────────────────────

export interface AttentionItem {
  type: 'critical_ole' | 'smh_gap' | 'flagged_shifts' | 'no_data';
  workcell: string;
  message: string;
  value: string;
  severity: 'high' | 'medium' | 'low';
}

export const MOCK_ATTENTION: AttentionItem[] = [
  { type: 'critical_ole',   workcell: 'BECKMAN COULTER', message: 'OLE critically below target', value: '55.3%', severity: 'high' },
  { type: 'flagged_shifts', workcell: 'BECKMAN COULTER', message: 'High flagged shift count',   value: '11 shifts', severity: 'high' },
  { type: 'critical_ole',   workcell: 'KEYSIGHT HLA',   message: 'OLE below 65% threshold',    value: '63.4%', severity: 'medium' },
  { type: 'smh_gap',        workcell: 'KEYSIGHT HLA',   message: 'SMH coverage gaps detected', value: '8 shifts', severity: 'medium' },
  { type: 'flagged_shifts', workcell: 'WABTEC',         message: 'Partial SMH data',           value: '5 shifts', severity: 'low' },
];

// ─── Derived aggregates (computed from mock summary) ──────────────────────────

export function getSiteAggregate(rows = MOCK_SUMMARY) {
  const totalOut = rows.reduce((s, r) => s + r.total_output_smh, 0);
  const totalIn  = rows.reduce((s, r) => s + r.total_input_hours, 0);
  return {
    ole_pct:           totalIn > 0 ? (totalOut / totalIn) * 100 : 0,
    total_output_smh:  totalOut,
    total_input_hours: totalIn,
    total_qty:         rows.reduce((s, r) => s + r.total_qty, 0),
    total_shifts:      rows.reduce((s, r) => s + r.total_shifts, 0),
    flagged_shifts:    rows.reduce((s, r) => s + r.flagged_shifts, 0),
  };
}

export function getPlantAggregate(plant: 'Plant 1' | 'Plant 2') {
  const rows = MOCK_SUMMARY.filter(r => {
    const wc = MOCK_WORKCELLS.find(w => w.workcell === r.workcell);
    return wc?.plant === plant;
  });
  return getSiteAggregate(rows);
}

// Site weekly aggregated
export function getSiteWeekly() {
  const byWeek: Record<string, { smh: number; hrs: number; year: number; week: number }> = {};
  MOCK_WEEKLY.forEach(r => {
    if (!byWeek[r.week_label]) byWeek[r.week_label] = { smh: 0, hrs: 0, year: r.iso_year, week: r.iso_week };
    byWeek[r.week_label].smh += r.total_output_smh;
    byWeek[r.week_label].hrs += r.total_input_hours;
  });
  return Object.values(byWeek)
    .sort((a, b) => a.week - b.week)
    .map(w => ({
      w:   `WW${String(w.week).padStart(2, '0')}`,
      ole: w.hrs > 0 ? Math.round((w.smh / w.hrs) * 10000) / 100 : 0,
    }));
}
