/**
 * useIPKWorkcells.ts — portfolio workcell list for the IPK module.
 *
 * Mock-backed for now. Future real endpoint:
 *   GET /api/ipk/workcells
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_WORKCELLS, type IPKWorkcell } from '@/pages/ipk/mockIpkData';

export const ipkKeys = {
  all:           ['ipk'] as const,
  workcells:     () => [...ipkKeys.all, 'workcells'] as const,
  summary:       (workcell: string) => [...ipkKeys.all, 'summary', workcell] as const,
  history:       (workcell: string) => [...ipkKeys.all, 'history', workcell] as const,
  matrix:        (workcell: string) => [...ipkKeys.all, 'matrix', workcell] as const,
  processGroups: (workcell: string) => [...ipkKeys.all, 'process-groups', workcell] as const,
};

export function useIPKWorkcells() {
  return useQuery<IPKWorkcell[]>({
    queryKey: ipkKeys.workcells(),
    queryFn: async () => MOCK_WORKCELLS, // → fetch(`${API}/api/ipk/workcells`).then(r => r.json())
    staleTime: 5 * 60_000,
  });
}
