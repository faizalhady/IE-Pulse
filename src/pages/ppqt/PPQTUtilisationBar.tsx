/**
 * PPQTUtilisationBar.tsx
 * ───────────────────────
 * Inline utilisation bar for the PPQT capacity table.
 *
 * Shows a horizontal bar that fills proportionally to `util` (capped visually at 100%),
 * with the percentage label to the right. Color-coded by status threshold.
 *
 * This is a PPQT-specific component — OLE has a similar Progress bar
 * but not with this overflow + dual-color (bar + text) behavior.
 */

import { cn } from '@/lib/utils';
import { getPPQTStatus, PPQT_UTIL_BAR, PPQT_UTIL_TEXT } from '@/lib/ppqt/ppqtConstants';

interface PPQTUtilisationBarProps {
  util: number;       // utilisation %, can exceed 100
  className?: string;
}

export default function PPQTUtilisationBar({ util, className }: PPQTUtilisationBarProps) {
  const status = getPPQTStatus(util);
  const barWidth = Math.min(util, 100);  // bar caps visually at 100%
  const barClass = PPQT_UTIL_BAR[status];
  const textClass = PPQT_UTIL_TEXT[status];

  return (
    <div className={cn('flex items-center gap-2 min-w-[110px]', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barClass)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={cn('font-mono text-xs font-semibold tabular-nums min-w-[38px] text-right', textClass)}>
        {util}%
      </span>
    </div>
  );
}
