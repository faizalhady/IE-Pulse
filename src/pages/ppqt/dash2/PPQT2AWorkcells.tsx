/**
 * PPQT2AWorkcells.tsx — Dashboard 2 · Variant A ("Report" approach)
 * ──────────────────────────────────────────────────────────────────
 * League table of workcells ranked by capacity shortfall — worst first.
 * One row per customer, columns answer the PPQT question directly:
 * how much demand, how many lines, how many steps short, how many
 * machines missing, verdict. Click a row → the dedicated capacity report.
 *
 * Route: /ppqt/dash2a
 * Data: mock (ppqt2Data.ts derived layer) — swap for hooks in Phase 2.
 */

import {
  PPQT_VERDICT_BADGE,
  PPQT_VERDICT_LABEL,
  PPQT_VERDICT_TEXT,
} from '@/lib/ppqt/ppqtConstants';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERIOD_OPTIONS } from '../mockPpqtData';
import { getAllWorkcellCapacities } from './ppqt2Data';

const GRID = '2.5rem minmax(14rem,1fr) 7.5rem 5rem 7rem 8.5rem 7.5rem 1.5rem';
const HEADERS = ['#', 'Workcell', 'Demand', 'Lines', 'Steps short', 'Machines short', 'Verdict', ''];

export default function PPQT2AWorkcells() {
  const navigate = useNavigate();
  const rows = useMemo(() => getAllWorkcellCapacities(), []);

  const totalShortWc = rows.filter(r => r.machinesShort > 0).length;
  const totalMachinesShort = rows.reduce((s, r) => s + r.machinesShort, 0);

  return (
    <div className="p-5">
      {/* header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Capacity Verdict — {PERIOD_OPTIONS[0]}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Machines needed vs machines available, per customer. Worst first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full border',
            totalMachinesShort > 0
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          )}>
            {totalMachinesShort > 0
              ? `${totalShortWc} workcell${totalShortWc !== 1 ? 's' : ''} short · ${totalMachinesShort} machine${totalMachinesShort !== 1 ? 's' : ''} missing`
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
          {HEADERS.map((h, i) => (
            <div key={i} className={cn('px-2 py-2.5', (i >= 2 && i <= 5) && 'text-right')}>{h}</div>
          ))}
        </div>

        {rows.map((r, idx) => {
          const logo = getWorkcellLogo(r.wc.id);
          return (
            <button
              key={r.wc.id}
              onClick={() => navigate(`/ppqt/dash2a/${encodeURIComponent(r.wc.id)}`)}
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
                    style={{ backgroundColor: getWorkcellLogoBg(r.wc.id) ?? '#ffffff' }}
                  >
                    <img src={logo} alt={r.wc.id} className="w-full h-full object-contain p-0.5" />
                  </div>
                ) : (
                  <div className="w-24 h-9 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-muted-foreground">{r.wc.id.slice(0, 3).toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">{r.wc.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.wc.division}</p>
                </div>
              </div>

              {/* demand */}
              <div className="px-2 text-right">
                <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                  {r.wc.totalDemand.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">units</span>
              </div>

              {/* lines */}
              <div className="px-2 text-right text-sm font-mono text-muted-foreground tabular-nums">
                {r.lines.length}
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
    </div>
  );
}
