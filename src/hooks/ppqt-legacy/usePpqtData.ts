/**
 * usePpqtData.ts — React Query hooks for the PPQT module.
 *
 * PPQT is computed server-side from real data (IEDB cycle time × planner
 * demand) — see modules/ppqt/capacity.py. Nothing here is mocked.
 */

import { useQuery } from '@tanstack/react-query';

import {
  ppqtApi, type PPQTApiParams, type PPQTCapacityQuery, type PPQTResource,
} from '@/lib/ppqt/ppqtApi';

export const ppqtKeys = { all: ['ppqt'] as const };

/** Months that have planner demand, plus the current-month default. */
export function usePpqtMonths() {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'months'] as const,
    queryFn:  ({ signal }) => ppqtApi.months.list(signal),
    staleTime: 60 * 60_000,
  });
}

/** Capacity rollup for every workcell — the league table. ~5s cold, cached backend-side. */
export function usePpqtOverview(
  params?: Partial<PPQTApiParams> & { month?: string; resource?: PPQTResource },
) {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'overview', params ?? {}] as const,
    queryFn:  ({ signal }) => ppqtApi.overview.get(params, signal),
    staleTime: 30 * 60_000,
  });
}

/** Workcells that have both cycle-time data and planner demand, by demand desc. */
export function usePpqtWorkcells(month?: string) {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'workcells', month ?? ''] as const,
    queryFn:  ({ signal }) => ppqtApi.workcells.list(month, signal),
    staleTime: 30 * 60_000,
  });
}

/**
 * Full forward capacity computation for one workcell.
 * Shift params are optional overrides — omit to use backend defaults.
 */
export function usePpqtCapacity(workcell: string | undefined, opts?: Omit<PPQTCapacityQuery, 'workcell'>) {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'capacity', workcell ?? '', opts ?? {}] as const,
    queryFn:  ({ signal }) => ppqtApi.capacity.get({ workcell: workcell!, ...opts }, signal),
    enabled:  Boolean(workcell),
    staleTime: 30 * 60_000,
  });
}

/** Excel DASH "TOP Demand": top-N assemblies × CT at every process on one line. */
export function usePpqtMatrix(
  workcell: string | undefined, subWorkcenter: string | undefined, top = 20,
  month?: string, resource?: PPQTResource,
) {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'matrix', workcell ?? '', subWorkcenter ?? '', top, month ?? '', resource ?? ''] as const,
    queryFn:  ({ signal }) =>
      ppqtApi.matrix.get(
        { workcell: workcell!, sub_workcenter: subWorkcenter!, top, month, resource }, signal,
      ),
    enabled:  Boolean(workcell && subWorkcenter),
    staleTime: 30 * 60_000,
  });
}

/** Assemblies driving one process's weighted cycle time — the math-trail drawer. */
export function usePpqtEvidence(
  workcell: string | undefined,
  subWorkcenter: string | undefined,
  process: string | undefined,
  month?: string,
  resource?: PPQTResource,
) {
  return useQuery({
    queryKey: [...ppqtKeys.all, 'evidence', workcell ?? '', subWorkcenter ?? '', process ?? '', month ?? '', resource ?? ''] as const,
    queryFn:  ({ signal }) =>
      ppqtApi.evidence.get(
        { workcell: workcell!, sub_workcenter: subWorkcenter!, process: process!, month, resource },
        signal,
      ),
    enabled:  Boolean(workcell && subWorkcenter && process),
    staleTime: 30 * 60_000,
  });
}
