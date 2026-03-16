import { useParams } from 'react-router-dom';
import { useBay } from '@/hooks/useBay';
import { useMachines } from '@/hooks/useMachines';
import MachineCard from '@/components/dashboard/MachineCard';
import { statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function BayDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bay, isLoading } = useBay(id!);
  const { data: machines = [] } = useMachines(id!);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!bay) return <p className="text-muted-foreground">Bay not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-4">
        <h2 className="text-xl font-semibold text-foreground">{bay.name}</h2>
        <span className={cn('text-3xl font-mono font-bold', statusText(bay.status))}>{bay.productivity}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} />
        ))}
      </div>
    </div>
  );
}
