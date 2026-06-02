/**
 * useIPKMatrix.ts — demand-tier × process-group trolley lookup table.
 *
 * Mock-backed for now. Future real endpoint:
 *   GET /api/ipk/workcells/:workcell/matrix
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_MATRIX, type IPKMatrix } from '@/pages/ipk/mockIpkData';
import { ipkKeys } from './useIPKWorkcells';

export function useIPKMatrix(workcell: string) {
  return useQuery<IPKMatrix>({
    queryKey: ipkKeys.matrix(workcell),
    queryFn: async () => MOCK_MATRIX, // → fetch(`${API}/api/ipk/workcells/${workcell}/matrix`)
    enabled: Boolean(workcell),
    staleTime: 5 * 60_000,
  });
}
