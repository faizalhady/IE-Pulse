/**
 * ppqtConstants.ts
 * ─────────────────
 * Single source of truth for PPQT badge styles, status thresholds, and labels.
 * Mirrors the structure of oleConstants.ts to keep styling consistent across modules.
 */

import { PPQTStatus, ProcessArea, CTSource } from '@/pages/ppqt/types';

// ─── Utilisation thresholds ──────────────────────────────────────────────────
// These drive the status (bottleneck / warning / healthy / idle) and the
// utilisation bar color in the capacity table.
export const UTIL_BOTTLENECK = 100; // > 100% → bottleneck
export const UTIL_WARNING    = 90;  // 90-100% → warning
export const UTIL_HEALTHY    = 70;  // 70-90%  → healthy
//                              < 70%  → idle

/** Map a utilisation percentage to a PPQTStatus. */
export function getPPQTStatus(util: number): PPQTStatus {
  if (util > UTIL_BOTTLENECK) return 'bottleneck';
  if (util >= UTIL_WARNING)   return 'warning';
  if (util >= UTIL_HEALTHY)   return 'healthy';
  return 'idle';
}

// ─── Status badge classes ────────────────────────────────────────────────────
// Same shape as oleConstants STATUS_BADGE — keeps visual language consistent.
export const PPQT_STATUS_BADGE: Record<PPQTStatus, string> = {
  bottleneck: 'bg-red-500/15     text-red-400     border-red-500/30',
  warning:    'bg-amber-500/15   text-amber-400   border-amber-500/30',
  healthy:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  idle:       'bg-muted          text-muted-foreground border-border',
};

export const PPQT_STATUS_LABEL: Record<PPQTStatus, string> = {
  bottleneck: 'Bottleneck',
  warning:    'Warning',
  healthy:    'Healthy',
  idle:       'Idle',
};

// ─── Utilisation bar fill color (matches status) ────────────────────────────
export const PPQT_UTIL_BAR: Record<PPQTStatus, string> = {
  bottleneck: 'bg-red-500',
  warning:    'bg-amber-400',
  healthy:    'bg-emerald-500',
  idle:       'bg-muted-foreground/40',
};

export const PPQT_UTIL_TEXT: Record<PPQTStatus, string> = {
  bottleneck: 'text-red-400',
  warning:    'text-amber-400',
  healthy:    'text-emerald-500',
  idle:       'text-muted-foreground',
};

// ─── Process area badge (SMT / TH / BE) ──────────────────────────────────────
// Modeled on oleConstants STAGE_BADGE but with PPQT-specific areas.
export const PPQT_AREA_BADGE: Record<ProcessArea, string> = {
  SMT: 'bg-blue-500/15   text-blue-400   border-blue-500/30',
  TH:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  BE:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export const PPQT_AREA_LABEL: Record<ProcessArea, string> = {
  SMT: 'SMT',
  TH:  'TH',
  BE:  'BE',
};

// ─── CT source badge (MOST / SW / Est) ───────────────────────────────────────
// Green for MOST (most rigorous), blue for stopwatch, amber for estimate (risk flag).
export const PPQT_CT_SOURCE_BADGE: Record<CTSource, string> = {
  MOST: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  SW:   'bg-blue-500/15    text-blue-400    border-blue-500/30',
  Est:  'bg-amber-500/15   text-amber-400   border-amber-500/30',
};

export const PPQT_CT_SOURCE_LABEL: Record<CTSource, string> = {
  MOST: 'MOST',
  SW:   'Stopwatch',
  Est:  'Estimate',
};

// ─── Gap text color ──────────────────────────────────────────────────────────
export function gapTextClass(gap: number): string {
  if (gap > 0) return 'text-red-400 font-semibold';
  if (gap < 0) return 'text-emerald-400';
  return 'text-muted-foreground';
}
