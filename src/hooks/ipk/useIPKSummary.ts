/**
 * useIPKSummary.ts — per-process-group summary rows for one workcell's latest run.
 *
 * Mock-backed for now. Future real endpoint:
 *   GET /api/ipk/workcells/:workcell/summary
 */

import { useQuery } from '@tanstack/react-query';
import { MOCK_SUMMARY_ROWS, type IPKSummaryRow } from '@/pages/ipk/mockIpkData';
import { ipkKeys } from './useIPKWorkcells';

export function useIPKSummary(workcell: string) {
  return useQuery<IPKSummaryRow[]>({
    queryKey: ipkKeys.summary(workcell),
    queryFn: async () => MOCK_SUMMARY_ROWS, // → fetch(`${API}/api/ipk/workcells/${workcell}/summary`)
    enabled: Boolean(workcell),
    staleTime: 5 * 60_000,
  });
}
