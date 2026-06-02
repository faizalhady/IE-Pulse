/**
 * useLBRWorkcells.ts — portfolio workcell list for the LBR module.
 * Mock-backed. Future: GET /api/lbr/workcells
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_LBR_WORKCELLS } from '@/pages/lbr/mockLbrData';
import type { LBRWorkcell } from '@/pages/lbr/types';

export const lbrKeys = {
  all:        ['lbr'] as const,
  workcells:  () => [...lbrKeys.all, 'workcells'] as const,
  assemblies: (workcell: string) => [...lbrKeys.all, 'assemblies', workcell] as const,
  playbooks:  (workcell: string, assembly: string) => [...lbrKeys.all, 'playbooks', workcell, assembly] as const,
  playbook:   (workcell: string, assembly: string, playbook: string) =>
                [...lbrKeys.all, 'playbook', workcell, assembly, playbook] as const,
};

export function useLBRWorkcells() {
  return useQuery<LBRWorkcell[]>({
    queryKey: lbrKeys.workcells(),
    queryFn: async () => MOCK_LBR_WORKCELLS, // → fetch(`${API}/api/lbr/workcells`)
    staleTime: 5 * 60_000,
  });
}
