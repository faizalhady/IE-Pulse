/**
 * usePpqt.ts — React Query hooks for the PPQT module.
 * Same pattern as hooks/cycle_time/useCycleTimeData.ts.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ppqtApi } from '@/lib/ppqt/ppqtApi';

const STALE = 5 * 60_000;

export const ppqtKeys = {
  all: ['ppqt'] as const,
  workcells: () => [...ppqtKeys.all, 'workcells'] as const,
  meta: (wc: string) => [...ppqtKeys.all, 'meta', wc] as const,
  summary: (wc: string) => [...ppqtKeys.all, 'summary', wc] as const,
  stations: (wc: string, area: string, period: string) => [...ppqtKeys.all, 'stations', wc, area, period] as const,
  stationAsm: (wc: string, area: string, period: string, station: string, top: number) =>
    [...ppqtKeys.all, 'stationAsm', wc, area, period, station, top] as const,
  assemblies: (wc: string, area: string, period: string, all: boolean) =>
    [...ppqtKeys.all, 'assemblies', wc, area, period, all] as const,
  inputs: (wc: string) => [...ppqtKeys.all, 'inputs', wc] as const,
};

export function usePpqtWorkcells() {
  return useQuery({ queryKey: ppqtKeys.workcells(), queryFn: ppqtApi.workcells, staleTime: STALE });
}

export function usePpqtMeta(wc: string) {
  return useQuery({ queryKey: ppqtKeys.meta(wc), queryFn: () => ppqtApi.meta(wc), staleTime: STALE, enabled: !!wc });
}

export function usePpqtSummary(wc: string) {
  return useQuery({ queryKey: ppqtKeys.summary(wc), queryFn: () => ppqtApi.summary(wc), staleTime: STALE, enabled: !!wc });
}

export function usePpqtStations(wc: string, area: string, period: string) {
  return useQuery({
    queryKey: ppqtKeys.stations(wc, area, period),
    queryFn: () => ppqtApi.stations(wc, area, period),
    staleTime: STALE, enabled: !!wc && !!area && !!period, placeholderData: keepPreviousData,
  });
}

export function usePpqtStationAssemblies(wc: string, area: string, period: string, station: string | null, top = 25) {
  return useQuery({
    queryKey: ppqtKeys.stationAsm(wc, area, period, station ?? '', top),
    queryFn: () => ppqtApi.stationAssemblies(wc, area, period, station!, top),
    staleTime: STALE, enabled: !!wc && !!area && !!period && !!station,
  });
}

export function usePpqtAssemblies(wc: string, area: string, period: string, all: boolean) {
  return useQuery({
    queryKey: ppqtKeys.assemblies(wc, area, period, all),
    queryFn: () => ppqtApi.assemblies(wc, area, period, all),
    staleTime: STALE, enabled: !!wc && !!area && !!period, placeholderData: keepPreviousData,
  });
}

export function usePpqtInputs(wc: string) {
  return useQuery({ queryKey: ppqtKeys.inputs(wc), queryFn: () => ppqtApi.inputs(wc), staleTime: STALE, enabled: !!wc });
}

/** POST /refresh, then drop every PPQT cache once the re-parse has had time to land. */
export function usePpqtRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ppqtApi.refresh,
    // ponytail: the parse takes ~8 s for a 12 MB workbook; a fixed wait beats a
    // status endpoint for now. Upgrade path: poll /health for a newer ingested_at.
    onSuccess: () => { setTimeout(() => qc.invalidateQueries({ queryKey: ppqtKeys.all }), 15_000); },
  });
}
