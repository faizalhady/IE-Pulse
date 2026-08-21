/**
 * ppqtFormat.ts — number / period formatting and the variance colour scale
 * shared by every PPQT view. One place, so "short" is red everywhere.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmt = {
  int: (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString()),
  num: (n: number | null | undefined, d = 2) =>
    n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (n: number | null | undefined, d = 1) => (n == null ? '—' : `${(n * 100).toFixed(d)}%`),
  /** Seconds → "616 s" / "20.6 min" / "1.3 h". */
  sec: (s: number | null | undefined) => {
    if (s == null) return '—';
    if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
    if (s >= 600) return `${(s / 60).toFixed(1)} min`;
    return `${Math.round(s).toLocaleString()} s`;
  },
  hrs: (h: number | null | undefined, d = 0) => (h == null ? '—' : `${fmt.num(h, d)} h`),
  /** Signed with a leading + for positives: +2 / −1 / 0. */
  signed: (n: number | null | undefined, d = 0) => {
    if (n == null) return '—';
    const v = d ? n.toFixed(d) : Math.round(n).toString();
    return n > 0 ? `+${v}` : n < 0 ? `−${v.replace('-', '')}` : v;
  },
  /** '2026-08' → "Aug '26"; '2025-Q1' → "Q1 '25". */
  period: (p: string | null | undefined) => {
    if (!p) return '—';
    const m = /^(\d{4})-(\d{2})$/.exec(p);
    if (m) return `${MONTHS[Number(m[2]) - 1] ?? m[2]} '${m[1].slice(2)}`;
    const q = /^(\d{4})-(Q[1-4])$/i.exec(p);
    if (q) return `${q[2].toUpperCase()} '${q[1].slice(2)}`;
    return p;
  },
  date: (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
  datetime: (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
};

/** short = not enough, tight = exactly enough, ok = spare. */
export type Tone = 'short' | 'tight' | 'ok' | 'none';

export function varianceTone(v: number | null | undefined): Tone {
  if (v == null) return 'none';
  if (v < 0) return 'short';
  if (v === 0) return 'tight';
  return 'ok';
}

/** Utilisation (need ÷ have): > 100 % short, ≥ 85 % tight. */
export function utilTone(u: number | null | undefined): Tone {
  if (u == null) return 'none';
  if (u > 1) return 'short';
  if (u >= 0.85) return 'tight';
  return 'ok';
}

export const TONE_TEXT: Record<Tone, string> = {
  short: 'text-red-600 dark:text-red-400',
  tight: 'text-amber-600 dark:text-amber-400',
  ok: 'text-emerald-600 dark:text-emerald-400',
  none: 'text-muted-foreground',
};
export const TONE_BG: Record<Tone, string> = {
  short: 'bg-red-500/10',
  tight: 'bg-amber-500/10',
  ok: 'bg-emerald-500/10',
  none: '',
};
export const TONE_BAR: Record<Tone, string> = {
  short: 'bg-red-500',
  tight: 'bg-amber-400',
  ok: 'bg-emerald-500',
  none: 'bg-muted-foreground/30',
};
