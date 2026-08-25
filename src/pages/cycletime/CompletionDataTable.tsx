/**
 * CompletionDataTable.tsx
 * ───────────────────────
 * The ranked demand + completion list. Two call sites:
 *
 *   • Report → "Data Table" tab      — every workcell, with the scope picker
 *   • Workcell page → "Report" tab   — `lockedWorkcell`, picker hidden
 *
 * One component rather than two, because the whole point of the completion
 * status is that a workcell's own page and the global report must never show
 * a different verdict for the same model.
 *
 * Scope = MES projection (~4wk forward) UNION planner demand (~13wk) UNION every
 * model that exists, ranked by demand units. 4,401 in demand, 57,074 in total —
 * the Planned/All toggle chooses, and Planned is the default. Volume is heavily
 * concentrated: the top 500 demand models carry 88.1% of the units and the top
 * 100 carry 64.9%, which is why rank order is the default sort.
 *
 * The picker mirrors the OLE 4Q report's: a plant is "selected" purely because
 * its workcells all happen to be picked. That state is DERIVED, never stored, so
 * un-ticking one workcell silently turns a whole-plant pick into a custom one
 * and the two can never disagree.
 */

import { ScopeBox, ScopePicker } from '@/components/shared/ScopePicker';
import { SortHeader } from '@/components/shared/SortHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCycleTimeAssemblyList, useCycleTimeCompletionDemand } from '@/hooks/cycle_time/useCycleTimeData';
import { useSortable } from '@/hooks/shared/useSortable';
import { cycleTimeApi, formatBuildDuration, formatCycleHMS } from '@/lib/cycle_time/cycleTimeApi';
import type { CycleTimeAssemblyListRow, DemandCompletionModel } from '@/lib/cycle_time/cycleTimeApi';
// ONE vocabulary, shared with the 4Q — see cycleTimeConstants. These used to be
// declared here AND in CompletionFourQuadrant, and had already drifted apart.
import { REASON_LABEL, STATUS_META, STATUS_ORDER, dstatus } from '@/lib/cycle_time/cycleTimeConstants';
import { ExportButton } from '@/components/shared/ExportButton';
import type { ExportColumn } from '@/lib/cycle_time/exportTable';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Check, ChevronDown, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RouteComparisonDrawer } from './RouteComparisonDrawer';

// Identity first (who/what/where), then schedule, then every number and
// indicator on the right — so the eye scans names down the left and figures
// down the right instead of hopping between them.
/** Fixed row height — the virtualiser needs one number, and every row is a
 *  single line of text, so measuring per-row would buy nothing. */
const ROW_H = 34;

/** Numeric header. row-reverse, not justify-end: the sort icon goes to the LEFT
 *  of the label so the label's right edge sits on the column edge — exactly
 *  where the right-aligned numbers under it sit. */
const NUM_HEAD = 'flex-row-reverse';

const GRID = '2.75rem minmax(6.5rem,0.9fr) minmax(8rem,1.2fr) 4.5rem  6.5rem 6.5rem  4.5rem 7.5rem 3.25rem 4.75rem  4.5rem 4.5rem  2rem';
/** Workcell column dropped when it is the same value on every row. */
/** The workcell view carries five more columns than the global report, because
 *  `/assembly-list` answers for ONE workcell at a time — In IEDB, Cycle time,
 *  SMH, Rev and Workcenter simply have no source when every workcell is on
 *  screen at once. They are added rather than swapped in: the report and the
 *  workcell page must still describe a model the same way. */
// Locked = one workcell, so Workcell AND Plant are both constant down the whole
// column. Workcell was already dropped; Plant was still there, costing 4.5rem of
// a table that did not fit, to print the same word 1,700 times.
// Every track is minmax(floor, fr) or a width that already fits its own header,
// and there is no minWidth on the grid: the 16 columns share whatever the
// window gives and the table fits in one view. It used to be pinned at 96rem —
// wider than the screen it is read on, so Workcenter fell off the right edge.
// The floors are sized to the HEADER, not the value: "UNMAPPED" is wider than
// any count under it, and a header that overflows its track is what made
// everything from Gap rightwards look crooked.
const GRID_LOCKED = '2.25rem minmax(8rem,1.6fr) minmax(5.5rem,0.8fr) minmax(5.5rem,0.8fr)  4.5rem 5.75rem  4.5rem minmax(6.5rem,1fr) 3.25rem 4.75rem  4.75rem 3.25rem  3.5rem 3.5rem  minmax(8rem,1fr)  1.75rem';

/** Status → label + colour. Ordered worst-first so the legend reads as a
 *  priority list: what needs creating, then fixing, then nothing. */
// `dstatus` moved to cycleTimeConstants — the 4Q needs it too. Re-exported
// here so the existing import path and its test keep working.
export { dstatus };

/** Plant keys as the backend sends them (`_PLANT_REGION` in api/routers/cycle_time.py),
 *  in site order with the names people actually use. The key stays the raw code —
 *  filtering is by workcell, so only the label and the order change here. */
const PLANT_ORDER = ['Plant 1', 'JPE', 'JBK'];
const PLANT_LABEL: Record<string, string> = {
  'Plant 1': 'Plant 1',
  JPE: 'Plant 2',
  JBK: 'Batu Kawan',
};
const plantLabel = (p: string) => PLANT_LABEL[p] ?? p;

/** The `reason` behind a status — the detail the 4 statuses deliberately fold
 *  away. Shown as a sub-label so the chip stays scannable. */
type SortKey = 'rank' | 'customer' | 'assembly' | 'status' | 'lbr' | 'ipk' | 'next' | 'last'
             | 'gap' | 'unmapped' | 'iedb' | 'ct' | 'checked' | 'smh' | 'rev';

/** IEDB's gap: a step the floor runs that IEDB either never timed (`no_ct`) or
 *  does not carry on its route at all (`not_in_iedb`). Kept apart from
 *  `unmapped`, which is OURS — the naming bridge could not identify the step, so
 *  we cannot honestly claim IEDB is missing anything. Folding the two into one
 *  number blames IEDB for our own mapping holes; ~6% of LAM RESEARCH's gap was. */
const gapOf = (m: Row) =>
  m.no_ct == null && m.not_in_iedb == null ? null : (m.no_ct ?? 0) + (m.not_in_iedb ?? 0);

/** The workcell page routes on the IEDB spelling ('Nokia Optics'); demand rows
 *  carry MES's ('NOKIA OPTICS'). Match on a normalised key, never the raw string. */
const wcKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A model the workcell owns but nothing has ordered, dressed as a table row.
 *
 *  It is DELIBERATELY thin. `/universe/workcell` knows the verdict and the dates
 *  and nothing else — no rank (there is no demand to rank by), no split gap, no
 *  LBR, no IPK. Those columns render as em-dashes, and that is the honest
 *  reading: nobody has checked this model, so there is no number to show. Zero
 *  would read as "checked, found nothing", which is a different claim.
 *
 *  `verdict` is already the final six-word vocabulary — the same one `dstatus`
 *  produces — so it passes straight through with no second translation. */
/** A table row: the demand verdict, plus the per-assembly facts that only
 *  `/assembly-list` knows. Merged ONTO the row rather than looked up at render
 *  time, so the sort accessors stay module-level and stable. */
type Row = DemandCompletionModel & Partial<Pick<CycleTimeAssemblyListRow,
  'has_smt' | 'has_th' | 'has_be' | 'smh' | 'revisions' | 'in_iedb' | 'has_cycle_time'>>;

/** Workcenter dot colours — the flow table's, so a stage is one colour
 *  everywhere. */
const WC_DOT: Record<string, string> = { SMT: 'bg-emerald-500', TH: 'bg-sky-500', BE: 'bg-violet-500' };
const WC_LABEL: Record<string, string> = { SMT: 'Surface Mount', TH: 'Through Hole', BE: 'Backend' };
const WORKCENTERS = ['SMT', 'TH', 'BE'] as const;
const stagesOf = (m: Row) =>
  [m.has_smt && 'SMT', m.has_th && 'TH', m.has_be && 'BE'].filter(Boolean) as string[];

/** YES / NO / — . Null is NOT "no": it means the assembly list has not answered
 *  for this model, which is a different claim from "IEDB does not have it". */
function YesNo({ v, yes, no }: { v?: boolean | null; yes: string; no: string }) {
  if (v == null) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span title={v ? yes : no}
      className={cn('text-[11px] font-semibold',
        v ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400')}>
      {v ? 'YES' : 'NO'}
    </span>
  );
}

/** "6 Aug 2024". The year used to be dropped as noise, which was true while
 *  every date sat inside a 13-week demand window. The Active scope broke that:
 *  `last_run` reaches three years back, so "6 Aug" could mean any of three
 *  years and the reader cannot tell which. */
function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Mirrors the on-screen columns. `get` is used wherever the cell shows a
 *  derived value, so the sheet says what the screen said — not the raw field.
 *  Last build follows the same rule as the cell: the #21 scan wins, the plan is
 *  the fallback. */
const MODEL_COLS: ExportColumn<Row>[] = [
  { key: 'customer',    header: 'Workcell',     width: 24 },
  { key: 'plant',       header: 'Plant',        width: 12 },
  { key: 'assembly',    header: 'Model',        width: 24 },
  { key: 'status',      header: 'Status',       width: 15, get: m => dstatus(m) },
  { key: 'has_cycle_time', header: 'Has cycle time', width: 14,
    get: m => (m.has_cycle_time ? 'Yes' : 'No'), align: 'center' },
  { key: 'in_iedb',     header: 'In IEDB',      width: 10,
    get: m => (m.in_iedb == null ? '' : m.in_iedb ? 'Yes' : 'No'), align: 'center' },
  { key: 'active',      header: 'Active',       width: 9,
    get: m => (m.active ? 'Yes' : 'No'), align: 'center' },
  { key: 'units',       header: 'Demand units', width: 13, numFmt: '#,##0' },
  { key: 'next_build',  header: 'Next build',   width: 13,
    get: m => (m.next_build ? String(m.next_build).slice(0, 10) : '') },
  { key: 'last_build',  header: 'Last build',   width: 13,
    get: m => { const v = m.last_run ?? m.last_build; return v ? String(v).slice(0, 10) : ''; } },
  { key: 'last_source', header: 'Last build from', width: 15,
    get: m => (m.last_run ? 'MES scan' : m.last_build ? 'Plan' : '') },
  { key: 'days_run',    header: 'Days seen',    width: 11, numFmt: '#,##0' },
  { key: 'units_built', header: 'Units built',  width: 14, numFmt: '#,##0' },
  { key: 'expected',    header: 'Steps expected', width: 14, numFmt: '#,##0' },
  { key: 'present',     header: 'Steps present',  width: 13, numFmt: '#,##0' },
  { key: 'coverage',    header: 'Coverage %',   width: 12, numFmt: '0.0' },
  { key: 'no_ct',       header: 'Steps no CT',  width: 12, numFmt: '#,##0' },
  { key: 'unmapped',    header: 'Steps unmapped', width: 14, numFmt: '#,##0' },
  { key: 'lbr',         header: 'LBR %',        width: 10, numFmt: '0.0' },
  { key: 'ipk_trolleys', header: 'IPK trolleys', width: 13, numFmt: '#,##0' },
  { key: 'smh',         header: 'SMH',          width: 10, numFmt: '#,##0.00' },
];

/** LBR is a balance target, not a percentage of something — 85%+ is healthy. */
const LBR_TARGET = 85;
const lbrTone = (v?: number | null) =>
  v == null ? 'text-muted-foreground'
    : v >= LBR_TARGET ? 'text-emerald-600 dark:text-emerald-400'
    : v >= 70 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500';

// Module-level: useSortable memoises on `accessors`, so rebuilding this object
// every render would defeat the memo and re-sort on each keystroke.
const ACCESSORS: Record<SortKey, (m: Row) => string | number | null> = {
  // Booleans sort as 0/1 so "NO first" is one click — that is the actionable end.
  iedb:     m => m.in_iedb == null ? null : m.in_iedb ? 1 : 0,
  ct:       m => m.has_cycle_time == null ? null : m.has_cycle_time ? 1 : 0,
  checked:  m => m.checked ? 1 : 0,
  smh:      m => m.smh ?? null,
  rev:      m => m.revisions ?? null,
  rank:     m => m.rank,
  customer: m => m.customer,
  assembly: m => m.assembly,
  // Sort by severity, not alphabetically — "what needs work" first.
  status:   m => STATUS_ORDER.indexOf(dstatus(m)),
  gap:      m => gapOf(m),
  unmapped: m => m.unmapped ?? null,
  lbr:      m => m.lbr ?? null,
  ipk:      m => m.ipk_trolleys ?? null,
  next:     m => m.next_build ?? null,
  // Sort on the SAME value the cell renders, or the column sorts by a date the
  // reader cannot see. last_run (what MES scanned) wins over last_build (a plan).
  last:     m => m.last_run ?? m.last_build ?? null,
};

/** The workcenter picker from CycleTimeFilters, made to serve two lists.
 *
 *  Multi-select, and "Default" means NOTHING is ticked rather than everything —
 *  the same shape as the workcenter dropdown, so the two read as one control
 *  used twice instead of two controls that happen to look alike.
 *
 *  Status used to be a row of chips here. The chips carried their counts on
 *  screen, so the counts moved INTO the rows rather than being dropped. */
function MultiPicker({ placeholder, options, selected, onToggle, onClear, width = 'w-[200px]' }: {
  placeholder: string;
  options: { key: string; label: string; dot?: string; count?: number; hint?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.filter(o => selected.includes(o.key));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn('flex h-8 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-xs',
            'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', width)}>
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {picked.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              picked.map(o => (
                <span key={o.key} className="flex items-center gap-1 whitespace-nowrap">
                  {o.dot && <span className={cn('h-2 w-2 rounded-full', o.dot)} />}{o.label}
                </span>
              ))
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-1', width)} align="start">
        <PickerRow label="Default" selected={selected.length === 0} onClick={onClear} />
        <div className="my-1 h-px bg-border" />
        {options.map(o => (
          <PickerRow key={o.key} label={o.label} dot={o.dot} count={o.count} hint={o.hint}
            selected={selected.includes(o.key)} onClick={() => onToggle(o.key)} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** One row. The popover stays open on click — these are multi-selects. */
function PickerRow({ label, dot, count, hint, selected, onClick }: {
  label: string; dot?: string; count?: number; hint?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} title={hint}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted">
      <Check className={cn('h-4 w-4 flex-shrink-0 text-emerald-500', selected ? 'opacity-100' : 'opacity-0')} />
      {dot ? <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dot)} /> : <span className="w-2 flex-shrink-0" />}
      <span className="flex-1 truncate font-medium">{label}</span>
      {count != null && <span className="tabular-nums text-xs text-muted-foreground">{count.toLocaleString()}</span>}
    </button>
  );
}

export default function CompletionDataTable({ lockedWorkcell, universeToggle }: {
  lockedWorkcell?: string;
  /** Legacy no-op. The Planned/All toggle used to need the per-workcell
   *  universe endpoint, so it was opt-in; the demand payload now carries every
   *  model itself and the toggle is always available. Kept so existing call
   *  sites still compile. */
  universeToggle?: boolean;
}) {
  // Scoped when locked. `data.total` and the workcell picker are `!locked`-only,
  // so nothing on this page reads a number that scoping would change.
  // ACTIVE is the default: what the plant is actually building. "All models"
  // still exists because the dormant count has to stay reachable — it just
  // stopped being the thing the page opens on.
  // PLANNED is the default scope AND the first paint. See the staged fetch below.
  const [scopeMode, setScopeMode] = useState<'demand' | 'active' | 'all'>('demand');

  // ── STAGED FETCH ────────────────────────────────────────────────────────
  // Three requests, each waiting on the one before it. Planned is 490KB and
  // paints in ~0.3s; active (3.8MB) and all (15.5MB) arrive behind it while the
  // reader is already working. Loading `all` up front cost 4.5s of blank screen
  // to draw a 712-row default.
  //
  // Unlocked (the global report) skips the staging: it has a workcell picker
  // that changes constantly, so one full payload beats re-fetching per pick.
  const wc = lockedWorkcell;
  const qPlanned = useCycleTimeCompletionDemand(wc, 'planned', !!wc);
  const qActive  = useCycleTimeCompletionDemand(wc, 'active', !!wc && qPlanned.isSuccess);
  const qAll     = useCycleTimeCompletionDemand(wc, 'all', wc ? qActive.isSuccess : true);

  // Always read from the WIDEST payload in hand and narrow it client-side.
  // all ⊇ active ⊇ planned, so filtering a superset is exact; the only cost of a
  // not-yet-arrived stage is that a wider scope briefly shows the narrower set,
  // which the dot on the button labels rather than hides.
  const data = qAll.data ?? qActive.data ?? qPlanned.data;
  const isLoading = !data && (wc ? qPlanned.isLoading : qAll.isLoading);
  const error = (wc ? qPlanned.error : qAll.error) ?? null;
  const locked = !!lockedWorkcell;
  // Always offered. The payload holds all three tiers now — demand, graded, and
  // every model that merely exists — so "which of them am I looking at?" is a
  // question every call site has to be able to answer, not just the workcell page.
  const showToggle = true;

  // Per-assembly facts IEDB knows and the demand endpoint does not: which
  // workcenters the model runs, whether IEDB carries it, its SMH and how many
  // revisions exist. Same query key the flow table uses, so it is already warm.
  const alist = useCycleTimeAssemblyList(locked ? lockedWorkcell : undefined);
  const alistBy = useMemo(() => {
    const map = new Map<string, CycleTimeAssemblyListRow>();
    (alist.data ?? []).forEach(r => map.set(wcKey(r.assembly), r));
    return map;
  }, [alist.data]);

  // null = "nothing chosen yet", which shows everything. An explicit list means
  // exactly those workcells — INCLUDING the empty list. The two used to be the
  // same value ([] = all), which is why the "All" tick could be turned on but
  // never off: unticking it produced [], and [] meant all.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [open, setOpen] = useState<{ customer: string; assembly: string } | null>(null);

  const scope = data?.scope;
  // Site order, not alphabetical: Plant 1, Plant 2, Batu Kawan is how everyone
  // here lists them. Anything the backend sends that is not in PLANT_ORDER
  // (e.g. "Unassigned") sorts to the end, so a new plant code still shows up.
  const plants = useMemo(() => {
    const keys = Object.keys(scope?.plants ?? {});
    const rank = (p: string) => { const i = PLANT_ORDER.indexOf(p); return i < 0 ? PLANT_ORDER.length : i; };
    return keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [scope]);
  const allWorkcells = useMemo(() => scope?.workcells ?? [], [scope]);

  // Filtering 3,900 rows on every keystroke made typing feel laggy. The input
  // stays instant; the filter catches up 180ms later.
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q), 180);
    return () => clearTimeout(id);
  }, [q]);

  // Default is EVERYTHING — the report's job is "show me the demand list", and
  // making the user pick before seeing anything hides the headline.
  useEffect(() => { setPicked(null); }, [data?.as_of]);

  const effectivePicked = picked ?? allWorkcells;
  const allPicked = allWorkcells.length > 0 && effectivePicked.length === allWorkcells.length;
  /** A real toggle: on → clear it, off → take everything back. */
  const toggleAll = () => setPicked(allPicked ? [] : null);

  const toggleStatus = (s: string) =>
    setStatusFilter(statusFilter.includes(s) ? statusFilter.filter(x => x !== s) : [...statusFilter, s]);
  const toggleStage = (s: string) =>
    setStageFilter(stageFilter.includes(s) ? stageFilter.filter(x => x !== s) : [...stageFilter, s]);

  // Everything EXCEPT the status filter. The chip counts read from this, so each
  // chip always shows how many models it holds in the current workcell/search
  // scope. Counting post-status-filter meant picking one status zeroed every
  // other chip, and the numbers only appeared on whatever was selected.
  // Demand, the graded mart and the full model universe — already unioned
  // server-side, one row per model. This used to fetch the universe separately
  // per workcell and merge it here, which meant the global report had no way to
  // reach those models at all and the two screens counted different totals.
  const sourceRows = useMemo<Row[]>(() => data?.models ?? [], [data]);

  // Merged once, here — not read inside the row renderer. The virtualiser
  // remounts rows constantly, and a Map lookup per cell per scroll frame is the
  // kind of thing that made this table feel stuck before it was virtualised.
  const enriched = useMemo<Row[]>(() => {
    if (!locked || alistBy.size === 0) return sourceRows;
    return sourceRows.map(m => {
      const a = alistBy.get(wcKey(m.assembly));
      if (!a) return m;
      return {
        ...m,
        has_smt: a.has_smt, has_th: a.has_th, has_be: a.has_be,
        smh: a.smh, revisions: a.revisions,
        // The assembly list is the richer answer where it has one; the universe
        // row's own value stands in when the model is not on that list.
        in_iedb: a.in_iedb ?? m.in_iedb,
        has_cycle_time: a.has_cycle_time ?? m.has_cycle_time,
      };
    });
  }, [sourceRows, alistBy, locked]);

  // Everything the pickers and the search box select, BEFORE the Planned/All
  // toggle is applied. Split out so the toggle can label itself with what each
  // side would actually show in the scope you are already in — a count taken
  // after the toggle can only ever describe the side you are on.
  const inScope = useMemo(() => {
    let r = enriched;
    // Sets, not arrays: .includes() on every one of ~3,900 rows was a linear
    // scan per row for both filters.
    if (lockedWorkcell) {
      const want = wcKey(lockedWorkcell);
      r = r.filter(m => wcKey(m.customer) === want);
    } else if (picked) {
      // Explicit list — an empty one really does mean "show nothing".
      const wanted = new Set(picked);
      r = r.filter(m => wanted.has(m.customer));
    }
    if (qDebounced.trim()) {
      const s = qDebounced.trim().toLowerCase();
      r = r.filter(m => m.assembly.toLowerCase().includes(s) || m.customer.toLowerCase().includes(s));
    }
    // The EXACT set, the same reading the Flow tab's picker uses: SMT means
    // "runs SMT and nothing else", SMT+TH means "runs exactly those two". It
    // used to match ANY of the ticked stages, which made the control read as
    // broken — on KEYSIGHT, SMT alone gave 616 rows and SMT+TH gave 619, so
    // adding a filter GREW the list and the Workcenter column still showed
    // SMT·TH·BE on every row.
    if (stageFilter.length) {
      const want = WORKCENTERS.filter(w => stageFilter.includes(w)).join('|');
      r = r.filter(m => stagesOf(m).join('|') === want);
    }
    return r;
  }, [enriched, lockedWorkcell, picked, qDebounced, stageFilter]);

  // Every payload carries all three totals, so the switch labels itself off the
  // FIRST small response — the buttons never render blank while the wider scopes
  // are still in flight. Server totals are pre-filter, so once the reader
  // narrows with the search box or the stage picker we count the rows in hand
  // instead, or the labels would contradict the table.
  const narrowed = !!qDebounced.trim() || stageFilter.length > 0 || !!picked;
  const scopeCounts = useMemo(() => {
    const local = {
      demand: inScope.reduce((n, m) => n + (m.has_demand ? 1 : 0), 0),
      active: inScope.reduce((n, m) => n + (m.active || m.has_demand ? 1 : 0), 0),
      all: inScope.length,
    };
    if (narrowed || !wc) return local;
    return {
      demand: data?.total_planned ?? local.demand,
      active: data?.total_active ?? local.active,
      all: data?.total_all ?? local.all,
    };
  }, [inScope, narrowed, wc, data?.total_planned, data?.total_active, data?.total_all]);

  // The payload is demand UNION graded UNION every model that exists, so
  // "Planned" has to filter or both sides of the toggle render the same rows.
  const scopedRows = useMemo(() => {
    if (scopeMode === 'demand') return inScope.filter(m => m.has_demand);
    // `|| has_demand` on purpose: a model ordered for next month has not run
    // yet, so the scan cannot know it. Planned IS active.
    if (scopeMode === 'active') return inScope.filter(m => m.active || m.has_demand);
    return inScope;
  }, [inScope, scopeMode]);

  /** The workcell's headline, computed from `scopedRows` — the exact rows the
   *  table is about to draw. Deriving it from a second request is how the
   *  landing page ended up claiming 24,080 models while its own cards said
   *  5,783 for the same workcell. Cards and table read one array. */
  const kpi = useMemo(() => {
    let hasCt = 0, noCt = 0, notIedb = 0, complete = 0, partial = 0, noBuild = 0;
    for (const m of scopedRows) {
      if (!m.has_cycle_time) {
        // Two different owners, so two different tiles: IEDB carries it and
        // nobody timed it, versus IEDB has never heard of it at all.
        if (m.in_iedb) noCt++; else notIedb++;
        continue;
      }
      hasCt++;
      const st = dstatus(m);
      if (st === 'complete') complete++;
      else if (st === 'incomplete') partial++;
      else if (st === 'not_built') noBuild++;
    }
    // Same bucket as the landing page: no_build absorbs every verdict the
    // comparison could not decide, so has_ct = complete + partial + noBuild
    // exactly. Two screens showing a different "No build found" for the same
    // workcell is the drift this rebuild exists to stop.
    return { total: scopedRows.length, hasCt, noCt, notIedb, complete, partial,
             noBuild: hasCt - complete - partial,
             /** The part of noBuild that genuinely has no MES production. */
             trulyNoBuild: noBuild };
  }, [scopedRows]);

  const rows = useMemo(() => {
    if (!statusFilter.length) return scopedRows;
    const wanted = new Set(statusFilter);
    return scopedRows.filter(m => wanted.has(dstatus(m)));
  }, [scopedRows, statusFilter]);

  const { sorted, sort, toggle } = useSortable<Row, SortKey>(rows, ACCESSORS,
    { key: 'rank', dir: 'asc' });

  // Virtualised: the demand list is ~3,900 rows x 10 cells. Rendering them all
  // put ~39,000 nodes in the DOM, and because `open`/`q`/`picked` live in this
  // component EVERY keystroke and every row click re-rendered the lot — which is
  // what made the page feel stuck. Only the visible window is mounted now.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    scopedRows.forEach(m => { const s = dstatus(m); c[s] = (c[s] ?? 0) + 1; });
    return c;
  }, [scopedRows]);

  const grid = locked ? GRID_LOCKED : GRID;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-muted-foreground">
      Could not load the report. The completion mart may not be built yet —
      run <code className="rounded bg-muted px-1">scripts/run_completion_target.py</code>.
    </div>;
  }

  return (
    <div className="h-full max-w-full space-y-4 overflow-y-auto overflow-x-hidden p-4 md:p-6">
      {/* The freshness banner was pulled on 18 Aug 2026: it ate a third of the
          screen AND was crying about `mes_process_map.parquet`, which the grader
          stopped reading when the bridge moved to the registry. A warning that
          is both large and wrong is worse than none.
          `data.freshness` still arrives on the wire — put it back small (a dot
          by the row count) once FRESHNESS_FILES in completion_report.py watches
          the registry instead. */}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      {/* Scoped to one workcell already — a picker here would only let you pick
          your way out of the page you are on. */}
      {!locked && (
      <div className="rounded-xl border bg-card">
        <button onClick={() => setScopeOpen(o => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Report scope
            </span>
            <span className="text-xs text-muted-foreground">
              {allPicked
                ? `All ${allWorkcells.length} workcells`
                : `${effectivePicked.length} of ${allWorkcells.length} workcells`}
            </span>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', scopeOpen && 'rotate-180')} />
        </button>

        {scopeOpen && (
          <div className="space-y-4 border-t px-4 py-3">
            <button onClick={toggleAll}
              className={cn('flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted/50',
                allPicked && 'text-primary')}>
              <ScopeBox on={allPicked} partial={!allPicked && effectivePicked.length > 0} />
              <span className="text-sm font-semibold">All</span>
              <span className="text-[11px] text-muted-foreground">
                {effectivePicked.length}/{allWorkcells.length} workcells
              </span>
            </button>

            <ScopePicker
              plants={plants}
              byPlant={scope?.plants ?? {}}
              picked={effectivePicked}
              onChange={setPicked}
              labelPlant={plantLabel}
              gridClassName="grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            />
          </div>
        )}
      </div>
      )}

      {/* ── Search + the two pickers ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)}
            placeholder={locked ? 'Search model' : 'Search model or workcell'}
            className="h-8 w-56 pl-8 text-xs" />
        </div>

        {/* Both pickers sit straight after the search box, in the order you
            narrow: where it runs, then what is wrong with it. */}
        {locked && (
          <MultiPicker
            placeholder="Select workcenter"
            options={WORKCENTERS.map(w => ({ key: w, label: w, dot: WC_DOT[w], hint: WC_LABEL[w] }))}
            selected={stageFilter}
            onToggle={toggleStage}
            onClear={() => setStageFilter([])}
          />
        )}

        <MultiPicker
          placeholder="Select status"
          width="w-[240px]"
          options={STATUS_ORDER
            .filter(k => (counts[k] ?? 0) > 0 || statusFilter.includes(k))
            .map(k => ({ key: k, label: STATUS_META[k].label, dot: STATUS_META[k].dot,
                         count: counts[k] ?? 0, hint: STATUS_META[k].hint }))}
          selected={statusFilter}
          onToggle={toggleStatus}
          onClear={() => setStatusFilter([])}
        />

        {/* Two scopes, one table. The workcell's model list used to live in a
            second component with a second look, which is how the same model
            could be described two ways on one page. */}
        {showToggle && (
          <div className="ml-auto flex items-center rounded-lg border bg-card p-0.5">
            {([
              ['demand', 'Planned', 'Ordered in the next 13 weeks — the planner window UNION the MES projection'],
              ['active', 'Active', 'MES saw it run since Sep 2024, or it is planned. What the plant is actually building — the default scope of this module'],
              ['all', 'All models', 'Every model that exists incl. dormant ones nobody has built in years. The denominator, not the working list'],
            ] as const).map(([k, label, hint]) => (
              <button key={k} onClick={() => setScopeMode(k)} title={hint}
                className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  scopeMode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {label}
                <span className="ml-1 tabular-nums opacity-70">{scopeCounts[k].toLocaleString()}</span>
                {/* This scope's rows are still in flight. The count is right (it
                    comes from the server) but the table shows a narrower set
                    until it lands — say so rather than let the number and the
                    rows disagree in silence. */}
                {((k === 'active' && !qActive.data && !qAll.data) ||
                  (k === 'all' && !qAll.data)) && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-50"
                        title="still loading — showing a narrower set until it arrives" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Same six numbers as the landing page, for one workcell. They follow the
          scope switch, so what the cards claim is always what the table shows —
          not a fixed scope that disagrees the moment you toggle. */}
      {locked && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {([
            ['Models', kpi.total, '', `Every model in the current scope (${scopeMode === 'all' ? 'all, incl. dormant' : scopeMode === 'active' ? 'active' : 'planned'})`],
            ['With cycle time', kpi.hasCt, 'text-emerald-600 dark:text-emerald-400', 'IEDB has priced it, so the comparison can decide something'],
            ['No cycle time', kpi.noCt, 'text-amber-600 dark:text-amber-400', 'IEDB carries the model but nobody has timed it — an IE task'],
            ['Not in IEDB', kpi.notIedb, 'text-rose-600 dark:text-rose-400', 'IEDB has never heard of it. It must be created before it can be timed'],
            ['Complete', kpi.complete, 'text-emerald-600 dark:text-emerald-400', 'Every step the floor ran is named in IEDB and has a cycle time'],
            ['Partial', kpi.partial, 'text-orange-600 dark:text-orange-400', 'A step is missing a cycle time, or the naming bridge could not identify it'],
            ['No build found', kpi.noBuild, 'text-muted-foreground',
              `Nothing to compare against. ${kpi.trulyNoBuild.toLocaleString()} have no MES `
              + `production in the window; the remaining ${(kpi.noBuild - kpi.trulyNoBuild).toLocaleString()} `
              + 'could not be decided — not in the IEDB catalogue, workcell not on MES, or no verdict yet'],
          ] as const).map(([label, v, tone, hint]) => (
            <div key={label} className="rounded-xl border bg-card p-2.5" title={hint}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className={cn('text-lg font-semibold tabular-nums', tone)}>
                {v.toLocaleString()}
              </div>
              {label !== 'Models' && kpi.total > 0 && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {Math.round((v / (label === 'With cycle time' || label === 'No cycle time'
                    || label === 'Not in IEDB' ? kpi.total : Math.max(kpi.hasCt, 1))) * 100)}%
                  {label === 'With cycle time' || label === 'No cycle time'
                    || label === 'Not in IEDB' ? ' of scope' : ' of timed'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {sorted.length.toLocaleString()} model{sorted.length === 1 ? '' : 's'}
          {!locked && sorted.length !== data.total && <> of {data.total.toLocaleString()}</>}
          {locked && (scopeMode === 'all' ? ' owned by this workcell'
                      : scopeMode === 'active' ? ' active in this workcell'
                      : ' in demand for this workcell')}
        </span>

        {/* `sorted` is the post-filter, post-sort array the table draws next,
            so the file matches the screen exactly. */}
        <ExportButton
          className="ml-auto"
          rows={sorted}
          columns={MODEL_COLS}
          filename={locked ? `cycle_time_${wcKey(lockedWorkcell ?? '')}` : 'cycle_time_models'}
          sheetName="Models"
          title={locked ? `Cycle Time — ${lockedWorkcell}` : 'Cycle Time — Models'}
          subtitle={[
            `Scope: ${scopeMode === 'all' ? 'all models incl. dormant'
              : scopeMode === 'active' ? 'active (ran since Sep 2024 or planned)'
              : 'planned (13-week planner + eDash forward)'}`,
            statusFilter.length ? `Status: ${statusFilter.join(', ')}` : '',
            stageFilter.length ? `Workcenter: ${stageFilter.join('+')}` : '',
            qDebounced.trim() ? `Search: "${qDebounced.trim()}"` : '',
          ].filter(Boolean).join(' · ')}
          scopeNote={sorted.length !== scopeCounts.all
            ? `filtered from ${scopeCounts.all.toLocaleString()}` : undefined}
        />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
        <div className="sticky top-0 z-30 bg-card">
        <div className="grid items-center gap-2 border-b bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: grid }}>
          {/* Position in the list as it is currently shown, not a stored rank.
              It used to print the demand rank, which meant the column read
              1, 2, 3 … then a run of em-dashes the moment a model without
              demand appeared — and the numbers no longer matched the rows you
              were counting. The list is still ordered by demand by default, so
              the top of the column means the same thing it always did. */}
          <span>#</span>
          {!locked && <SortHeader label="Workcell" active={sort?.key === 'customer'} dir={sort?.dir} onClick={() => toggle('customer')} />}
          <SortHeader label="Model" active={sort?.key === 'assembly'} dir={sort?.dir} onClick={() => toggle('assembly')} />
          {!locked && <span>Plant</span>}
          <SortHeader label="Next build" active={sort?.key === 'next'} dir={sort?.dir} onClick={() => toggle('next')} />
          <SortHeader label="Last build" active={sort?.key === 'last'} dir={sort?.dir} onClick={() => toggle('last')} />
          {/* Before the verdict, because they are what the verdict is built ON:
              a model IEDB never heard of cannot be graded, and one nobody timed
              can only fail. Reading the status first invites explaining it. */}
          {locked && <SortHeader label="In IEDB" active={sort?.key === 'iedb'} dir={sort?.dir} onClick={() => toggle('iedb')} className="justify-center" />}
          {locked && <SortHeader label="Cycle time" active={sort?.key === 'ct'} dir={sort?.dir} onClick={() => toggle('ct')} className="justify-center" />}
          {/* Did we look — separate from what we found. Folded into Status, one
              cell was answering two questions and the reader could not tell
              "we have not run the check" from "the check found nothing wrong". */}
          <SortHeader label="Checked" active={sort?.key === 'checked'} dir={sort?.dir} onClick={() => toggle('checked')} className="justify-center" />
          <SortHeader label="Status" active={sort?.key === 'status'} dir={sort?.dir} onClick={() => toggle('status')} />
          {/* Two gaps, never one number: theirs, then ours. */}
          <SortHeader label="Gap" active={sort?.key === 'gap'} dir={sort?.dir} onClick={() => toggle('gap')} className={NUM_HEAD} />
          <SortHeader label="Unmapped" active={sort?.key === 'unmapped'} dir={sort?.dir} onClick={() => toggle('unmapped')} className={NUM_HEAD} />
          {locked && <SortHeader label="SMH" active={sort?.key === 'smh'} dir={sort?.dir} onClick={() => toggle('smh')} className={NUM_HEAD} />}
          {locked && <SortHeader label="Rev" active={sort?.key === 'rev'} dir={sort?.dir} onClick={() => toggle('rev')} className={NUM_HEAD} />}
          <SortHeader label="LBR" active={sort?.key === 'lbr'} dir={sort?.dir} onClick={() => toggle('lbr')} className={NUM_HEAD} />
          <SortHeader label="IPK" active={sort?.key === 'ipk'} dir={sort?.dir} onClick={() => toggle('ipk')} className={NUM_HEAD} />
          {locked && <span className="text-right">Workcenter</span>}
          {/* the open-page arrow — no label, the icon says it */}
          <span />
        </div>
        </div>

          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {locked && !qDebounced && !statusFilter.length
                ? scopeMode === 'all'
                  ? 'No models found for this workcell in IEDB, MES or demand.'
                  : 'No demand for this workcell — nothing on the MES plan or the planner forecast. Try "All models".'
                : !locked && picked?.length === 0
                ? 'No workcells selected. Tick "All", or pick a plant.'
                : 'Nothing matches the current filters.'}
            </div>
          )}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(v => {
            const m = sorted[v.index];
            const meta = STATUS_META[dstatus(m)] ?? STATUS_META.not_checked;
            const gap = gapOf(m);
            return (
              // A div, not a button: the row carries a LINK in its last cell,
              // and a link inside a button is invalid HTML — browsers recover
              // from it differently and keyboard focus order breaks. Same
              // role/tabIndex/onKeyDown pattern the flow table already uses.
              <div key={`${m.customer}|${m.assembly}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpen({ customer: m.customer, assembly: m.assembly })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpen({ customer: m.customer, assembly: m.assembly });
                  }
                }}
                className="absolute left-0 top-0 grid w-full cursor-pointer items-center gap-2 border-b px-4 text-left text-xs hover:bg-muted/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
                style={{ gridTemplateColumns: grid, height: ROW_H, transform: `translateY(${v.start}px)` }}>
                <span className="tabular-nums text-muted-foreground">{v.index + 1}</span>
                {/* The WORKCELL navigates to its own page, the same way the
                    model name navigates to the model. stopPropagation keeps the
                    row's drawer handler from firing on the way past. */}
                {!locked && (
                  <Link
                    to={`/cycle-time/${encodeURIComponent(m.customer)}`}
                    onClick={(e) => e.stopPropagation()}
                    title={`Open ${m.customer}`}
                    className="truncate font-medium underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus:outline-none"
                  >
                    {m.customer}
                  </Link>
                )}
                {/* The model NAME navigates; the rest of the row opens the drawer.
                    stopPropagation keeps the row handler from firing too, so a
                    click on the name does one thing rather than both. */}
                <Link
                  to={`/cycle-time/${encodeURIComponent(m.customer)}/${encodeURIComponent(m.assembly)}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`Open ${m.assembly}`}
                  className="truncate font-mono text-[11px] underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus:outline-none"
                >
                  {m.assembly}
                </Link>
                {!locked && <span className="truncate text-muted-foreground">{m.plant}</span>}

                {/* No upcoming start but demand still running = already on the floor. */}
                <span className="tabular-nums text-muted-foreground">
                  {m.next_build ? fmtDate(m.next_build)
                    : m.in_progress ? <span className="text-emerald-600 dark:text-emerald-400">Building</span>
                    : '—'}
                </span>
                {/* `last_build` comes from the DEMAND frame, so a model with no
                    forward demand had a dash here even though #21 knows exactly
                    when it last ran. `last_run` is the scan itself — actual
                    production, not a plan — so it wins, and last_build is only
                    the fallback for something planned but never yet built. */}
                <span className="tabular-nums text-muted-foreground"
                      title={m.last_run ? `Last seen in MES production on ${m.last_run}`
                                        : 'From the demand plan — MES has no production record'}>
                  {fmtDate(m.last_run ?? m.last_build)}
                </span>

                {locked && (
                  <span className="text-center">
                    <YesNo v={m.in_iedb} yes="IEDB carries this model" no="IEDB has never heard of it — it has to be created first" />
                  </span>
                )}
                {locked && (
                  <span className="text-center">
                    <YesNo v={m.has_cycle_time} yes="IEDB has a cycle time for this model" no="In IEDB, but nobody has timed it" />
                  </span>
                )}

                {/* Checked — did the completion run judge this model. Grey NO,
                    not orange: an unchecked model is work we have not done, not
                    a fault in the model. */}
                <span className="text-center">
                  <span title={m.checked
                        ? 'The completion check has run on this model'
                        : 'The completion check has not run on this model yet'}
                    className={cn('text-[11px] font-semibold',
                      m.checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {m.checked ? 'YES' : 'NO'}
                  </span>
                </span>

                <span className="flex items-center gap-1">
                  <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', meta.cls)}
                    title={m.reason ? `${meta.hint}\n\n${REASON_LABEL[m.reason] ?? m.reason}` : meta.hint}>
                    {meta.label}</span>
                  {m.source === 'batch' && (
                    <span title="Verdict from #21 batch counts — a customer-level aggregate that can drag in rework and other variants"
                      className="text-[10px] text-amber-500">⚠</span>
                  )}
                </span>
                {/* IEDB's gap, then ours. Zero prints as a dash: the eye should
                    land only on rows that owe someone work. */}
                <span className="text-right font-medium tabular-nums"
                  title={gap ? `${m.no_ct ?? 0} step(s) with no cycle time · ${m.not_in_iedb ?? 0} step(s) not on the IEDB route` : undefined}>
                  {gap ? <span className="text-rose-600 dark:text-rose-400">{gap}</span> : <span className="text-muted-foreground">—</span>}
                </span>
                <span className="text-right tabular-nums text-muted-foreground"
                  title={m.unmapped ? 'Steps OUR naming bridge could not identify — our gap, not IEDB’s' : undefined}>
                  {m.unmapped ? m.unmapped : '—'}
                </span>
                {/* Operator content per unit — the size of the model, and the
                    reason a 4-second gap on one and a 4-second gap on another
                    are not the same problem. */}
                {locked && (
                  <span className="text-right tabular-nums text-muted-foreground"
                    title={m.smh == null ? 'No primary routing' : formatCycleHMS(m.smh)}>
                    {m.smh == null ? '—' : formatBuildDuration(m.smh)}
                  </span>
                )}
                {locked && (
                  <span className="text-right tabular-nums text-muted-foreground"
                    title={m.revisions ? `${m.revisions} revision(s) in IEDB — a step on one may not exist on another` : undefined}>
                    {m.revisions ?? '—'}
                  </span>
                )}

                <span className={cn('text-right tabular-nums', lbrTone(m.lbr))}>
                  {m.lbr != null ? `${Math.round(m.lbr)}%` : '—'}
                </span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {m.ipk_trolleys != null ? Math.round(m.ipk_trolleys) : '—'}
                </span>

                {/* Which stages the model actually runs. A dot per workcenter
                    beats three YES/NO columns — the shape of the route is the
                    thing you read, not each flag separately. */}
                {locked && (() => {
                  const stages = stagesOf(m);
                  return (
                    <span className="flex items-center justify-end gap-1.5 overflow-hidden">
                      {stages.length === 0
                        ? <span className="text-muted-foreground/50">—</span>
                        : stages.map(w => (
                          <span key={w} title={WC_LABEL[w]}
                            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', WC_DOT[w])} />{w}
                          </span>
                        ))}
                    </span>
                  );
                })()}

                {/* Straight to the model's own page, skipping the drawer.
                    The drawer answers "why is this flagged"; this answers
                    "show me everything". stopPropagation, or the click would
                    also open the drawer it is meant to bypass. */}
                <Link
                  to={`/cycle-time/${encodeURIComponent(m.customer)}/${encodeURIComponent(m.assembly)}`}
                  onClick={(e) => e.stopPropagation()}
                  title={`Open ${m.assembly}`}
                  className="flex items-center justify-center rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {open && (
        <RouteComparisonDrawer
          customer={open.customer}
          assembly={open.assembly}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
