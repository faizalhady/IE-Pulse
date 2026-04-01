// useSSE.ts — SSE/polling stub. fetchBays was removed from api.ts.
// Real-time data now comes from useProductionLatest in useMesData.ts.
// This stub is kept so legacy imports don't crash.
export function useSSE(_bayId?: string) {
  return { data: [], isLoading: false, error: null };
}
