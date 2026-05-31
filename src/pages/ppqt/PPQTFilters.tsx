/**
 * PPQTFilters.tsx
 * ────────────────
 * Filter strip for the PPQT dashboard.
 * Modeled on src/pages/ole/OLEFilters.tsx — same component primitives
 * (Select, Input, Label), same Tailwind class language.
 *
 * Currently filters by: search · workcell · area (SMT/TH/BE) · status pills · period.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { ProcessArea, PPQTStatus } from './types';

const ALL = '__all__';

interface PPQTFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  workcell: string;
  setWorkcell: (v: string) => void;
  workcellOptions: readonly string[];
  area: ProcessArea | '';
  setArea: (v: ProcessArea | '') => void;
  status: PPQTStatus | '';
  setStatus: (v: PPQTStatus | '') => void;
  period: string;
  setPeriod: (v: string) => void;
  periodOptions: readonly string[];
  rowCount: number;
}

export default function PPQTFilters({
  search, setSearch,
  workcell, setWorkcell, workcellOptions,
  area, setArea,
  status, setStatus,
  period, setPeriod, periodOptions,
  rowCount,
}: PPQTFiltersProps) {
  const hasFilters = !!(search || area || status || (workcell && workcell !== workcellOptions[0]));

  return (
    <div className="px-6 pt-4 pb-3 flex flex-wrap items-end gap-3">

      {/* 1. Search */}
      <div className="relative w-[240px] lg:w-[280px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search process or sub-workcenter…"
          className="pl-8 h-9"
        />
      </div>

      {/* 2. Workcell */}
      <div className="min-w-[140px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workcell</Label>
        <Select value={workcell} onValueChange={setWorkcell}>
          <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {workcellOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Period (Month) */}
      <div className="min-w-[140px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Period</Label>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periodOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 4. Area pills (All / SMT / TH / BE) */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Area</Label>
        <div className="flex items-center gap-1 h-9">
          {([['', 'All'], ['SMT', 'SMT'], ['TH', 'TH'], ['BE', 'BE']] as [ProcessArea | '', string][]).map(([val, label]) => (
            <button
              key={label}
              onClick={() => setArea(val)}
              className={cn(
                'h-9 px-3 rounded-md border text-xs font-medium transition-colors whitespace-nowrap',
                area === val
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Status pills */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</Label>
        <div className="flex items-center gap-1 h-9">
          {([
            ['',           'All',        ''                ],
            ['bottleneck', 'Bottleneck', 'border-red-500/40 text-red-400'],
            ['warning',    'Warning',    'border-amber-500/40 text-amber-400'],
            ['healthy',    'Healthy',    'border-emerald-500/40 text-emerald-400'],
            ['idle',       'Idle',       'border-border text-muted-foreground'],
          ] as [PPQTStatus | '', string, string][]).map(([val, label, accent]) => (
            <button
              key={label}
              onClick={() => setStatus(val)}
              className={cn(
                'h-9 px-3 rounded-md border text-xs font-medium transition-colors whitespace-nowrap',
                status === val
                  ? cn('bg-muted/60 text-foreground', accent || 'border-primary')
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Clear all */}
      {hasFilters && (
        <button
          onClick={() => {
            setSearch('');
            setArea('');
            setStatus('');
          }}
          className="h-9 px-3 rounded-md border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
        >
          Clear
        </button>
      )}

      {/* Row count */}
      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
        {rowCount.toLocaleString()} {rowCount === 1 ? 'process' : 'processes'}
      </span>
    </div>
  );
}

export { ALL };
