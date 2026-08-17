/**
 * vanvaConstants.ts
 * ──────────────────
 * Single source of truth for VA/NVA thresholds, badge styles, labels and
 * chart colours. Mirrors lbrConstants.ts / ipkConstants.ts so the visual
 * language stays consistent across IE Pulse.
 *
 * Never inline a threshold or a badge class in a page — import from here.
 */

import type { MaturityStageKey, VaNvaStatus } from '@/pages/vanva/types';

// ─── Targets ────────────────────────────────────────────────────────────────
/** The workbook's own simulation target: NVA ≤ 20% of total DL (columns P/Q). */
export const NVA_TARGET = 0.20;
/** Slider bounds on the Simulation tab. */
export const NVA_TARGET_MIN = 0.05;
export const NVA_TARGET_MAX = 0.50;

// ─── Status ─────────────────────────────────────────────────────────────────
/**
 * Bands are anchored on the Sheet2 ladder, not invented:
 *   ≤ 25%  → inside the long-term (lean) NVA band → healthy
 *   ≤ 35%  → inside the mid-term band            → warning
 *   > 35%  → short-term or baseline              → critical
 */
export function getVaNvaStatus(nvaRatio: number | null): VaNvaStatus {
  if (nvaRatio === null || Number.isNaN(nvaRatio)) return 'unknown';
  if (nvaRatio <= 0.25) return 'healthy';
  if (nvaRatio <= 0.35) return 'warning';
  return 'critical';
}

export const VANVA_STATUS_BADGE: Record<VaNvaStatus, string> = {
  healthy:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning:  'bg-amber-500/15   text-amber-400   border-amber-500/30',
  critical: 'bg-red-500/15     text-red-400     border-red-500/30',
  unknown:  'bg-muted          text-muted-foreground border-border',
};

export const VANVA_STATUS_LABEL: Record<VaNvaStatus, string> = {
  healthy: 'Lean', warning: 'Watch', critical: 'Critical', unknown: 'No data',
};

export const VANVA_STATUS_BAR: Record<VaNvaStatus, string> = {
  healthy:  'bg-emerald-500',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
  unknown:  'bg-muted-foreground/40',
};

/** Hex equivalents of the bar classes — recharts cannot read Tailwind classes. */
export const VANVA_STATUS_HEX: Record<VaNvaStatus, string> = {
  healthy: '#10b981', warning: '#f59e0b', critical: '#ef4444', unknown: '#64748b',
};

/** Colour the NVA % figure itself (not a verdict pill). */
export function nvaTextClass(nvaRatio: number | null): string {
  return {
    healthy: 'text-emerald-400', warning: 'text-amber-400',
    critical: 'text-red-400', unknown: 'text-muted-foreground',
  }[getVaNvaStatus(nvaRatio)];
}

/** Over/under sizing: more heads than the sizing calls for is the bad direction. */
export function sizingGapClass(gap: number | null): string {
  if (gap === null) return 'text-muted-foreground';
  if (gap > 0) return 'text-red-400';
  if (gap < 0) return 'text-emerald-400';
  return 'text-muted-foreground';
}

// ─── Maturity ladder (Sheet2) ───────────────────────────────────────────────
/** Which rung of the Sheet2 ladder an NVA % currently sits on. */
export function getMaturityStage(nvaRatio: number | null): MaturityStageKey | null {
  if (nvaRatio === null || Number.isNaN(nvaRatio)) return null;
  if (nvaRatio <= 0.25) return 'long_term';
  if (nvaRatio <= 0.35) return 'mid_term';
  if (nvaRatio <= 0.45) return 'short_term';
  return 'baseline';
}

export const STAGE_LABEL: Record<MaturityStageKey, string> = {
  baseline: 'Baseline', short_term: 'Short-term', mid_term: 'Mid-term', long_term: 'Lean',
};

export const STAGE_HEX: Record<MaturityStageKey, string> = {
  baseline: '#ef4444', short_term: '#f97316', mid_term: '#f59e0b', long_term: '#10b981',
};

export const STAGE_BADGE: Record<MaturityStageKey, string> = {
  baseline:   'bg-red-500/15     text-red-400     border-red-500/30',
  short_term: 'bg-orange-500/15  text-orange-400  border-orange-500/30',
  mid_term:   'bg-amber-500/15   text-amber-400   border-amber-500/30',
  long_term:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

// ─── Chart palette ──────────────────────────────────────────────────────────
export const VA_HEX = '#10b981';   // value-add — emerald, the platform primary
export const NVA_HEX = '#ef4444';  // non-value-add — red, this is the waste
export const TARGET_HEX = '#f59e0b';
export const PPQT_HEX = '#8b5cf6'; // the unused-in-the-workbook NVA source
export const ACTUAL_HEX = '#38bdf8';

/** Categorical series colours for donut / treemap / radar. */
export const VANVA_PALETTE = [
  '#10b981', '#38bdf8', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6',
  '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#84cc16', '#64748b',
];

/** Shared recharts tooltip chrome — every chart in this module uses it. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, fontSize: 11, padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  labelStyle: { color: 'hsl(var(--muted-foreground))', marginBottom: 4, fontWeight: 500 },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

export const AXIS_TICK = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
export const GRID_STROKE = 'hsl(var(--border))';

// ─── Formatting ─────────────────────────────────────────────────────────────
export const pct = (v: number | null, dp = 1) =>
  v === null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(dp)}%`;

export const dl = (v: number | null, dp = 1) =>
  v === null || Number.isNaN(v) ? '—' : v.toFixed(dp).replace(/\.0$/, '');

export const signed = (v: number | null, dp = 1) =>
  v === null || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(dp).replace(/\.0$/, '')}`;

/** Who may upload a new workbook. UI convenience only — see useAccessLevel. */
export const UPLOAD_MIN_LEVEL = 'admin' as const;
