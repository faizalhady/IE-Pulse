/**
 * FsmsWorkcell.tsx — Dashboard "Workcell" tab = the Workcell Space Directory.
 * ──────────────────────────────────────────────────────────────────────────────
 * Same content as the legacy workcell-space-directory page, in the IE Pulse style:
 *   • Filter bar — Fiscal Year / Quarter / Month (multi) + Plant ↔ Area (mutually
 *     exclusive) + Building Rate ($) + Customer
 *   • 8 KPI cards + the "Forecast VS Actual" status card (Over/Optimal/Under)
 *   • Variance table + Pie + Trend + Area-details chart (see WorkcellCharts.tsx)
 * Mock-backed. Page-level filters are structural for now (single mock period);
 * the in-widget controls (trend range, area toggle/drill-down) are live.
 */

import KpiTile from '@/components/dashboard/KpiTile';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFsmsDashboard } from '@/hooks/fsms/useFsmsDashboard';
import { fmtPct, fmtSqft, fmtUsd } from '@/lib/fsms/fsmsConstants';
import { cn } from '@/lib/utils';
import { WorkcellArea, WorkcellPie, WorkcellTrend, WorkcellVarianceTable } from '@/pages/fsms/WorkcellCharts';
import { Boxes, ChevronDown, DollarSign, Gauge, Layers, PackageOpen, Ruler, TrendingUp } from 'lucide-react';
import { useState } from 'react';

const FYS = ['FY 2025', 'FY 2026'];
const QUARTERS = ['Q1 (Sep-Nov)', 'Q2 (Dec-Feb)', 'Q3 (Mar-May)', 'Q4 (Jun-Aug)'];
const QUARTER_MONTHS: Record<string, string[]> = {
  'Q1 (Sep-Nov)': ['September', 'October', 'November'],
  'Q2 (Dec-Feb)': ['December', 'January', 'February'],
  'Q3 (Mar-May)': ['March', 'April', 'May'],
  'Q4 (Jun-Aug)': ['June', 'July', 'August'],
};
const PLANT_OPTS = ['BK', 'P1', 'P2'];
const AREA_OPTS = ['SMT', 'DF'];
const RATE_OPTS = ['SMT', 'DF'];
const CUSTOMER_OPTS = ['Arista', 'Keysight', 'GoPro', 'Micron', 'Wabtec', 'Celestica'];

// ─── Multi-select dropdown (checkbox list) ───────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, disabled }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const all = selected.length === 0;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button disabled={disabled}
            className={cn('inline-flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors',
              disabled ? 'border-border text-muted-foreground/50 cursor-not-allowed'
                : all ? 'border-border text-muted-foreground hover:text-foreground'
                  : 'border-primary/50 text-primary')}>
            <span className="truncate">{all ? `All ${label}` : selected.length === 1 ? selected[0] : `${selected.length} selected`}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto min-w-[180px] p-2">
          <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer">
            <Checkbox checked={all} onCheckedChange={() => onChange([])} />
            <span className="text-sm font-medium">(All)</span>
          </label>
          <div className="my-1 h-px bg-border" />
          {options.map(o => (
            <label key={o} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer">
              <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function FsmsWorkcell({ initialPlant }: { initialPlant?: string | null }) {
  const { data, isLoading } = useFsmsDashboard();

  // fiscal selection (default to a complete period so the mock renders fully)
  const [fy, setFy] = useState<string[]>(['FY 2026']);
  const [quarter, setQuarter] = useState<string[]>(['Q3 (Mar-May)']);
  const [month, setMonth] = useState<string[]>(['March']);
  // additional filters — pre-select the plant when arriving from the Plants map
  const [plants, setPlants] = useState<string[]>(
    initialPlant && PLANT_OPTS.includes(initialPlant) ? [initialPlant] : [],
  );
  const [areas, setAreas] = useState<string[]>([]);
  const [rates, setRates] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);

  const monthOpts = quarter.flatMap(q => QUARTER_MONTHS[q] ?? []);
  const complete = fy.length > 0 && quarter.length > 0 && month.length > 0;

  const onQuarter = (v: string[]) => { setQuarter(v); const ms = v.flatMap(q => QUARTER_MONTHS[q] ?? []); setMonth(month.filter(m => ms.includes(m))); };

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-24 rounded-xl bg-muted/40 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[88px] rounded-lg bg-muted/40 animate-pulse" />)}</div>
        <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const k = data.kpis;
  const variance = k.forecast - k.overall;
  const status = variance < 0 ? 'over' : variance === 0 ? 'optimal' : 'under';
  const statusMeta = {
    over:    { text: 'Overutilized',  box: 'border-red-500/40 bg-red-500/10',         badge: 'bg-red-500/20 text-red-300' },
    optimal: { text: 'Optimal Use',   box: 'border-emerald-500/40 bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300' },
    under:   { text: 'Underutilized', box: 'border-amber-500/40 bg-amber-500/10',     badge: 'bg-amber-500/20 text-amber-300' },
  }[status];
  const signedVar = variance === 0 ? '0' : variance > 0 ? `+${variance.toLocaleString()}` : `(${Math.abs(variance).toLocaleString()})`;

  const tiles = [
    { label: 'SMT Rate, $',         value: fmtUsd(k.rate_smt),  icon: <DollarSign className="h-5 w-5" /> },
    { label: 'Overall Usage, sqft', value: fmtSqft(k.overall),  icon: <Boxes className="h-5 w-5" /> },
    { label: 'Overall Surplus',     value: fmtSqft(k.surplus),  icon: <PackageOpen className="h-5 w-5" /> },
    { label: 'Temporary Usage',     value: fmtSqft(k.temporary), icon: <Layers className="h-5 w-5" /> },
    { label: 'DF Rate, $',          value: fmtUsd(k.rate_df),   icon: <DollarSign className="h-5 w-5" /> },
    { label: 'Permanent Usage',     value: fmtSqft(k.permanent), icon: <Ruler className="h-5 w-5" /> },
    { label: 'Forecast, sqft',      value: fmtSqft(k.forecast), icon: <TrendingUp className="h-5 w-5" /> },
    { label: 'Utilization, %',      value: fmtPct(k.utilization), icon: <Gauge className="h-5 w-5" /> },
  ];

  return (
    <div className="p-5 space-y-4">
      {/* ── filter bar ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <MultiSelect label="Fiscal Year" options={FYS} selected={fy} onChange={setFy} />
          <MultiSelect label="Quarter" options={QUARTERS} selected={quarter} onChange={onQuarter} disabled={fy.length === 0} />
          <MultiSelect label="Month" options={monthOpts} selected={month} onChange={setMonth} disabled={quarter.length === 0} />
          {complete && (
            <div className="flex flex-col px-3 py-1 bg-primary/10 rounded-md border border-primary/20">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Period</span>
              <span className="text-sm font-semibold text-primary">{fy.join(', ')} · {month.join(', ')}</span>
            </div>
          )}
        </div>
        {complete ? (
          <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border">
            <MultiSelect label="Plant" options={PLANT_OPTS} selected={plants} onChange={setPlants} disabled={areas.length > 0} />
            <MultiSelect label="Area" options={AREA_OPTS} selected={areas} onChange={setAreas} disabled={plants.length > 0} />
            <MultiSelect label="Building Rate ($)" options={RATE_OPTS} selected={rates} onChange={setRates} />
            <MultiSelect label="Customer" options={CUSTOMER_OPTS} selected={customers} onChange={setCustomers} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground pt-3 border-t border-border">
            Select <strong>Fiscal Year</strong>, <strong>Quarter</strong>, and <strong>Month</strong> to view data.
          </div>
        )}
      </div>

      {/* ── KPI cards + status card ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map(t => <KpiTile key={t.label} label={t.label} value={t.value} icon={t.icon} />)}
        </div>
        <div className={cn('rounded-xl border p-4 flex flex-col items-center justify-center text-center gap-2', statusMeta.box)}>
          <span className="text-sm font-semibold text-foreground">Forecast VS Actual, sqft</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusMeta.badge)}>{statusMeta.text}</span>
          <span className="text-4xl font-bold tabular-nums text-foreground">{signedVar}</span>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5">Optimal</span>
            <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5">Underutilized</span>
            <span className="rounded bg-red-500/20 text-red-300 px-1.5 py-0.5">Overutilized</span>
          </div>
        </div>
      </div>

      {/* ── variance table ─────────────────────────────────────────────── */}
      <WorkcellVarianceTable />

      {/* ── pie + trend ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WorkcellPie />
        <div className="lg:col-span-2"><WorkcellTrend /></div>
      </div>

      {/* ── area details ───────────────────────────────────────────────── */}
      <WorkcellArea initialPlant={initialPlant} />
    </div>
  );
}
