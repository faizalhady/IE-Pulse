/**
 * CycleTimeAssemblies.tsx
 * ───────────────────────
 * Standalone "Cycle Time by Assembly" page — customer picked from the filter
 * bar. The table itself is the shared CycleTimeAssembliesTable component (also
 * used, customer-locked, in the workcell page's Breakdown tab).
 *
 * Route: /cycle-time/assemblies
 */

import { Boxes } from 'lucide-react';

import { useInvalidateOnRefreshComplete } from '@/hooks/cycle_time/useCycleTimeData';

import CycleTimeAssembliesTable from './CycleTimeAssembliesTable';

export default function CycleTimeAssemblies() {
  useInvalidateOnRefreshComplete();

  return (
    <div className="flex h-full flex-col">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Boxes className="h-5 w-5 text-emerald-500" /> Cycle Time by Assembly
        </h1>
      </div>

      {/* Customer picked in the filter bar (no lockedCustomer). */}
      <div className="flex-1 min-h-0">
        <CycleTimeAssembliesTable />
      </div>
    </div>
  );
}
