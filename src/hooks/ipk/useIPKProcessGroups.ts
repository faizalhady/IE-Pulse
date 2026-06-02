/**
 * useIPKProcessGroups.ts — process group config for one workcell.
 *
 * Mock-backed for now. Future real endpoint:
 *   GET /api/ipk/workcells/:workcell/process-groups
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_PROCESS_GROUPS, type IPKProcessGroup } from '@/pages/ipk/mockIpkData';
import { ipkKeys } from './useIPKWorkcells';

export function useIPKProcessGroups(workcell: string) {
  return useQuery<IPKProcessGroup[]>({
    queryKey: ipkKeys.processGroups(workcell),
    queryFn: async () => MOCK_PROCESS_GROUPS, // → fetch(`${API}/api/ipk/workcells/${workcell}/process-groups`)
    enabled: Boolean(workcell),
    staleTime: 5 * 60_000,
  });
}
