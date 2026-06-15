/**
 * fsmsConstants.ts
 * ─────────────────
 * Single source of truth for FSMS status thresholds, badge styles, labels,
 * chart colours, and number formatters. Mirrors ipkConstants.ts / ppqtConstants.ts
 * so the visual language stays consistent across modules. Never inline these.
 */

import type { BatchStatus, BuEntryStatus, SpaceType } from '@/types/fsms';

/** Optimal utilisation benchmark used across the analysis charts. */
export const UTIL_TARGET_PCT = 90;

// ─── Batch (CONSO approval) status ──────────────────────────────────────────────
export const BATCH_STATUS_BADGE: Record<BatchStatus, string> = {
  Pending:    'bg-amber-500/15   text-amber-400   border-amber-500/30',
  Approved:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected:   'bg-red-500/15     text-red-400     border-red-500/30',
  Superseded: 'bg-muted          text-muted-foreground border-border',
};

// ─── BU pipeline status ─────────────────────────────────────────────────────────
export const BU_STATUS_BADGE: Record<BuEntryStatus, string> = {
  Draft:                 'bg-muted          text-muted-foreground border-border',
  Pending:               'bg-amber-500/15   text-amber-400   border-amber-500/30',
  PendingSiteSME:        'bg-blue-500/15    text-blue-400    border-blue-500/30',
  PendingAcknowledgment: 'bg-violet-500/15  text-violet-400  border-violet-500/30',
  Approved:              'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected:              'bg-red-500/15     text-red-400     border-red-500/30',
};

// ─── Space type ─────────────────────────────────────────────────────────────────
export const SPACE_TYPE_BADGE: Record<SpaceType, string> = {
  'SMT':             'bg-blue-500/15   text-blue-400   border-blue-500/30',
  'DF':              'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'Temporary - SMT': 'bg-blue-500/10   text-blue-300   border-blue-500/20',
  'Temporary - DF':  'bg-violet-500/10 text-violet-300 border-violet-500/20',
};

// ─── Plant / location colour (Summary directory LOCATION column) ────────────────
// Legacy semantics: BK = green, P1 = yellow, P2 = a third colour.
export const LOCATION_BADGE: Record<string, string> = {
  BK: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  P1: 'bg-amber-500/20   text-amber-300   border-amber-500/40',
  P2: 'bg-sky-500/20     text-sky-300     border-sky-500/40',
  P3: 'bg-violet-500/20  text-violet-300  border-violet-500/40',
};

/** Resolve a location string (possibly multi-plant like 'P1/BK') to a badge class. */
export const locationBadge = (loc: string) =>
  LOCATION_BADGE[loc.split('/')[0]?.trim()] ?? 'bg-muted text-muted-foreground border-border';

// ─── Utilisation status vs the target ───────────────────────────────────────────
export type UtilStatus = 'over' | 'tight' | 'healthy' | 'low';

/** Map a utilisation % to a status (over capacity / tight / healthy / low). */
export function getUtilStatus(pct: number): UtilStatus {
  if (pct > 100) return 'over';
  if (pct >= UTIL_TARGET_PCT) return 'tight';
  if (pct >= 60) return 'healthy';
  return 'low';
}

export const UTIL_STATUS_TEXT: Record<UtilStatus, string> = {
  over:    'text-red-400',
  tight:   'text-amber-400',
  healthy: 'text-emerald-400',
  low:     'text-muted-foreground',
};

// ─── Variance cell coloring (forecast − actual) ─────────────────────────────────
// Negative variance = actual exceeds forecast = over-built (red). Positive = headroom (green).
export const varianceText = (v: number) =>
  v < 0 ? 'text-red-400' : v > 0 ? 'text-emerald-400' : 'text-muted-foreground';

// ─── Chart palette (recharts) ───────────────────────────────────────────────────
export const FSMS_CHART = {
  utilization: 'hsl(var(--primary))', // emerald
  surplus:     '#eab308',             // yellow
  temporary:   '#3b82f6',             // blue
  forecast:    '#3b82f6',
  actual:      'hsl(var(--primary))',
  over:        '#ef4444',             // red — over capacity
  target:      '#B8860B',             // dashed 90% target
} as const;

// ─── Formatters ─────────────────────────────────────────────────────────────────
export const fmtSqft = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export const fmtPct = (n: number | null | undefined) => `${(n ?? 0).toFixed(2)}%`;

export const fmtUsd = (n: number | null | undefined) =>
  n == null ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
