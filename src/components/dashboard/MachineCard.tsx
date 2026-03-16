import { Machine } from '@/types';
import { statusBg, statusText } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';

interface RadialRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  status: Machine['status'];
}

function RadialRing({ value, size = 64, strokeWidth = 6, status }: RadialRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const colorMap = {
    optimal: 'hsl(var(--status-optimal))',
    warning: 'hsl(var(--status-warning))',
    critical: 'hsl(var(--status-critical))',
    idle: 'hsl(var(--status-idle))',
  };

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={colorMap[status]} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

interface MachineCardProps {
  machine: Machine;
  onClick?: () => void;
}

export default function MachineCard({ machine, onClick }: MachineCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border bg-card p-3 text-left hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-ring w-full"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <RadialRing value={machine.uph} status={machine.status} />
          <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-mono font-bold rotate-0', statusText(machine.status))}>
            {machine.uph}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground truncate">{machine.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', statusBg(machine.status))} />
            <span className="text-xs text-muted-foreground">WIP: {machine.wipCount}</span>
          </div>
          {/* Sparkline */}
          <div className="flex items-end gap-px mt-2 h-4">
            {machine.sparklineData.map((v, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t bg-primary/40"
                style={{ height: `${(v / 100) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
