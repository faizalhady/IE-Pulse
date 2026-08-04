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

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import {
  cycleTimeApi,
  CycleTimeAliasMap,
  CycleTimeDataFilters,
  CycleTimeDataPage,
  CycleTimeLivePage,
  CycleTimePivotedRow,
  CycleTimeRawFilters,
} from '@/lib/cycle_time/cycleTimeApi';

// ─── Query keys (single source of truth) ─────────────────────────────────────

export const ctKeys = {
  all:        ['cycle_time'] as const,
  health:     () => [...ctKeys.all, 'health'] as const,
  customers:  () => [...ctKeys.all, 'customers'] as const,
  coverage:   () => [...ctKeys.all, 'coverage'] as const,
  customerStatus: (site: string) => [...ctKeys.all, 'customerStatus', site] as const,
  aliases:    (customer?: string) => [...ctKeys.all, 'aliases', customer ?? ''] as const,
  assemblies: (customer?: string, line?: string, assembly?: string) =>
                [...ctKeys.all, 'assemblies', customer ?? '', line ?? '', assembly ?? ''] as const,
  assemblyList: (customer?: string, line?: string) =>
                [...ctKeys.all, 'assemblyList', customer ?? '', line ?? ''] as const,
  assemblyBuilds: (customer?: string, assembly?: string, line?: string) =>
                [...ctKeys.all, 'assemblyBuilds', customer ?? '', assembly ?? '', line ?? ''] as const,
  data:       (filters: CycleTimeDataFilters) => [...ctKeys.all, 'data', filters] as const,
  dataPage:   (filters: CycleTimeDataFilters, pageSize: number) =>
                [...ctKeys.all, 'dataPage', filters, pageSize] as const,
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

/** Per-customer with-data assembly counts + freshness (one request for the league table). */
export function useCycleTimeCoverage() {
  return useQuery({
    queryKey: ctKeys.coverage(),
    queryFn:  cycleTimeApi.coverage.list,
    staleTime: 5 * 60_000,
  });
}

/** Per-customer assembly coverage + measurement-method breakdown from the IEDB
 *  CustomerStatus report. Failures are non-fatal — the league table degrades to
 *  its /coverage figures when this is unavailable. */
export function useCycleTimeCustomerStatus(site = 'pen') {
  return useQuery({
    queryKey: ctKeys.customerStatus(site),
    queryFn:  () => cycleTimeApi.customerStatus.list(site),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Assemblies for one customer that have NO cycle-time data. Fetched live from
 *  IEDB via the backend (fast — two lightweight /api/Assemblies calls). */
export function useCycleTimeNoDataAssemblies(customer: string | undefined) {
  return useQuery({
    queryKey: [...ctKeys.all, 'noDataAssemblies', customer ?? ''] as const,
    queryFn:  ({ signal }) => cycleTimeApi.noDataAssemblies.list(customer!, signal),
    enabled:  Boolean(customer),
    staleTime: 5 * 60_000,
  });
}

/** Top runners per plant (plant dashboard). One request.
 *  mode: 'historical' = units built (24mo) | 'projection' = MES demand (~4wk) | 'planner' = Excel demand (~13wk). */
export function useCycleTimePlantRunners(top = 50, plants = 3, mode: 'historical' | 'projection' | 'planner' = 'historical') {
  return useQuery({
    queryKey: [...ctKeys.all, 'plantRunners', top, plants, mode] as const,
    queryFn:  () => cycleTimeApi.plantRunners.list(top, plants, mode),
    staleTime: 30 * 60_000,
  });
}

/** Completion-status summary for all top-runners (one fetch → lookup by customer+assembly). */
export function useCycleTimeCompletion() {
  return useQuery({
    queryKey: [...ctKeys.all, 'completion'] as const,
    queryFn:  () => cycleTimeApi.completion.list(),
    staleTime: 30 * 60_000,
  });
}

/** Demand-ranked completion for the Incompletion Report page.
 *  Filtering is done client-side from one payload: the whole list is ~3.9k rows
 *  and the picker changes constantly, so re-fetching per selection would be far
 *  more traffic than sending it once. */
export function useCycleTimeCompletionDemand() {
  return useQuery({
    queryKey: [...ctKeys.all, 'completionDemand'] as const,
    queryFn:  () => cycleTimeApi.completion.demand(),
    staleTime: 30 * 60_000,
  });
}

/** MES actual route vs IEDB route for one model (the side-by-side comparison). */
export function useCycleTimeCompletionSteps(customer: string | undefined, assembly: string | undefined) {
  return useQuery({
    queryKey: [...ctKeys.all, 'completionSteps', customer ?? '', assembly ?? ''] as const,
    queryFn:  ({ signal }) => cycleTimeApi.completion.steps(customer!, assembly!, signal),
    enabled:  Boolean(customer && assembly),
    staleTime: 30 * 60_000,
  });
}

/** Per-model LBR + IPK breakdown (lines, stations, buffers) — the drawer proof. */
export function useCycleTimeLineMetrics(customer: string | undefined, assembly: string | undefined) {
  return useQuery({
    queryKey: [...ctKeys.all, 'lineMetrics', customer ?? '', assembly ?? ''] as const,
    queryFn:  ({ signal }) => cycleTimeApi.completion.lineMetrics(customer!, assembly!, signal),
    enabled:  Boolean(customer && assembly),
    staleTime: 30 * 60_000,
  });
}

/** IEDB with-data / no-data assembly name sets for one customer (3-way badge). */
export function useCycleTimeAssemblyCatalog(customer: string | undefined) {
  return useQuery({
    queryKey: [...ctKeys.all, 'assemblyCatalog', customer ?? ''] as const,
    queryFn:  () => cycleTimeApi.assemblyCatalog.list(customer!),
    enabled:  Boolean(customer),
    staleTime: 30 * 60_000,
  });
}

/** Dominant plant per customer (from the MES buildplan). One request for the league table. */
export function useCycleTimeCustomerPlants() {
  return useQuery({
    queryKey: [...ctKeys.all, 'customerPlants'] as const,
    queryFn:  () => cycleTimeApi.customerPlants.list(),
    staleTime: 30 * 60_000,
  });
}

/** Runner ranking (units built per assembly, 24-mo) for one workcell, from the
 *  eBuild/MES mart. Used to prioritise no-data assemblies on the Incompletion Report. */
export function useCycleTimeRunners(customer: string | undefined, mode: 'historical' | 'projection' | 'planner' = 'historical') {
  return useQuery({
    queryKey: [...ctKeys.all, 'runners', customer ?? '', mode] as const,
    queryFn:  () => cycleTimeApi.runners.list(customer!, 'top', undefined, mode),
    enabled:  Boolean(customer),
    staleTime: 30 * 60_000,
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
 * DB-mode pivoted rows with server-side pagination + infinite scroll. The first
 * page paints almost instantly; more pages load as the user scrolls. Returns a
 * flattened `rows` plus `totalCount` (mirrors useCycleTimeLive's shape so the
 * table can treat DB and Live modes identically).
 */
export function useCycleTimeDataInfinite(filters: CycleTimeDataFilters, pageSize = 300) {
  const q = useInfiniteQuery<
    CycleTimeDataPage,
    Error,
    { pages: CycleTimeDataPage[]; pageParams: number[] },
    ReturnType<typeof ctKeys.dataPage>,
    number
  >({
    queryKey: ctKeys.dataPage(filters, pageSize),
    enabled:  Boolean(filters.customer),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      cycleTimeApi.data.page({ ...filters, page: pageParam, page_size: pageSize }),
    getNextPageParam: (last) => (last.has_next ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });

  const rows = useMemo<CycleTimePivotedRow[]>(
    () => (q.data?.pages ?? []).flatMap((p) => p.rows),
    [q.data],
  );
  const totalCount = q.data?.pages?.[0]?.total ?? 0;

  return { ...q, rows, totalCount };
}

/**
 * DB-mode pivoted rows for a SINGLE page (classic prev/next pagination). Shows
 * one page at a time; keeps the previous page visible while the next loads.
 */
export function useCycleTimeDataPage(filters: CycleTimeDataFilters, page: number, pageSize = 300) {
  return useQuery({
    queryKey: [...ctKeys.dataPage(filters, pageSize), page] as const,
    queryFn:  () => cycleTimeApi.data.page({ ...filters, page, page_size: pageSize }),
    enabled:  Boolean(filters.customer),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Per-assembly aggregate for Breakdown B (server-computed), optionally scoped
 *  to one line and/or a single assembly (drawer header). */
export function useCycleTimeAssemblies(customer: string | undefined, line?: string, assembly?: string) {
  return useQuery({
    queryKey: ctKeys.assemblies(customer, line, assembly),
    queryFn:  () => cycleTimeApi.assemblies.list(customer!, line || undefined, assembly || undefined),
    enabled:  Boolean(customer),
    staleTime: 5 * 60_000,
  });
}

/** Lightweight collapsed-row list for the Assemblies page — one cheap grouped
 *  scan of raw (identity + stage footprint, no cycle-time math). */
export function useCycleTimeAssemblyList(customer: string | undefined, line?: string) {
  return useQuery({
    queryKey: ctKeys.assemblyList(customer, line),
    queryFn:  () => cycleTimeApi.assemblyList.list(customer!, line || undefined),
    enabled:  Boolean(customer),
    staleTime: 5 * 60_000,
  });
}

/** Per-build process detail for ONE assembly — fetched lazily when its row is
 *  expanded. Long rows the component groups into builds. */
export function useCycleTimeAssemblyBuilds(customer: string | undefined, assembly: string | undefined, line?: string) {
  return useQuery({
    queryKey: ctKeys.assemblyBuilds(customer, assembly, line),
    queryFn:  () => cycleTimeApi.assemblyBuilds.list(customer!, assembly!, line || undefined),
    enabled:  Boolean(customer && assembly),
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
