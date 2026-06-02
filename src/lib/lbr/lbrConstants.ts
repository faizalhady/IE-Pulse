/**
 * lbrConstants.ts
 * ────────────────
 * Single source of truth for LBR status thresholds, badge styles, labels, and
 * target values. Mirrors ppqtConstants.ts / ipkConstants.ts to keep the visual
 * language consistent across the IE Pulse platform.
 */

import type { LBRStatus, StationType, ElementCategory } from '@/pages/lbr/types';

// ─── Targets ────────────────────────────────────────────────────────────────
export const LBR_TARGET = 90;       // % — ideal line balance rate
export const LBR_TAKT_TARGET = 95;  // % of TAKT — bottleneck design goal

// ─── Status ─────────────────────────────────────────────────────────────────
/** Map an LBR % + study flag to a status. */
export function getLBRStatus(lbr: number, hasStudy: boolean): LBRStatus {
  if (!hasStudy) return 'never_studied';
  if (lbr < 85) return 'critical';
  if (lbr < 90) return 'warning';
  return 'healthy';
}

export const LBR_STATUS_BADGE: Record<LBRStatus, string> = {
  critical:      'bg-red-500/15     text-red-400     border-red-500/30',
  warning:       'bg-amber-500/15   text-amber-400   border-amber-500/30',
  healthy:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  never_studied: 'bg-muted          text-muted-foreground border-border',
};

export const LBR_STATUS_LABEL: Record<LBRStatus, string> = {
  critical: 'Critical', warning: 'Warning', healthy: 'Healthy', never_studied: 'Not Studied',
};

/** Bar fill color matching status. */
export const LBR_STATUS_BAR: Record<LBRStatus, string> = {
  critical:      'bg-red-500',
  warning:       'bg-amber-400',
  healthy:       'bg-emerald-500',
  never_studied: 'bg-muted-foreground/40',
};

/** LBR % text color (for coloring the figure itself — not a verdict pill). */
export function lbrTextClass(lbr: number, hasStudy = true): string {
  if (!hasStudy) return 'text-muted-foreground';
  if (lbr < 85) return 'text-red-400';
  if (lbr < 90) return 'text-amber-400';
  return 'text-emerald-400';
}

// ─── vs TAKT % coloring (bottleneck headroom — target ≤ 95%) ──────────────────
export function vsTaktTextClass(pct: number): string {
  if (pct > 100) return 'text-red-400';
  if (pct > LBR_TAKT_TARGET) return 'text-amber-400';
  return 'text-emerald-400';
}

// ─── Station type badge ───────────────────────────────────────────────────────
export const STATION_TYPE_BADGE: Record<StationType, string> = {
  operator:     'bg-blue-500/15   text-blue-400   border-blue-500/30',
  machine_only: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  shared:       'bg-amber-500/15  text-amber-400  border-amber-500/30',
};

export const STATION_TYPE_LABEL: Record<StationType, string> = {
  operator: 'Operator', machine_only: 'Machine', shared: 'Shared',
};

// ─── Work-element category badge ──────────────────────────────────────────────
export const ELEMENT_CATEGORY_BADGE: Record<ElementCategory, string> = {
  VA:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  NVA: 'bg-slate-500/15   text-slate-400   border-slate-500/30',
};

export const ELEMENT_CATEGORY_LABEL: Record<ElementCategory, string> = {
  VA: 'VA', NVA: 'NVA',
};

// ─── Yamazumi palette (work-element segments) ─────────────────────────────────
// VA elements in emerald shades, NVA in slate shades, machine-only stations violet.
export const YAMAZUMI_VA_COLORS  = ['#10b981', '#34d399', '#059669', '#6ee7b7', '#047857', '#a7f3d0'];
export const YAMAZUMI_NVA_COLORS = ['#64748b', '#94a3b8', '#475569', '#cbd5e1'];
export const YAMAZUMI_MACHINE_COLOR = '#8b5cf6';

/** Period options for the Home header selector. */
export const LBR_PERIOD_OPTIONS = ['Monthly', 'Weekly'];
