/**
 * DemandCompletionReport.tsx
 * ──────────────────────────
 * Completion status for the models we are actually building and about to build.
 *
 * This file is only the shell: page header + tabs. Both tabs live elsewhere and
 * are shared — the table with the workcell page's Report tab, the 4Q with its
 * own standalone route — so no view of completion can drift from another.
 *
 *   Data Table → CompletionDataTable
 *   4Q Report  → CycleTime4QReport (embedded)
 *
 * Route: /cycle-time/completion
 */

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { useCycleTimeCompletionDemand } from '@/hooks/cycle_time/useCycleTimeData';
import { LayoutGrid, Table2 } from 'lucide-react';
import { useState } from 'react';
import CompletionDataTable from './CompletionDataTable';
import CycleTime4QReport from './CycleTime4QReport';

/** Two views of the same completion data — the ranked list, and the 4Q that
 *  summarises it. Same page so they can never be read as different reports. */
const TABS = [
  { key: 'table', label: 'Data Table', icon: Table2 },
  { key: '4q', label: '4Q Report', icon: LayoutGrid, badge: 'Testing Phase' },
] as const;

export default function DemandCompletionReport() {
  // Same query key as the table's — react-query serves both from one fetch.
  const { data } = useCycleTimeCompletionDemand();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('table');

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Page header + tabs ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border bg-background px-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Report</h1>
            <p className="text-xs text-muted-foreground">
              Models in demand — MES plan (~4wk) + planner forecast (~13wk) — ranked by demand.
            </p>
          </div>
          {data?.as_of && (
            <span className="text-[11px] text-muted-foreground">
              checked {new Date(data.as_of).toLocaleString()}
              {data.unchecked > 0 && <> · <span className="text-amber-600 dark:text-amber-400">
                {data.unchecked.toLocaleString()} not yet checked</span></>}
            </span>
          )}
        </div>
        {/* -mb-px on the row (inside UnderlineTabs) lands the active underline
            on top of this header's bottom border — hence tabs go last. */}
        <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} className="mt-3" />
      </div>

      <div className="min-h-0 flex-1">
        {tab === '4q' ? <CycleTime4QReport embedded /> : <CompletionDataTable />}
      </div>
    </div>
  );
}
