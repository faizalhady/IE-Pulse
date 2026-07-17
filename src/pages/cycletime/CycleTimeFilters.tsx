/**
 * CycleTimeFilters.tsx
 * ─────────────────────
 * Filter bar above the pivoted table. State is mirrored to URL search params
 * (?customer=ASP&sub_workcenter=...&assembly=...) so views are deep-linkable.
 *
 * Sizing + theme intentionally matches src/pages/ole/OLEFilters.tsx so the
 * filter bar feels identical across apps.
 */

import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCycleTimeAssemblyList,
  useCycleTimeCoverage,
  useCycleTimeCustomers,
} from '@/hooks/cycle_time/useCycleTimeData';
import { cn } from '@/lib/utils';

/** Cap rendered combobox options — big customers (KEYSIGHT) have 50k+ assemblies. */
const MAX_OPTIONS = 100;

const ALL = '__all__';

/** The build stages a filter can target. */
export const STAGES = ['SMT', 'TH', 'BE'] as const;

/** Stage colour dots — match the Flow tab's workcenter colours. */
const STAGE_DOT: Record<string, string> = {
  SMT: 'bg-emerald-500', TH: 'bg-sky-500', BE: 'bg-violet-500',
};

export interface CycleTimeFiltersValue {
  customer: string;
  sub_workcenter: string;
  assembly: string;
  /** Comma-joined stage set (e.g. "SMT,TH"); empty = All. */
  stages: string;
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
  /**
   * When true, the Line select is replaced by All/SMT/TH/BE stage buttons that
   * filter assemblies by their exact stage footprint (used by the Flow tab).
   */
  stageMode?: boolean;
}

/** Hook that exposes filter state synced to the URL. */
export function useCycleTimeFilters(): [
  CycleTimeFiltersValue,
  (next: Partial<CycleTimeFiltersValue>) => void,
] {
  const [params, setParams] = useSearchParams();
  const value: CycleTimeFiltersValue = {
    customer: params.get('customer') ?? '',
    sub_workcenter: params.get('sub_workcenter') ?? '',
    assembly: params.get('assembly') ?? '',
    stages: params.get('stages') ?? '',
  };
  const setValue = (next: Partial<CycleTimeFiltersValue>) => {
    const merged = { ...value, ...next };
    // Preserve non-filter params already in the URL (e.g. ?tab=report) instead
    // of rebuilding from scratch — clearing a filter must not drop the tab.
    const out = new URLSearchParams(params);
    for (const k of ['customer', 'sub_workcenter', 'assembly', 'stages'] as const) {
      if (merged[k]) out.set(k, merged[k]); else out.delete(k);
    }
    setParams(out, { replace: true });
  };
  return [value, setValue];
}

export default function CycleTimeFilters({ availableLines, rightSlot, lockedCustomer, stageMode }: CycleTimeFiltersProps) {
  const customers = useCycleTimeCustomers();
  const coverage = useCycleTimeCoverage();
  const [filters, setFilters] = useCycleTimeFilters();

  // Effective customer: the route-locked one (workcell page) or the picked one.
  const activeCustomer = lockedCustomer ?? filters.customer;
  const locked = Boolean(lockedCustomer);

  const hasFilters = !!(filters.sub_workcenter || filters.assembly || filters.stages);

  // Stage filter (Flow tab): the selected set of build stages.
  const stageSel = useMemo(
    () => new Set(filters.stages ? filters.stages.split(',') : []),
    [filters.stages],
  );
  const toggleStage = (st: string) => {
    const next = new Set(stageSel);
    next.has(st) ? next.delete(st) : next.add(st);
    setFilters({ stages: Array.from(next).sort().join(',') });
  };
  const [stageOpen, setStageOpen] = useState(false);

  // Assembly box — single input that also shows a selectable dropdown of the
  // customer's assemblies (type to filter OR click to select).
  const [assemblyOpen, setAssemblyOpen] = useState(false);
  const assembliesQ = useCycleTimeAssemblyList(activeCustomer || undefined, filters.sub_workcenter || undefined);
  const { options, totalMatches } = useMemo(() => {
    const all = assembliesQ.data ?? [];
    const q = filters.assembly.trim().toLowerCase();
    const matched = q ? all.filter((a) => a.assembly.toLowerCase().includes(q)) : all;
    return { options: matched.slice(0, MAX_OPTIONS).map((a) => a.assembly), totalMatches: matched.length };
  }, [assembliesQ.data, filters.assembly]);

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

      {/* 2. Assembly — single input that also lists selectable assemblies */}
      <div className="relative w-[260px]">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={filters.assembly}
          onChange={(e) => { setFilters({ assembly: e.target.value }); setAssemblyOpen(true); }}
          onFocus={() => setAssemblyOpen(true)}
          onBlur={() => setAssemblyOpen(false)}
          placeholder="Search or select assembly…"
          className="h-9 pl-8"
          disabled={!activeCustomer}
          autoComplete="off"
        />
        {assemblyOpen && activeCustomer && (
          <div className="absolute left-0 top-10 z-50 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
            {assembliesQ.isLoading ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">Loading…</div>
            ) : options.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No assemblies found.</div>
            ) : (
              <>
                {options.map((a) => (
                  <button
                    key={a}
                    type="button"
                    // preventDefault keeps the input focused so this click registers
                    // before the input's onBlur closes the dropdown.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setFilters({ assembly: a }); setAssemblyOpen(false); }}
                    className={cn(
                      'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted',
                      filters.assembly === a && 'bg-muted',
                    )}
                  >
                    <span className="truncate">{a}</span>
                  </button>
                ))}
                {totalMatches > options.length && (
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    Showing {options.length} of {totalMatches.toLocaleString()} — keep typing to narrow.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 3a. Stage multi-select (Flow tab) — filter assemblies by exact stage set. */}
      {stageMode ? (
        <Popover open={stageOpen} onOpenChange={setStageOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!activeCustomer}
              className={cn(
                'flex h-9 w-[200px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm',
                'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                {stageSel.size === 0 ? (
                  <span className="text-muted-foreground">Select workcenter</span>
                ) : (
                  STAGES.filter((s) => stageSel.has(s)).map((s) => (
                    <span key={s} className="flex items-center gap-1">
                      <span className={cn('h-2 w-2 rounded-full', STAGE_DOT[s])} />{s}
                    </span>
                  ))
                )}
              </span>
              <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-1" align="start">
            <StageOption label="Default" selected={stageSel.size === 0} onClick={() => setFilters({ stages: '' })} />
            <div className="my-1 h-px bg-border" />
            {STAGES.map((st) => (
              <StageOption key={st} label={st} dot={STAGE_DOT[st]} selected={stageSel.has(st)} onClick={() => toggleStage(st)} />
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        /* 3b. Line (optional) — used by the Table tab. */
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
      )}

      {/* 4. Clear — leaves a route-locked customer intact. */}
      {hasFilters && (
        <button
          onClick={() => setFilters(locked
            ? { sub_workcenter: '', assembly: '', stages: '' }
            : { customer: '', sub_workcenter: '', assembly: '', stages: '' })}
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

/** A row in the stage multi-select dropdown (All / SMT / TH / BE). Clicking
 *  toggles the stage; the popover stays open so several can be picked. */
function StageOption({
  label, dot, selected, onClick,
}: { label: string; dot?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
    >
      <Check className={cn('h-4 w-4 flex-shrink-0 text-emerald-500', selected ? 'opacity-100' : 'opacity-0')} />
      {dot ? <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dot)} /> : <span className="w-2 flex-shrink-0" />}
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}
