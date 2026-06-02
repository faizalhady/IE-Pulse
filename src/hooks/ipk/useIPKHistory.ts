/**
 * useIPKHistory.ts — past simulation runs for one workcell.
 *
 * Mock-backed for now. Future real endpoint:
 *   GET /api/ipk/workcells/:workcell/history
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_HISTORY, type IPKHistoryRun } from '@/pages/ipk/mockIpkData';
import { ipkKeys } from './useIPKWorkcells';

export function useIPKHistory(workcell: string) {
  return useQuery<IPKHistoryRun[]>({
    queryKey: ipkKeys.history(workcell),
    queryFn: async () => MOCK_HISTORY, // → fetch(`${API}/api/ipk/workcells/${workcell}/history`)
    enabled: Boolean(workcell),
    staleTime: 5 * 60_000,
  });
}
