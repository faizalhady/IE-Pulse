/**
 * oleConstants.ts
 * ────────────────
 * Single source of truth for shared dropdown values across all OLE pages.
 *
 * Shifts: 1 = Normal  |  2 = Night  |  3 = Day
 * This standard applies to ALL pages — downtime, transfers, filters, OLE results.
 */

export const SHIFTS = [
  { value: '1', label: 'Normal' },
  { value: '2', label: 'Night' },
  { value: '3', label: 'Day' },
] as const;

export type ShiftValue = '1' | '2' | '3';

export function shiftLabel(value: string | number | undefined | null): string {
  const map: Record<string, string> = { '1': 'Normal', '2': 'Night', '3': 'Day' };
  return map[String(value)] ?? String(value ?? '—');
}

// ─── Date Formatter ─────────────────────────────────────────────────────────
// Single source of truth for display dates across all OLE tables.
// Accepts ISO strings (2026-03-01, 2026-03-01T00:00:00, etc.) → dd-mm-yyyy
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  // Take only the date part before any 'T'
  const datePart = value.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return value; // fallback: return as-is
  const [yyyy, mm, dd] = parts;
  return `${dd}-${mm}-${yyyy}`;
}

// ─── Workcell Logos ─────────────────────────────────────────────────────────
export const WORKCELL_LOGOS: Record<string, string> = {
  aop: '/workcell logo/aop.png',
  arista: '/workcell logo/Arista.png',
  asp: '/workcell logo/asp.jpg',
  beckmancoulter: '/workcell logo/bc.png',
  collins: '/workcell logo/collins.png',
  danaher: '/workcell logo/danaher.png',
  dyson: '/workcell logo/dyson.png',
  fortive: '/workcell logo/fortive.png',
  imed: '/workcell logo/imed.png',
  infinera: '/workcell logo/infinera.jpg',
  keyisght: '/workcell logo/keysight.png',
  keysight: '/workcell logo/keysight.png',
  lamresearch: '/workcell logo/lam_research.png',
  masimo: '/workcell logo/masimo.png',
  micron: '/workcell logo/micron.png',
  msi: '/workcell logo/msi.png',
  photonics: '/workcell logo/photonics.png',
  resmed: '/workcell logo/resmed.png',
  tellabs: '/workcell logo/tellabs.png',
  utas: '/workcell logo/collins.png',
  wabtec: '/workcell logo/wabtec.png',
};

// ─── OLE Target ────────────────────────────────────────────────────────────
export const OLE_TARGET = 61;

// ─── Status Utilities ───────────────────────────────────────────────────────
export type OleStatus = 'optimal' | 'warning' | 'critical' | 'idle';

export function getOleStatus(pct: number | null): OleStatus {
  if (pct === null) return 'idle';
  if (pct >= OLE_TARGET) return 'optimal';
  if (pct >= 45) return 'warning';
  return 'critical';
}

export function oleColor(pct: number | null): string {
  if (pct === null) return 'hsl(var(--muted-foreground))';
  if (pct >= OLE_TARGET) return '#22c55e'; // emerald
  if (pct >= 45) return '#f59e0b';         // amber
  return '#ef4444';                         // red
}

// ─── Badge Classes ──────────────────────────────────────────────────────────
export const STATUS_BADGE: Record<string, string> = {
  critical: 'bg-red-500/15    text-red-400    border-red-500/30',
  idle: 'bg-muted         text-muted-foreground border-border',
  optimal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
};

export const STATUS_LABEL: Record<string, string> = {
  critical: 'Below Target', idle: 'No Data', optimal: 'On Track', warning: 'At Risk',
};

export const OLE_COLOR: Record<string, string> = {
  critical: 'text-red-400', idle: 'text-muted-foreground', optimal: 'text-emerald-500', warning: 'text-amber-400',
};

export const OLE_BAR: Record<string, string> = {
  critical: 'bg-red-500', idle: 'bg-muted', optimal: 'bg-emerald-500', warning: 'bg-amber-400',
};

export const STAGE_BADGE: Record<string, string> = {
  Backend: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  BoxBuild: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  SMT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export const SMH_STATUS_BADGE: Record<string, string> = {
  MISSING_SMH: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
  NOT_IN_SMH_DB: 'bg-red-500/15    text-red-400    border-red-500/30',
  OK: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export const QUALITY_BADGE: Record<string, string> = {
  NO_INPUT_HOURS: 'bg-red-500/15    text-red-400    border-red-500/30',
  NO_OUTPUT_SMH: 'bg-red-500/15    text-red-400    border-red-500/30',
  OK: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  PARTIAL_SMH: 'bg-amber-500/15  text-amber-400  border-amber-500/30',
};
