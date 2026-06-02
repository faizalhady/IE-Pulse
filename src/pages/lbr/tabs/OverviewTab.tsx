/**
 * OverviewTab.tsx — playbook overview: metric cards + mini Yamazumi + stations summary.
 */

import { cn } from '@/lib/utils';
import { lbrTextClass, vsTaktTextClass, STATION_TYPE_BADGE, STATION_TYPE_LABEL } from '@/lib/lbr/lbrConstants';
import { stationCt } from '@/lib/lbr/lbrCalc';
import type { LBRPlaybook } from '../types';
import YamazumiChart from '../YamazumiChart';
import { ArrowRight } from 'lucide-react';

export default function OverviewTab({ playbook, onOpenTab }: { playbook: LBRPlaybook; onOpenTab: (t: string) => void }) {
  const p = playbook;
  return (
    <div className="flex flex-col gap-5">
      {/* Metric cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        <Metric label="LBR" value={`${p.lbr}%`} className={lbrTextClass(p.lbr)} />
        <Metric label="UPH" value={String(p.uph)} />
        <Metric label="UPPH" value={String(p.upph)} />
        <Metric label="LBL" value={`${p.lbl}s`} />
        <Metric label="TAKT" value={`${p.takt}s`} />
        <Metric label="Bottleneck CT" value={`${p.bottleneckCt}s`} className={vsTaktTextClass(p.vsTaktPct)} />
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Mini Yamazumi */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Line Balance · Yamazumi</p>
            <button onClick={() => onOpenTab('yamazumi')} className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              Full chart <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4"><YamazumiChart stations={p.stations} takt={p.takt} height={240} showAxisLabels={false} /></div>
        </div>

        {/* Stations summary */}
        <div className="w-full lg:w-[340px] flex-shrink-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Stations · {p.stations.length}</p>
            <button onClick={() => onOpenTab('stations')} className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              Details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {p.stations.map(s => {
            const ct = stationCt(s);
            return (
              <div key={s.id} className="flex items-center gap-2 px-4 py-2 border-b border-border last:border-0">
                <span className="text-[11px] font-semibold text-foreground w-12">{s.id}</span>
                <span className={cn('text-[8px] font-semibold px-1 py-0.5 rounded border', STATION_TYPE_BADGE[s.type])}>{STATION_TYPE_LABEL[s.type]}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className={cn('h-full rounded-full', s.isBottleneck ? 'bg-red-500' : 'bg-emerald-500')} style={{ width: `${(ct / p.bottleneckCt) * 100}%` }} />
                </div>
                <span className={cn('text-[11px] font-mono tabular-nums w-10 text-right', s.isBottleneck ? 'text-red-400 font-bold' : 'text-muted-foreground')}>{ct}s</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-2xl font-mono font-black mt-1 tabular-nums leading-none', className ?? 'text-foreground')}>{value}</p>
    </div>
  );
}
