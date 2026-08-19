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

import { ArrowLeft, BookOpen, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';

import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import {
  useCycleTimeCustomers,
  useInvalidateOnRefreshComplete,
} from '@/hooks/cycle_time/useCycleTimeData';

import CompletionDataTable from './CompletionDataTable';
import { ProcessRegistryPanel } from './ProcessRegistry';

/** Two questions about one workcell, in the order people ask them: what are we
 *  building, then what do we call the steps. Processes is the same panel the old
 *  workcell page carried — imported, never re-implemented, because two registries
 *  drifting apart is exactly the failure this module keeps hitting. */
const TABS = [
  { key: 'models',   label: 'Models',    icon: Table2,
    tip: 'Every model this workcell owns, its status and the gap behind it' },
  { key: 'registry', label: 'Processes', icon: BookOpen,
    tip: 'What this workcell runs, and what MES and IEDB each call it' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function CycleTimeWorkcellModels() {
  useInvalidateOnRefreshComplete();

  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('models');
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

  const logo = getWorkcellLogo(customer);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/cycle-time/home')}
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
                Pick a row for the proof, open the page for the detail
              </p>
            </div>
          </div>

        </div>
        <div className="px-6">
          <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </div>

      {/* No overflow here. CompletionDataTable is `h-full` and runs its own
          scrollers; wrapping it in a second one collapsed its height and let the
          table spill. Only the registry panel, which is plain flow content,
          needs a scroller of its own. */}
      <div className="min-h-0 flex-1">
        {tab === 'models'
          ? <CompletionDataTable lockedWorkcell={customer} universeToggle />
          : <div className="h-full overflow-auto p-6"><ProcessRegistryPanel workcell={customer} /></div>}
      </div>
    </div>
  );
}
