/**
 * DemandCompletionReport.tsx
 * ──────────────────────────
 * Completion status for the models we are actually building and about to build.
 *
 * This file is only the shell: page header + the ranked table, which is shared
 * with the workcell page's Models tab so no view of completion can drift from
 * another.
 *
 *   Data Table → CompletionDataTable
 *
 * The 4Q used to be a second tab here. It is a report in its own right — it gets
 * presented, exported and sent on — and burying it as a tab on another page made
 * it something you had to already know about to find. It has its own route now:
 * /cycle-time/4q → CycleTime4QReport. Same component, no embed flag.
 *
 * Route: /cycle-time/completion
 */

import { useCycleTimeCompletionDemand } from '@/hooks/cycle_time/useCycleTimeData';
import CompletionDataTable from './CompletionDataTable';

/** `embedded` drops the page title. The report is a tab on Home now, and a
 *  second <h1> under the page's own is wrong for a screen reader and reads as a
 *  nested page to everyone else. Same flag CycleTime4QReport already uses. */
export default function DemandCompletionReport({ embedded = false }: { embedded?: boolean }) {
  // Same query key as the table's — react-query serves both from one fetch.
  const { data } = useCycleTimeCompletionDemand();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Page header + tabs ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border bg-background px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {!embedded && <h1 className="text-lg font-semibold">Report</h1>}
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
      </div>

      <div className="min-h-0 flex-1">
        <CompletionDataTable />
      </div>
    </div>
  );
}
