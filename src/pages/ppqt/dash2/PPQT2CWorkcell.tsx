/**
 * PPQT2CWorkcell.tsx — Dashboard 2 · Variant C ("Excel DASH replica")
 * ────────────────────────────────────────────────────────────────────
 * Faithful on-screen reproduction of the PPQT workbook's DASH sheet, so the
 * SME sees exactly the artifact they already know. Same variables, same row
 * labels, same arrangement — processes as COLUMNS, variables as ROWS:
 *
 *   Left rail    →  "Sub Workcenter" list (Excel B3:C15) — the line selector
 *   Chart        →  Equipment Available vs Resources NEEDED per process
 *   Matrix       →  rows 21-26  operating parameters
 *                   rows 28-30  Total Demand (by process) / Weighted Cycle
 *                               time / Takt Time (Min)
 *                   rows 32-35  Equipment Available / Resources NEEDED /
 *                               Round Up / Justification
 *   TOP Demand   →  rows 37-59  top assemblies × CT at every process
 *
 * Used as the "DASH" tab in PPQT2AWorkcell — no standalone route.
 * Data: REAL — capacity comes in as a prop (same object as the other tabs);
 * the TOP Demand matrix is one GET /api/ppqt/matrix per selected line.
 */

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePpqtMatrix } from '@/hooks/ppqt/usePpqtData';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PPQTProcess } from '../types';
import { StepDrawer } from './StepDrawer';
import { PPQT_RESOURCE_COPY, type PPQTResourceMode } from '@/lib/ppqt/ppqtConstants';
import { Ppqt2Line, getMathTrail, type Ppqt2Workcell } from './ppqt2Data';

// Matrix grid: row label | total ("D") column | one column per process.
function matrixCols(n: number): string {
  return `15rem 6.5rem repeat(${n}, minmax(6rem, 1fr))`;
}

/**
 * DASH replica body (line selector + chart + matrix + TOP Demand) — embeddable.
 * Rendered as the "DASH" tab in the PPQT dashboard workcell page.
 */
export function PPQT2CWorkcellContent({
  workcellId, data, period = '', month, resource = 'equipment',
}: {
  workcellId: string;
  data: Ppqt2Workcell;
  period?: string;
  month?: string;
  resource?: PPQTResourceMode;
}) {
  const copy = PPQT_RESOURCE_COPY[resource];
  const [lineId, setLineId] = useState<string | null>(null);
  const [drawerProc, setDrawerProc] = useState<PPQTProcess | null>(null);

  // The Excel DASH works one sub-workcenter at a time — default to the first.
  const line: Ppqt2Line = data.lines.find(l => l.swc.id === lineId) ?? data.lines[0];
  const procs = line.processes;

  /** Open the step drawer for the process band clicked in the chart. */
  const onChartClick = (state: { activeLabel?: string | number } | null) => {
    if (!state?.activeLabel) return;
    const p = procs.find(x => x.name === state.activeLabel);
    if (p) setDrawerProc(p);
  };

  return (
      <div className="p-5">
        {/* ── main: chart + matrix + TOP demand — full width ────────────────── */}
        <div className="space-y-4">

          {/* toolbar — "Sub Workcenter" selector (Excel B3:C15) */}
          <div className="flex items-center gap-3">
            <Select value={line.swc.id} onValueChange={setLineId}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.lines.map(l => (
                  <SelectItem key={l.swc.id} value={l.swc.id} className="text-xs">{l.swc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* chart — Equipment Available vs Resources NEEDED per process */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.haveLabel} vs Resources NEEDED — {line.swc.name}
            </div>
            <div className="px-2 pt-3 pb-1">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={procs.map(p => ({
                    name: p.name, Available: p.eqAvail,
                    // dwell steps aren't serially sized — omit their (huge) bar so it doesn't blow the Y-axis
                    Needed: p.dwell ? null : p.resNeeded, gap: p.gap, dwell: p.dwell,
                  }))}
                  barGap={2}
                  onClick={onChartClick}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={55}
                  />
                  {/* Hidden numeric axis — lets zone shading cover each band edge-to-edge.
                      Recharts throws [DecimalError] NaN computing ticks for a single-band
                      domain, and real data does have one-process lines (e.g. WAB BE ESS
                      P1A-1), so the shading is skipped below 2 processes — the bars still
                      carry the verdict. */}
                  {procs.length > 1 && (
                    <XAxis xAxisId="zones" type="number" domain={[0, procs.length]} hide />
                  )}
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    width={28}
                  />
                  {/* zone shading: red = not enough machines, green = enough */}
                  {procs.length > 1 && procs.map((p, i) => (
                    <ReferenceArea
                      key={p.id}
                      xAxisId="zones"
                      x1={i}
                      x2={i + 1}
                      fill={p.dwell ? '#8b5cf6' : p.gap > 0 ? '#ef4444' : '#10b981'}
                      fillOpacity={0.08}
                      stroke="none"
                      cursor="pointer"
                    />
                  ))}
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Available" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={26} cursor="pointer" />
                  <Bar dataKey="Needed" fill="#9ca3af" radius={[3, 3, 0, 0]} maxBarSize={26} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="px-4 pb-3 text-[10px] text-muted-foreground">
              Zone shading: <span className="text-red-400 font-semibold">red</span> = not enough {copy.unitPlural} to meet{' '}
              {period} demand at that step, <span className="text-emerald-400 font-semibold">green</span> = enough.
              Click a process to see the math trail and which assemblies drive its load.
            </p>
          </div>

          {/* the DASH matrix — table view of the same data */}
          <DashMatrix line={line} totalDemand={data.wc.totalDemand} demandThru={data.demandThru} resource={resource} />

          {/* TOP Demand block — Excel rows 37-59 */}
          <TopDemandMatrix line={line} workcellId={workcellId} month={month} resource={resource} />
        </div>

        {/* step drawer — opened by clicking a process band in the chart */}
        {drawerProc && (
          <StepDrawer
            workcell={workcellId}
            process={drawerProc}
            line={line.swc}
            month={month}
            resource={resource}
            onClose={() => setDrawerProc(null)}
          />
        )}
      </div>
  );
}

// ─── The DASH calculation matrix (Excel rows 21-35) ──────────────────────────
function DashMatrix({
  line, totalDemand, demandThru, resource,
}: {
  line: Ppqt2Line;
  totalDemand: number;
  demandThru: Map<string, number>;
  resource: PPQTResourceMode;
}) {
  const copy = PPQT_RESOURCE_COPY[resource];
  const procs = line.processes;
  const cols = matrixCols(procs.length);
  const s = line.swc;

  // Round Up flag (Excel row 34) — set where rounding up changed the result.
  const roundUpFlag = (p: PPQTProcess): string => {
    const raw = getMathTrail(p, s).rawNeed;
    return Math.ceil(raw) !== Math.round(raw) && p.resNeeded === Math.ceil(raw) ? '1' : '';
  };

  type Row = {
    label: string;
    total?: string;                       // the "D" column
    cell: (p: PPQTProcess) => string;
    cellClass?: (p: PPQTProcess) => string;
    section?: boolean;                    // draw a thicker divider above
  };

  const rows: Row[] = [
    // rows 21-26 — operating parameters (per-process columns, like the sheet)
    { label: 'Shift Hour (Hrs)=',                  cell: () => String(s.shiftHours) },
    { label: 'Days in the Period of the Demand=',  cell: () => String(s.workingDays) },
    { label: 'Qty. of Changeovers per day=',       cell: () => String(s.changeoverQty) },
    { label: 'Time for Changeover (Min)=',         cell: () => String(s.changeoverTime) },
    { label: 'FPY',                                cell: () => `${s.fpy}%` },
    { label: 'Efficiency',                         cell: () => `${s.efficiency}%` },
    // rows 28-30 — calculations
    {
      label: 'Total Demand (by process)', section: true,
      total: totalDemand.toLocaleString(),
      cell: p => (demandThru.get(p.id) ?? 0).toLocaleString(),
    },
    { label: resource === 'people' ? 'Weighted Manual time' : 'Weighted Cycle time', cell: p => p.wct.toFixed(2) },
    { label: 'Takt Time (Sec)',     cell: p => p.takt.toFixed(1) },
    // rows 32-35 — the output block
    {
      label: copy.haveLabel, section: true,
      total: s.name,
      cell: p => String(p.eqAvail),
    },
    {
      label: 'Resources NEEDED',
      cell: p => (p.dwell ? 'dwell' : String(p.resNeeded)),
      cellClass: p => (p.dwell ? 'text-violet-400' : p.gap > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'),
    },
    { label: 'Round Up',      cell: roundUpFlag },
    { label: 'Justification', cell: () => '' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        DASH — {s.name}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 15 * 16 + 6.5 * 16 + procs.length * 96 }}>
          {/* process header row */}
          <div className="grid bg-muted/50 border-b border-border" style={{ gridTemplateColumns: cols }}>
            <div className="px-3 py-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold sticky left-0 bg-muted/50" />
            <div className="px-2 py-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold text-right">Total</div>
            {procs.map(p => (
              <div key={p.id} className="px-2 py-2 text-[9px] text-foreground uppercase tracking-wider font-bold text-right truncate" title={p.name}>
                {p.name}
              </div>
            ))}
          </div>

          {rows.map(row => (
            <div
              key={row.label}
              className={cn(
                'grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                row.section && 'border-t-2 border-t-border',
              )}
              style={{ gridTemplateColumns: cols, height: 38 }}
            >
              <div className="px-3 text-[11px] font-medium text-muted-foreground sticky left-0 bg-card truncate" title={row.label}>
                {row.label}
              </div>
              <div className="px-2 text-right text-[11px] font-mono text-foreground/80 tabular-nums truncate" title={row.total}>
                {row.total ?? ''}
              </div>
              {procs.map(p => (
                <div
                  key={p.id}
                  className={cn(
                    'px-2 text-right text-[11px] font-mono tabular-nums text-foreground',
                    row.cellClass?.(p),
                  )}
                >
                  {row.cell(p) || <span className="text-muted-foreground/40">–</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="px-4 py-2.5 border-t border-border text-[10px] text-muted-foreground">
        Resources NEEDED = Weighted Cycle time ÷ Takt ÷ (FPY × Efficiency), rounded up when the Round Up flag is set
        (Excel row 34 — engineering judgment; a fractional need can be rounded down with a justification, e.g. a
        machine shared with another line).
      </p>
    </div>
  );
}

// ─── TOP Demand block (Excel rows 37-59) ──────────────────────────────────────
function TopDemandMatrix({
  line, workcellId, month, resource,
}: { line: Ppqt2Line; workcellId: string; month?: string; resource: PPQTResourceMode }) {
  const procs = line.processes;
  const cols = matrixCols(procs.length);

  // Top assemblies by demand with their CT at every process — blank = not routed.
  // One request per line; the backend does the ranking and the pivot.
  const { data, isLoading } = usePpqtMatrix(workcellId, line.swc.name, 20, month, resource);
  const rows = data?.assemblies ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">TOP Demand :</span>
        <span className="text-[10px] font-bold text-foreground font-mono">{rows.length}</span>
        <span className="text-[9px] text-muted-foreground ml-auto">
          {resource === 'people' ? 'operator time' : 'cycle time'} (s) per assembly at each process — blank = does not route through
        </span>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading top demand…
        </div>
      )}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 15 * 16 + 6.5 * 16 + procs.length * 96 }}>
          {/* header — ' SAP Part Number' | 'Demand' | process columns */}
          <div className="grid bg-muted/50 border-b border-border" style={{ gridTemplateColumns: cols }}>
            <div className="px-3 py-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold sticky left-0 bg-muted/50">
              SAP Part Number
            </div>
            <div className="px-2 py-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold text-right">Demand</div>
            {procs.map(p => (
              <div key={p.id} className="px-2 py-2 text-[9px] text-foreground uppercase tracking-wider font-bold text-right truncate" title={p.name}>
                {p.name}
              </div>
            ))}
          </div>

          {rows.map(r => {
            const label = `${r.assembly} / ${r.revision}`;
            return (
              <div
                key={`${r.assembly}-${r.revision}`}
                className="grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                style={{ gridTemplateColumns: cols, height: 36 }}
              >
                <div className="px-3 text-[11px] font-mono font-medium text-foreground sticky left-0 bg-card truncate" title={label}>
                  {label}
                </div>
                <div className="px-2 text-right text-[11px] font-mono font-semibold text-foreground tabular-nums">
                  {r.demand.toLocaleString()}
                </div>
                {procs.map(p => {
                  const ct = r.ct[p.name];
                  return (
                    <div key={p.id} className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">
                      {ct && ct > 0 ? ct.toFixed(2) : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
