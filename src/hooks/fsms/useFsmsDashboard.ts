/**
 * useFsmsDashboard.ts — react-query hooks for the FSMS dashboard tabs.
 *
 * All mock-backed for now; each queryFn becomes a fetch later (the contract in
 * @/types/fsms is unchanged, so the swap is local to this file).
 */

import { useQuery } from '@tanstack/react-query';
import {
  MOCK_AREA_DETAILS, MOCK_CONSO_SUMMARY, MOCK_CONSO_SURPLUS, MOCK_DASHBOARD_KPIS, MOCK_FVA,
  MOCK_GOLDEN_LINE, MOCK_PLANT_UTILIZATION, MOCK_REVENUE, MOCK_SUMMARY_KPIS, MOCK_SUMMARY_PERIOD,
  MOCK_SUMMARY_PLANTS, MOCK_TREND, type SummaryPeriodMeta,
} from '@/pages/fsms/mockFsmsData';
import type {
  AreaDetails, ConsoSummaryRow, DashboardKpis, ForecastVsActualRow,
  GoldenLineSummary, PlantUtilizationResponse, RevenueMetricRow, SummaryKpis, TrendPoint,
} from '@/types/fsms';

const STALE = 5 * 60_000;

// ─── Overview (KPIs + plant utilisation) ────────────────────────────────────────
export interface FsmsDashboardData {
  kpis: DashboardKpis;
  utilization: PlantUtilizationResponse;
}

export function useFsmsDashboard(period?: string) {
  return useQuery<FsmsDashboardData>({
    queryKey: ['fsms-dashboard', period ?? 'latest'],
    queryFn: async () => ({ kpis: MOCK_DASHBOARD_KPIS, utilization: MOCK_PLANT_UTILIZATION }),
    staleTime: STALE,
  });
}

// ─── By customer (Summary Space Directory) ──────────────────────────────────────
export interface ConsoSummaryData {
  period: SummaryPeriodMeta;
  kpis: SummaryKpis;
  plants: string[];           // dynamic plant column order, e.g. ['BK','P1','P2']
  rows: ConsoSummaryRow[];    // customer rows (excludes the surplus row)
  surplus: ConsoSummaryRow;   // synthesized SURPLUS row
}

export function useConsoSummary(period?: string) {
  return useQuery<ConsoSummaryData>({
    queryKey: ['fsms-conso-summary', period ?? 'latest'],
    queryFn: async () => ({
      period: MOCK_SUMMARY_PERIOD,
      kpis: MOCK_SUMMARY_KPIS,
      plants: MOCK_SUMMARY_PLANTS,
      rows: MOCK_CONSO_SUMMARY,
      surplus: MOCK_CONSO_SURPLUS,
    }),
    staleTime: STALE,
  });
}

// ─── Trends (actual-vs-forecast trend + FVA table) ──────────────────────────────
export interface FsmsTrendsData {
  trend: TrendPoint[];
  fva: ForecastVsActualRow[];
}

export function useFsmsTrends(period?: string) {
  return useQuery<FsmsTrendsData>({
    queryKey: ['fsms-trends', period ?? 'latest'],
    queryFn: async () => ({ trend: MOCK_TREND, fva: MOCK_FVA }),
    staleTime: STALE,
  });
}

// ─── By area (top bays + capacity) ──────────────────────────────────────────────
export function useFsmsAreaDetails(period?: string) {
  return useQuery<AreaDetails>({
    queryKey: ['fsms-area-details', period ?? 'latest'],
    queryFn: async () => MOCK_AREA_DETAILS,
    staleTime: STALE,
  });
}

// ─── Revenue / sqft (rows + Golden Line) ────────────────────────────────────────
export interface FsmsRevenueData {
  rows: RevenueMetricRow[];
  goldenLines: GoldenLineSummary[];
}

export function useFsmsRevenue(period?: string) {
  return useQuery<FsmsRevenueData>({
    queryKey: ['fsms-revenue', period ?? 'latest'],
    queryFn: async () => ({ rows: MOCK_REVENUE, goldenLines: MOCK_GOLDEN_LINE }),
    staleTime: STALE,
  });
}
