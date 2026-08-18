/**
 * CycleTimeWorkcellModels.tsx  —  CANDIDATE, being judged
 * ───────────────────────────────────────────────────────
 * One workcell's models, on ONE table.
 *
 * Route: /cycle-time/models/:customer   (reached from the home2 candidate)
 *
 * WHAT IS BEING TRIED HERE
 *   The live workcell page answers the same question twice. Its "Cycle Time"
 *   tab lists every model the workcell owns and shows the cycle times inline;
 *   its "Report" tab lists only the models in demand, with the verdicts and the
 *   split gap. Two lists, two looks, two behaviours — and a model that appears
 *   on both is described differently on each.
 *
 *   This page collapses that into one table with a scope switch:
 *     In demand   ordered in the next 13 weeks — the working list
 *     All models  every model the workcell owns — the denominator
 *
 *   Same rows, same colours, same drawer either way. The scope changes WHICH
 *   models are listed, never how one is drawn.
 *
 * THE THREE LAYERS, ONE QUESTION EACH
 *   this page   which models need work            table
 *   drawer      why is this one flagged           a glance, you stay here
 *   model page  everything about one model        /cycle-time/wc/:c/:a
 *
 *   The drawer now links to the model page, so the deep view is reachable and
 *   sendable instead of being a dead end. New per-model breakdowns belong on
 *   the model page; new cross-model columns belong on the table. Nothing new
 *   should be added to the drawer — it is a preview of the page, not a rival.
 *
 * ponytail: the header is CycleTimeWorkcell's, minus the tab row. Kept as a
 * separate file on purpose — the live page must keep working while this is
 * judged. Delete one of the two once a decision is made; do not let both live.
 */

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { matchCustomerStatus } from '@/lib/cycle_time/cycleTimeApi';
import { cn } from '@/lib/utils';
import {
  useCycleTimeCustomers,
  useCycleTimeCustomerStatus,
  useInvalidateOnRefreshComplete,
} from '@/hooks/cycle_time/useCycleTimeData';

import CompletionDataTable from './CompletionDataTable';

export default function CycleTimeWorkcellModels() {
  useInvalidateOnRefreshComplete();

  const navigate = useNavigate();
  const { customer: rawCustomer = '' } = useParams();

  // The URL may carry the MES spelling ("NOKIA OPTICS") while the cycle-time
  // endpoints match the configured one ("Nokia Optics") case-sensitively.
  // Resolve it once here so every query below hits data.
  const { data: customerList } = useCycleTimeCustomers();
  const customer = useMemo(() => {
    const match = (customerList ?? []).find(
      (c) => c.customer.toLowerCase() === rawCustomer.toLowerCase());
    return match?.customer ?? rawCustomer;
  }, [customerList, rawCustomer]);

  const { data: statusRows = [], isLoading: statusLoading, isError: statusError } =
    useCycleTimeCustomerStatus();
  const status = matchCustomerStatus(statusRows, customer);
  const logo = getWorkcellLogo(customer);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/cycle-time/home2')}
              title="All workcells"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {logo ? (
              <div
                className="flex h-10 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border"
                style={{ backgroundColor: getWorkcellLogoBg(customer) ?? '#ffffff' }}
              >
                <img src={logo} alt={customer} className="h-full w-full object-contain p-1" />
              </div>
            ) : (
              <div className="flex h-10 w-24 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <span className="text-xs font-bold text-muted-foreground">
                  {customer.slice(0, 3).toUpperCase()}
                </span>
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground">{customer}</h1>
              <p className="truncate text-[11px] text-muted-foreground">
                Every model, one table — pick a row for the proof, open the page for the detail
              </p>
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
      </div>

      <div className="min-h-0 flex-1">
        <CompletionDataTable lockedWorkcell={customer} universeToggle />
      </div>
    </div>
  );
}

/**
 * Total vs with-data assemblies, from IEDB's own CustomerStatus report — the
 * same source the workcell league table ranks on, so the two can never
 * disagree. The gap between the two numbers is the point.
 */
function AssemblyCoverageCard({
  total, withData, pct, loading, unavailable,
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
    <div className="flex flex-shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2">
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
