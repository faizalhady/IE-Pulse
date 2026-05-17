/**
 * useOleData.ts — React hooks for OLE Analyzer backend
 *
 * PERFORMANCE DESIGN:
 *   - All data is fetched ONCE in full (no filter params sent to backend)
 *   - Filtering is done IN-BROWSER via useMemo in the consuming component
 *   - Module-level cache prevents re-fetching on unmount/remount within session
 *   - Polling only for primary datasets (summary + ole results)
 *
 * DO NOT pass filter params here — filter in the component with useMemo.
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
  IndirectLaborRow,
  IndirectLaborEntity,
  MhDistributionRow,
  ShiftOperator,
} from '@/lib/ole/oleApi';
import { TEMP_EXCLUDED_WORKCELLS } from '@/lib/ole/oleConstants';

const isExcluded = (workcell: string) => TEMP_EXCLUDED_WORKCELLS.includes(workcell);

// ─── Module-level in-memory cache ────────────────────────────────────────────
// Survives component unmount/remount — cleared only on full page refresh.
const CACHE = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return entry.data as T;
}
function setCached<T>(key: string, data: T): void {
  CACHE.set(key, { data, ts: Date.now() });
}
/**
 * Fire-and-forget prefetch of the heavy OLE datasets so they're warm in the
 * module cache by the time the user navigates to a page that needs them.
 * Safe to call multiple times — already-cached datasets are skipped.
 */
export function prefetchOleData(): void {
  const warm = <T>(key: string, fetcher: () => Promise<T>) => {
    if (getCached<T>(key) !== null) return;
    fetcher().then(d => setCached(key, d)).catch(() => { /* swallow — hook will retry */ });
  };
  warm('ole_results',    () => oleApi.ole.list());
  warm('ole_summary',    () => oleApi.ole.summary());
  warm('ole_weekly',     () => oleApi.ole.weekly());
  warm('workcells',      () => oleApi.workcells.list());
  warm('indirect_labor', () => oleApi.indirectLabor.list());
  warm('mh_distribution', () => oleApi.mhDistribution.list());
}

export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) { CACHE.clear(); return; }
  for (const k of Array.from(CACHE.keys())) {
    if (k.startsWith(keyPrefix)) CACHE.delete(k);
  }
}

// ─── Generic cache-first fetch hook ──────────────────────────────────────────

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  pollIntervalMs = 0,
): UseFetchResult<T> {
  const cached                = getCached<T>(key);
  const [data, setData]       = useState<T | null>(cached);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [error, setError]     = useState<string | null>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef            = useRef(true);

  const fetch_ = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const result = await fetcher();
      if (!mountedRef.current) return;
      setCached(key, result);
      setData(result);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    const hit = getCached<T>(key);
    if (hit !== null) {
      setData(hit);
      setLoading(false);
    } else {
      fetch_(true);
    }
    if (pollIntervalMs > 0) {
      timerRef.current = setInterval(() => fetch_(false), pollIntervalMs);
    }
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pollIntervalMs]);

  const refetch = useCallback(() => { CACHE.delete(key); fetch_(true); }, [key, fetch_]);
  return { data, loading, error, refetch };
}

// ─── OLE hooks ─────────────────────────────────────────────────────────────────
// All hooks fetch ALL data — no filter params. Filter with useMemo in component.

/** Health check */
export function useOleHealth() {
  return useCachedFetch<OleHealth>('health', () => oleApi.health.check(), 0);
}

/** Workcell config list */
export function useOleWorkcells() {
  const r = useCachedFetch<OleWorkcellConfig[]>('workcells', () => oleApi.workcells.list(), 0);
  return { ...r, data: r.data?.filter(w => !isExcluded(w.workcell)) ?? null };
}

/** OLE summary per workcell — poll every 5 min */
export function useOleSummary() {
  const r = useCachedFetch<OleSummary[]>('ole_summary', () => oleApi.ole.summary(), 5 * 60 * 1000);
  return { ...r, data: r.data?.filter(w => !isExcluded(w.workcell)) ?? null };
}

/** Full OLE shift rows — poll every 5 min */
export function useOleResults() {
  const r = useCachedFetch<OleResult[]>('ole_results', () => oleApi.ole.list(), 5 * 60 * 1000);
  return { ...r, data: r.data?.filter(w => !isExcluded(w.workcell)) ?? null };
}

/** Raw MES production rows */
export function useOleProduction() {
  return useCachedFetch<OleProduction[]>('ole_production', () => oleApi.production.list(), 0);
}

/** Raw eTMS paid-hours rows */
export function useOlePaidHours() {
  return useCachedFetch<OlePaidHours[]>('ole_paid_hours', () => oleApi.paidHours.list(), 0);
}

/** SMH lookup — workcell/assembly specific */
export function useSmhLookup(params?: { workcell?: string; assembly?: string }) {
  const key = `smh_lookup:${params?.workcell ?? ''}:${params?.assembly ?? ''}`;
  return useCachedFetch<SmhLookup[]>(key, () => oleApi.smh.list(params), 0);
}

/** SMH assembly status */
export function useSmhStatus() {
  return useCachedFetch<SmhStatus[]>('smh_status', () => oleApi.smh.status(), 0);
}

/** Weekly OLE aggregates */
export function useOleWeekly() {
  const r = useCachedFetch<OleWeeklyResult[]>('ole_weekly', () => oleApi.ole.weekly(), 0);
  return { ...r, data: r.data?.filter(w => !isExcluded(w.workcell)) ?? null };
}

/**
 * All operators for a single workcell — one fetch on page mount.
 * Powers the shift drawer without a per-click roundtrip.
 */
export function useWorkcellOperators(workcell: string | null) {
  const key = workcell ? `wc_ops:${workcell}` : 'wc_ops:idle';
  return useCachedFetch<ShiftOperator[]>(
    key,
    async () => workcell ? oleApi.shiftOperators.list({ workcell }) : [],
    0,
  );
}

/**
 * Operators for ONE shift — lazy fetch, used as fallback when bulk isn't
 * available yet. Cached per (workcell, date, shift) so re-opening is instant.
 */
export function useShiftOperators(
  params: { workcell: string; date: string; shift: number } | null,
) {
  const key = params ? `shift_ops:${params.workcell}|${params.date}|${params.shift}` : 'shift_ops:idle';
  return useCachedFetch<ShiftOperator[]>(
    key,
    async () => params ? oleApi.shiftOperators.list(params) : [],
    0,
  );
}

/** Man-hours distribution — per-shift loss buckets (NVA / Lunch / MFG DT / DT / Lost) */
export function useMhDistribution() {
  return useCachedFetch<MhDistributionRow[]>('mh_distribution', () => oleApi.mhDistribution.list(), 5 * 60 * 1000);
}

/** Indirect labor (warehouses, support pools) — daily/shift rows */
export function useIndirectLabor() {
  return useCachedFetch<IndirectLaborRow[]>('indirect_labor', () => oleApi.indirectLabor.list(), 5 * 60 * 1000);
}

/** Indirect labor entity config */
export function useIndirectLaborEntities() {
  return useCachedFetch<IndirectLaborEntity[]>('indirect_labor_entities', () => oleApi.indirectLabor.entities(), 0);
}

/** ARIMA/HW predictions — cached per workcell */
export function useOlePredictions(
  params: { workcell: string; projection_weeks?: number },
  skip = false,
) {
  const key = `ole_predict:${params.workcell}:${params.projection_weeks ?? 3}`;
  return useCachedFetch<OlePredictionResult[]>(
    key,
    async () => skip ? [] : oleApi.ole.predict(params),
    0,
  );
}
