import { Bay } from '@/types';
import { statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const STATUS_BORDER: Record<Bay['status'], string> = {
  optimal: 'border-l-status-optimal',
  warning: 'border-l-status-warning',
  critical: 'border-l-status-critical',
  idle: 'border-l-status-idle',
};

interface BayCardProps {
  bay: Bay;
  onClick: () => void;
}

export default function BayCard({ bay, onClick }: BayCardProps) {
  // Build sparkline data from last 5 hourly records
  const sparkData = bay.hourlyData.slice(-5).map((h, i) => ({ v: h.actual, i }));

  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border bg-card text-left transition-all hover:shadow-md hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden w-full',
        'border-l-4',
        STATUS_BORDER[bay.status],
      )}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-card-foreground">{bay.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn('text-3xl font-bold font-mono', statusText(bay.status))}>
              {bay.productivity}%
            </span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{bay.model}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2">
          <Stat label="PLAN" value={bay.plan} />
          <Stat label="CUMM" value={bay.cumm} />
          <Stat label="DELTA" value={bay.delta} negative />
        </div>

        {/* Sparkline */}
        <div className="h-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  const isNeg = negative && value < 0;
  const isPos = negative && value > 0;
  return (
    <div className="text-center">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-mono font-semibold', isNeg ? 'text-destructive' : isPos ? 'text-status-optimal' : 'text-card-foreground')}>
        {negative ? (isNeg ? `${value}↓` : isPos ? `+${value}↑` : value) : value}
      </p>
    </div>
  );
}
