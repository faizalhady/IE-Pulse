import { useParams } from 'react-router-dom';
import { useSSE } from '@/hooks/useSSE';
import { statusBg, statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';

export default function KioskMode() {
  const { bayId } = useParams<{ bayId: string }>();
  const { data: bayList = [] } = useSSE(bayId);
  const bay = bayList[0];

  if (!bay) return <div className="flex h-screen items-center justify-center bg-background text-muted-foreground text-2xl">Loading...</div>;

  return (
    <div className="flex h-screen flex-col bg-background p-8 gap-8">
      {/* Top: Bay name + productivity */}
      <div className="text-center">
        <p className="text-2xl font-semibold text-foreground">{bay.name}</p>
        <p className={cn('text-7xl font-mono font-bold mt-2', statusText(bay.status))}>
          {bay.productivity}%
        </p>
        <p className="text-lg text-muted-foreground mt-1">{bay.model}</p>
      </div>

      {/* Machine grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 flex-1 content-start">
        {bay.machines.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-lg p-4 text-center',
              statusBg(m.status),
              m.status === 'critical' && 'animate-pulse-status'
            )}
          >
            <p className="text-sm font-bold text-primary-foreground truncate">{m.name}</p>
            <p className="text-3xl font-mono font-bold text-primary-foreground mt-1">{m.uph}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
