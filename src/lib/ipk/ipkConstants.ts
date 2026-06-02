/**
 * ipkConstants.ts
 * ────────────────
 * Single source of truth for IPK status thresholds, badge styles, labels, and
 * variance coloring. Mirrors the structure of ppqtConstants.ts / oleConstants.ts
 * to keep the visual language consistent across modules.
 */

export type IPKStatus = 'critical' | 'warning' | 'healthy' | 'never_run';

/** Map a variance (trolleys short) + run-history flag to an IPKStatus. */
export function getIPKStatus(variance: number, hasRun: boolean): IPKStatus {
  if (!hasRun) return 'never_run';
  if (variance > 5) return 'critical';
  if (variance > 0) return 'warning';
  return 'healthy';
}

// ─── Status badge classes ──────────────────────────────────────────────────────
export const IPK_STATUS_BADGE: Record<IPKStatus, string> = {
  critical:  'bg-red-500/15     text-red-400     border-red-500/30',
  warning:   'bg-amber-500/15   text-amber-400   border-amber-500/30',
  healthy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  never_run: 'bg-muted          text-muted-foreground border-border',
};

export const IPK_STATUS_LABEL: Record<IPKStatus, string> = {
  critical:  'Critical',
  warning:   'Warning',
  healthy:   'Healthy',
  never_run: 'Not Run',
};

/** Bar fill color matching the status. */
export const IPK_STATUS_BAR: Record<IPKStatus, string> = {
  critical:  'bg-red-500',
  warning:   'bg-amber-400',
  healthy:   'bg-emerald-500',
  never_run: 'bg-muted-foreground/40',
};

// ─── Variance cell coloring ─────────────────────────────────────────────────────
// Positive variance = trolleys SHORT = bad (red). Zero/negative = covered (green).
export const IPK_VARIANCE_CLASS = (v: number) =>
  v > 0 ? 'text-red-400 bg-red-500/10'
    : v < 0 ? 'text-emerald-400 bg-emerald-500/10'
    : 'text-muted-foreground';

/** Plain text variant (no background) — for inline figures in headers/cards. */
export const IPK_VARIANCE_TEXT = (v: number) =>
  v > 0 ? 'text-red-400' : v < 0 ? 'text-emerald-400' : 'text-muted-foreground';

// ─── Simulation source badge (Excel / Wizard / Manual) ──────────────────────────
export type IPKSource = 'Excel' | 'Wizard' | 'Manual';

export const IPK_SOURCE_BADGE: Record<IPKSource, string> = {
  Excel:  'bg-blue-500/15    text-blue-400    border-blue-500/30',
  Wizard: 'bg-violet-500/15  text-violet-400  border-violet-500/30',
  Manual: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

// ─── Calc-type options (process group calculation modes) ─────────────────────────
export const IPK_CALC_TYPES = [
  'normal',
  'double_pass',
  'piece_to_batch',
  'batch_to_piece',
  'batch_to_batch',
  'two_line_input',
] as const;

export type IPKCalcType = typeof IPK_CALC_TYPES[number];

export const IPK_CALC_TYPE_LABEL: Record<IPKCalcType, string> = {
  normal:         'Normal',
  double_pass:    'Double Pass',
  piece_to_batch: 'Piece → Batch',
  batch_to_piece: 'Batch → Piece',
  batch_to_batch: 'Batch → Batch',
  two_line_input: 'Two-Line Input',
};
