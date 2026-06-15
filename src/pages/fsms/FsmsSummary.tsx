/**
 * FsmsSummary.tsx — Dashboard "Summary" tab = the Summary Space Directory.
 * ──────────────────────────────────────────────────────────────────────────────
 * Same information as the legacy page, rebuilt in the IE Pulse style (not a clone
 * of the legacy Excel-coloured grid):
 *   • Period selectors (FY / Quarter / Month) + compact SMT-rate / DF-rate / Util cluster
 *   • Multi-select filters on Profit Center / Customer / Location (legacy's 3 column filters)
 *   • Clean type-grouped table: SMT(P1·P2·BK) | DF(P1·P2·BK) | Location | Actual |
 *     Forecast·PRISM | Variance — accounting number format (0 → "-", negatives in parens)
 *   • Comment underlines (hover for the note), colour-coded LOCATION
 *   • Totals footer ("Total Available SQFT") summing filtered rows
 *   • "Showing X of Y" counter, Clear Filters, working Export Excel
 * Mock-backed (useConsoSummary).
 */

import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConsoSummary } from '@/hooks/fsms/useFsmsDashboard';
import { fmtPct, fmtUsd, locationBadge, varianceText } from '@/lib/fsms/fsmsConstants';
import type { SummaryPeriodMeta } from '@/pages/fsms/mockFsmsData';
import { cn } from '@/lib/utils';
import type { ConsoSummaryRow } from '@/types/fsms';
import { ChevronDown, Download, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

// Period options (structural — mock is single-period, real period switching lands with the API).
const FYS = ['FY 2025', 'FY 2026'];
const QUARTERS = ['Q1 (Sep-Nov)', 'Q2 (Dec-Feb)', 'Q3 (Mar-May)', 'Q4 (Jun-Aug)'];
const QUARTER_MONTHS: Record<string, string[]> = {
  'Q1 (Sep-Nov)': ['September', 'October', 'November'],
  'Q2 (Dec-Feb)': ['December', 'January', 'February'],
  'Q3 (Mar-May)': ['March', 'April', 'May'],
  'Q4 (Jun-Aug)': ['June', 'July', 'August'],
};

// Excel-style number format: 0 → "-", negative → (parens), null → "—".
const fmtCell = (n?: number | null) => {
  if (n == null) return '—';
  if (n === 0) return '-';
  if (n < 0) return `(${Math.abs(n).toLocaleString()})`;
  return n.toLocaleString();
};

const plantVal = (r: ConsoSummaryRow, plant: string, type: 'smt' | 'df') => {
  const c = r.by_plant.find(p => p.plant === plant);
  return c ? c[type] : 0;
};
const plantComment = (r: ConsoSummaryRow, plant: string, type: 'smt' | 'df') => {
  const c = r.by_plant.find(p => p.plant === plant);
  return c ? (type === 'smt' ? c.smt_comment : c.df_comment) ?? null : null;
};

// ─── Export Excel (dynamic import — only loads exceljs on click) ─────────────────
async function exportExcel(rows: ConsoSummaryRow[], plants: string[], period: SummaryPeriodMeta) {
  try {
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Summary Space Directory');
    ws.addRow([
      'Profit Center', 'Customer Name',
      ...plants.map(p => `${p} SMT`), ...plants.map(p => `${p} DF`),
      'Location', 'Actual SMT', 'Actual DF', 'Forecast SMT', 'Forecast DF', 'Var SMT', 'Var DF',
    ]);
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      ws.addRow([
        r.profit_center, r.customer_name,
        ...plants.map(p => plantVal(r, p, 'smt') || ''),
        ...plants.map(p => plantVal(r, p, 'df') || ''),
        r.customer_location,
        r.actual_smt || '', r.actual_df || '',
        r.forecast_smt || '', r.forecast_df || '',
        r.variance_smt || '', r.variance_df || '',
      ]);
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-space-directory-${period.conso_year}-${period.month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Excel export failed', e);
  }
}

// ─── Multi-select filter (the legacy's per-column Excel filter, our style) ───────
function MultiFilter({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const allSelected = selected.length === 0;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
          allSelected ? 'border-border text-muted-foreground hover:text-foreground' : 'border-primary/50 text-primary')}>
          {label}
          {!allSelected && <span className="rounded-full bg-primary/20 px-1.5 text-[10px] leading-4">{selected.length}</span>}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto min-w-[200px] p-2">
        <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer">
          <Checkbox checked={allSelected} onCheckedChange={() => onChange([])} />
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
  );
}

function PeriodField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 flex flex-col justify-center min-w-[96px]">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn('text-lg font-bold tabular-nums leading-tight', highlight ? 'text-primary' : 'text-foreground')}>{value}</span>
    </div>
  );
}

export default function FsmsSummary() {
  const { data, isLoading } = useConsoSummary();
  const [fy, setFy] = useState('FY 2026');
  const [quarter, setQuarter] = useState('Q3 (Mar-May)');
  const [month, setMonth] = useState('March');
  const [pcSel, setPcSel] = useState<string[]>([]);
  const [custSel, setCustSel] = useState<string[]>([]);
  const [locSel, setLocSel] = useState<string[]>([]);

  const plants = data?.plants ?? ['BK', 'P1', 'P2'];
  const rows = data?.rows ?? [];

  const pcOptions = useMemo(() => Array.from(new Set(rows.map(r => r.profit_center))).sort(), [rows]);
  const custOptions = useMemo(() => Array.from(new Set(rows.map(r => r.customer_name))).sort(), [rows]);
  const locOptions = useMemo(() => Array.from(new Set(rows.map(r => r.customer_location))).sort(), [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (pcSel.length === 0 || pcSel.includes(r.profit_center)) &&
    (custSel.length === 0 || custSel.includes(r.customer_name)) &&
    (locSel.length === 0 || locSel.includes(r.customer_location)),
  ), [rows, pcSel, custSel, locSel]);

  const hasFilters = pcSel.length > 0 || custSel.length > 0 || locSel.length > 0;
  const clearFilters = () => { setPcSel([]); setCustSel([]); setLocSel([]); };
  const onQuarter = (q: string) => { setQuarter(q); const ms = QUARTER_MONTHS[q] ?? []; if (!ms.includes(month)) setMonth(ms[0] ?? ''); };

  if (isLoading || !data) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-9 rounded-lg bg-muted/40 animate-pulse w-2/3" />
        <div className="h-96 rounded-xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const { period, kpis, surplus } = data;
  const monthOptions = QUARTER_MONTHS[quarter] ?? [];
  const shown = [...filtered, surplus];
  const sum = (fn: (r: ConsoSummaryRow) => number) => shown.reduce((s, r) => s + fn(r), 0);

  // header cell classes (our tokens — no Excel hex colours)
  const hBase = 'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border whitespace-nowrap';
  const hGrp = `${hBase} text-center border-l border-border`;
  const hGrpF = `${hGrp} bg-amber-500/10 text-amber-300`;
  const hSub = `${hBase} text-center`;
  const hSubF = `${hSub} bg-amber-500/5 text-amber-200`;

  const dataCell = (key: string, v: number, opts?: { comment?: string | null; forecast?: boolean }) => {
    const dash = v === 0 || v == null;
    return (
      <td key={key} title={opts?.comment ?? undefined}
        className={cn('px-3 h-12 text-center font-mono text-sm border-b border-border',
          opts?.forecast && 'bg-amber-500/5',
          dash ? 'text-muted-foreground' : 'text-foreground',
          opts?.comment && 'underline decoration-dotted underline-offset-2 cursor-help')}>
        {fmtCell(v)}
      </td>
    );
  };
  const varCell = (key: string, v: number) => (
    <td key={key} className={cn('px-3 h-12 text-center font-mono text-sm border-b border-border', v === 0 ? 'text-muted-foreground' : varianceText(v))}>
      {fmtCell(v)}
    </td>
  );

  const renderRow = (r: ConsoSummaryRow, isSurplus = false) => {
    const locClass = r.customer_location.includes('/') ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : locationBadge(r.customer_location);
    return (
      <tr key={r.profit_center} className={cn(isSurplus ? 'bg-muted/40 font-medium' : 'hover:bg-muted/30')}>
        <td className="px-3 h-12 font-mono text-xs text-muted-foreground border-b border-border whitespace-nowrap">{r.profit_center}</td>
        <td className="px-3 h-12 text-sm text-foreground border-b border-border whitespace-nowrap uppercase">{r.customer_name}</td>
        {plants.map(p => dataCell('s' + p, plantVal(r, p, 'smt'), { comment: plantComment(r, p, 'smt') }))}
        {plants.map(p => dataCell('d' + p, plantVal(r, p, 'df'), { comment: plantComment(r, p, 'df') }))}
        <td className="px-3 h-12 border-b border-border text-center whitespace-nowrap">
          <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold border', locClass)}>{r.customer_location}</span>
        </td>
        {dataCell('asmt', r.actual_smt, { comment: r.actual_smt_comment })}
        {dataCell('adf', r.actual_df, { comment: r.actual_df_comment })}
        {dataCell('fsmt', r.forecast_smt, { forecast: true, comment: r.forecast_smt_comment })}
        {dataCell('fdf', r.forecast_df, { forecast: true, comment: r.forecast_df_comment })}
        {varCell('vsmt', r.variance_smt)}
        {varCell('vdf', r.variance_df)}
      </tr>
    );
  };

  return (
    <div className="p-5 space-y-4">
      {/* ── period + KPI cluster ───────────────────────────────────────── */}
      <div className="flex items-end gap-3 flex-wrap">
        <PeriodField label="Fiscal Year">
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{FYS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </PeriodField>
        <PeriodField label="Quarter">
          <Select value={quarter} onValueChange={onQuarter}>
            <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{QUARTERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </PeriodField>
        <PeriodField label="Month">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </PeriodField>
        <div className="ml-auto flex items-stretch gap-2">
          <Stat label="SMT Rate" value={fmtUsd(kpis.rate_smt)} />
          <Stat label="DF Rate" value={fmtUsd(kpis.rate_df)} />
          <Stat label="Utilization" value={fmtPct(kpis.utilization)} highlight />
        </div>
      </div>

      {/* ── toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of {rows.length} rows (sqft)
        </span>
        <div className="flex items-center gap-1.5">
          <MultiFilter label="Profit Center" options={pcOptions} selected={pcSel} onChange={setPcSel} />
          <MultiFilter label="Customer" options={custOptions} selected={custSel} onChange={setCustSel} />
          <MultiFilter label="Location" options={locOptions} selected={locSel} onChange={setLocSel} />
          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <button
          onClick={() => exportExcel(shown, plants, period)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-3.5 w-3.5" /> Export Excel
        </button>
      </div>

      {/* ── table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full border-collapse min-w-[1080px]">
          <thead>
            <tr className="bg-muted/60">
              <th rowSpan={2} className={`${hBase} text-left align-bottom`}>Profit Center</th>
              <th rowSpan={2} className={`${hBase} text-left align-bottom`}>Customer</th>
              <th colSpan={plants.length} className={hGrp}>SMT (sqft)</th>
              <th colSpan={plants.length} className={hGrp}>DF (sqft)</th>
              <th rowSpan={2} className={`${hBase} text-center align-bottom border-l border-border`}>Location</th>
              <th colSpan={2} className={hGrp}>Actual</th>
              <th colSpan={2} className={hGrpF}>Forecast · PRISM</th>
              <th colSpan={2} className={hGrp}>Variance</th>
            </tr>
            <tr className="bg-muted/60">
              {plants.map(p => <th key={'hs' + p} className={hSub}>{p}</th>)}
              {plants.map(p => <th key={'hd' + p} className={hSub}>{p}</th>)}
              <th className={hSub}>SMT</th>
              <th className={hSub}>DF</th>
              <th className={hSubF}>SMT</th>
              <th className={hSubF}>DF</th>
              <th className={hSub}>SMT</th>
              <th className={hSub}>DF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => renderRow(r))}
            {filtered.length === 0 && (
              <tr><td colSpan={9 + plants.length * 2} className="px-4 py-10 text-center text-sm text-muted-foreground">No rows match the filters.</td></tr>
            )}
            {renderRow(surplus, true)}
          </tbody>
          <tfoot>
            <tr className="bg-primary/10 font-semibold">
              <td colSpan={2} className="px-3 h-12 text-xs uppercase tracking-wide text-primary border-b border-border">Total Available SQFT</td>
              {plants.map(p => <td key={'ts' + p} className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => plantVal(r, p, 'smt')))}</td>)}
              {plants.map(p => <td key={'td' + p} className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => plantVal(r, p, 'df')))}</td>)}
              <td className="border-b border-border" />
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => r.actual_smt))}</td>
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => r.actual_df))}</td>
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border bg-amber-500/5">{fmtCell(sum(r => r.forecast_smt))}</td>
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border bg-amber-500/5">{fmtCell(sum(r => r.forecast_df))}</td>
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => r.variance_smt))}</td>
              <td className="px-3 h-12 text-center font-mono text-sm text-foreground border-b border-border">{fmtCell(sum(r => r.variance_df))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
