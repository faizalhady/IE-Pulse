/**
 * CycleTimeWorkcell.tsx
 * ──────────────────────
 * Dedicated page for one cycle-time workcell (= customer), reached by picking a
 * row in the Workcells league table.
 *
 * Route: /cycle-time/wc/:customer
 *
 * Same explorer as the Overview page (Table / Breakdown tabs, DB|Live toggle,
 * download) but branded with the workcell's logo + name and locked to this
 * customer — no customer Select in the filter bar.
 */

import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import {
  useCycleTimeCustomers,
  useCycleTimeProfile,
  useInvalidateOnRefreshComplete,
} from '@/hooks/cycle_time/useCycleTimeData';

import CycleTimeExplorer from './CycleTimeExplorer';

export default function CycleTimeWorkcell() {
  useInvalidateOnRefreshComplete();

  const navigate = useNavigate();
  const { customer = '' } = useParams();
  const { data } = useCycleTimeProfile(customer);
  const { data: customers } = useCycleTimeCustomers();

  const logo = getWorkcellLogo(customer);
  const summary = data?.summary;
  const subtitle = summary
    ? `${summary.lines} lines · ${summary.processes} processes`
    : 'Cycle-time profile';

  // Two different counts (see header card): catalog total vs assemblies that
  // actually have cycle-time data in the local mart.
  const totalAssemblies = customers?.find((c) => c.customer === customer)?.assembly_count ?? null;
  const withData = summary?.assemblies ?? null;

  return (
    <CycleTimeExplorer
      lockedCustomer={customer}
      enableBreakdown={false}
      aside={<AssemblyCoverageCard total={totalAssemblies} withData={withData} />}
      headerLeft={
        <div className="flex items-center gap-3 min-w-0">
          {/* Back to league table */}
          <button
            onClick={() => navigate('/cycle-time/workcells')}
            title="All workcells"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          {/* Logo */}
          {logo ? (
            <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
              <img src={logo} alt={customer} className="h-full w-full object-contain p-1" />
            </div>
          ) : (
            <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <span className="text-xs font-bold text-muted-foreground">{customer.slice(0, 3).toUpperCase()}</span>
            </div>
          )}

          {/* Name + subtitle */}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground">{customer}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      }
    />
  );
}

/**
 * Compact header card contrasting the two assembly counts:
 *   • total    — every assembly the customer has in IEDB (catalog figure)
 *   • withData — assemblies that actually have cycle-time data locally
 * The gap signals how complete the pulled cycle-time data is.
 */
function AssemblyCoverageCard({ total, withData }: { total: number | null; withData: number | null }) {
  const pct =
    total && total > 0 && withData != null
      ? Math.min(100, Math.round((withData / total) * 100))
      : null;

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
