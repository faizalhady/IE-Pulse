/**
 * mockVaNvaData.ts
 * ─────────────────
 * Verbatim transcription of "KPI Tracker VA NVA  2.xlsx" (Sheet1 + Sheet2),
 * read on 2026-08-13 from C:\Users\4033375\Projects\VA NVA\.
 *
 * Only the INPUT cells are stored. Everything the workbook computed
 * (H, I, M, P, Q) is re-derived in lib/va_nva/vanvaCalc.ts so the dashboard
 * can re-run the whole sheet at any NVA target, not just 20%.
 *
 * Three faults in the source workbook are corrected here by tagging rows
 * rather than by changing numbers:
 *   1. Rows 9–10 roll into row 8, rows 15–16 roll into row 17. Summing the
 *      column double-counts them → tagged role 'child' and skipped in totals.
 *   2. Those child rows have no NVA MFG, so the sheet's M formula prints 0%
 *      NVA, which is not the same as "no data" → nvaMfg stays null and the
 *      ratio comes back null.
 *   3. Column K (NVA ACTUAL PPQT) feeds no formula anywhere in the workbook.
 *      It is carried through and surfaced as ppqtVsMfg instead of dropped.
 *
 * Swap MOCK_VA_NVA_DATASETS for the API response once ingestion is decided.
 */

import type { VaNvaDataset, VaNvaRow } from './types';

/** Sheet1, in workbook row order. */
export const SHEET1_ROWS: VaNvaRow[] = [
  {
    id: 'aop-overall', workcell: 'AOP OVERALL', role: 'aggregate',
    vaSizingRound: 150, vaSizingDecimal: 150, vaActual: 151, crew: 3,
    nvaPpqt: 85, nvaMfg: 78,
    note: 'Reads as a plan/summary row, not a customer workcell — excluded from plant totals. Confirm before reporting.',
  },
  {
    id: 'imed-pca', workcell: 'IMED PCA', role: 'workcell',
    vaSizingRound: 38, vaSizingDecimal: 30.23, vaActual: 51, crew: 3,
    nvaPpqt: 12, nvaMfg: 24,
  },
  {
    id: 'advantest', workcell: 'ADVANTEST', role: 'workcell',
    vaSizingRound: 148, vaSizingDecimal: 148, vaActual: 113, crew: 2,
    nvaPpqt: 14, nvaMfg: 14,
  },
  {
    id: 'lam-mech-efem', workcell: 'LAM MECH / EFEM', role: 'workcell',
    vaSizingRound: 311, vaSizingDecimal: 289.31, vaActual: 119, crew: 2,
    nvaPpqt: 122, nvaMfg: 82,
  },
  {
    id: 'lam-gas-box', workcell: 'LAM GAS BOX', role: 'parent',
    vaSizingRound: 49, vaSizingDecimal: 48.5, vaActual: 56, crew: 2,
    nvaPpqt: 17, nvaMfg: 9,
  },
  {
    id: 'lam-gas-box-weldment', workcell: 'LAM GAS BOX · Weldment', role: 'child', parentId: 'lam-gas-box',
    vaSizingRound: 21, vaSizingDecimal: 24.47, vaActual: 33, crew: 2,
    nvaPpqt: 8, nvaMfg: null,
    note: 'No NVA MFG recorded — the workbook prints 0% here, which is not the same as zero NVA.',
  },
  {
    id: 'lam-gas-box-assembly', workcell: 'LAM GAS BOX · Assembly', role: 'child', parentId: 'lam-gas-box',
    vaSizingRound: 28, vaSizingDecimal: 24.03, vaActual: 23, crew: 2,
    nvaPpqt: 8, nvaMfg: null,
    note: 'No NVA MFG recorded — the workbook prints 0% here, which is not the same as zero NVA.',
  },
  {
    id: 'micron', workcell: 'MICRON', role: 'workcell',
    vaSizingRound: 83, vaSizingDecimal: 48.41, vaActual: 82, crew: 3,
    nvaPpqt: 25, nvaMfg: 58,
  },
  {
    id: 'lamresearch', workcell: 'LAMRESEARCH', role: 'workcell',
    vaSizingRound: 92, vaSizingDecimal: 72.68, vaActual: 116, crew: 3,
    nvaPpqt: 27, nvaMfg: 47,
  },
  {
    id: 'cohu', workcell: 'COHU', role: 'workcell',
    vaSizingRound: 11, vaSizingDecimal: 7.61, vaActual: 11, crew: 1,
    nvaPpqt: 7, nvaMfg: 7,
  },
  {
    id: 'aristanetworks', workcell: 'ARISTANETWORKS', role: 'workcell',
    vaSizingRound: 204, vaSizingDecimal: 138, vaActual: 169, crew: 3,
    nvaPpqt: 318, nvaMfg: 246,
  },
  {
    id: 'keysight', workcell: 'KEYSIGHT', role: 'parent',
    vaSizingRound: 313.94, vaSizingDecimal: 313.94, vaActual: 274, crew: 2,
    nvaPpqt: 32, nvaMfg: 80,
  },
  {
    id: 'keysight-pca', workcell: 'KEYSIGHT · KS PCA', role: 'child', parentId: 'keysight',
    vaSizingRound: 113, vaSizingDecimal: 113, vaActual: null, crew: null,
    nvaPpqt: null, nvaMfg: null,
    note: 'Sizing only — no actual, crew or NVA recorded.',
  },
  {
    id: 'keysight-hla', workcell: 'KEYSIGHT · KS HLA', role: 'child', parentId: 'keysight',
    vaSizingRound: 200.94, vaSizingDecimal: 200.94, vaActual: null, crew: null,
    nvaPpqt: null, nvaMfg: null,
    note: 'Sizing only — no actual, crew or NVA recorded.',
  },
  {
    id: 'danaher', workcell: 'DANAHER', role: 'workcell',
    vaSizingRound: 28, vaSizingDecimal: 21.98, vaActual: 24, crew: 2,
    nvaPpqt: 8, nvaMfg: 12,
  },
  {
    id: 'wabtec', workcell: 'WABTEC', role: 'workcell',
    vaSizingRound: 52, vaSizingDecimal: 42.53, vaActual: 38, crew: 1,
    nvaPpqt: 12, nvaMfg: 9,
  },
  {
    id: 'collins', workcell: 'COLLINS', role: 'workcell',
    vaSizingRound: 8.4, vaSizingDecimal: 5.1, vaActual: 19, crew: 1,
    nvaPpqt: 4.5, nvaMfg: 4,
  },
  {
    id: 'becton-dickinson', workcell: 'BECTON DICKINSON', role: 'workcell',
    vaSizingRound: 10.15, vaSizingDecimal: 5.23, vaActual: 16, crew: 2,
    nvaPpqt: 6, nvaMfg: 5,
  },
  {
    id: 'masimo', workcell: 'MASIMO', role: 'workcell',
    vaSizingRound: 16.24, vaSizingDecimal: 15.43, vaActual: 19, crew: 2,
    nvaPpqt: 5, nvaMfg: 5,
  },
  {
    id: 'resmed', workcell: 'RESMED', role: 'workcell',
    vaSizingRound: 26, vaSizingDecimal: 24.72, vaActual: 27, crew: 3,
    nvaPpqt: 5, nvaMfg: 14,
  },
  {
    id: 'fortive', workcell: 'FORTIVE', role: 'workcell',
    vaSizingRound: 20, vaSizingDecimal: 16.34, vaActual: 13, crew: 1,
    nvaPpqt: 4, nvaMfg: 4,
  },
  {
    id: 'thermofisher', workcell: 'THERMOFISHER', role: 'workcell',
    vaSizingRound: 16, vaSizingDecimal: 12.31, vaActual: 20, crew: 2,
    nvaPpqt: 5, nvaMfg: 7,
  },
  {
    id: 'medtronics', workcell: 'MEDTRONICS', role: 'workcell',
    // Sheet1 row 27 sits below the table: only E=23, H=25 (hardcoded, not a
    // formula) and L=2. H − L = 23 → VA sizing is taken as the actual.
    vaSizingRound: 23, vaSizingDecimal: 23, vaActual: 23, crew: null,
    nvaPpqt: null, nvaMfg: 2,
    note: 'No PPQT. Sits outside the table in the workbook; overall (25) was hardcoded, not calculated.',
  },
];

/** Sheet2 — lean maturity ladder. Bands are % of total DL. */
export const MATURITY_LADDER = [
  { key: 'baseline'   as const, stage: 'Current (baseline)',      vaLo: 40, vaHi: 50, nvaLo: 50, nvaHi: 60, description: 'Typical unstable process' },
  { key: 'short_term' as const, stage: 'Short-term (3–6 months)', vaLo: 55, vaHi: 60, nvaLo: 40, nvaHi: 45, description: 'Quick wins, kaizen' },
  { key: 'mid_term'   as const, stage: 'Mid-term (6–12 months)',  vaLo: 65, vaHi: 70, nvaLo: 30, nvaHi: 35, description: 'Process improvement' },
  { key: 'long_term'  as const, stage: 'Long-term (Lean level)',  vaLo: 75, vaHi: 85, nvaLo: 15, nvaHi: 25, description: 'Mature system' },
];

export const MOCK_VA_NVA_DATASETS: VaNvaDataset[] = [
  {
    id: 'ds-2026-08',
    filename: 'KPI Tracker VA NVA  2.xlsx',
    periodLabel: 'Aug 2026',
    uploadedBy: 'seed',
    uploadedAt: '2026-08-13T00:00:00Z',
    rowCount: SHEET1_ROWS.length,
    active: true,
    rows: SHEET1_ROWS,
  },
];
