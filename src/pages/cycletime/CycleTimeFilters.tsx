/**
 * CycleTimeFilters.tsx
 * ─────────────────────
 * Filter bar above the pivoted table. State is mirrored to URL search params
 * (?customer=ASP&sub_workcenter=...&assembly=...) so views are deep-linkable.
 *
 * Sizing + theme intentionally matches src/pages/ole/OLEFilters.tsx so the
 * filter bar feels identical across apps.
 */

import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCycleTimeCustomers } from '@/hooks/cycle_time/useCycleTimeData';

const ALL = '__all__';

export interface CycleTimeFiltersValue {
  customer: string;
  sub_workcenter: string;
  assembly: string;
}

interface CycleTimeFiltersProps {
  /** Lines (sub_workcenters) available in the currently loaded customer's data. */
  availableLines: string[];
  /** Number of rows currently shown — rendered on the right, OLE-style. */
  rowCount: number;
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

export default function CycleTimeFilters({ availableLines, rowCount }: CycleTimeFiltersProps) {
  const customers = useCycleTimeCustomers();
  const [filters, setFilters] = useCycleTimeFilters();

  const hasFilters = !!(filters.customer || filters.sub_workcenter || filters.assembly);

  return (
    <div className="px-6 pt-4 pb-3 flex flex-wrap items-end gap-3 transition-colors duration-200">

      {/* 1. Customer (required — pick first) */}
      <div className="min-w-[200px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Customer <span className="text-red-500/80">*</span>
        </Label>
        <Select
          value={filters.customer || undefined}
          onValueChange={(v) => setFilters({ customer: v, sub_workcenter: '' })}
        >
          <SelectTrigger className="mt-1 h-9">
            <SelectValue placeholder="Select customer…" />
          </SelectTrigger>
          <SelectContent>
            {(customers.data ?? [])
              .slice()
              .sort((a, b) => a.customer.localeCompare(b.customer))
              .map((c) => (
                <SelectItem key={c.customer} value={c.customer}>
                  {c.customer}{' '}
                  <span className="text-muted-foreground">
                    ({c.assembly_count.toLocaleString()})
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Line (optional) */}
      <div className="min-w-[220px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Line
        </Label>
        <Select
          value={filters.sub_workcenter || ALL}
          onValueChange={(v) => setFilters({ sub_workcenter: v === ALL ? '' : v })}
          disabled={!filters.customer || availableLines.length === 0}
        >
          <SelectTrigger className="mt-1 h-9">
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
      </div>

      {/* 3. Assembly search */}
      <div className="flex flex-col">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Search assembly
        </Label>
        <div className="relative mt-1 w-[240px] lg:w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.assembly}
            onChange={(e) => setFilters({ assembly: e.target.value })}
            placeholder="e.g. 00-27000"
            className="pl-8 h-9"
            disabled={!filters.customer}
          />
        </div>
      </div>

      {/* 4. Clear */}
      {hasFilters && (
        <button
          onClick={() => setFilters({ customer: '', sub_workcenter: '', assembly: '' })}
          className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
        >
          Clear all
        </button>
      )}

      {/* Row count — far right */}
      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
        {rowCount.toLocaleString()} rows
      </span>
    </div>
  );
}
