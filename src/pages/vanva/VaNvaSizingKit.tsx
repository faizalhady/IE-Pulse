/**
 * VaNvaSizingKit.tsx
 * ───────────────────
 * Pieces shared by the plant sizing page and the per-workcell sizing page, so
 * the two can never disagree on how a bar, a move, the month or the target
 * control reads. The month browser is also used by the Analytics page.
 *
 * URL IS THE STATE
 *   ?t=30      NVA target in whole %, absent at the workbook default (20%)
 *   ?m=2026-06 reporting month, absent for the latest month
 *   Both survive the hop between the plant page and a workcell page, and a
 *   pasted link opens exactly what the sender saw.
 */

import { useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Minus, RotateCcw } from 'lucide-react';

import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useVaNvaDatasets, useVaNvaRows } from '@/hooks/va_nva/useVaNvaData';
import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import type { SizingRow } from '@/lib/va_nva/vanvaCalc';
import {
  NVA_HEX, NVA_TARGET, NVA_TARGET_MAX, NVA_TARGET_MIN, TARGET_HEX,
  VANVA_STATUS_BAR, VA_HEX, getVaNvaStatus, nvaTextClass, pct,
} from '@/lib/va_nva/vanvaConstants';

export const n0 = (v: number) => Math.round(v).toLocaleString();
export const n1 = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 'YYYY-MM' → locale "Aug 2026". */
export const fmtPeriod = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

/** Light/dark pairs — the 400 shades alone fail 4.5:1 on a white card. */
export const BAD = 'text-red-600 dark:text-red-400';
export const GOOD = 'text-emerald-600 dark:text-emerald-400';

/** One scale for every bullet bar, so rows are comparable by eye. */
export const BULLET_MAX = NVA_TARGET_MAX;

export const TH = 'h-9 px-3 text-[10px] font-semibold uppercase tracking-wider';
export const TD = 'px-3 py-0 font-mono text-[11px] tabular-nums';
const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';
const ICON_BTN = 'flex h-8 w-8 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30';

// ─── URL state ───────────────────────────────────────────────────────────────

export function useSizingParams() {
  const [sp, setSp] = useSearchParams();
  const patch = (kv: Record<string, string | undefined>) => {
    const next = new URLSearchParams(sp);
    Object.entries(kv).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSp(next, { replace: true });
  };
  const t = Number(sp.get('t'));
  const target = t >= NVA_TARGET_MIN * 100 && t <= NVA_TARGET_MAX * 100 ? t / 100 : NVA_TARGET;
  return {
    target,
    setTarget: (v: number) => patch({ t: v === NVA_TARGET ? undefined : String(Math.round(v * 100)) }),
    month: sp.get('m') ?? undefined,
    setMonth: (m?: string) => patch({ m }),
    /** What to append to a sibling link so it opens at the same month and target. */
    qs: sp.toString() ? `?${sp}` : '',
  };
}

/** The reporting month in the URL resolved to a dataset. Newest first; latest is the default. */
export function usePeriod() {
  const { month, setMonth, qs } = useSizingParams();
  const { data: datasets = [] } = useVaNvaDatasets();
  const periods = [...new Set(datasets.map(d => d.period))].sort().reverse();
  const period = month && periods.includes(month) ? month : periods[0];
  return {
    period, periods, qs,
    dataset: datasets.find(d => d.period === period),
    setPeriod: (p: string) => setMonth(p === periods[0] ? undefined : p),
  };
}

/** Everything a sizing page needs, in one call. */
export function useSizingData() {
  const { target, setTarget, qs } = useSizingParams();
  const { period, periods, setPeriod, dataset } = usePeriod();
  const { rows, isLoading } = useVaNvaRows(target, dataset?.id);
  return { target, setTarget, period, periods, setPeriod, dataset, rows, isLoading, qs };
}

// ─── Controls ────────────────────────────────────────────────────────────────

/** ‹ month › stepper around a year-grouped picker. `periods` newest first. */
export function PeriodNav({ period, periods, onChange }: {
  period?: string; periods: string[]; onChange: (p: string) => void;
}) {
  const id = useId();
  const i = period ? periods.indexOf(period) : -1;
  const newer = i > 0 ? periods[i - 1] : undefined;
  const older = i >= 0 ? periods[i + 1] : undefined;
  const years = [...new Set(periods.map(p => p.slice(0, 4)))];
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-1 flex items-center justify-between">
        <span id={id} className={LABEL}>Reporting month</span>
        {i > 0 && (
          <button type="button" onClick={() => onChange(periods[0])}
            className="cursor-pointer text-[10px] font-semibold text-teal-600 underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm dark:text-teal-400">
            Latest
          </button>
        )}
      </div>
      <div className="flex items-center rounded-lg border border-border bg-card">
        <button type="button" onClick={() => older && onChange(older)} disabled={!older} aria-label="Older month" className={ICON_BTN}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Select value={period ?? ''} onValueChange={onChange} disabled={!periods.length}>
          <SelectTrigger aria-label="Reporting month"
            className="h-8 w-[178px] gap-1.5 rounded-md border-0 bg-transparent px-2 text-xs font-semibold focus:ring-2 focus:ring-ring focus:ring-offset-0">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            <SelectValue placeholder="No data" />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectGroup key={y}>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{y}</SelectLabel>
                {periods.filter(p => p.startsWith(y)).map(p => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {fmtPeriod(p)}
                    {p === periods[0] && <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">latest</span>}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <button type="button" onClick={() => newer && onChange(newer)} disabled={!newer} aria-label="Newer month" className={ICON_BTN}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TargetControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    // role=group carries the label: the shadcn Slider does not forward aria-* to the thumb.
    <div role="group" aria-labelledby={id} className="w-[260px] max-w-full">
      <div className="mb-1 flex items-center justify-between">
        <span id={id} className={LABEL}>NVA target</span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-[11px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {pct(value, 0)}
          </span>
          {value !== NVA_TARGET && (
            <button type="button" onClick={() => onChange(NVA_TARGET)}
              aria-label={`Reset to ${pct(NVA_TARGET, 0)}`} title={`Back to the workbook's ${pct(NVA_TARGET, 0)}`}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>
      <Slider className="py-2" value={[value * 100]} min={NVA_TARGET_MIN * 100} max={NVA_TARGET_MAX * 100} step={1}
        onValueChange={([v]) => onChange(v / 100)} />
    </div>
  );
}

/** Header right-hand group: month on the left, target on the right. */
export function SizingControls({ period, periods, onPeriod, target, onTarget }: {
  period?: string; periods: string[]; onPeriod: (p: string) => void;
  target: number; onTarget: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-5">
      <PeriodNav period={period} periods={periods} onChange={onPeriod} />
      <TargetControl value={target} onChange={onTarget} />
    </div>
  );
}

// ─── Marks ───────────────────────────────────────────────────────────────────

/** 100% stacked bar: NVA from the left so the target marker reads directly against it. */
export function SplitBar({ label, nva, va, target }: { label: string; nva: number; va: number; target: number }) {
  const total = nva + va;
  const nvaP = total ? nva / total : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {n0(total)} DL · <span className={cn('font-bold', nvaTextClass(nvaP))}>{pct(nvaP)} NVA</span>
        </span>
      </div>
      <div className="relative pt-2.5">
        {/* The bar clips its own overflow, so the marker lives outside it. */}
        <TargetMark left={target * 100} label={pct(target, 0)} />
      <div role="img" aria-label={`${label}: ${pct(nvaP)} NVA, ${pct(1 - nvaP)} VA, target ${pct(target, 0)}`}
        className="relative h-7 w-full overflow-hidden rounded-md bg-muted/40">
        {/* Labels sit at the far ends, away from the boundary where the target marker lands. */}
        <div className="absolute inset-y-0 left-0 flex items-center pl-2 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${nvaP * 100}%`, background: NVA_HEX }}>
          {nvaP > 0.1 && <span className="font-mono text-[10px] font-bold text-slate-950">NVA {n0(nva)}</span>}
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-2 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(1 - nvaP) * 100}%`, background: VA_HEX }}>
          {nvaP < 0.9 && <span className="font-mono text-[10px] font-bold text-slate-950">VA {n0(va)}</span>}
        </div>
        <div aria-hidden className="absolute inset-y-0 w-0.5" style={{ left: `${target * 100}%`, background: TARGET_HEX }} />
      </div>
      </div>
    </div>
  );
}

/** Downward caret above a meter, marking where the target sits. A 2px line
 *  inside a coloured bar is invisible against the fill — this sits outside it. */
function TargetMark({ left, label }: { left: number; label?: string }) {
  return (
    <span aria-hidden className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
      style={{ left: `${left}%` }}>
      {label && (
        <span className="mb-px font-mono text-[9px] font-bold leading-none" style={{ color: TARGET_HEX }}>
          {label}
        </span>
      )}
      <span className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent"
        style={{ borderTopColor: TARGET_HEX }} />
    </span>
  );
}

export function Bullet({ ratio, target }: { ratio: number | null; target: number }) {
  const fill = Math.min((ratio ?? 0) / BULLET_MAX, 1) * 100;
  const mark = Math.min(target / BULLET_MAX, 1) * 100;
  return (
    <div aria-hidden className="relative w-full pt-1.5">
      <TargetMark left={mark} />
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
          VANVA_STATUS_BAR[getVaNvaStatus(ratio)])} style={{ width: `${fill}%` }} />
        <div className="absolute inset-y-0 w-0.5" style={{ left: `${mark}%`, background: TARGET_HEX }} />
      </div>
    </div>
  );
}

/** Arrow + number + word, so colour is never the only cue. */
export function Move({ r }: { r: Pick<SizingRow, 'reduce' | 'add'> }) {
  const [Icon, n, word, tone] = r.reduce > 0 ? [ArrowDown, r.reduce, 'cut', BAD]
    : r.add > 0 ? [ArrowUp, r.add, 'add', GOOD]
    : [Minus, 0, 'hold', 'text-muted-foreground'];
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono font-bold tabular-nums', tone)}>
      <Icon className="h-3 w-3" />{n}
      <span className="font-sans text-[9px] font-semibold uppercase tracking-wider opacity-80">{word}</span>
    </span>
  );
}

/** sm = table rows, lg = page headers. */
export function Logo({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const logo = getWorkcellLogo(name);
  const box = size === 'lg' ? 'h-10 w-[4.25rem] rounded-md' : 'h-6 w-10 rounded';
  return logo ? (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white', box)}>
      <img src={logo} alt="" className={cn('h-full w-full object-contain', size === 'lg' ? 'p-1' : 'p-0.5')} />
    </span>
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center border border-border bg-muted font-bold text-muted-foreground',
      box, size === 'lg' ? 'text-xs' : 'text-[9px]')}>
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}
