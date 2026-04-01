// useBay.ts — re-exports from useMesData so any page importing useBay still works.
// fetchBay / fetchBays never existed in api.ts — this replaces the stale stub.
export { useWorkcellBays as useBays, useProductionByBay as useBay } from './useMesData';
