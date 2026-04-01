/**
 * useMesData.ts — React hooks for MES API data
 *
 * Each hook:
 *  - Fetches on mount
 *  - Polls every `interval` ms (default varies by data type)
 *  - Returns { data, loading, error, refetch }
 *
 * Usage:
 *   const { data: workcells, loading } = useWorkcells();
 *   const { data: production } = useProductionByBay(68, 'P1');
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  ApiAssembly,
  ApiPlant,
  ApiProductionByAssembly,
  ApiProductionByBay,
  ApiProductionLatest,
  ApiProductionSummary,
  ApiWorkcell,
  ApiWorkcellBay,
  ApiWorkcellSummary,
} from '@/lib/api';

// ─── Generic polling hook ─────────────────────────────────────────────────────

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number,
  deps: unknown[] = []
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setLoading(true);
    fetch_();
    if (interval > 0) {
      timerRef.current = setInterval(fetch_, interval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch_, interval]);

  return { data, loading, error, refetch: fetch_ };
}

// ─── Workcell hooks ───────────────────────────────────────────────────────────

/** All workcells — refreshes every 5 minutes */
export function useWorkcells() {
  return usePolling<ApiWorkcell[]>(
    () => api.workcells.list(),
    5 * 60 * 1000
  );
}

/** Bays for a workcell — refreshes every 5 minutes */
export function useWorkcellBays(workcell_id: number, plant?: string) {
  return usePolling<ApiWorkcellBay[]>(
    () => api.workcells.bays(workcell_id, plant),
    5 * 60 * 1000,
    [workcell_id, plant]
  );
}

/** Workcell summary (stats + plants list) */
export function useWorkcellSummary(workcell_id: number, plant?: string) {
  return usePolling<ApiWorkcellSummary>(
    () => api.workcells.summary(workcell_id, plant),
    5 * 60 * 1000,
    [workcell_id, plant]
  );
}

/** Workcells active in a plant */
export function useWorkcellsByPlant(plant: string) {
  return usePolling<{ customer_id: number; workcell_name: string; bay_count: number }[]>(
    () => api.workcells.byPlant(plant),
    5 * 60 * 1000,
    [plant]
  );
}

// ─── Production hooks ─────────────────────────────────────────────────────────

/** Bay-level output summary — refreshes every 30 seconds */
export function useProductionByBay(workcell_id?: number, plant?: string) {
  return usePolling<ApiProductionByBay[]>(
    () => api.production.byBay(workcell_id, plant),
    30 * 1000,
    [workcell_id, plant]
  );
}

/** Per-bay aggregated summary — fetch once, no polling */
export function useProductionSummary(workcell_id?: number, plant?: string) {
  return usePolling<ApiProductionSummary[]>(
    () => api.production.summary(workcell_id, plant),
    0,           // 0 = fetch once only, no interval
    [workcell_id, plant]
  );
}

/** Live activity feed — refreshes every 15 seconds */
export function useProductionLatest(workcell_id?: number, plant?: string, limit = 20) {
  return usePolling<ApiProductionLatest[]>(
    () => api.production.latest(workcell_id, plant, limit),
    15 * 1000,
    [workcell_id, plant, limit]
  );
}

/** Assembly-level output — refreshes every 60 seconds */
export function useProductionByAssembly(workcell_id?: number, bay?: string) {
  return usePolling<ApiProductionByAssembly[]>(
    () => api.production.byAssembly(workcell_id, bay),
    60 * 1000,
    [workcell_id, bay]
  );
}

// ─── Assembly hooks ──────────────────────────────────────────────────────────

/** All assemblies for a workcell — fetch once, no polling */
export function useAssemblies(workcell_id: number | null) {
  return usePolling<ApiAssembly[]>(
    async () => {
      if (workcell_id == null) return [];
      const result = await api.assemblies.list(workcell_id);
      // API may return array directly OR a wrapped object { data: [...] }
      if (Array.isArray(result)) return result;
      const r = result as any;
      if (Array.isArray(r?.data))    return r.data;
      if (Array.isArray(r?.items))   return r.items;
      if (Array.isArray(r?.results)) return r.results;
      // fallback: return empty
      return [];
    },
    0,
    [workcell_id]
  );
}

// ─── Location hooks ───────────────────────────────────────────────────────────

/** Plant list with step counts — refreshes every 10 minutes */
export function usePlants() {
  return usePolling<ApiPlant[]>(
    () => api.locations.plants(),
    10 * 60 * 1000
  );
}
