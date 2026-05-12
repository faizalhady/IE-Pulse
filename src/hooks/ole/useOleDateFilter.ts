/**
 * useOleDateFilter.ts
 * ───────────────────
 * Shared state + handlers for the (week, dateFrom, dateTo) filter trio
 * used across OLE pages.
 *
 * Rules baked into the handlers:
 *   - selectWeek(w):       sets all three (selectedWeek, dateFrom = w.start, dateTo = w.end)
 *   - handleDateFrom(val): sets dateFrom AND clears selectedWeek
 *   - handleDateTo(val):   sets dateTo   AND clears selectedWeek
 *   - reset():             clears all three
 */

import { useState } from 'react';
import type { WeekRow } from '@/lib/ole/oleTypes';

type Options = {
  initialWeek?: number | null;
  initialFrom?: string;
  initialTo?: string;
};

export function useOleDateFilter(options: Options = {}) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(options.initialWeek ?? null);
  const [dateFrom, setDateFrom] = useState<string>(options.initialFrom ?? '');
  const [dateTo, setDateTo] = useState<string>(options.initialTo ?? '');

  function selectWeek(w: WeekRow) {
    setSelectedWeek(w.isoWeek);
    setDateFrom(w.start);
    setDateTo(w.end);
  }

  function handleDateFrom(val: string) {
    setDateFrom(val);
    setSelectedWeek(null);
  }

  function handleDateTo(val: string) {
    setDateTo(val);
    setSelectedWeek(null);
  }

  function reset() {
    setSelectedWeek(null);
    setDateFrom('');
    setDateTo('');
  }

  return {
    selectedWeek,
    setSelectedWeek,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectWeek,
    handleDateFrom,
    handleDateTo,
    reset,
  };
}
