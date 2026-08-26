/**
 * ProcessesGlobal — every (workcell, MES step) couple in the plant.
 *
 * The workcell page's Processes tab is this table locked to one workcell and to
 * the SCANNED steps. This is the same table with the lock off, defaulting to
 * everything MES has on a route:
 *
 *      configured  72,692 couples · 67,394 of them never scanned
 *      scanned      5,344 couples · 983 still unmapped
 *
 * Configured is the catalogue; scanned is the work. Both are here because
 * "why is this step not on the list" and "what is left to answer" are different
 * questions and the answer to the first is usually "it was never scanned".
 *
 * Server-paged and searched — 72k rows in one response is ~9 MB and the browser
 * would hold all of it to show thirty.
 */

import { cn } from '@/lib/utils';
import type { ProcessScope } from '@/lib/cycle_time/cycleTimeApi';
import { useState } from 'react';

import ProcessTable from './ProcessTable';

/** Scanned first, and the default. Configured is 72,692 couples of which 67,394
 *  have never been scanned, so opening on it meant opening on 93% noise. Scanned
 *  is the work list — the same reasoning that made Active the default everywhere
 *  else in this module. */
const SCOPES: { key: ProcessScope; label: string; hint: string }[] = [
  { key: 'scanned', label: 'Scanned', hint: 'Steps MES actually recorded a scan on — 5,344 couples. The work list.' },
  { key: 'configured', label: 'Configured', hint: 'Every step on a MES route — 72,692 couples, most never scanned' },
];

export default function ProcessesGlobal() {
  const [scope, setScope] = useState<ProcessScope>('scanned');

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 pb-3 pt-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold">Processes</h1>
          <p className="text-sm text-muted-foreground">
            Every MES step, every workcell, and what IEDB calls it. Edit one, or
            tick several and answer them together.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* keyed on scope: the two lists have different filters, sort and
            selection, and carrying one over to the other shows a selection the
            new list does not contain. */}
        <ProcessTable
          key={scope}
          scope={scope}
          scopeToggle={
            <div className="flex items-center rounded-lg border bg-card p-0.5">
              {SCOPES.map((s) => (
                <button key={s.key} type="button" onClick={() => setScope(s.key)} title={s.hint}
                  className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    scope === s.key ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground')}>
                  {s.label}
                </button>
              ))}
            </div>
          }
        />
      </div>
    </div>
  );
}
