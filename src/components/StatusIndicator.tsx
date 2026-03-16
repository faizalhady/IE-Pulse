import { StatusLevel } from '@/types';
import { cn } from '@/lib/utils';

const statusMap: Record<StatusLevel, string> = {
  optimal: 'bg-status-optimal',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical animate-pulse-status',
  idle: 'bg-status-idle',
};

const statusTextMap: Record<StatusLevel, string> = {
  optimal: 'text-status-optimal',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
  idle: 'text-status-idle',
};

const statusDotMap: Record<StatusLevel, string> = {
  optimal: 'bg-status-optimal',
  warning: 'bg-status-warning',
  critical: 'bg-status-critical animate-pulse-status',
  idle: 'bg-status-idle',
};

export function statusBg(status: StatusLevel) {
  return statusMap[status];
}

export function statusText(status: StatusLevel) {
  return statusTextMap[status];
}

export function StatusDot({ status, className }: { status: StatusLevel; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 rounded-full', statusDotMap[status], className)} />;
}
