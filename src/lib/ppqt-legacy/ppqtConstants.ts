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

// ═══ Dashboard 2 — capacity verdict (NEED vs HAVE) ═══════════════════════════
// The verdict is the SME's mental model from the PPQT Excel: per step, compare
// machines NEEDED (row 33) against machines AVAILABLE (row 32). A scope (line
// or workcell) is SHORT when any step needs more machines than it has, TIGHT
// when nothing is short but at least one step sits in the warning band, OK
// otherwise.
export type PPQTVerdict = 'short' | 'tight' | 'ok';

/** Map shortfall counts to a capacity verdict. */
export function getPPQTVerdict(machinesShort: number, stepsTight: number): PPQTVerdict {
  if (machinesShort > 0) return 'short';
  if (stepsTight > 0)    return 'tight';
  return 'ok';
}

export const PPQT_VERDICT_BADGE: Record<PPQTVerdict, string> = {
  short: 'bg-red-500/15     text-red-400     border-red-500/30',
  tight: 'bg-amber-500/15   text-amber-400   border-amber-500/30',
  ok:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export const PPQT_VERDICT_LABEL: Record<PPQTVerdict, string> = {
  short: 'SHORT',
  tight: 'TIGHT',
  ok:    'OK',
};

export const PPQT_VERDICT_TEXT: Record<PPQTVerdict, string> = {
  short: 'text-red-400',
  tight: 'text-amber-400',
  ok:    'text-emerald-400',
};

export const PPQT_VERDICT_DOT: Record<PPQTVerdict, string> = {
  short: 'bg-red-500',
  tight: 'bg-amber-400',
  ok:    'bg-emerald-500',
};

// ─── Period ──────────────────────────────────────────────────────────────────
// PPQT is a MONTHLY analysis — confirmed against the Jabil training package
// ("It is recommended to use the Monthly Demand") and the Wabtec workbook
// (DASH!C22 "Days in the Period of the Demand = 26"). One run = one month.

/** '2026-07' → 'Jul 2026'. Returns '' for empty/invalid input. */
export function monthLabel(ym: string | undefined): string {
  if (!ym) return '';
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym);
  if (!m) return ym;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// ─── Resource mode ───────────────────────────────────────────────────────────
// PPQT sizes two resources off the same demand and takt. Excel SMT!C40 labels
// the output "Resources NEEDED (DLs per Shift or Equipment)" — same formula,
// read as machines or as people depending on the process.
export type PPQTResourceMode = 'equipment' | 'people';

/** Per-mode wording so the grids/drawers read correctly in both modes. */
export const PPQT_RESOURCE_COPY: Record<PPQTResourceMode, {
  label: string;
  /** Noun for one unit of the resource, e.g. "machine". */
  unit: string;
  unitPlural: string;
  /** Column header for the CT that this mode charges. */
  ctHeader: string;
  /** What the "Have" column counts. */
  haveLabel: string;
  shortLabel: string;
}> = {
  equipment: {
    label: 'Equipment', unit: 'machine', unitPlural: 'machines',
    ctHeader: 'WCT (s)', haveLabel: 'Machines available', shortLabel: 'Machines short',
  },
  people: {
    label: 'Head Count', unit: 'operator', unitPlural: 'operators',
    ctHeader: 'Manual (s)', haveLabel: 'Headcount per station', shortLabel: 'People short',
  },
};
