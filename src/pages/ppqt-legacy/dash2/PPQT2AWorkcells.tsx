/**
 * PPQT2AWorkcells.tsx — Dashboard 2 · Variant A ("Report" approach)
 * ──────────────────────────────────────────────────────────────────
 * League table of workcells ranked by capacity shortfall — worst first.
 * One row per customer, columns answer the PPQT question directly:
 * how much demand, how many lines, how many steps short, how many
 * machines missing, verdict. Click a row → the dedicated capacity report.
 *
 * Route: /ppqt/dash2a
 * Data: REAL — GET /api/ppqt/overview. Planner demand × IEDB cycle time,
 * computed forward server-side (modules/ppqt/capacity.py).
 */

import {
  PPQT_VERDICT_BADGE,
  PPQT_VERDICT_LABEL,
  PPQT_VERDICT_TEXT,
} from '@/lib/ppqt/ppqtConstants';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePpqtMonths, usePpqtOverview } from '@/hooks/ppqt/usePpqtData';
import { cn } from '@/lib/utils';
import { monthLabel, PPQT_RESOURCE_COPY, type PPQTResourceMode } from '@/lib/ppqt/ppqtConstants';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GRID = '2.5rem minmax(14rem,1fr) 7.5rem 5rem 7rem 8.5rem 7.5rem 1.5rem';
const HEADERS_FOR = (shortLabel: string) =>
  ['#', 'Workcell', 'Demand', 'Lines', 'Steps short', shortLabel, 'Verdict', ''];

export default function PPQT2AWorkcells() {
  const navigate = useNavigate();
  const { data: monthData } = usePpqtMonths();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [resource, setResource] = useState<PPQTResourceMode>('equipment');
  const { data, isLoading, error } = usePpqtOverview({ month, resource });
  const copy = PPQT_RESOURCE_COPY[resource];

  const activeMonth = month ?? data?.month ?? monthData?.default ?? '';
  const rows = data?.workcells ?? [];
  const eqAvail = data?.params.eq_avail ?? 1;
  const totalShortWc = rows.filter(r => r.machinesShort > 0).length;
  const totalMachinesShort = rows.reduce((s, r) => s + r.machinesShort, 0);

  if (isLoading) {
    return (
      <div className="p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Computing capacity across all workcells…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Could not load capacity data</p>
            <p className="text-xs text-muted-foreground mt-1">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            Capacity Verdict — {monthLabel(activeMonth)}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {resource === 'people'
              ? 'Planner demand × IEDB manual time. Operators needed vs headcount per station. Worst first.'
              : `Planner demand × IEDB cycle time. Machines needed vs ${eqAvail} available per step. Worst first.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* resource toggle — same demand + takt, different numerator and "have" */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {(['equipment', 'people'] as PPQTResourceMode[]).map(m => (
              <button
                key={m}
                onClick={() => setResource(m)}
                className={cn(
                  'px-3 h-7 text-[11px] font-semibold transition-colors',
                  resource === m
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {PPQT_RESOURCE_COPY[m].label}
              </button>
            ))}
          </div>
          <Select value={activeMonth} onValueChange={setMonth}>
            <SelectTrigger className="w-[150px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(monthData?.months ?? []).map(m => (
                <SelectItem key={m} value={m} className="text-xs">{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            totalMachinesShort > 0
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          )}>
            {totalMachinesShort > 0
              ? `${totalShortWc} workcell${totalShortWc !== 1 ? 's' : ''} short · ${totalMachinesShort} ${totalMachinesShort !== 1 ? copy.unitPlural : copy.unit} missing`
              : 'All workcells can meet demand'}
          </span>
        </div>
      </div>

      {/* league table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
          style={{ gridTemplateColumns: GRID }}
        >
          {HEADERS_FOR(copy.shortLabel).map((h, i) => (
            <div key={i} className={cn('px-2 py-2.5', (i >= 2 && i <= 5) && 'text-right')}>{h}</div>
          ))}
        </div>

        {rows.map((r, idx) => {
          const logo = getWorkcellLogo(r.workcell);
          return (
            <button
              key={r.workcell}
              onClick={() => navigate(
                `/ppqt/dash2a/${encodeURIComponent(r.workcell)}`
                + `?resource=${resource}` + (activeMonth ? `&month=${activeMonth}` : ''),
              )}
              className="group grid items-center w-full text-left border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              style={{ gridTemplateColumns: GRID, height: 60 }}
            >
              {/* position */}
              <div className="px-2">
                <span className="text-sm font-mono font-bold text-muted-foreground tabular-nums">{idx + 1}</span>
              </div>

              {/* logo + name */}
              <div className="px-2 flex items-center gap-3 min-w-0">
                {logo ? (
                  <div
                    className="w-24 h-9 rounded border border-border flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: getWorkcellLogoBg(r.workcell) ?? '#ffffff' }}
                  >
                    <img src={logo} alt={r.workcell} className="w-full h-full object-contain p-0.5" />
                  </div>
                ) : (
                  <div className="w-24 h-9 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-muted-foreground">{r.workcell.slice(0, 3).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{r.workcell}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.assemblies.toLocaleString()} assemblies · {r.lines} line{r.lines !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* demand */}
              <div className="px-2 text-right">
                <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                  {r.totalDemand.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">units</span>
              </div>

              {/* lines */}
              <div className="px-2 text-right text-sm font-mono text-muted-foreground tabular-nums">
                {r.lines}
              </div>

              {/* steps short */}
              <div className="px-2 text-right">
                <span className={cn(
                  'text-sm font-mono font-semibold tabular-nums',
                  r.stepsShort > 0 ? 'text-red-400' : 'text-muted-foreground',
                )}>
                  {r.stepsShort}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">of {r.stepsTotal}</span>
              </div>

              {/* machines short — THE number */}
              <div className="px-2 text-right">
                <span className={cn(
                  'text-base font-mono font-bold tabular-nums',
                  r.machinesShort > 0 ? 'text-red-400' : 'text-emerald-400',
                )}>
                  {r.machinesShort > 0 ? `−${r.machinesShort}` : '0'}
                </span>
              </div>

              {/* verdict */}
              <div className="px-2 flex justify-end">
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wider',
                  PPQT_VERDICT_BADGE[r.verdict],
                )}>
                  {PPQT_VERDICT_LABEL[r.verdict]}
                </span>
              </div>

              {/* chevron */}
              <div className="px-1 flex justify-center">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-3">
        <span className={cn('font-semibold', PPQT_VERDICT_TEXT.short)}>SHORT</span> — at least one process step needs
        more machines than the line has. <span className={cn('font-semibold', PPQT_VERDICT_TEXT.tight)}>TIGHT</span> —
        nothing short, but at least one step is loaded above 90%. Click a workcell for the full capacity report.
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">
        Demand: planner spreadsheets for {monthLabel(activeMonth)}. Cycle time: IEDB, demand-weighted per step.
        {resource === 'equipment' ? (
          <> Equipment available is assumed to be {eqAvail} per step — the SBWC machine counts are
          not ingested yet, so gaps are worst-case.</>
        ) : (
          <> Charges operator time only (no machine time, no FPY) against the IEDB headcount per
          station. This is <span className="font-semibold text-foreground/80">direct/VA labour only</span> —
          NVA and offline DL (line leader, rework, debug, admin; target ≤20%) are not in the data,
          so total DL will be higher.</>
        )}
      </p>
    </div>
  );
}
