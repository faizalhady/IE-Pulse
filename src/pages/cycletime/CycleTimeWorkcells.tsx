/**
 * CycleTimeWorkcells.tsx
 * ───────────────────────
 * "League table" of cycle-time workcells (= customers). Logo + name, then the
 * one stat that matters here: how much of each customer's assembly catalogue
 * actually has cycle-time data (with data / missing / total + coverage), plus
 * freshness. The richer per-line/process breakdown lives on the dedicated
 * workcell page.
 *
 * Route: /cycle-time/workcells
 *
 * Data: catalogue totals from /customers, with-data counts + freshness from
 * /coverage (a single request — no per-customer round trips). Workcells with
 * zero data are hidden; a count of them is shown in the header so they're not
 * forgotten. Sorted A–Z.
 */

import { RegistrySearch } from '@/components/shared/RegistrySearch';
import { SortHeader } from '@/components/shared/SortHeader';
import { useCycleTimeCoverage, useCycleTimeCustomerPlants, useCycleTimeCustomers, useCycleTimeCustomerStatus } from '@/hooks/cycle_time/useCycleTimeData';
import { useSortable } from '@/hooks/shared/useSortable';
import { matchCustomerStatus, type CycleTimeCustomerStatus } from '@/lib/cycle_time/cycleTimeApi';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(11rem,1fr) 6.5rem 16rem 8.5rem 16rem 8.5rem';

/** MES plant codes → friendly display names (unmapped plants shown as-is). */
const PLANT_LABELS: Record<string, string> = { JPE: 'Plant 2', JBK: 'Batu Kawan' };
const plantLabel = (p: string | null) => (p == null ? null : PLANT_LABELS[p] ?? p);

type WcSortKey = 'customer' | 'plant' | 'withData' | 'complete' | 'method' | 'estimate';
const WC_COLUMNS: { label: string; key?: WcSortKey }[] = [
  { label: '#' },
  { label: 'Workcell', key: 'customer' },
  { label: 'Plant', key: 'plant' },
  { label: 'Assemblies (with data / total)', key: 'withData' },
  { label: 'Completion %', key: 'complete' },
  { label: 'Measurement method', key: 'method' },
  { label: 'Estimate %', key: 'estimate' },
];

/** Estimate share above this (%) is treated as a data-quality risk → red. */
const ESTIMATE_RED_THRESHOLD = 30;
const estimateIsHigh = (pct: number | null | undefined) => pct != null && pct > ESTIMATE_RED_THRESHOLD;

/** Data-coverage % (assemblies with cycle-time data ÷ catalogue total). */
function coverageColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}
function coverageBar(pct: number | null): string {
  if (pct == null) return 'bg-muted-foreground/30';
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 80) return 'bg-amber-400';
  return 'bg-red-500';
}

interface Row {
  customer: string;
  division: string;
  total: number;
  withData: number;
  revisions: number;
  active: number | null;
  inactive: number | null;
  missing: number;
  cov: number | null;
  updated: string | null;
  /** Matched IEDB CustomerStatus row (coverage + measurement-method counts). */
  status: CycleTimeCustomerStatus | null;
  /** Dominant plant from the MES buildplan (null if never built / unmatched). */
  plant: string | null;
}

const WC_ACCESSORS: Record<WcSortKey, (r: Row) => string | number | null> = {
  customer: (r) => r.customer,
  plant: (r) => r.plant,
  withData: (r) => r.status?.NoOfAssembliesWithData ?? null,
  complete: (r) => r.status?.Complete ?? null,
  // Measurement method has no single scalar — sort by total measured steps.
  method:   (r) => (r.status ? r.status.StopWatch + r.status.Most + r.status.Estimate : null),
  estimate: (r) => r.status?.EstimatePercentage ?? null,
};

export default function CycleTimeWorkcells() {
  const navigate = useNavigate();
  const { data: customers = [], isFetching: custFetching } = useCycleTimeCustomers();
  const { data: coverage = [], isFetching: covFetching } = useCycleTimeCoverage();
  const { data: customerStatus = [], isLoading: statusLoading, isError: statusError } = useCycleTimeCustomerStatus();
  const { data: customerPlants } = useCycleTimeCustomerPlants();

  const covByCustomer = useMemo(() => {
    const m = new Map<string, { assemblies: number; revisions: number; active: number | null; inactive: number | null; updated_on: string | null }>();
    for (const c of coverage) m.set(c.customer, { assemblies: c.assemblies, revisions: c.revisions, active: c.active ?? null, inactive: c.inactive ?? null, updated_on: c.updated_on });
    return m;
  }, [coverage]);

  // Dominant plant per customer, matched by normalised name (MES vs config
  // differ by case / underscore / spacing).
  const norm = (s: string) => s.trim().toUpperCase().replace(/_/g, ' ');
  const plantByCustomer = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of customerPlants?.plants ?? []) m.set(norm(p.customer), p.plant);
    return m;
  }, [customerPlants]);

  // Build rows, then keep only those that actually have data, sorted A–Z.
  const { visible, totals } = useMemo(() => {
    const rows: Row[] = customers.map((c) => {
      const cov = covByCustomer.get(c.customer);
      const withData = cov?.assemblies ?? 0;
      const total = c.assembly_count;
      return {
        customer: c.customer,
        division: c.division,
        total,
        withData,
        revisions: cov?.revisions ?? 0,
        active: cov?.active ?? null,
        inactive: cov?.inactive ?? null,
        missing: Math.max(0, total - withData),
        cov: total > 0 ? Math.min(100, Math.round((withData / total) * 100)) : null,
        updated: cov?.updated_on ?? null,
        status: matchCustomerStatus(customerStatus, c.customer),
        plant: plantLabel(plantByCustomer.get(norm(c.customer)) ?? null),
      };
    });
    const visible = rows
      .filter((r) => r.withData > 0)
      .sort((a, b) => a.customer.localeCompare(b.customer));
    const hiddenNames = rows
      .filter((r) => r.withData === 0)
      .map((r) => r.customer)
      .sort((a, b) => a.localeCompare(b));
    const total = rows.reduce((s, r) => s + r.total, 0);
    const withData = rows.reduce((s, r) => s + r.withData, 0);
    const totals = {
      total,
      withData,
      missing: Math.max(0, total - withData),
      cov: total > 0 ? Math.min(100, Math.round((withData / total) * 100)) : null,
    };
    return { visible, hiddenNames, totals };
  }, [customers, covByCustomer, customerStatus, plantByCustomer]);

  const { sorted, sort, toggle } = useSortable(visible, WC_ACCESSORS, { key: 'customer', dir: 'asc' });

  const loading = (custFetching && customers.length === 0) || (covFetching && coverage.length === 0);

  return (
    <div className="p-5">
      {/* One box for workcell / model / process. Someone arriving here knows a
          part number OR a workcell OR a step name they read off a screen — and
          should not have to know which before they can look for it. */}
      <RegistrySearch className="mb-4 max-w-xl" />
      {/* overall summary — assemblies with data vs without */}
      {/* <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl ct-num font-bold tabular-nums text-foreground">{totals.total.toLocaleString()}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">assemblies</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl ct-num font-bold tabular-nums', coverageColor(totals.cov))}>{totals.withData.toLocaleString()}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">with data</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl ct-num font-bold tabular-nums text-muted-foreground">{totals.missing.toLocaleString()}</span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">without data</span>
        </div>
        <div className="ml-auto flex items-center gap-3 min-w-[12rem]">
          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', coverageBar(totals.cov))} style={{ width: `${totals.cov ?? 0}%` }} />
          </div>
          <span className={cn('text-sm ct-num font-bold tabular-nums', coverageColor(totals.cov))}>
            {totals.cov == null ? '—' : `${totals.cov}%`}
          </span>
        </div>
      </div> */}

      {/* league table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="grid bg-muted/50 text-[12px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
          style={{ gridTemplateColumns: GRID }}
        >
          {WC_COLUMNS.map((col, i) =>
            col.key ? (
              <SortHeader
                key={i}
                label={col.label}
                active={sort?.key === col.key}
                dir={sort?.dir}
                onClick={() => toggle(col.key!)}
                className="px-2 whitespace-nowrap"
              />
            ) : (
              <div key={i} className="px-2 py-2.5 whitespace-nowrap">{col.label}</div>
            ),
          )}
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workcells…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">No workcells with cycle-time data.</div>
        ) : (
          sorted.map((r, idx) => {
            const logo = getWorkcellLogo(r.customer);
            const updated = r.updated
              ? new Date(r.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '—';
            return (
              <button
                key={r.customer}
                onClick={() => navigate(`/cycle-time/${encodeURIComponent(r.customer)}`)}
                className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors relative"
                style={{ gridTemplateColumns: GRID, height: 60 }}
              >
                {/* position */}
                <div className="px-2">
                  <span className="text-xs ct-num font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
                </div>

                {/* logo + name */}
                <div className="px-2 flex items-center gap-3 min-w-0">
                  {logo ? (
                    <div
                      className="w-24 h-9 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: getWorkcellLogoBg(r.customer) ?? '#ffffff' }}
                    >
                      <img src={logo} alt={r.customer} className="w-full h-full object-contain p-0.5" />
                    </div>
                  ) : (
                    <div className="w-24 h-9 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-muted-foreground">{r.customer.slice(0, 3).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] xl:text-sm font-semibold text-foreground truncate">{r.customer}</p>
                    <p className="text-[10px] xl:text-[11px] text-muted-foreground truncate">{r.division}</p>
                  </div>
                </div>

                {/* plant — dominant plant from the MES buildplan */}
                <div className="px-2 flex items-center">
                  <span className="text-xs xl:text-[13px] text-foreground tabular-nums truncate">{r.plant ?? '—'}</span>
                </div>

                {/* assemblies — with data / missing / total. Numbers come straight
                    from the IEDB CustomerStatus report (no fallback). */}
                {statusLoading ? (
                  <CellLoader />
                ) : statusError || !r.status ? (
                  <CellEmpty />
                ) : (() => {
                  const st = r.status;
                  const cWith = st.NoOfAssembliesWithData;
                  const cTotal = st.NoOfAssemblies;
                  const cMissing = Math.max(0, cTotal - cWith);
                  return (
                    <div className="px-3 flex flex-col justify-center gap-2 leading-none">
                      <div className="flex items-baseline gap-3">
                        <NumLabel n={cWith} label="with data" tone={coverageColor(st.Complete)} bold />
                        <span className="text-border">/</span>
                        <NumLabel n={cTotal} label="total" tone="text-foreground" />
                        <span className="text-[9px] xl:text-[10px] text-muted-foreground whitespace-nowrap">({cMissing.toLocaleString()} missing)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', coverageBar(st.Complete))} style={{ width: `${st.Complete ?? 0}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* completion % — assemblies-with-data share (number only) */}
                {statusLoading ? (
                  <CellLoader />
                ) : statusError || !r.status ? (
                  <CellEmpty />
                ) : (
                  <div className="px-3 flex items-center">
                    <span className={cn('text-xs xl:text-sm ct-num font-bold tabular-nums', coverageColor(r.status.Complete))}>
                      {r.status.Complete == null ? '—' : `${r.status.Complete}%`}
                    </span>
                  </div>
                )}

                {/* measurement method — StopWatch / MOST / Estimate breakdown */}
                {statusLoading ? (
                  <CellLoader />
                ) : statusError || !r.status ? (
                  <CellEmpty />
                ) : (
                  <MethodCell status={r.status} />
                )}

                {/* estimate percentage — red when above the risk threshold */}
                {statusLoading ? (
                  <CellLoader />
                ) : statusError || !r.status ? (
                  <CellEmpty />
                ) : (
                  <div className="px-3 flex items-center">
                    <span className={cn(
                      'text-xs xl:text-sm ct-num font-bold tabular-nums',
                      estimateIsHigh(r.status.EstimatePercentage) ? 'text-red-400' : 'text-foreground',
                    )}>
                      {r.status.EstimatePercentage}%
                    </span>
                  </div>
                )}

                {/* revisions — distinct (assembly, revision) pairs */}
                {/* <div className="px-2 flex flex-col items-center justify-center leading-none">
                  <span className="text-base ct-num font-bold text-foreground tabular-nums">{r.revisions.toLocaleString()}</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">revisions</span>
                </div> */}

                {/* active — from IEDB /api/Assemblies/active (— until backend wired) */}
                {/* <div className="px-2 flex items-center justify-center">
                  <span className="text-sm ct-num font-semibold text-foreground tabular-nums">
                    {r.active == null ? '—' : r.active.toLocaleString()}
                  </span>
                </div> */}

                {/* inactive — from IEDB /api/Assemblies/inactive (— until backend wired) */}
                {/* <div className="px-2 flex items-center justify-center">
                  <span className="text-sm ct-num font-semibold text-muted-foreground tabular-nums">
                    {r.inactive == null ? '—' : r.inactive.toLocaleString()}
                  </span>
                </div>

                {/* updated */}
                {/* <div className="px-2 text-right text-[11px] ct-num text-muted-foreground tabular-nums">
                    {updated}
                  </div> */}

                {/* chevron */}
                {/* <div className="px-1 flex justify-center">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div> */}
              </button>
            );
          })
        )}
      </div>


    </div>
  );
}

// ─── Per-column states (shared by Coverage + Measurement method) ──────────────
/** Inline spinner shown in a single column cell while its data is fetching. */
function CellLoader() {
  return (
    <div className="px-3 flex items-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}
/** Shown when a column's data can't be fetched (request failed or no match). */
function CellEmpty() {
  return <div className="px-3 flex items-center text-[11px] text-muted-foreground italic">Can't fetch data</div>;
}

// ─── Measurement-method breakdown (StopWatch / MOST / Estimate) ───────────────
const METHODS = [
  { key: 'StopWatch', label: 'SW', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'Most', label: 'MOST', bar: 'bg-sky-500', dot: 'bg-sky-500' },
  { key: 'Estimate', label: 'Est', bar: 'bg-amber-400', dot: 'bg-amber-400' },
] as const;

function MethodCell({ status }: { status: CycleTimeCustomerStatus | null }) {
  const sw = status?.StopWatch ?? 0;
  const most = status?.Most ?? 0;
  const est = status?.Estimate ?? 0;
  const total = sw + most + est;
  const counts: Record<string, number> = { StopWatch: sw, Most: most, Estimate: est };

  if (!status || total === 0) {
    return <div className="px-3 text-[11px] text-muted-foreground">—</div>;
  }

  // The Estimate segment turns red when its share is above the risk threshold.
  const estHigh = estimateIsHigh(status.EstimatePercentage);
  const barClass = (key: string) => (key === 'Estimate' && estHigh ? 'bg-red-500' : METHODS.find((m) => m.key === key)!.bar);
  const dotClass = (key: string) => (key === 'Estimate' && estHigh ? 'bg-red-500' : METHODS.find((m) => m.key === key)!.dot);

  return (
    <div className="px-3 flex flex-col justify-center gap-1.5 leading-none">
      {/* legend + counts (label on top) */}
      <div className="flex items-center gap-2 xl:gap-2.5 text-[10px] xl:text-xs text-muted-foreground">
        {METHODS.map((m) => (
          <span key={m.key} className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 xl:w-2 xl:h-2 rounded-full', dotClass(m.key))} />
            {m.label}
            <span className="text-[11px] xl:text-xs ct-num font-bold text-foreground tabular-nums">{counts[m.key].toLocaleString()}</span>
          </span>
        ))}
      </div>
      {/* proportional bar (below the label) */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
        {METHODS.map((m) =>
          counts[m.key] > 0 ? (
            <div key={m.key} className={cn('h-full', barClass(m.key))} style={{ width: `${(counts[m.key] / total) * 100}%` }} />
          ) : null,
        )}
      </div>
    </div>
  );
}

// ─── Inline number + tiny label ───────────────────────────────────────────────
function NumLabel({ n, label, tone, bold }: { n: number; label: string; tone: string; bold?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className={cn('ct-num tabular-nums', bold ? 'text-[11px] xl:text-xs font-bold' : 'text-[11px] xl:text-xs font-semibold', tone)}>
        {n.toLocaleString()}
      </span>
      <span className="text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>
    </span>
  );
}
