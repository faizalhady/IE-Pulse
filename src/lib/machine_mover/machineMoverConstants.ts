/**
 * machineMoverConstants.ts — status logic, badges, and picklists for the
 * Machine Mover module. House rule: status colours + thresholds live here,
 * NEVER inline in pages (see CLAUDE.md UI conventions).
 */

// ─── Job lifecycle ────────────────────────────────────────────────────────────
// A move "Job" is an order: Created → Approved → Ongoing → Completed.
// Rejected is a terminal off-track state reachable from Created.
export type JobStatus = 'Created' | 'Approved' | 'Ongoing' | 'Completed' | 'Rejected';

/** All statuses, in filter order (All is added by the page). */
export const JOB_STATUSES: JobStatus[] = ['Created', 'Approved', 'Ongoing', 'Completed', 'Rejected'];

/** The happy-path lifecycle used by the drawer timeline (Rejected sits outside). */
export const LIFECYCLE: JobStatus[] = ['Created', 'Approved', 'Ongoing', 'Completed'];

/** Badge (border + bg + text) per status. */
export const STATUS_BADGE: Record<JobStatus, string> = {
  Created:   'bg-amber-500/15   text-amber-400   border-amber-500/30',
  Approved:  'bg-sky-500/15     text-sky-400     border-sky-500/30',
  Ongoing:   'bg-violet-500/15  text-violet-400  border-violet-500/30',
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected:  'bg-red-500/15     text-red-400     border-red-500/30',
};

/** Solid dot colour per status (timelines, list dots). */
export const STATUS_DOT: Record<JobStatus, string> = {
  Created:   '#f59e0b',
  Approved:  '#0ea5e9',
  Ongoing:   '#8b5cf6',
  Completed: '#10b981',
  Rejected:  '#ef4444',
};

// ─── Approval model — two PIC sign-offs gate a Created job ──────────────────────
export const APPROVER_ROLES = ['Department PIC', 'Facilities PIC'] as const;
export type ApproverRole = typeof APPROVER_ROLES[number];

// ─── Picklists (mock — swap for backend lookups later) ─────────────────────────
export const DEPARTMENTS = ['ME', 'IE', 'Production', 'Facilities', 'Engineering', 'Logistics'];

export const LOCATIONS = [
  'P1 — SMT Line 1', 'P1 — SMT Line 2', 'P1 — Chamber Room', 'P1 — Test Area',
  'P2 — DF Line 1', 'P2 — DF Line 2', 'P2 — Warehouse',
  'BK — Level 1', 'BK — Level 2', 'BK — Staging Bay',
];

/** Doors a machine can enter/exit through. */
export const DOORS = [
  'P1 Main Shutter', 'P1 Chamber Shutter', 'P1 Loading Bay',
  'P2 Main Shutter', 'P2 Side Door', 'P2 Loading Bay',
  'BK Dock 1', 'BK Dock 2',
];

export const LOGISTICS = ['Internal team', 'Lorry (external)', 'Forklift', 'Crane + Lorry'];

// ─── Formatters ────────────────────────────────────────────────────────────────
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
