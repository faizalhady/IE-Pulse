/**
 * CycleTimeFilters.tsx
 * ─────────────────────
 * Filter bar above the pivoted table. State is mirrored to URL search params
 * (?customer=ASP&sub_workcenter=...&assembly=...) so views are deep-linkable.
 *
 * Sizing + theme intentionally matches src/pages/ole/OLEFilters.tsx so the
 * filter bar feels identical across apps.
 */

import { ReactNode, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCycleTimeCoverage, useCycleTimeCustomers } from '@/hooks/cycle_time/useCycleTimeData';

const ALL = '__all__';

export interface CycleTimeFiltersValue {
  customer: string;
  sub_workcenter: string;
  assembly: string;
}

interface CycleTimeFiltersProps {
  /** Lines (sub_workcenters) available in the currently loaded customer's data. */
  availableLines: string[];
  /** Rendered at the far right of the filter row (e.g. the Download button). */
  rightSlot?: ReactNode;
  /**
   * When set, the customer is fixed (e.g. on the dedicated workcell page where
   * it comes from the route). The customer Select is hidden and Line/Assembly
   * stay enabled against this customer.
   */
  lockedCustomer?: string;
}

/** Hook that exposes filter state synced to the URL. */
export function useCycleTimeFilters(): [
  CycleTimeFiltersValue,
  (next: Partial<CycleTimeFiltersValue>) => void,
] {
  const [params, setParams] = useSearchParams();
  const value: CycleTimeFiltersValue = {
    customer:       params.get('customer')       ?? '',
    sub_workcenter: params.get('sub_workcenter') ?? '',
    assembly:       params.get('assembly')       ?? '',
  };
  const setValue = (next: Partial<CycleTimeFiltersValue>) => {
    const merged = { ...value, ...next };
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) out.set(k, v);
    }
    setParams(out, { replace: true });
  };
  return [value, setValue];
}

export default function CycleTimeFilters({ availableLines, rightSlot, lockedCustomer }: CycleTimeFiltersProps) {
  const customers = useCycleTimeCustomers();
  const coverage = useCycleTimeCoverage();
  const [filters, setFilters] = useCycleTimeFilters();

  // Effective customer: the route-locked one (workcell page) or the picked one.
  const activeCustomer = lockedCustomer ?? filters.customer;
  const locked = Boolean(lockedCustomer);

  const hasFilters = !!(filters.sub_workcenter || filters.assembly);

  // Only offer workcells that actually have cycle-time data (same rule as the
  // league table). Sorted A–Z.
  const withDataCustomers = useMemo(() => {
    const has = new Set((coverage.data ?? []).filter((c) => c.assemblies > 0).map((c) => c.customer));
    return (customers.data ?? [])
      .filter((c) => has.has(c.customer))
      .slice()
      .sort((a, b) => a.customer.localeCompare(b.customer));
  }, [customers.data, coverage.data]);

  return (
    <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3 transition-colors duration-200">

      {/* 1. Workcell (required — pick first). Hidden when locked by the route. */}
      {!locked && (
        <Select
          value={filters.customer || undefined}
          onValueChange={(v) => setFilters({ customer: v, sub_workcenter: '' })}
        >
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="Select workcell…" />
          </SelectTrigger>
          <SelectContent>
            {withDataCustomers.map((c) => (
              <SelectItem key={c.customer} value={c.customer}>
                {c.customer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 2. Assembly search */}
      <div className="relative w-[260px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.assembly}
          onChange={(e) => setFilters({ assembly: e.target.value })}
          placeholder="Search assembly…"
          className="h-9 pl-8"
          disabled={!activeCustomer}
        />
      </div>

      {/* 3. Line (optional) */}
      <Select
        value={filters.sub_workcenter || ALL}
        onValueChange={(v) => setFilters({ sub_workcenter: v === ALL ? '' : v })}
        disabled={!activeCustomer || availableLines.length === 0}
      >
        <SelectTrigger className="h-9 w-[220px]">
          <SelectValue placeholder="All lines" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All lines</SelectItem>
          {availableLines.map((line) => (
            <SelectItem key={line} value={line}>
              {line}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 4. Clear — leaves a route-locked customer intact. */}
      {hasFilters && (
        <button
          onClick={() => setFilters(locked ? { sub_workcenter: '', assembly: '' } : { customer: '', sub_workcenter: '', assembly: '' })}
          className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
        >
          Clear all
        </button>
      )}

      {/* Far-right slot (e.g. Download) */}
      {rightSlot && <div className="ml-auto flex items-center">{rightSlot}</div>}
    </div>
  );
}
