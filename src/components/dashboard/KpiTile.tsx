import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiTileProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  className?: string;
}

export default function KpiTile({ label, value, icon, trend, className }: KpiTileProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 flex items-start gap-3', className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-bold font-mono text-card-foreground">{value}</span>
        {trend && <span className="text-xs text-muted-foreground mt-0.5">{trend}</span>}
      </div>
    </div>
  );
}
