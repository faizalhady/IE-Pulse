/**
 * VaNvaChartKit.tsx
 * ──────────────────
 * The chrome every VA/NVA chart sits in, plus the two tiles the dashboard
 * repeats. One file so the card header, the empty state and the KPI tile are
 * written once instead of twenty-five times.
 */

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

/** Card shell: title strip, optional hint, fixed-height plot area. */
export function ChartCard({
  title, hint, height = 260, children, className, actions, span,
}: {
  title: string;
  hint?: string;
  height?: number;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  /** Tailwind col-span helper, e.g. 'xl:col-span-2'. */
  span?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden flex flex-col', span, className)}>
      <div className="px-4 py-2.5 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">{title}</p>
          {hint && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="p-3 flex-1 min-h-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Same shell, but for content that is not a recharts tree (tables, legends). */
export function PanelCard({
  title, hint, children, className, actions, span,
}: {
  title: string; hint?: string; children: ReactNode; className?: string;
  actions?: ReactNode; span?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden flex flex-col', span, className)}>
      <div className="px-4 py-2.5 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">{title}</p>
          {hint && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/** Headline number tile. */
export function KpiTile({
  label, value, sub, icon: Icon, tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const toneClass = {
    neutral: 'text-foreground',
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    accent: 'text-sky-400',
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      </div>
      <p className={cn('mt-1 text-2xl font-mono font-black tabular-nums leading-none', toneClass)}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

/** Small legend swatch row — recharts' own <Legend> is too tall for these cards. */
export function Swatches({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Shown in place of a chart when the slice has nothing to plot. */
export function NoData({ text = 'No data' }: { text?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{text}</div>
  );
}
