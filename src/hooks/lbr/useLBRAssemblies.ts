/**
 * useLBRAssemblies.ts — assemblies for one workcell.
 * Mock-backed. Future: GET /api/lbr/workcells/:workcell/assemblies
 */

import { useQuery } from '@tanstack/react-query';
import { getLBRAssembliesFor } from '@/pages/lbr/mockLbrData';
import type { LBRAssembly } from '@/pages/lbr/types';
import { lbrKeys } from './useLBRWorkcells';

export function useLBRAssemblies(workcell: string) {
  return useQuery<LBRAssembly[]>({
    queryKey: lbrKeys.assemblies(workcell),
    queryFn: async () => getLBRAssembliesFor(workcell),
    enabled: Boolean(workcell),
    staleTime: 5 * 60_000,
  });
}
