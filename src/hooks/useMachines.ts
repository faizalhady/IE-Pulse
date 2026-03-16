import { useQuery } from '@tanstack/react-query';
import { fetchBay } from '@/lib/api';

export function useMachines(bayId: string) {
  return useQuery({
    queryKey: ['machines', bayId],
    queryFn: async () => {
      const bay = await fetchBay(bayId);
      return bay?.machines ?? [];
    },
  });
}
