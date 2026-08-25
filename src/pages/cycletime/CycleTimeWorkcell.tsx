/**
 * CycleTimeWorkcell.tsx
 * ──────────────────────
 * Dedicated page for one cycle-time workcell (= customer), reached by picking a
 * row in the Workcells league table.
 *
 * Route: /cycle-time/wc/:customer
 *
 * Branded header (logo + name + assembly coverage card) over the assemblies
 * flow view, locked to this customer — no customer Select in the filter bar.
 */

import { ArrowLeft, BookOpen, ClipboardList, Loader2, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { matchCustomerStatus } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import {
  useCycleTimeCustomers,
  useCycleTimeCustomerStatus,
  useCycleTimeProfile,
  useInvalidateOnRefreshComplete,
} from '@/hooks/cycle_time/useCycleTimeData';

import CycleTimeAssemblyFlow from './CycleTimeAssemblyFlow';
import { ProcessRegistryPanel } from './ProcessRegistry';
import CompletionDataTable from './CompletionDataTable';

const TABS = [
  { key: 'cycle',    label: 'Cycle Time', icon: Timer },
  { key: 'report',   label: 'Report',     icon: ClipboardList,
    tip: 'Every model in demand: its status, the gap behind it, and how fresh the inputs are' },
  { key: 'registry', label: 'Processes',  icon: BookOpen,
    tip: 'What this workcell runs, and what MES and IEDB each call it' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function CycleTimeWorkcell() {
  useInvalidateOnRefreshComplete();

  const navigate = useNavigate();
  const { customer: rawCustomer = '' } = useParams();
  // The URL customer may arrive in the MES spelling (e.g. "RESMED" from a Plant
  // Runner row) which the cycle-time endpoints match case-sensitively. Resolve
  // it to the configured spelling ("ResMed") so BOTH tabs' queries hit data.
  const { data: customerList } = useCycleTimeCustomers();
  const customer = useMemo(() => {
    const match = (customerList ?? []).find((c) => c.customer.toLowerCase() === rawCustomer.toLowerCase());
    return match?.customer ?? rawCustomer;
  }, [customerList, rawCustomer]);
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  // `?tab=status` was the old Status Report, now merged into Report. Links to it
  // exist in chats and bookmarks, so it redirects rather than silently falling
  // back to Cycle Time — the person clicking it wanted the completion numbers.
  const [tab, setTab] = useState<TabKey>(
    urlTab === 'status' ? 'report'
      : urlTab === 'report' || urlTab === 'registry' ? urlTab : 'cycle');
  const { data } = useCycleTimeProfile(customer);
  const { data: statusRows = [], isLoading: statusLoading, isError: statusError } = useCycleTimeCustomerStatus();

  const logo = getWorkcellLogo(customer);
  const summary = data?.summary;
  const subtitle = summary
    ? `${summary.lines} lines · ${summary.processes} processes`
    : 'Cycle-time profile';

  // Coverage figures come straight from the IEDB CustomerStatus report (same
  // source as the league table) — total / with-data / Complete %.
  const status = matchCustomerStatus(statusRows, customer);

  return (
    <div className="flex h-full flex-col">
      {/* ─── Branded header (coverage card pinned far right) + tabs ────── */}
      <div className="border-b border-border">
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back to league table */}
          <button
            onClick={() => navigate('/cycle-time/home')}
            title="All workcells"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Logo */}
          {logo ? (
            <div
              className="flex h-10 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border"
              style={{ backgroundColor: getWorkcellLogoBg(customer) ?? '#ffffff' }}
            >
              <img src={logo} alt={customer} className="h-full w-full object-contain p-1" />
            </div>
          ) : (
            <div className="flex h-10 w-24 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <span className="text-xs font-bold text-muted-foreground">{customer.slice(0, 3).toUpperCase()}</span>
            </div>
          )}

          {/* Name + subtitle */}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">{customer}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <AssemblyCoverageCard
          total={status?.NoOfAssemblies ?? null}
          withData={status?.NoOfAssembliesWithData ?? null}
          pct={status?.Complete ?? null}
          loading={statusLoading}
          unavailable={!statusLoading && (statusError || !status)}
        />
      </div>

        {/* Tabs — last element of the bordered header (underline overlaps border) */}
        <div className="px-6">
          <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </div>

      {/* ─── Tab content ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {tab === 'cycle' ? (
          <CycleTimeAssemblyFlow lockedCustomer={customer} />
        ) : tab === 'report' ? (
          // The ranked completion table, same component the global report page
          // uses — one component, so a workcell's own page and the global report
          // can never show a different verdict for the same model.
          //
          // This used to be two tabs. "Status Report" rendered the same verdicts
          // from a second component, and for a while the two printed different
          // Complete counts for the same workcell — which is the exact failure
          // the shared component was meant to prevent, reintroduced one level up.
          // Its two genuine additions (the split gap, the freshness banner) now
          // live here instead. `modules/cycle_time/completion_report.py` still
          // backs the Excel export.
          <CompletionDataTable lockedWorkcell={customer} />
        ) : (
          // Same panel as /cycle-time/registry, workcell locked. Its Answer /
          // Browse are PILL tabs, not another underline row — two identical tab
          // rows stacked and you cannot tell which level you are on.
          <div className="p-6"><ProcessRegistryPanel workcell={customer} /></div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact header card contrasting the two assembly counts, from the IEDB
 * CustomerStatus report:
 *   • total    — every assembly the customer has (NoOfAssemblies)
 *   • withData — assemblies that have cycle-time data (NoOfAssembliesWithData)
 *   • pct      — Complete %
 * The gap signals how complete the cycle-time data is. Shows a loader while the
 * report is fetching and a notice when it can't be loaded.
 */
function AssemblyCoverageCard({
  total,
  withData,
  pct,
  loading,
  unavailable,
}: {
  total: number | null;
  withData: number | null;
  pct: number | null;
  loading?: boolean;
  unavailable?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[11px]">Loading coverage…</span>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="flex items-center rounded-lg border border-border bg-card px-3.5 py-2">
        <span className="text-[11px] italic text-muted-foreground">Can't fetch coverage data</span>
      </div>
    );
  }

  const tone =
    pct == null ? 'text-muted-foreground'
    : pct >= 90 ? 'text-emerald-400'
    : pct >= 50 ? 'text-amber-400'
    : 'text-red-400';
  const bar =
    pct == null ? 'bg-muted-foreground/30'
    : pct >= 90 ? 'bg-emerald-500'
    : pct >= 50 ? 'bg-amber-400'
    : 'bg-red-500';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2">
      <div className="text-right leading-none">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">With data</div>
        <div className="mt-1 font-mono text-lg font-black tabular-nums text-emerald-400">
          {withData == null ? '…' : withData.toLocaleString()}
        </div>
      </div>

      <span className="text-muted-foreground/40">/</span>

      <div className="text-right leading-none">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</div>
        <div className="mt-1 font-mono text-lg font-black tabular-nums text-foreground">
          {total == null ? '…' : total.toLocaleString()}
        </div>
      </div>

      {/* Coverage % + thin bar */}
      <div className="ml-1 w-16">
        <div className={cn('text-right font-mono text-xs font-semibold tabular-nums', tone)}>
          {pct == null ? '—' : `${pct}%`}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/50">
          <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct ?? 0}%` }} />
        </div>
      </div>
    </div>
  );
}
