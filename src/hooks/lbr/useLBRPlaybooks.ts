/**
 * useLBRPlaybooks.ts — all playbooks for one assembly.
 * Mock-backed. Future: GET /api/lbr/workcells/:workcell/assemblies/:assembly/playbooks
 */

import { useQuery } from '@tanstack/react-query';
import { getLBRPlaybooksFor } from '@/pages/lbr/mockLbrData';
import type { LBRPlaybook } from '@/pages/lbr/types';
import { lbrKeys } from './useLBRWorkcells';

export function useLBRPlaybooks(workcell: string, assembly: string) {
  return useQuery<LBRPlaybook[]>({
    queryKey: lbrKeys.playbooks(workcell, assembly),
    queryFn: async () => getLBRPlaybooksFor(assembly),
    enabled: Boolean(workcell && assembly),
    staleTime: 5 * 60_000,
  });
}
