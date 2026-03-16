import { Bay } from '@/types';
import { statusBg, statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';

interface BayCardProps {
  bay: Bay;
  onClick: () => void;
}

export default function BayCard({ bay, onClick }: BayCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border bg-card text-left transition-all hover:shadow-md hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden w-full"
    >
      {/* Status header bar */}
      <div className={cn('h-1.5', statusBg(bay.status))} />

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-card-foreground">{bay.name}</p>
            <p className="text-xs text-muted-foreground">{bay.model}</p>
          </div>
          <span className={cn('text-3xl font-bold font-mono', statusText(bay.status))}>
            {bay.productivity}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2">
          <Stat label="PLAN" value={bay.plan} />
          <Stat label="CUMM" value={bay.cumm} />
          <Stat label="DELTA" value={bay.delta} negative />
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-mono font-semibold', negative && value < 0 ? 'text-destructive' : 'text-card-foreground')}>
        {value}
      </p>
    </div>
  );
}
