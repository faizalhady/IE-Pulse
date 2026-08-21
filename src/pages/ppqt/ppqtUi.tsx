/**
 * ppqtUi.tsx — the small atoms every PPQT tab shares: KPI tile, segmented
 * control, variance cell, issue badge, loading / empty / error states, and the
 * dense-table class constants. Data-dense dashboard style: minimal padding,
 * tabular numerals, colour only as a second signal next to the number.
 */

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { fmt, TONE_BG, TONE_TEXT, varianceTone, type Tone } from '@/lib/ppqt/ppqtFormat';

// ─── Table classes ───────────────────────────────────────────────────────────
export const TH = 'px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right first:text-left';
export const TD = 'px-2 py-1.5 text-[13px] tabular-nums whitespace-nowrap text-right first:text-left';
export const ROW = 'border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors';
export const CARD = 'rounded-xl border border-border bg-card';

// ─── KPI tile ────────────────────────────────────────────────────────────────
export function Kpi({ label, value, sub, tone = 'none', className }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-border/70 bg-background/60 px-3 py-2', className)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className={cn('mt-0.5 text-xl font-bold tabular-nums leading-tight', tone === 'none' ? 'text-foreground' : TONE_TEXT[tone])}>
        {value}
      </div>
      {sub != null && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────
export function Segmented<T extends string>({ options, value, onChange, size = 'sm', className, ariaLabel }: {
  // NoInfer: T comes from `value` / `onChange` (a state union), not from the
  // option literals, which would widen it to string.
  options: ReadonlyArray<{ value: NoInfer<T>; label: string; hint?: string }>;
  value: T; onChange: (v: T) => void; size?: 'sm' | 'xs'; className?: string; ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex rounded-md border border-border bg-background p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2.5 font-medium transition-colors whitespace-nowrap',
            size === 'sm' ? 'py-1 text-xs' : 'py-0.5 text-[11px]',
            value === o.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PeriodChips({ periods, value, onChange, className }: {
  periods: string[]; value: string; onChange: (p: string) => void; className?: string;
}) {
  return (
    <Segmented
      ariaLabel="Period"
      className={className}
      options={periods.map((p) => ({ value: p, label: fmt.period(p) }))}
      value={value}
      onChange={onChange}
    />
  );
}

// ─── Variance / number cells ─────────────────────────────────────────────────
export function VarCell({ v, d = 0, className }: { v: number | null | undefined; d?: number; className?: string }) {
  const tone = varianceTone(v);
  return (
    <span className={cn('inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 text-center font-semibold tabular-nums', TONE_BG[tone], TONE_TEXT[tone], className)}>
      {fmt.signed(v, d)}
    </span>
  );
}

export function Bar({ pct, tone, className }: { pct: number | null; tone: Tone; className?: string }) {
  const w = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className={cn('h-1.5 w-16 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <div className={cn('h-full rounded-full', tone === 'short' ? 'bg-red-500' : tone === 'tight' ? 'bg-amber-400' : tone === 'ok' ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
           style={{ width: `${w}%` }} />
    </div>
  );
}

export function IssueBadge({ issues }: { issues: string | null | undefined }) {
  if (!issues) return null;
  return (
    <span
      title={`Broken cell in the workbook: ${issues}. The sheet computes 0 here — fix the workbook and refresh.`}
      className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
    >
      <AlertTriangle className="h-3 w-3" aria-hidden /> {issues}
    </span>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {msg}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-muted/40">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {right}
    </div>
  );
}
