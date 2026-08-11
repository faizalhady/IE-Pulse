/**
 * buildPareto feeds Q2 on both 4Q reports. The cumulative line is the part that
 * fails quietly — a wrong denominator still draws a plausible curve, it just
 * stops telling you where the 80% lands.
 */

import { buildPareto } from '@/components/shared/ParetoChart';
import { describe, expect, it } from 'vitest';

const c = '#000';

describe('buildPareto', () => {
  it('sorts descending regardless of input order', () => {
    const out = buildPareto([
      { name: 'Lunch', value: 6000, color: c },
      { name: 'NVA Input', value: 24800, color: c },
      { name: 'MFG DT', value: 1100, color: c },
      { name: 'MFG Hour Lost', value: 12600, color: c },
    ]);
    expect(out.map(r => r.name)).toEqual(['NVA Input', 'MFG Hour Lost', 'Lunch', 'MFG DT']);
  });

  it('accumulates to exactly 100% on the last bar', () => {
    const out = buildPareto([
      { name: 'a', value: 50, color: c },
      { name: 'b', value: 30, color: c },
      { name: 'c', value: 20, color: c },
    ]);
    expect(out.map(r => r.cum)).toEqual([50, 80, 100]);
  });

  it('drops zero and negative-to-zero rows rather than plotting them', () => {
    const out = buildPareto([
      { name: 'real', value: 10, color: c },
      { name: 'zero', value: 0, color: c },
    ]);
    expect(out.map(r => r.name)).toEqual(['real']);
    expect(out[0].cum).toBe(100);
  });

  it('treats a negative as a loss of the same size', () => {
    // Losses arrive signed from some sources; a negative bar would invert the
    // sort AND push the cumulative line backwards.
    const out = buildPareto([
      { name: 'down', value: -80, color: c },
      { name: 'up', value: 20, color: c },
    ]);
    expect(out[0]).toMatchObject({ name: 'down', value: 80, cum: 80 });
    expect(out[1].cum).toBe(100);
  });

  it('returns nothing for an all-zero set instead of dividing by zero', () => {
    expect(buildPareto([{ name: 'a', value: 0, color: c }])).toEqual([]);
  });

  it('handles a single bar', () => {
    expect(buildPareto([{ name: 'only', value: 7, color: c }])[0].cum).toBe(100);
  });
});
