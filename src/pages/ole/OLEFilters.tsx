import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const ALL = '__all__';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3) return undefined;
  const [y, mo, d] = parts;
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

export function DatePickerField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);
  return (
    <div className="min-w-[160px] max-w-[200px]">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline"
            className={cn('mt-1 w-full h-9 justify-start text-left font-normal px-2', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{date ? format(date, 'MMM d, yyyy') : 'Any date'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date}
            onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }}
            initialFocus
          />
          {value && (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs"
                onClick={() => { onChange(''); setOpen(false); }}
              >Clear date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface OLEFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  workcell: string;
  setWorkcell: (v: string) => void;
  plant: string;
  setPlant: (v: string) => void;
  plantOptions?: string[];
  // Full workcell config so we can filter workcell dropdown by selected plant
  workcellConfigs?: { workcell: string; plant: string }[];
  dateFrom?: string;
  setDateFrom?: (v: string) => void;
  dateTo?: string;
  setDateTo?: (v: string) => void;
  shift?: string;
  setShift?: (v: string) => void;
  smhFilter?: string;
  setSmhFilter?: (v: string) => void;
  workcellOptions: string[];
  rowCount: number;
  activeTab: string;
}

export default function OLEFilters({
  search, setSearch,
  workcell, setWorkcell,
  plant, setPlant,
  plantOptions = [],
  workcellConfigs = [],
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  shift, setShift,
  smhFilter, setSmhFilter,
  workcellOptions,
  rowCount,
  activeTab,
}: OLEFiltersProps) {

  // Filter workcell list to only show workcells belonging to the selected plant
  const filteredWorkcellOptions = useMemo(() => {
    if (!plant) return workcellOptions;
    const inPlant = new Set(
      workcellConfigs.filter(c => c.plant === plant).map(c => c.workcell)
    );
    return workcellOptions.filter(w => inPlant.has(w));
  }, [workcellOptions, workcellConfigs, plant]);

  const hasFilters = !!(search || workcell || plant || dateFrom || dateTo || shift || smhFilter);

  return (
    <div className="px-6 pt-4 pb-3 flex flex-wrap items-end gap-3">

      {/* 1. Search — responsive, grows but capped */}
      <div className="relative w-[240px] lg:w-[300px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={
            activeTab === 'smh'        ? 'Search assembly…' :
            activeTab === 'production' ? 'Search workcell or assembly…' :
            'Search…'
          }
          className="pl-8 h-9"
        />
      </div>

      {/* 2. Plant */}
      <div className="min-w-[140px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Plant</Label>
        <Select value={plant || ALL} onValueChange={v => {
          const newPlant = v === ALL ? '' : v;
          setPlant(newPlant);
          // If the currently selected workcell is not in the new plant, clear it
          if (workcell && newPlant) {
            const inNewPlant = new Set(
              workcellConfigs.filter(c => c.plant === newPlant).map(c => c.workcell)
            );
            if (!inNewPlant.has(workcell)) setWorkcell('');
          }
        }}>
          <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All plants" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plantOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Workcell — filtered by selected plant */}
      <div className="min-w-[160px]">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Workcell{plant ? ` · ${plant}` : ''}
        </Label>
        <Select value={workcell || ALL} onValueChange={v => setWorkcell(v === ALL ? '' : v)}>
          <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All workcells" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All workcells</SelectItem>
            {filteredWorkcellOptions.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Date From */}
      {setDateFrom && setDateTo && (
        <>
          <DatePickerField id="ole-date-from" label="Date from" value={dateFrom || ''} onChange={setDateFrom} />
          <DatePickerField id="ole-date-to"   label="Date to"   value={dateTo   || ''} onChange={setDateTo}   />
        </>
      )}

      {/* 4. Shift */}
      {setShift && (
        <div className="min-w-[120px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Shift</Label>
          <Select value={shift || ALL} onValueChange={v => setShift(v === ALL ? '' : v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any shift" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any shift</SelectItem>
              <SelectItem value="1">Normal</SelectItem>
              <SelectItem value="2">Night</SelectItem>
              <SelectItem value="3">Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 5. SMH Status */}
      {setSmhFilter && (
        <div className="min-w-[160px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SMH Status</Label>
          <Select value={smhFilter || ALL} onValueChange={v => setSmhFilter(v === ALL ? '' : v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Any status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              <SelectItem value="NOT_IN_SMH_DB">Missing SMH</SelectItem>
              <SelectItem value="OK">OK</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 5. Clear */}
      {hasFilters && (
        <button
          onClick={() => {
            setSearch('');
            setWorkcell('');
            setPlant('');
            if (setDateFrom)  setDateFrom('');
            if (setDateTo)    setDateTo('');
            if (setShift)     setShift('');
            if (setSmhFilter) setSmhFilter('');
          }}
          className="h-9 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
        >
          Clear all
        </button>
      )}

      {/* Row count */}
      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">{rowCount.toLocaleString()} rows</span>
    </div>
  );
}
