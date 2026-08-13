/**
 * DataTab.tsx — the workbook itself, every column, plus a CSV export and the
 * data-quality notes. This is the tab people open when they don't believe a
 * chart: the derived columns sit next to the inputs they came from.
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  VANVA_STATUS_BADGE, VANVA_STATUS_LABEL, dl, nvaTextClass, pct, signed, sizingGapClass,
} from '@/lib/va_nva/vanvaConstants';
import { PanelCard } from '@/pages/vanva/VaNvaChartKit';
import type { VaNvaMetrics } from '@/pages/vanva/types';
import { AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

const HEAD = [
  'Workcell', 'Role', 'VA sizing (round)', 'VA sizing (dec)', 'Actual', 'Crew',
  'NVA PPQT', 'NVA MFG', 'Overall (round)', 'Overall (dec)', 'NVA %',
  'NVA allowed', 'To cut', 'Actual − sizing', 'PPQT − MFG', 'Status', 'Note',
];

const ROLE_LABEL: Record<string, string> = {
  workcell: 'Workcell', parent: 'Rollup', child: 'Breakdown', aggregate: 'Plan row',
};

function toCsv(rows: VaNvaMetrics[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map(r => [
    r.workcell, ROLE_LABEL[r.role], r.vaSizingRound, r.vaSizingDecimal, r.vaActual, r.crew,
    r.nvaPpqt, r.nvaMfg, r.overallRound, r.overallDecimal,
    r.nvaRatio === null ? '' : (r.nvaRatio * 100).toFixed(2),
    r.nvaTarget?.toFixed(2), r.toReduce?.toFixed(2), r.sizingGap, r.ppqtVsMfg,
    r.status, r.note ?? '',
  ].map(esc).join(','));
  return [HEAD.map(esc).join(','), ...lines].join('\r\n');
}

export default function DataTab({ rows, target }: { rows: VaNvaMetrics[]; target: number }) {
  const notes = rows.filter(r => r.note);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-nva_${(target * 100).toFixed(0)}pct_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows.`);
  };

  return (
    <div className="space-y-4">
      <PanelCard
        title="Every column, every row"
        hint={`Derived columns re-run at ${pct(target, 0)} NVA. Breakdown and plan rows are shown but excluded from plant totals.`}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 gap-1.5 text-[11px]">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1180px]">
            <thead>
              <tr className="bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left  font-semibold px-4 py-2.5 sticky left-0 bg-muted/50">Workcell</th>
                <th className="text-left  font-semibold px-2 py-2.5">Role</th>
                <th className="text-right font-semibold px-2 py-2.5">VA #</th>
                <th className="text-right font-semibold px-2 py-2.5">VA dec</th>
                <th className="text-right font-semibold px-2 py-2.5">Actual</th>
                <th className="text-right font-semibold px-2 py-2.5">Crew</th>
                <th className="text-right font-semibold px-2 py-2.5">NVA PPQT</th>
                <th className="text-right font-semibold px-2 py-2.5">NVA MFG</th>
                <th className="text-right font-semibold px-2 py-2.5">Total #</th>
                <th className="text-right font-semibold px-2 py-2.5">Total dec</th>
                <th className="text-right font-semibold px-2 py-2.5">NVA %</th>
                <th className="text-right font-semibold px-2 py-2.5">Allowed</th>
                <th className="text-right font-semibold px-2 py-2.5">To cut</th>
                <th className="text-right font-semibold px-2 py-2.5">Act−Size</th>
                <th className="text-right font-semibold px-2 py-2.5">PPQT−MFG</th>
                <th className="text-right font-semibold px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={cn('h-11 border-b border-border last:border-0 hover:bg-muted/30',
                  r.role !== 'workcell' && r.role !== 'parent' && 'opacity-60')}>
                  <td className="px-4 text-xs font-semibold text-foreground whitespace-nowrap sticky left-0 bg-card">
                    {r.workcell}
                    {r.note && <AlertTriangle className="inline ml-1.5 h-3 w-3 text-amber-400" />}
                  </td>
                  <td className="px-2 text-[10px] text-muted-foreground whitespace-nowrap">{ROLE_LABEL[r.role]}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(r.vaSizingRound, 2)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(r.vaSizingDecimal, 2)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-sky-400 tabular-nums">{dl(r.vaActual)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{r.crew ?? '—'}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-violet-400 tabular-nums">{dl(r.nvaPpqt)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-red-400 tabular-nums">{dl(r.nvaMfg)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{dl(r.overallRound, 2)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(r.overallDecimal, 2)}</td>
                  <td className={cn('px-2 text-right text-[11px] font-mono font-bold tabular-nums', nvaTextClass(r.nvaRatio))}>{pct(r.nvaRatio)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{dl(r.nvaTarget, 2)}</td>
                  <td className={cn('px-2 text-right text-[11px] font-mono font-semibold tabular-nums',
                    (r.toReduce ?? 0) > 0 ? 'text-red-400' : r.toReduce === null ? 'text-muted-foreground' : 'text-emerald-400')}>
                    {signed(r.toReduce, 2)}
                  </td>
                  <td className={cn('px-2 text-right text-[11px] font-mono tabular-nums', sizingGapClass(r.sizingGap))}>{signed(r.sizingGap)}</td>
                  <td className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{signed(r.ppqtVsMfg)}</td>
                  <td className="px-4 text-right">
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap', VANVA_STATUS_BADGE[r.status])}>
                      {VANVA_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {notes.length > 0 && (
        <PanelCard title="Data quality" hint="Carried from the source workbook — read these before quoting a number.">
          {notes.map((r, i) => (
            <div key={r.id} className={cn('px-4 py-2.5 flex items-start gap-2.5', i < notes.length - 1 && 'border-b border-border')}>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-foreground">{r.workcell}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{r.note}</p>
              </div>
            </div>
          ))}
        </PanelCard>
      )}
    </div>
  );
}
