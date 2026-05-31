/**
 * useCycleTimeData.ts — React Query hooks for Cycle Time backend
 *
 * Design notes
 *  - PER-CUSTOMER FETCH: /data is fetched scoped to a single customer.
 *    Each fetched customer cached for the session. No big upfront payload.
 *  - REFRESH STATUS POLLING: while a refresh is running, we poll status every
 *    5s and auto-invalidate the data caches when it transitions to success.
 *
 * Pattern intentionally diverges from useOleData.ts (which uses a hand-rolled
 * Map cache). React Query gives us SWR, refetch-on-focus, devtools, and
 * mutation invalidation for free. If we like it after a sprint we'll
 * backport OLE.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import {
  cycleTimeApi,
  CycleTimeAliasMap,
  CycleTimeDataFilters,
  CycleTimeLivePage,
  CycleTimePivotedRow,
  CycleTimeRawFilters,
} from '@/lib/cycle_time/cycleTimeApi';

// ─── Query keys (single source of truth) ─────────────────────────────────────

export const ctKeys = {
  all:        ['cycle_time'] as const,
  health:     () => [...ctKeys.all, 'health'] as const,
  customers:  () => [...ctKeys.all, 'customers'] as const,
  aliases:    (customer?: string) => [...ctKeys.all, 'aliases', customer ?? ''] as const,
  data:       (filters: CycleTimeDataFilters) => [...ctKeys.all, 'data', filters] as const,
  raw:        (filters: CycleTimeRawFilters)  => [...ctKeys.all, 'raw', filters]  as const,
  profile:    (customer: string) => [...ctKeys.all, 'profile', customer] as const,
  live:       (customer: string, pageSize: number, subWc?: string) =>
                [...ctKeys.all, 'live', customer, pageSize, subWc ?? ''] as const,
  status:     () => [...ctKeys.all, 'refresh', 'status'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useCycleTimeHealth() {
  return useQuery({
    queryKey: ctKeys.health(),
    queryFn:  cycleTimeApi.health.get,
    staleTime: 30_000,
  });
}

export function useCycleTimeCustomers() {
  return useQuery({
    queryKey: ctKeys.customers(),
    queryFn:  cycleTimeApi.customers.list,
    staleTime: 60 * 60_000, // 1h — customer list rarely changes
  });
}

/** alias → process code + lines, scoped to a customer (so tooltips can show
 *  "the friendly column header 'MA 1' maps to API process 'Assembly 1'"). */
export function useCycleTimeAliases(customer: string | undefined) {
  return useQuery({
    queryKey: ctKeys.aliases(customer),
    queryFn:  () => cycleTimeApi.aliases.list(customer),
    enabled:  Boolean(customer),
    staleTime: 30 * 60_000,
  });
}

/**
 * Per-customer pivoted rows. Pass `customer` to scope the fetch.
 * Returns no data (enabled=false) until a customer is selected.
 */
export function useCycleTimeData(filters: CycleTimeDataFilters) {
  return useQuery({
    queryKey: ctKeys.data(filters),
    queryFn:  () => cycleTimeApi.data.list(filters),
    enabled:  Boolean(filters.customer),
    staleTime: 5 * 60_000,
  });
}

/**
 * Live mode — infinite-scroll pagination directly off the IEDB API.
 * Each fetched page lands in the cache; callers concat .pages[*].rows.
 *
 * Returns a uniform shape:
 *   {
 *     rows:      CycleTimePivotedRow[]   ← all pages concatenated
 *     aliasMap:  CycleTimeAliasMap       ← merged across pages
 *     totalCount: number
 *     ...react-query fields (fetchNextPage, hasNextPage, isFetchingNextPage…)
 *   }
 */
export function useCycleTimeLive(
  customer: string | undefined,
  pageSize: number = 500,
  subWorkcenter?: string,
) {
  const q = useInfiniteQuery<
    CycleTimeLivePage,
    Error,
    { pages: CycleTimeLivePage[]; pageParams: number[] },
    ReturnType<typeof ctKeys.live>,
    number
  >({
    queryKey: ctKeys.live(customer ?? '', pageSize, subWorkcenter),
    enabled:  Boolean(customer),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      cycleTimeApi.live.page({
        customer:       customer!,
        page:           pageParam,
        page_size:      pageSize,
        sub_workcenter: subWorkcenter,
      }),
    getNextPageParam: (last) => (last.has_next ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });

  // Flatten + merge: rows concatenated, alias_map merged (later pages win).
  const rows = useMemo<CycleTimePivotedRow[]>(
    () => (q.data?.pages ?? []).flatMap((p) => p.rows),
    [q.data],
  );
  const aliasMap = useMemo<CycleTimeAliasMap>(() => {
    const out: CycleTimeAliasMap = {};
    for (const page of q.data?.pages ?? []) {
      for (const [alias, info] of Object.entries(page.alias_map)) out[alias] = info;
    }
    return out;
  }, [q.data]);
  const totalCount = q.data?.pages?.[0]?.total_count ?? 0;

  return {
    ...q,
    rows,
    aliasMap,
    totalCount,
  };
}

/**
 * Workcell analytical breakdown (counts, by-line, by-assembly). Scoped to one
 * customer; skips the fetch until a customer is selected. Powers the
 * Breakdown tab.
 */
export function useCycleTimeProfile(customer: string | undefined) {
  return useQuery({
    queryKey: ctKeys.profile(customer ?? ''),
    queryFn:  () => cycleTimeApi.profile.get(customer!),
    enabled:  Boolean(customer),
    staleTime: 5 * 60_000,
  });
}

/** Paginated raw rows (one row per process). Used for detail/drawer views. */
export function useCycleTimeRaw(filters: CycleTimeRawFilters) {
  return useQuery({
    queryKey: ctKeys.raw(filters),
    queryFn:  () => cycleTimeApi.raw.list(filters),
    enabled:  Boolean(filters.customer),
    staleTime: 5 * 60_000,
  });
}

/** Refresh status query. By default polls every 5s ONLY while state=running. */
export function useCycleTimeRefreshStatus(opts: { pollMs?: number } = {}) {
  const pollMs = opts.pollMs ?? 5_000;
  return useQuery({
    queryKey: ctKeys.status(),
    queryFn:  cycleTimeApi.refresh.status,
    refetchInterval: q => (q.state.data?.state === 'running' ? pollMs : false),
    refetchIntervalInBackground: true,
  });
}

/**
 * Trigger a refresh. The mutation just kicks off the BG task (202).
 * Watch the status with useCycleTimeRefreshStatus() for progress.
 */
export function useCycleTimeRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: 'full' | 'incremental' = 'incremental') =>
      cycleTimeApi.refresh.trigger(mode),
    onSuccess: () => {
      // Status will flip to 'running' on next poll — trigger that immediately.
      qc.invalidateQueries({ queryKey: ctKeys.status() });
    },
  });
}

/**
 * Auto-invalidate the data + health caches whenever a refresh COMPLETES.
 * Mount this once at the page root (CycleTimeHome). Watches the status
 * query; when state transitions running → success, invalidates everything
 * so the table re-fetches fresh rows.
 */
export function useInvalidateOnRefreshComplete() {
  const qc = useQueryClient();
  const status = useCycleTimeRefreshStatus();
  const prevStateRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevStateRef.current;
    const cur = status.data?.state ?? null;
    if (prev === 'running' && cur === 'success') {
      qc.invalidateQueries({ queryKey: ctKeys.all });
    }
    prevStateRef.current = cur;
  }, [status.data?.state, qc]);
}
