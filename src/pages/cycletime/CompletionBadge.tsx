/**
 * CompletionBadge.tsx
 * ───────────────────
 * The 5-state completion badge for a top-runner model:
 *   complete · incomplete · no_data · unavailable · unverified
 * Replaces the old binary Has-data/No-data pill on the runner rows.
 */

import { cn } from '@/lib/utils';
import type { CompletionStatus } from '@/lib/cycle_time/cycleTimeApi';

// Status meaning (backend string → user label):
//   unavailable → "No data"     — model doesn't exist in IEDB at all
//   incomplete  → "Incomplete"  — in IEDB but cycle time empty OR partial (doesn't tally MES)
//   complete    → "Complete"    — in IEDB, all steps tally with MES + all have cycle time
//   unverified  → "Unverified"  — can't find the model's route from MES yet
//   no_data (legacy zero-CT rows) also → "Incomplete" (folded in)
export const COMPLETION_META: Record<CompletionStatus, { label: string; cls: string; hint: string }> = {
  complete:    { label: 'Complete',   cls: 'bg-emerald-500/15 text-emerald-600', hint: 'In IEDB — all steps tally with MES and every process has a cycle time.' },
  incomplete:  { label: 'Incomplete', cls: 'bg-amber-500/15 text-amber-600',     hint: 'In IEDB but cycle time is empty or only partial (doesn’t tally with the MES route).' },
  no_data:     { label: 'Incomplete', cls: 'bg-amber-500/15 text-amber-600',     hint: 'In IEDB but zero cycle time entered — counts as incomplete.' },
  unavailable: { label: 'No data',    cls: 'bg-red-500/15 text-red-500',         hint: 'Model doesn’t exist in IEDB at all.' },
  unverified:  { label: 'Unverified', cls: 'bg-muted text-muted-foreground',     hint: 'Can’t find the model’s route from MES yet (not built recently).' },
  non_mes:     { label: 'N/A',        cls: 'bg-slate-500/15 text-slate-500',     hint: 'Runs on a different shopfloor system — can’t be verified via MES.' },
};

/** Badge when there's no completion row for the model at all (mart not built / not a runner). */
const UNKNOWN = { label: '—', cls: 'bg-muted text-muted-foreground', hint: 'No completion status computed for this model.' };

export function CompletionBadge({
  status, size = 'md', className, onClick, extraHint,
}: {
  status?: CompletionStatus;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
  extraHint?: string;
}) {
  const meta = (status && COMPLETION_META[status]) || UNKNOWN;   // unknown status → never crash
  // Always a <span> (never a <button>) — these render inside the runner-row button,
  // and nested buttons are invalid HTML. stopPropagation so a badge click opens the
  // comparison without also firing the row's navigate.
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={extraHint ? `${meta.hint}\n${extraHint}` : meta.hint}
      className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase tracking-wide whitespace-nowrap',
        size === 'sm' ? 'text-[8px] px-1 py-px' : 'text-[9px] px-1.5 py-0.5',
        meta.cls,
        onClick && 'hover:ring-1 hover:ring-current/30 cursor-pointer',
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
