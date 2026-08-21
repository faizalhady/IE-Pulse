/**
 * vanvaFourQ.test.ts — the 4Q's windowing and averaging, on four tiny months.
 */

import { describe, expect, it } from 'vitest';

import { monthWindow, monthlyTrend, nvaTracker, threeMonthAverage } from '@/lib/va_nva/vanvaFourQ';
import type { VaNvaDataset, VaNvaRow } from '@/pages/vanva/types';

const row = (id: string, va: number, nva: number): VaNvaRow => ({
  id, workcell: id.toUpperCase(), role: 'workcell',
  vaSizingRound: va, vaSizingDecimal: va, vaActual: va, crew: 1, nvaPpqt: nva, nvaMfg: nva,
});
const ds = (period: string, rows: VaNvaRow[]): VaNvaDataset => ({
  id: period, period, filename: '', periodLabel: period, uploadedBy: '', uploadedAt: '',
  rowCount: rows.length, active: false, rows,
});

const data = [
  ds('2026-05', [row('a', 5, 5), row('b', 9, 1)]),
  ds('2026-06', [row('a', 5, 5)]),                    // b missing this month
  ds('2026-07', [row('a', 5, 5), row('b', 9, 1)]),
  ds('2026-08', [row('a', 8, 2), row('b', 9, 1)]),    // a lands exactly on 20%
];

describe('vanvaFourQ', () => {
  it('window ends at the report month and is at most n long', () => {
    expect(monthWindow(data, '2026-07', 2).map(d => d.period)).toEqual(['2026-06', '2026-07']);
    expect(monthWindow(data, '2026-08')).toHaveLength(4);
  });

  it('Q2 averages whole heads over the last 3 months; a missing month counts as 0', () => {
    const avg = threeMonthAverage(data, '2026-08', 0.2);
    // a: Jun 3 + Jul 3 + Aug 0 = 6 → 2 per month.  b: under target every month → 0.
    expect(avg.find(x => x.workcell === 'A')?.reduce).toBeCloseTo(2, 5);
    expect(avg.find(x => x.workcell === 'B')?.reduce).toBe(0);
    expect(avg.find(x => x.workcell === 'B')?.months).toBe(2);
  });

  it('tracker delta is latest minus previous, as a ratio; plant row is head-weighted', () => {
    const t = nvaTracker(data, '2026-08', 0.2);
    const a = t.rows.find(r => r.workcell === 'A')!;
    expect(a.cells).toEqual([0.5, 0.5, 0.5, 0.2]);
    expect(a.delta).toBeCloseTo(-0.3, 5);
    expect(t.plant.cells[1]).toBeCloseTo(0.5, 5);   // only a in Jun
    expect(t.plant.cells[0]).toBeCloseTo(6 / 20, 5); // (5+1) / (10+10)
  });

  it('scope filters by workcell name', () => {
    const trend = monthlyTrend(data, '2026-08', 0.2, ['B']);
    expect(trend[trend.length - 1]?.overall).toBe(10);
    expect(trend).toHaveLength(4);
  });
});
