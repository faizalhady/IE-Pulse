/**
 * useLBRPlaybook.ts — full detail (stations + work elements) for one playbook.
 * Mock-backed. Future: GET /api/lbr/.../playbooks/:playbook
 */

import { useQuery } from '@tanstack/react-query';
import { getLBRPlaybook } from '@/pages/lbr/mockLbrData';
import type { LBRPlaybook } from '@/pages/lbr/types';
import { lbrKeys } from './useLBRWorkcells';

export function useLBRPlaybook(workcell: string, assembly: string, playbook: string) {
  return useQuery<LBRPlaybook | undefined>({
    queryKey: lbrKeys.playbook(workcell, assembly, playbook),
    queryFn: async () => getLBRPlaybook(assembly, playbook),
    enabled: Boolean(workcell && assembly && playbook),
    staleTime: 5 * 60_000,
  });
}
