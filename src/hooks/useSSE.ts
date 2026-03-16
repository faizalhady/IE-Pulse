import { useQuery } from '@tanstack/react-query';
import { fetchBays } from '@/lib/api';
import type { Bay } from '@/types';

/**
 * Stub: In production this would use Server-Sent Events.
 * For now it polls mock data every 10 seconds.
 */
export function useSSE(bayId?: string) {
  return useQuery<Bay[]>({
    queryKey: ['sse', bayId],
    queryFn: fetchBays,
    refetchInterval: 10_000,
    select: (data) => (bayId ? data.filter((b) => b.id === bayId) : data),
  });
}
