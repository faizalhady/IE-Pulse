import { useQuery } from '@tanstack/react-query';
import { fetchBay, fetchBays } from '@/lib/api';

export function useBay(id: string) {
  return useQuery({
    queryKey: ['bay', id],
    queryFn: () => fetchBay(id),
  });
}

export function useBays() {
  return useQuery({
    queryKey: ['bays'],
    queryFn: fetchBays,
  });
}
