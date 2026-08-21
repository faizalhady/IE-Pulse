/**
 * StatusBands — the good/warning/bad zones behind a 4Q trend chart.
 *
 * Every Q1 used to colour the BARS by status, which meant the bar told you two
 * things at once (how big, and how bad) and the four reports each picked their
 * own palette. Now the bar is always the brand blue and the verdict lives in a
 * tinted band behind it: the same reading in one glance, and a chart that still
 * works for anyone who cannot separate red from green.
 *
 * Returns an ARRAY, not a wrapper element — recharts identifies its children by
 * component type, so a custom component around ReferenceArea is ignored, while
 * an array is flattened by React and picked up normally. Spread it into the
 * chart: `{statusBands(BANDS)}`.
 */

import { ReferenceArea } from 'recharts';

export interface StatusBand {
  from: number;
  to: number;
  /** Hex — recharts cannot read Tailwind classes. */
  color: string;
}

export const BAND_GOOD = '#10b981';
export const BAND_WARN = '#f59e0b';
export const BAND_BAD = '#ef4444';

export function statusBands(bands: StatusBand[], yAxisId?: string) {
  return bands.map((b, i) => (
    <ReferenceArea key={`band-${i}`} y1={b.from} y2={b.to} yAxisId={yAxisId}
      fill={b.color} fillOpacity={0.09} stroke="none" ifOverflow="hidden" />
  ));
}
