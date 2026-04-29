/**
 * useOleData.ts — React hooks for OLE Analyzer backend
 *
 * Mirrors the useMesData.ts polling pattern exactly.
 * Each hook fetches on mount with optional polling.
 *
 * Usage:
 *   const { data: summary, loading } = useOleSummary();
 *   const { data: results } = useOleResults({ workcell: 'AOP1' });
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  oleApi,
  OleHealth,
  OlePaidHours,
  OleProduction,
  OleResult,
  OleSummary,
  OleWeeklyResult,
  OlePredictionResult,
  OleWorkcellConfig,
  SmhLookup,
  SmhStatus,
} from '@/lib/oleApi';

// ─── Generic polling hook (same as useMesData) ────────────────────────────────

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
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

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

// ─── OLE hooks ────────────────────────────────────────────────────────────────

/** Health check — fetch once */
export function useOleHealth() {
  return usePolling<OleHealth>(
    () => oleApi.health.check(),
    0
  );
}

/** Workcell config list — fetch once */
export function useOleWorkcells() {
  return usePolling<OleWorkcellConfig[]>(
    () => oleApi.workcells.list(),
    0
  );
}

/** OLE summary per workcell — refreshes every 5 minutes */
export function useOleSummary(params?: {
  date_from?: string;
  date_to?: string;
  plant?: string;
}) {
  return usePolling<OleSummary[]>(
    () => oleApi.ole.summary(params),
    5 * 60 * 1000,
    [params?.date_from, params?.date_to, params?.plant]
  );
}

/** Full OLE results — filterable, refreshes every 5 minutes */
export function useOleResults(params?: {
  workcell?: string;
  date_from?: string;
  date_to?: string;
  shift?: number;
}) {
  return usePolling<OleResult[]>(
    () => oleApi.ole.list(params),
    5 * 60 * 1000,
    [params?.workcell, params?.date_from, params?.date_to, params?.shift]
  );
}

/** Raw MES production data — fetch once */
export function useOleProduction(params?: {
  workcell?: string;
  date_from?: string;
  date_to?: string;
}) {
  return usePolling<OleProduction[]>(
    () => oleApi.production.list(params),
    0,
    [params?.workcell, params?.date_from, params?.date_to]
  );
}

/** Raw eTMS paid hours data — fetch once */
export function useOlePaidHours(params?: {
  workcell?: string;
  date_from?: string;
  date_to?: string;
}) {
  return usePolling<OlePaidHours[]>(
    () => oleApi.paidHours.list(params),
    0,
    [params?.workcell, params?.date_from, params?.date_to]
  );
}

/** SMH lookup — fetch once */
export function useSmhLookup(params?: { workcell?: string; assembly?: string }) {
  return usePolling<SmhLookup[]>(
    () => oleApi.smh.list(params),
    0,
    [params?.workcell, params?.assembly]
  );
}

/** SMH assembly status — fetch once */
export function useSmhStatus(params?: {
  workcell?: string;
  status?: SmhStatus['smh_status'];
}) {
  return usePolling<SmhStatus[]>(
    () => oleApi.smh.status(params),
    0,
    [params?.workcell, params?.status]
  );
}

/** Weekly OLE aggregates — projection engine input, fetch once */
export function useOleWeekly(params?: {
  workcell?: string;
  sample_from?: string;
  sample_to?: string;
  plant?: string;
}) {
  return usePolling<OleWeeklyResult[]>(
    () => oleApi.ole.weekly(params),
    0,
    [params?.workcell, params?.sample_from, params?.sample_to, params?.plant]
  );
}

/** Advanced forecasting via statsmodels — fetch once */
export function useOlePredictions(params: {
  workcell: string;
  projection_weeks?: number;
}, skip = false) {
  return usePolling<OlePredictionResult[]>(
    async () => skip ? [] : oleApi.ole.predict(params),
    0,
    [params.workcell, params.projection_weeks, skip]
  );
}
