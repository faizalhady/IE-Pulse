/**
 * cycleTimeConstants.ts
 * ─────────────────────
 * The cycle-time completion vocabulary — ONE definition, for every screen.
 *
 * WHY THIS FILE EXISTS
 *   Every other module already has one (ipkConstants, lbrConstants, oleConstants,
 *   ppqtConstants, vanvaConstants). Cycle time was the exception, so its status
 *   vocabulary got copied instead: the models table held STATUS_META, the 4Q held
 *   its own STATUS_LABEL + LOSS_COLOR, and both held a REASON_LABEL. They had
 *   already drifted — the same reason read "in IEDB, nobody has timed it" on one
 *   screen and "in IEDB, never timed" on the other, and the 4Q was still showing
 *   the retired `not_in_mes` after the table had split it.
 *
 *   A status means one thing. It gets one label, one colour, one order, here.
 *
 * THE SIX VERDICTS (plus `not_checked` for rows the run has not reached)
 *   Worst first, which is also the sort order and the order the chips render in.
 *   `complete` is last because it is the answer, not a problem.
 */

/** Hex alongside the Tailwind classes: chips need classes, charts need a colour
 *  value. Same source, so a status cannot be amber on the table and orange in a
 *  chart. */
export interface StatusMeta {
  label: string;
  /** Chip background + text. */
  cls: string;
  /** Legend/indicator dot. */
  dot: string;
  /** Chart + stacked-bar fill. */
  color: string;
  hint: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  incomplete: {
    label: 'Missing CT', color: '#f59e0b',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500',
    hint: 'In IEDB with cycle times, but gaps against what the floor actually runs',
  },
  no_cycle_time: {
    label: 'No cycle time', color: '#f97316',
    cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500',
    hint: 'Model EXISTS in IEDB, but not one cycle time has been entered',
  },
  not_in_iedb: {
    label: 'Not in IEDB', color: '#ef4444',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-400', dot: 'bg-red-500',
    hint: 'Model does not exist in IEDB at all — it has to be created first',
  },
  not_built: {
    label: 'Not built yet', color: '#0ea5e9',
    cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500',
    hint: 'MES has no production record in the window. Nothing to do but wait for the build',
  },
  cannot_check: {
    label: 'Cannot be checked', color: '#64748b',
    cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40',
    hint: 'This workcell is not on MES, so no scan will ever arrive. Waiting is pointless — 470 LAMMEC models read as "not built yet" until this was split out',
  },
  not_checked: {
    label: 'Not checked', color: '#94a3b8',
    cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40',
    hint: 'The completion run has not reached this model yet',
  },
  complete: {
    label: 'Complete', color: '#10b981',
    cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500',
    hint: 'Every step MES ran was named AND has a cycle time',
  },
};

export const STATUS_ORDER = ['incomplete', 'no_cycle_time', 'not_in_iedb', 'not_built',
                             'cannot_check', 'not_checked', 'complete'];

/** Anything unrecognised falls back to `not_checked` rather than rendering a raw
 *  key. The one real source of unknown keys is a history week snapshotted before
 *  a vocabulary change — see `not_in_mes` below. */
export const statusMeta = (s: string): StatusMeta => STATUS_META[s] ?? STATUS_META.not_checked;
export const statusLabel = (s: string): string => STATUS_META[s]?.label ?? s;
export const statusColor = (s: string): string => statusMeta(s).color;

/** Retired keys, kept only so old data still renders as words.
 *
 *  `not_in_mes` was ONE status for two different answers and was split: "not
 *  built yet" means wait for the scan, "cannot be checked" means no scan will
 *  ever arrive. Live endpoints no longer emit it, but completion_history weeks
 *  snapshotted before the split still carry it, and the 4Q plots those weeks. */
export const LEGACY_STATUS: Record<string, string> = {
  not_in_mes: 'not_built',
};
export const canonStatus = (s: string): string => LEGACY_STATUS[s] ?? s;

/** Why a status was given — the detail the verdicts fold away.
 *
 *  Kept terse deliberately: these read inside a chart legend and a tooltip, and
 *  the long-form explanation belongs in `STATUS_META[...].hint`, which sits
 *  beside them wherever they render. */
export const REASON_LABEL: Record<string, string> = {
  missing_ct: 'blank cycle time',
  missing_step: 'step not in route',
  'missing_ct+step': 'blank CT + route gap',
  unmapped: 'steps unrecognised',
  no_alias: 'no alias to match on',
  in_iedb_untimed: 'in IEDB, never timed',
  absent: 'no IEDB record',
  absent_unverified: 'not in our IEDB snapshot',
  no_production: 'not built yet',
  workcell_not_on_mes: 'workcell not on MES',
};
export const reasonLabel = (r?: string | null): string => (r ? REASON_LABEL[r] ?? r : '');

/** The verdict to SHOW for a model, corrected at read time.
 *
 *  Compatibility shim, and nothing more. The server now sends the corrected
 *  verdict from `model_universe`, which owns both corrections: a `complete`
 *  carrying a gap is demoted, and `not_in_mes` is split into "not built yet" vs
 *  "no scan will ever come". That logic used to live in the table, and again in
 *  the report, and not at all in the demand endpoint — which is how one workcell
 *  reported 279, 236 and 208 complete models on three screens at once.
 *
 *  What is left runs only against an OLDER backend still sending the raw mart
 *  status — prod, until this deploys. Against a current backend every branch is
 *  a no-op, which is the intended end state: delete it once prod is on this code.
 *
 *  It lives here rather than beside the table because the 4Q needs it too, and
 *  importing it from a page module would drag a virtualised table into the
 *  report bundle. */
export const dstatus = (m: {
  status: string; reason?: string | null;
  no_ct?: number | null; not_in_iedb?: number | null; unmapped?: number | null;
}): string => {
  if (m.status === 'not_in_mes')
    return m.reason === 'workcell_not_on_mes' ? 'cannot_check' : 'not_built';
  if (m.status === 'complete' && (m.no_ct || m.not_in_iedb || m.unmapped)) return 'incomplete';
  return m.status;
};

/** The completion target, in percent of demand units. */
export const TARGET = 90;
