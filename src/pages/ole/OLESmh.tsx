/**
 * OLESmh.tsx — SMH Coverage + maintenance.
 *
 * Two sources, deliberately merged:
 *   /api/smh-status  what the LAST pipeline run saw — which produced
 *                    assemblies had SMH, and how many units each shipped.
 *   /api/smh         the LIVE SMH table, which the user is editing here.
 *
 * The status parquet is a snapshot, so an edit made a second ago is invisible
 * in it. Overlaying the live table means the row updates the moment you save —
 * otherwise saving a value appears to do nothing until Monday.
 *
 * Filters live in the URL, so a pre-filtered link can be sent to a workcell
 * owner: /ole/smh?workcell=ASP&status=NOT_IN_SMH_DB  (the 'Missing SMH' filter)
 */

import WorkcellBadge from '@/components/ole/WorkcellBadge';
import { Pagination } from '@/components/shared/Pagination';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSmhStatus } from '@/hooks/ole/useOleData';
import { fetchUserInfo, type UserInfo } from '@/lib/shared/savedReportsApi';
import { smhApi, type SmhRow } from '@/lib/ole/smhApi';
import { fmtDate } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ArrowUpDown, CheckCircle2, Clock, Loader2, Pencil, Plus,
  Search, Trash2, WifiOff, X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// UNUSED = in the SMH table but not produced in the current window. Only these
// are safe to delete as "outdated" — the other three are live production.
type RowStatus = 'OK' | 'NOT_IN_SMH_DB' | 'UNUSED';
type StatusFilter = 'all' | RowStatus;

// Scope, from the backend. ACTIVE is the default view and the only tier the
// headline counts — chasing a model last built in March is wasted effort, and
// UPCOMING has no SMH by definition (it has never been built to measure).
type Tier = 'ACTIVE' | 'UPCOMING' | 'DORMANT' | 'UNUSED';
type TierFilter = Tier | 'all';

const TIERS: { key: TierFilter; label: string; hint: string }[] = [
  { key: 'ACTIVE',   label: 'Active',       hint: 'Built in the last 90 days, or planned within 13 weeks' },
  // NOT "never built" — the MES window only reaches back to the oldest file the
  // share still had. A model built before that is absent, not new.
  { key: 'UPCOMING', label: 'Upcoming',     hint: 'Planned within 13 weeks, with no build in the MES window' },
  { key: 'DORMANT',  label: 'Dormant',      hint: 'Last built over 90 days ago, nothing planned' },
  // Kept its own tier, not folded into Dormant: 27k stale .xls rows would bury
  // the ~900 models that were genuinely built and then went quiet.
  { key: 'UNUSED',   label: 'Not produced', hint: 'Has an SMH value, but never built in the production window' },
  { key: 'all',      label: 'All',          hint: 'Every row, including SMH entries for models never built' },
];

const TIER_BADGE: Record<Tier, string> = {
  ACTIVE:   'bg-sky-500/15    text-sky-400    border-sky-500/30',
  UPCOMING: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  DORMANT:  'bg-slate-500/15  text-slate-400  border-slate-500/30',
  UNUSED:   'bg-zinc-500/15   text-zinc-400   border-zinc-500/30',
};

interface Row {
  workcell: string;
  assembly: string;
  smh_value: number;          // 0 = not set
  smh_status: RowStatus;
  total_qty_produced: number;
  last_seen_date: string | null;
  tier: Tier;
  next_build_date: string | null;
  next_build_qty: number;
  updated_by: string | null;
  updated_at: string | null;
  source: string | null;
}

const STATUS_BADGE: Record<RowStatus, string> = {
  OK:            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  NOT_IN_SMH_DB: 'bg-red-500/15     text-red-400     border-red-500/30',
  UNUSED:        'bg-slate-500/15   text-slate-400   border-slate-500/30',
};

const STATUS_LABEL: Record<RowStatus, string> = {
  OK: 'OK',
  NOT_IN_SMH_DB: 'Missing SMH',
  UNUSED: 'Not produced',
};

// 'Not produced' is a TIER now, not a status — leaving it here too gave two
// controls for one thing, in combinations that returned nothing.
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'NOT_IN_SMH_DB', label: 'Missing SMH' },
  { key: 'OK', label: 'OK' },
];

const GRID = '2.5rem 4rem 1fr 8rem 7rem 6rem 5.5rem';

// Tier tabs are built and working, just parked while the scope is being agreed.
// ?tier=UPCOMING etc. still switches tiers in the meantime.
const SHOW_TIER_TABS = false;
const ROWS_PER_PAGE = 100;
const key = (wc: string, asm: string) => `${wc}|||${asm}`;

export default function OLESmh() {
  // ── URL-driven filter state ────────────────────────────────────────────────
  // The URL is the state, not a mirror of it. That makes every filter
  // combination a link someone can be sent.
  const [searchParams, setSearchParams] = useSearchParams();
  const workcellFilter = searchParams.get('workcell') ?? 'all';
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;
  // Defaults to ACTIVE, not 'all' — the page should open on the models actually
  // worth chasing. ?tier=all still works for the full list.
  const tierFilter = (searchParams.get('tier') ?? 'ACTIVE') as TierFilter;
  const search = searchParams.get('q') ?? '';

  const setParam = useCallback((k: string, v: string, dflt = 'all') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!v || v === dflt) next.delete(k);
      else next.set(k, v);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // ── Data ───────────────────────────────────────────────────────────────────
  // Fetches every workcell — filtering is client-side, which is what makes the
  // workcell dropdown instant.
  const { data: statusData, loading, error } = useSmhStatus();
  const [live, setLive] = useState<SmhRow[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    try {
      setLive(await smhApi.list());
      setLiveError(null);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void loadLive(); }, [loadLive]);

  // ── Identity + permission ──────────────────────────────────────────────────
  const [user, setUser] = useState<UserInfo | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const u = await fetchUserInfo();
      if (!alive) return;
      setUser(u);
      if (!u) return;
      // Ask the backend rather than duplicating the allowlist here — one place
      // to change when the list grows.
      try {
        const { can_edit } = await smhApi.canEdit(u.userNtid);
        if (alive) setCanEdit(can_edit);
      } catch { /* leave read-only */ }
    })();
    return () => { alive = false; };
  }, []);

  // ── Merge snapshot + live table ────────────────────────────────────────────
  const rows = useMemo((): Row[] => {
    const liveMap = new Map((live ?? []).map(r => [key(r.workcell, r.assembly), r]));
    const out: Row[] = [];
    const seen = new Set<string>();

    for (const s of statusData ?? []) {
      const k = key(s.workcell, s.assembly);
      seen.add(k);
      const l = liveMap.get(k);
      const value = l ? l.smh_value : (s.smh_value || 0);
      out.push({
        workcell: s.workcell,
        assembly: s.assembly,
        smh_value: value,
        // Derived from the LIVE value, not the snapshot's status — that's the
        // whole point of the overlay.
        smh_status: value > 0 ? 'OK' : 'NOT_IN_SMH_DB',
        total_qty_produced: s.total_qty_produced,
        last_seen_date: s.last_seen_date,
        tier: s.tier ?? 'ACTIVE',
        next_build_date: s.next_build_date ?? null,
        next_build_qty: s.next_build_qty ?? 0,
        updated_by: l?.updated_by ?? null,
        updated_at: l?.updated_at ?? null,
        source: l?.source ?? null,
      });
    }

    // SMH rows with no production in the window. Shown so outdated entries can
    // be found and removed — they're invisible in the coverage snapshot.
    for (const l of live ?? []) {
      const k = key(l.workcell, l.assembly);
      if (seen.has(k)) continue;
      out.push({
        workcell: l.workcell,
        assembly: l.assembly,
        smh_value: l.smh_value,
        smh_status: 'UNUSED',
        total_qty_produced: 0,
        last_seen_date: null,
        tier: 'UNUSED',         // in the SMH table, never produced in the window
        next_build_date: null,
        next_build_qty: 0,
        updated_by: l.updated_by,
        updated_at: l.updated_at,
        source: l.source,
      });
    }
    return out;
  }, [statusData, live]);

  const workcells = useMemo(
    () => ['all', ...Array.from(new Set(rows.map(r => r.workcell))).sort()],
    [rows],
  );

  // null = default order (highest volume first). Clicking the Next build header
  // cycles soonest → latest → back to default.
  const [sortNext, setSortNext] = useState<'asc' | 'desc' | null>(null);

  const filtered = useMemo(() => {
    let list = rows;
    if (tierFilter !== 'all') list = list.filter(r => r.tier === tierFilter);
    if (workcellFilter !== 'all') list = list.filter(r => r.workcell === workcellFilter);
    if (statusFilter !== 'all') list = list.filter(r => r.smh_status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.assembly.toLowerCase().includes(q) || r.workcell.toLowerCase().includes(q));
    }
    // Rows with no planned build sort last either way — an empty date must not
    // win "soonest" just because '' sorts before any real date.
    const byNext = (a: Row, b: Row) => {
      if (!a.next_build_date) return b.next_build_date ? 1 : 0;
      if (!b.next_build_date) return -1;
      const d = a.next_build_date.localeCompare(b.next_build_date);
      return sortNext === 'asc' ? d : -d;
    };
    return [...list].sort(sortNext
      ? byNext
      : (a, b) => b.total_qty_produced - a.total_qty_produced);
  }, [rows, tierFilter, workcellFilter, statusFilter, search, sortNext]);

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [tierFilter, workcellFilter, statusFilter, search]);
  const paginated = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // ── Counts (workcell filter only — status/search would make them circular) ─
  // Counts follow the tier too — a headline that includes dormant models is the
  // thing the tiers exist to stop.
  const scoped = rows.filter(r =>
    (workcellFilter === 'all' || r.workcell === workcellFilter) &&
    (tierFilter === 'all' || r.tier === tierFilter));
  const produced = scoped.filter(r => r.smh_status !== 'UNUSED');
  const missingCount = produced.filter(r => r.smh_status !== 'OK').length;
  const okCount = produced.filter(r => r.smh_status === 'OK').length;
  const totalQtyMissing = produced
    .filter(r => r.smh_status !== 'OK')
    .reduce((s, r) => s + r.total_qty_produced, 0);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [draft, setDraft] = useState({ workcell: '', assembly: '', smh: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeModals = () => {
    setEditing(null); setAdding(false); setDeleting(null);
    setFormError(null); setDraft({ workcell: '', assembly: '', smh: '' });
  };

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      await loadLive();
      // Hold the modal open long enough for the tick to draw — the write has
      // already landed, this is only the confirmation the user asked for.
      setSaved(true);
      await new Promise(r => setTimeout(r, 850));
      setSaved(false);
      closeModals();
      setToast(message);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const activeFilters = search || statusFilter !== 'all' || workcellFilter !== 'all'
    || tierFilter !== 'ACTIVE';

  return (
    <div className="space-y-5 p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SMH Coverage</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Loading…' : error ? 'Backend unreachable' :
              'Assembly models in MES production, with their Standard Man Hours per unit'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <WifiOff className="h-3.5 w-3.5" /> API offline
            </span>
          )}
          {canEdit && (
            <button
              onClick={() => { setAdding(true); setDraft({ workcell: workcellFilter === 'all' ? '' : workcellFilter, assembly: '', smh: '' }); }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add SMH
            </button>
          )}
        </div>
      </div>

      {/* Read-only notice — degrade, don't disappear */}
      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            You are viewing SMH in read-only mode. Editing is restricted, because an SMH
            change moves the reported OLE % for every past week. Contact the IE team to
            request a change{user ? '' : ' (or sign in on the corporate network)'}.
          </p>
        </div>
      )}

      {liveError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5">
          <p className="text-xs text-destructive">Could not load live SMH values: {liveError}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-amber-500/60 bg-amber-50 dark:bg-amber-950 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-amber-600 dark:text-amber-400">Missing SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">{missingCount}</p>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-0.5">
            {totalQtyMissing.toLocaleString()} units produced earning nothing
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-emerald-600 dark:text-emerald-400">With SMH</p>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">{okCount}</p>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60 mt-0.5">assemblies with a valid SMH value</p>
        </div>
      </div>

      {/* Tier — the primary scope control, so it sits above the other filters */}
      {SHOW_TIER_TABS && <div className="flex flex-wrap items-center gap-1.5">
        {TIERS.map(t => {
          const n = rows.filter(r =>
            (workcellFilter === 'all' || r.workcell === workcellFilter) &&
            (t.key === 'all' || r.tier === t.key)).length;
          return (
            <button key={t.key} title={t.hint}
              onClick={() => setParam('tier', t.key, 'ACTIVE')}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
                tierFilter === t.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted')}>
              {t.label}
              <span className={cn('ml-1.5 font-mono',
                tierFilter === t.key ? 'opacity-80' : 'opacity-60')}>{n}</span>
            </button>
          );
        })}
        <span className="text-[11px] text-muted-foreground ml-2">
          {TIERS.find(t => t.key === tierFilter)?.hint}
        </span>
      </div>}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setParam('q', e.target.value, '')}
            placeholder="Search assembly…"
            className="pl-8 h-9"
          />
        </div>

        <div className="min-w-[160px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</Label>
          <Select value={statusFilter} onValueChange={v => setParam('status', v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              {FILTERS.map(({ key: k, label }) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[180px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
          <Select value={workcellFilter} onValueChange={v => setParam('workcell', v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All workcells" /></SelectTrigger>
            <SelectContent>
              {workcells.map(wc => (
                <SelectItem key={wc} value={wc}>{wc === 'all' ? 'All workcells' : wc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeFilters && (
          <button
            onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
            className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors"
          >
            Clear
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} assemblies</span>
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider px-5 py-3 gap-4"
                style={{ gridTemplateColumns: GRID }}>
                <span className="text-right">#</span>
                <span className="text-center">WC</span>
                <span>Assembly</span>
                <button
                  onClick={() => setSortNext(s => s === null ? 'asc' : s === 'asc' ? 'desc' : null)}
                  title="Sort by next planned build"
                  className="flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors">
                  Next build
                  <ArrowUpDown className={cn('h-3 w-3', sortNext ? 'text-primary' : 'opacity-40')} />
                  {sortNext === 'desc' && <span className="text-[9px]">↓</span>}
                  {sortNext === 'asc' && <span className="text-[9px]">↑</span>}
                </button>
                <span>Status</span>
                <span className="text-right">SMH / Unit</span>
                <span className="text-center">Actions</span>
              </div>

              {paginated.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No assemblies found</div>
              ) : paginated.map((row, idx) => {
                const badgeStatus = row.smh_status === 'OK' ? 'optimal'
                  : row.smh_status === 'UNUSED' ? 'optimal' : 'critical';
                const inDb = row.smh_value > 0;

                return (
                  <div
                    key={key(row.workcell, row.assembly)}
                    className="grid items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    <span className="text-xs text-muted-foreground font-mono text-right flex-shrink-0">
                      {(page - 1) * ROWS_PER_PAGE + idx + 1}
                    </span>

                    <WorkcellBadge name={row.workcell} status={badgeStatus} />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                          row.smh_status === 'OK' ? 'bg-emerald-400'
                            : row.smh_status === 'UNUSED' ? 'bg-slate-400' : 'bg-red-400')} />
                        <p className="font-semibold text-sm text-foreground font-mono truncate">{row.assembly}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {row.workcell}
                        {row.tier === 'UPCOMING' || row.smh_status === 'UNUSED'
                          ? ' · no build in this window'
                          : ` · Last build: ${fmtDate(row.last_seen_date ?? '')}`}
                        {/* Only a person's edit is worth attributing. Rows from the
                            .xls import carry updated_by='migration', which read as
                            "someone edited this" when nobody had. */}
                        {row.source === 'manual' && row.updated_by ? ` · edited by ${row.updated_by}` : ''}
                      </p>
                    </div>

                    <div className="text-xs">
                      {row.next_build_date ? (
                        <>
                          <div className="font-mono text-foreground">{fmtDate(row.next_build_date)}</div>
                          {row.next_build_qty > 0 && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {row.next_build_qty.toLocaleString()} pcs
                            </div>
                          )}
                        </>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </div>

                    <div className="flex flex-col items-start gap-1">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', STATUS_BADGE[row.smh_status])}>
                        {STATUS_LABEL[row.smh_status]}
                      </span>
                      {/* Only when the list is mixed — a tier pill on every row of
                          a single-tier view is noise. */}
                      {tierFilter === 'all' && (
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', TIER_BADGE[row.tier])}>
                          {row.tier}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-0.5 text-xs text-right">
                      <span className={cn('font-mono font-semibold', inDb ? 'text-foreground' : 'text-red-400')}>
                        {inDb ? row.smh_value.toFixed(4) : 'not set'}
                      </span>
                    </div>

                    <div className="flex justify-center gap-1">
                      {canEdit ? (
                        <>
                          <button
                            title={inDb ? 'Edit SMH value' : 'Add SMH value'}
                            onClick={() => {
                              setFormError(null);
                              if (inDb) { setEditing(row); setDraft({ ...draft, smh: String(row.smh_value) }); }
                              else { setAdding(true); setDraft({ workcell: row.workcell, assembly: row.assembly, smh: '' }); }
                            }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          >
                            {inDb ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </button>
                          <button
                            title={inDb ? 'Delete SMH value' : 'No stored value to delete'}
                            disabled={!inDb}
                            onClick={() => { setFormError(null); setDeleting(row); }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-25 disabled:hover:text-muted-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination page={page} total={filtered.length} pageSize={ROWS_PER_PAGE} onChange={setPage} />
      )}

      {missingCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-400/90">
            Units produced without an SMH value earn <strong>zero</strong> standard hours, but
            their labour hours still count against OLE. Filling these in raises the reported
            OLE % — for past weeks too, since the pipeline recomputes the full history.
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-border bg-card shadow-2xl px-4 py-3 flex items-start gap-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center animate-in zoom-in-50 duration-300">
            <Tick className="h-3.5 w-3.5" />
          </span>
          <p className="text-xs text-foreground">{toast}</p>
          <button onClick={() => setToast(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Edit / Add */}
      {(editing || adding) && (
        <Modal
          title={editing ? 'Edit SMH Value' : 'Add SMH Value'}
          onClose={closeModals}
          busy={busy}
          saved={saved}
          error={formError}
          confirmLabel={editing ? 'Save' : 'Add'}
          onConfirm={() => {
            if (!user) return setFormError('Could not determine who you are.');
            const value = Number(draft.smh);
            if (!draft.smh.trim() || Number.isNaN(value)) return setFormError('Enter a number.');
            if (value <= 0) return setFormError('SMH must be greater than 0. To record "not known", delete the row instead.');
            if (editing) {
              return run(
                () => smhApi.update(editing.workcell, editing.assembly, value, user.userNtid),
                `Saved ${editing.assembly}. It applies at the next pipeline refresh.`,
              );
            }
            if (!draft.workcell.trim() || !draft.assembly.trim()) return setFormError('Workcell and assembly are required.');
            return run(
              () => smhApi.create({ workcell: draft.workcell.trim(), assembly: draft.assembly.trim(), smh_value: value }, user.userNtid),
              `Added ${draft.assembly.trim()}. It applies at the next pipeline refresh.`,
            );
          }}
        >
          {editing ? (
            <>
              <Field label="Workcell" value={editing.workcell} />
              <Field label="Assembly" value={editing.assembly} mono />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Workcell</Label>
                <Select value={draft.workcell} onValueChange={v => setDraft(d => ({ ...d, workcell: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select workcell" /></SelectTrigger>
                  <SelectContent>
                    {workcells.filter(w => w !== 'all').map(wc => (
                      <SelectItem key={wc} value={wc}>{wc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Assembly</Label>
                <Input value={draft.assembly} onChange={e => setDraft(d => ({ ...d, assembly: e.target.value }))}
                  placeholder="Assembly number" className="font-mono" />
              </div>
            </>
          )}
          <div className="space-y-2 pt-2">
            <Label className="text-sm font-semibold">SMH / Unit</Label>
            <Input type="number" step="0.0001" min="0" value={draft.smh}
              onChange={e => setDraft(d => ({ ...d, smh: e.target.value }))}
              placeholder="0.0000" className="font-mono" autoFocus />
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
              Saved immediately, but OLE numbers only change at the next pipeline
              refresh — and then for every past week, not just from today.
            </p>
          </div>
        </Modal>
      )}

      {/* Delete */}
      {deleting && (
        <Modal
          title="Delete SMH Value"
          onClose={closeModals}
          busy={busy}
          saved={saved}
          error={formError}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (!user) return setFormError('Could not determine who you are.');
            return run(
              () => smhApi.remove(deleting.workcell, deleting.assembly, user.userNtid),
              `Deleted ${deleting.assembly}. It applies at the next pipeline refresh.`,
            );
          }}
        >
          <Field label="Workcell" value={deleting.workcell} />
          <Field label="Assembly" value={deleting.assembly} mono />
          <Field label="Current SMH" value={deleting.smh_value.toFixed(4)} mono />
          {deleting.total_qty_produced > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This assembly produced {deleting.total_qty_produced.toLocaleString()} units.
                Deleting its SMH makes all of them earn zero standard hours, which will
                <strong> lower</strong> the reported OLE %.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Small local pieces ───────────────────────────────────────────────────────
// Local, not in components/: nothing else needs them, and a shared modal would
// have to grow options to serve two callers.

/** Green tick that draws its stroke on — the "it saved" signal. */
function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}
      strokeLinecap="round" strokeLinejoin="round"
      className={cn('text-emerald-500', className)}>
      <path d="M4 12.5 9.5 18 20 6.5" strokeDasharray="30" className="animate-tick-draw" />
    </svg>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className={cn('font-medium text-foreground', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose, onConfirm, confirmLabel, busy, saved, error, destructive }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy: boolean;
  saved: boolean;
  error: string | null;
  destructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <p className="font-bold text-foreground text-lg">{title}</p>
          <button onClick={onClose} disabled={busy}
            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          {children}
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors shadow-sm disabled:opacity-40">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60',
              saved ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/40 disabled:opacity-100'
                : destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90')}>
            {saved ? <Tick className="h-4 w-4" />
              : busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saved ? 'Saved' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
