/**
 * UnderlineTabs.tsx
 * ──────────────────
 * The house tab bar — underline style as used on Pulse Reports, OLE Dashboard,
 * and the PPQT workcell page. One shared implementation so every module
 * renders tabs identically.
 *
 * Usage (inside a sticky header with `border-b border-border pb-0`):
 *
 *   const TABS = [
 *     { key: 'dash',   label: 'DASH',   icon: FileSpreadsheet },
 *     { key: 'report', label: 'Report', icon: Table2 },
 *   ] as const;
 *
 *   <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
 *
 * The row carries `-mb-px` so the active underline overlaps the header's
 * bottom border — place it as the LAST element of the bordered header.
 * `icon`, `tip` (hover tooltip) and `count` (badge) are optional per tab.
 */

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface UnderlineTab<K extends string = string> {
  key: K;
  label: string;
  icon?: LucideIcon;
  /** Hover tooltip describing the view. */
  tip?: string;
  /** Optional count badge after the label (hidden when 0/undefined). */
  count?: number;
}

export function UnderlineTabs<K extends string>({
  tabs, active, onChange, className,
}: {
  tabs: ReadonlyArray<UnderlineTab<K>>;
  active: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-0 -mb-px', className)}>
      {tabs.map(({ key, label, icon: Icon, tip, count }) => (
        <button
          key={key}
          type="button"
          title={tip}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
            active === key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
          {count != null && count > 0 && (
            <span className="ml-1 text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
              {count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
