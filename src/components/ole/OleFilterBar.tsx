/**
 * OleFilterBar.tsx
 * ────────────────
 * Reusable filter strip used by OLE pages.
 * Owns: week <Select>, From/To <DatePickerField>, and the Clear button.
 *
 * The `before` slot is for page-specific selects (Plant on OlePlantReport,
 * Workcell on OleWorkcellReport) so the strip layout stays consistent.
 *
 * onClear: optional extra cleanup the page wants to run when "Clear" is
 * pressed (e.g. setPlant('all')). `reset()` runs after it.
 *
 * showClear: overrides the default visibility rule of the Clear button
 * (which is "any of week/from/to is set"). Use this when the page also
 * tracks filters outside this bar — e.g. a plant selector on OlePlantReport.
 */

import { DatePickerField } from '@/pages/ole/OLEFilters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WeekRow } from '@/lib/ole/oleTypes';

type Props = {
  weeks: WeekRow[];
  selectedWeek: number | null;
  dateFrom: string;
  dateTo: string;
  selectWeek: (w: WeekRow) => void;
  handleDateFrom: (v: string) => void;
  handleDateTo: (v: string) => void;
  reset: () => void;
  idPrefix: string;
  before?: React.ReactNode;
  onClear?: () => void;
  showClear?: boolean;
};

export function OleFilterBar({
  weeks,
  selectedWeek, dateFrom, dateTo,
  selectWeek, handleDateFrom, handleDateTo, reset,
  idPrefix, before, onClear, showClear,
}: Props) {
  const defaultShowClear = selectedWeek !== null || !!dateFrom || !!dateTo;
  const visibleClear = showClear ?? defaultShowClear;

  return (
    <div className="px-5 pt-4 pb-3 flex items-center gap-3 flex-wrap border-b border-border">
      {before}

      <Select
        value={
          selectedWeek !== null ? String(selectedWeek)
            : (dateFrom || dateTo) ? 'custom'
              : 'all'
        }
        onValueChange={(v) => {
          if (v === 'all') { reset(); return; }
          if (v === 'custom') return;
          const found = weeks.find(w => w.isoWeek === Number(v));
          if (found) selectWeek(found);
        }}
      >
        <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="Week" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Weeks</SelectItem>
          {selectedWeek === null && (dateFrom || dateTo) && (
            <SelectItem value="custom">Custom</SelectItem>
          )}
          {weeks.map(w => (
            <SelectItem key={w.isoWeek} value={String(w.isoWeek)}>{w.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePickerField id={`${idPrefix}-from`} label="" value={dateFrom} onChange={handleDateFrom} />
      <DatePickerField id={`${idPrefix}-to`} label="" value={dateTo} onChange={handleDateTo} />

      {visibleClear && (
        <button
          onClick={() => { onClear?.(); reset(); }}
          className="h-8 px-3 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-colors whitespace-nowrap"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
