/**
 * oleChartStyles.ts
 * ─────────────────
 * Shared Recharts tooltip / cursor style objects and modal dimensions
 * used across OLE pages. Extracted to remove copy-paste duplication.
 */

export const TT = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 13,
    color: 'hsl(var(--foreground))',
    padding: '8px 12px',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))', fontWeight: 600, fontSize: 12, marginBottom: 2 },
  itemStyle: { color: 'hsl(var(--foreground))', fontWeight: 700, fontSize: 14 },
};

export const TT_AREA = {
  contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 },
  labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
  itemStyle: { color: 'hsl(var(--muted-foreground))' },
  cursor: { fill: 'hsl(var(--muted-foreground) / 0.08)' },
};

export const CURSOR_PRIMARY = { fill: 'hsl(var(--primary) / 0.06)' };

export const MODAL_DIM = {
  width: '72vw',
  height: '68vh',
};

export const MODAL_DIM_LG = {
  width: '74vw',
  height: '72vh',
};
