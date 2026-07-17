import type { SortDir } from '@/hooks/shared/useSortable';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * Clickable table header cell for three-stage sorting. Shows a neutral
 * up/down icon when inactive, a solid up/down when this column is the active
 * sort. Pair with useSortable — pass `active={sort?.key === col.key}` and
 * `dir={sort?.dir}`.
 */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('py-2.5 flex items-center gap-1 text-left hover:text-foreground uppercase tracking-wider', className)}
    >
      {label}
      {active ? (
        dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-30" />
      )}
    </button>
  );
}
