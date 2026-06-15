/**
 * mockFsmsData.ts — mock data for the FSMS dashboard surfaces.
 * ────────────────────────────────────────────────────────────
 * Co-located with the pages (house pattern). Every value is shaped to a contract
 * in `@/types/fsms`, so swapping these for a real API response is a no-op for the UI.
 */

import type {
  AreaDetails, AreaScopeRow, ConsoSummaryRow, DashboardKpis, ForecastVsActualRow,
  GoldenLineSummary, PlantCell, PlantUtilizationResponse, RevenueMetricRow, SummaryKpis, TrendPoint,
} from '@/types/fsms';

// ─── Overview KPIs ──────────────────────────────────────────────────────────────
export const MOCK_DASHBOARD_KPIS: DashboardKpis = {
  forecast: 412_000,
  permanent: 358_400,
  overall: 381_900,
  temporary: 23_500,
  surplus: 78_100,
  total_available: 436_500,
  utilization: 87.0,
  rate_smt: 4.16,
  rate_df: 3.07,
};

// ─── Plant utilisation (latest CONSO month, per plant × area) ────────────────────
export const MOCK_PLANT_UTILIZATION: PlantUtilizationResponse = {
  conso_month: 'March 2026',
  conso_date: '2026-03-01',
  plants: ['P1', 'P2', 'BK'],
  data: {
    P1: [
      { plant: 'P1', area: 'SMT', label: 'SMT', total_available: 92_000, utilization_space: 81_000, surplus: 11_000, utilization_pct: 88.0 },
      { plant: 'P1', area: 'DF',  label: 'DF',  total_available: 68_000, utilization_space: 57_000, surplus: 11_000, utilization_pct: 83.8 },
    ],
    P2: [
      { plant: 'P2', area: 'SMT', label: 'SMT', total_available: 84_000, utilization_space: 76_000, surplus: 8_000,  utilization_pct: 90.5 },
      { plant: 'P2', area: 'DF',  label: 'DF',  total_available: 60_000, utilization_space: 49_000, surplus: 11_000, utilization_pct: 81.7 },
    ],
    BK: [
      { plant: 'BK', area: 'SMT', label: 'SMT', total_available: 78_000, utilization_space: 62_400, surplus: 15_600, utilization_pct: 80.0 },
      { plant: 'BK', area: 'DF',  label: 'DF',  total_available: 54_500, utilization_space: 33_000, surplus: 21_500, utilization_pct: 60.6 },
    ],
  },
};

// ─── By customer: Summary Space Directory ────────────────────────────────────────
export interface SummaryPeriodMeta {
  fiscal_year: string;    // 'FY 2026'
  quarter: string;        // 'Q3 (Mar-May)'
  month: string;          // 'March'
  conso_year: number;     // 2026
  conso_quarter: string;  // "Q3'26"
}

export const MOCK_SUMMARY_PERIOD: SummaryPeriodMeta = {
  fiscal_year: 'FY 2026',
  quarter: 'Q3 (Mar-May)',
  month: 'March',
  conso_year: 2026,
  conso_quarter: "Q3'26",
};

export const MOCK_SUMMARY_KPIS: SummaryKpis = {
  rate_smt: 4.16,
  rate_df: 3.07,
  permanent: 358_400,
  total_available: 418_106,
  utilization: 85.72,
};

/** The plant column order shown in the directory (dynamic — legacy: BK, P1, P2). */
export const MOCK_SUMMARY_PLANTS = ['BK', 'P1', 'P2'];

const consoRow = (
  profit_center: string,
  customer_name: string,
  customer_location: string,
  by_plant: PlantCell[],
  forecast_smt: number,
  forecast_df: number,
  comments?: { smt?: string; df?: string },
): ConsoSummaryRow => {
  const actual_smt = by_plant.reduce((s, p) => s + p.smt, 0);
  const actual_df = by_plant.reduce((s, p) => s + p.df, 0);
  // mirror the row-level comment onto the dominant (first) plant cell so the
  // per-plant matrix shows the same underline as the Actual column.
  const bp = by_plant.map((p, i) => i === 0
    ? { ...p, smt_comment: comments?.smt ?? p.smt_comment ?? null, df_comment: comments?.df ?? p.df_comment ?? null }
    : p);
  return {
    date: '2026-03-01',
    profit_center,
    customer_name,
    customer_location,
    by_plant: bp,
    forecast_smt,
    forecast_df,
    actual_smt,
    actual_df,
    variance_smt: forecast_smt - actual_smt,
    variance_df: forecast_df - actual_df,
    actual_smt_comment: comments?.smt ?? null,
    actual_df_comment: comments?.df ?? null,
  };
};

export const MOCK_CONSO_SUMMARY: ConsoSummaryRow[] = [
  consoRow('0301AKAMAI', 'AKAMAI TECHNOLOGIES', 'BK', [{ plant: 'BK', smt: 0, df: 3_954 }], 0, 3_954, { df: 'Confirmed by BK floor team' }),
  consoRow('0301AMAT',   'APPLIED MATERIALS',   'P1', [{ plant: 'P1', smt: 3_500, df: 0 }], 3_500, 1_000),
  consoRow('0301AOP10',  'AOP - 0301AOP10',     'BK', [{ plant: 'BK', smt: 5_672, df: 0 }], 5_672, 0),
  consoRow('0301AOP11',  'AOP - 0301AOP11',     'BK', [{ plant: 'BK', smt: 3_472, df: 0 }], 3_472, 0),
  consoRow('0301AOP12',  'AOP - 0301AOP12',     'BK', [{ plant: 'BK', smt: 2_042, df: 0 }], 2_042, 0),
  consoRow('0301AOP4',   'IMED SMT',            'P1', [{ plant: 'P1', smt: 11_937, df: 0 }], 11_078, 0, { smt: 'Line ramp in progress' }),
  consoRow('0301AOP5',   'IMED WAVE',           'P1', [{ plant: 'P1', smt: 1_099, df: 0 }], 1_139, 0),
  consoRow('0301AOP6',   'IMED TEST',           'P1', [{ plant: 'P1', smt: 4_505, df: 0 }], 4_006, 0, { smt: 'Pending re-measure' }),
  consoRow('0301AOP7',   'AOP - 0301AOP7',      'P1', [{ plant: 'P1', smt: 18_969, df: 0 }], 16_717, 0, { smt: 'Awaiting layout sign-off' }),
  consoRow('0301Dyson',  'DYSON',               'BK', [{ plant: 'BK', smt: 0, df: 5_930 }], 0, 0, { df: 'New DF allocation' }),
  consoRow('0301ELENIO', 'JP ELENION',          'BK', [{ plant: 'BK', smt: 6_993, df: 0 }], 6_993, 0),
  consoRow('0301GOPRO_', 'GOPRO',               'BK', [{ plant: 'BK', smt: 3_150, df: 0 }], 3_150, 0),
  consoRow('0301ICPACK', 'IC PACKAGING',        'BK', [{ plant: 'BK', smt: 2_767, df: 0 }], 2_767, 0, { smt: 'Shared bay' }),
  consoRow('0301INFNRA', 'INFINERA',            'BK', [{ plant: 'BK', smt: 10_000, df: 17_589 }], 9_950, 17_589, { smt: 'Estimate pending CONSO' }),
  consoRow('0301INTELC', 'INTEL CAP',           'BK', [{ plant: 'BK', smt: 0, df: 27_962 }], 0, 28_000),
  consoRow('0301JPINCM', 'AWS PHOTONICS',       'BK', [{ plant: 'BK', smt: 22_053, df: 7_472 }], 22_053, 7_472),
  consoRow('0301JPNOKI', 'JP NOKIA',            'BK', [{ plant: 'BK', smt: 0, df: 10_500 }], 0, 11_000),
];

/** Synthesized SURPLUS row (0301SURPLS) — appended at the bottom of the directory. */
export const MOCK_CONSO_SURPLUS: ConsoSummaryRow = {
  date: '2026-03-01',
  profit_center: '0301SURPLS',
  customer_name: 'SURPLUS',
  customer_location: 'BK/P1/P2',
  by_plant: [
    { plant: 'BK', smt: 18_000, df: 12_000 },
    { plant: 'P1', smt: 9_000, df: 5_000 },
    { plant: 'P2', smt: 6_000, df: 3_000 },
  ],
  forecast_smt: 0,
  forecast_df: 0,
  actual_smt: 33_000,
  actual_df: 20_000,
  variance_smt: -33_000,
  variance_df: -20_000,
};

// ─── Trends: monthly actual-vs-forecast + FVA table ──────────────────────────────
export const MOCK_TREND: TrendPoint[] = [
  { mth: '2025-09', actual: 332_000, forecast: 340_000 },
  { mth: '2025-10', actual: 338_500, forecast: 345_000 },
  { mth: '2025-11', actual: 344_000, forecast: 350_000 },
  { mth: '2025-12', actual: 349_000, forecast: 356_000 },
  { mth: '2026-01', actual: 351_500, forecast: 362_000 },
  { mth: '2026-02', actual: 355_000, forecast: 372_000 },
  { mth: '2026-03', actual: 358_400, forecast: 412_000 },
];

export const MOCK_FVA: ForecastVsActualRow[] = [
  { customer: 'Arista',    mth: '2026-03', qtr: "Q3'26", forecast_sqft: 51_000, actual_sqft: 50_000, variance: 1_000, temporary_sqft: 2_000 },
  { customer: 'Keysight',  mth: '2026-03', qtr: "Q3'26", forecast_sqft: 43_000, actual_sqft: 43_000, variance: 0,     temporary_sqft: 1_500 },
  { customer: 'GoPro',     mth: '2026-03', qtr: "Q3'26", forecast_sqft: 33_000, actual_sqft: 31_000, variance: 2_000, temporary_sqft: 0 },
  { customer: 'Micron',    mth: '2026-03', qtr: "Q3'26", forecast_sqft: 32_000, actual_sqft: 32_000, variance: 0,     temporary_sqft: 3_000 },
  { customer: 'Wabtec',    mth: '2026-03', qtr: "Q3'26", forecast_sqft: 22_000, actual_sqft: 22_000, variance: 0,     temporary_sqft: 0 },
  { customer: 'Celestica', mth: '2026-03', qtr: "Q3'26", forecast_sqft: 25_000, actual_sqft: 25_000, variance: 0,     temporary_sqft: 1_000 },
];

// ─── By area: top bays + capacity ────────────────────────────────────────────────
const bay = (plant: string, area: string, bay: string, sqft: number, temp_sqft: number, total_available: number): AreaScopeRow =>
  ({ plant, area, bay, sqft, temp_sqft, total_available, period_date: '2026-03-01' });

export const MOCK_AREA_DETAILS: AreaDetails = {
  rows: [
    // ── P1 — P1A, P1B (L1/L2/L3), P1C ──────────────────────────────────────────
    bay('P1', 'P1A',    'P1A-01', 9_500, 500,   11_000),
    bay('P1', 'P1A',    'P1A-02', 8_200, 0,      9_000),
    bay('P1', 'P1B L1', 'P1B1-01', 7_000, 800,   8_000),
    bay('P1', 'P1B L1', 'P1B1-02', 6_500, 0,     7_500),
    bay('P1', 'P1B L2', 'P1B2-01', 6_800, 0,     7_200),
    bay('P1', 'P1B L2', 'P1B2-02', 5_400, 600,   6_000),
    bay('P1', 'P1B L3', 'P1B3-01', 5_200, 0,     6_500),
    bay('P1', 'P1B L3', 'P1B3-02', 4_800, 400,   5_500),
    bay('P1', 'P1C',    'P1C-01', 8_800, 1_000, 10_000),
    bay('P1', 'P1C',    'P1C-02', 7_600, 0,      8_500),
    // ── P2 — P2, P2A, P2B, P2C ─────────────────────────────────────────────────
    bay('P2', 'P2',  'P2-01', 7_500, 0,     8_400),
    bay('P2', 'P2',  'P2-02', 6_400, 600,   7_200),
    bay('P2', 'P2A', 'P2A-01', 8_900, 0,     9_800),
    bay('P2', 'P2A', 'P2A-02', 7_300, 700,   8_200),
    bay('P2', 'P2B', 'P2B-01', 6_900, 0,     7_600),
    bay('P2', 'P2B', 'P2B-02', 6_100, 900,   7_000),
    bay('P2', 'P2C', 'P2C-01', 4_200, 0,     5_500),
    bay('P2', 'P2C', 'P2C-02', 3_600, 500,   4_500),
    // ── BK — L1 Ph1, L1 Ph2, L2 Ph1, L2 Ph2, L2 Ph3, L3 ────────────────────────
    bay('BK', 'Level 1 Phase 1', 'BK-L1P1-01', 5_200, 0,     6_000),
    bay('BK', 'Level 1 Phase 1', 'BK-L1P1-02', 4_400, 600,   5_200),
    bay('BK', 'Level 1 Phase 2', 'BK-L1P2-01', 4_900, 0,     5_600),
    bay('BK', 'Level 1 Phase 2', 'BK-L1P2-02', 4_100, 500,   4_800),
    bay('BK', 'Level 2 Phase 1', 'BK-L2P1-01', 6_100, 0,     7_000),
    bay('BK', 'Level 2 Phase 1', 'BK-L2P1-02', 5_300, 700,   6_200),
    bay('BK', 'Level 2 Phase 2', 'BK-L2P2-01', 5_800, 0,     6_600),
    bay('BK', 'Level 2 Phase 2', 'BK-L2P2-02', 4_700, 400,   5_400),
    bay('BK', 'Level 2 Phase 3', 'BK-L2P3-01', 5_500, 0,     6_300),
    bay('BK', 'Level 2 Phase 3', 'BK-L2P3-02', 4_600, 800,   5_300),
    bay('BK', 'Level 3',         'BK-L3-01', 5_600, 0,     6_800),
    bay('BK', 'Level 3',         'BK-L3-02', 4_900, 600,   5_800),
  ],
  top_bays: ['P1A-01', 'P1C-01', 'P2A-01', 'BK-L2P1-01', 'P2-01', 'P1B1-01', 'P2B-01', 'BK-L3-01'],
};

// ─── Revenue / sqft ──────────────────────────────────────────────────────────────
const MONTHS = [
  { month_label: 'Oct FY 26', fiscal_month_index: 2, calendar_month: 10, month_date: '2025-10-01' },
  { month_label: 'Nov FY 26', fiscal_month_index: 3, calendar_month: 11, month_date: '2025-11-01' },
  { month_label: 'Dec FY 26', fiscal_month_index: 4, calendar_month: 12, month_date: '2025-12-01' },
  { month_label: 'Jan FY 26', fiscal_month_index: 5, calendar_month: 1,  month_date: '2026-01-01' },
  { month_label: 'Feb FY 26', fiscal_month_index: 6, calendar_month: 2,  month_date: '2026-02-01' },
  { month_label: 'Mar FY 26', fiscal_month_index: 7, calendar_month: 3,  month_date: '2026-03-01' },
];

let revId = 1;
const revRows = (profit_center: string, customer: string, division: string, base: number, sqft: number): RevenueMetricRow[] =>
  MONTHS.map((m, i) => {
    const revenue_usd = base + i * (base * 0.03);
    return {
      id: String(revId++),
      profit_center,
      customer,
      division,
      month_label: m.month_label,
      fiscal_year: 2026,
      fiscal_month_index: m.fiscal_month_index,
      calendar_month: m.calendar_month,
      revenue_usd,
      actual_sqft: sqft,
      rev_per_sqft: sqft > 0 ? Math.round((revenue_usd / sqft) * 100) / 100 : null,
      month_date: m.month_date,
      is_forecast: i >= 5,
      source_month: i >= 5 ? '2026-02-01' : m.month_date,
    };
  });

export const MOCK_REVENUE: RevenueMetricRow[] = [
  ...revRows('0301ARISTA', 'Arista',   'Networking', 2_600_000, 50_000),
  ...revRows('0301KEYSGT', 'Keysight', 'Test & Measure', 1_900_000, 43_000),
  ...revRows('0301MICRON', 'Micron',   'Storage', 1_500_000, 32_000),
];

export const MOCK_GOLDEN_LINE: GoldenLineSummary[] = [
  { division: 'Networking',     total_revenue: 16_500_000, total_actual_sqft: 300_000, avg_rev_per_sqft: 52.0, profit_center_count: 4, month_count: 6, golden_line: 8.7 },
  { division: 'Test & Measure', total_revenue: 11_800_000, total_actual_sqft: 258_000, avg_rev_per_sqft: 44.5, profit_center_count: 3, month_count: 6, golden_line: 7.4 },
  { division: 'Storage',        total_revenue: 9_200_000,  total_actual_sqft: 192_000, avg_rev_per_sqft: 47.0, profit_center_count: 2, month_count: 6, golden_line: 7.9 },
];
