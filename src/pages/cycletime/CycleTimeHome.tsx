/**
 * CycleTimeHome.tsx
 * ─────────────────
 * Cycle Time module "Overview" page — explore any customer's pivoted cycle
 * times. The customer is picked from the filter bar; everything else (source
 * toggle, Table/Breakdown tabs, download) lives in the shared explorer.
 *
 * The dedicated, branded workcell page (/cycle-time/wc/:customer) renders the
 * same explorer with the customer locked from the route.
 */

import { Database } from 'lucide-react';

import { useInvalidateOnRefreshComplete } from '@/hooks/cycle_time/useCycleTimeData';

import CycleTimeExplorer from './CycleTimeExplorer';

export default function CycleTimeHome() {
  useInvalidateOnRefreshComplete();

  return (
    <CycleTimeExplorer
      enableBreakdown={false}
      headerLeft={
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Database className="h-5 w-5 text-emerald-500" /> Cycle Time Data
        </h1>
      }
    />
  );
}
