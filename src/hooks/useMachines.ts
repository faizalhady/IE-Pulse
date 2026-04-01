// useMachines.ts — machines as a concept replaced by live production steps per bay.
// Use useProductionLatest from useMesData.ts instead:
//   const { data } = useProductionLatest(customer_id, bay)
// This stub is kept so any legacy import doesn't hard-crash the app.
export function useMachines(_bayId: string) {
  return { data: [], loading: false, error: null };
}
