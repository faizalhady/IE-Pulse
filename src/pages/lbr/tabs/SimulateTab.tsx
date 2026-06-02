/**
 * SimulateTab.tsx — THE TOOL.
 * Move work elements between stations (click a movable element → pick a target
 * station). LBR/UPH/LBL recompute live via lbrCalc. Right panel shows Original
 * vs Simulated with deltas. All local state — no backend persistence in v1.
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { lbrTextClass, ELEMENT_CATEGORY_BADGE, STATION_TYPE_BADGE, STATION_TYPE_LABEL } from '@/lib/lbr/lbrConstants';
import { computeLbrMetrics, recomputeStations, stationCt } from '@/lib/lbr/lbrCalc';
import type { LBRPlaybook, LBRStation } from '../types';
import YamazumiChart from '../YamazumiChart';
import { ArrowDown, ArrowRight, ArrowUp, RotateCcw, Save } from 'lucide-react';
import { useMemo, useState } from 'react';

const clone = (s: LBRStation[]): LBRStation[] => JSON.parse(JSON.stringify(s));

export default function SimulateTab({ playbook }: { playbook: LBRPlaybook }) {
  const [stations, setStations] = useState<LBRStation[]>(() => recomputeStations(clone(playbook.stations)));
  const [saved, setSaved] = useState<string | null>(null);

  const orig = useMemo(() => computeLbrMetrics(playbook.stations, playbook.operators, playbook.takt), [playbook]);
  const sim = useMemo(() => computeLbrMetrics(stations, playbook.operators, playbook.takt), [stations, playbook]);

  const moveEl = (fromId: string, elId: string, toId: string) => {
    setSaved(null);
    setStations(prev => {
      const next = prev.map(s => ({ ...s, elements: [...s.elements] }));
      const from = next.find(s => s.id === fromId);
      const to = next.find(s => s.id === toId);
      if (!from || !to) return prev;
      const i = from.elements.findIndex(e => e.id === elId);
      if (i < 0) return prev;
      const [el] = from.elements.splice(i, 1);
      to.elements.push(el);
      return recomputeStations(next);
    });
  };

  const reset = () => { setStations(recomputeStations(clone(playbook.stations))); setSaved(null); };
  const save = () => setSaved(`Saved “${playbook.name} (sim)” · LBR ${sim.lbr}% — local only, no backend in v1.`);

  const dirty = JSON.stringify(stations.map(s => s.elements.map(e => e.id))) !== JSON.stringify(playbook.stations.map(s => s.elements.map(e => e.id)));

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* LEFT — editable stations */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Live Yamazumi</p>
            <span className="text-[9px] text-muted-foreground">click a movable element below to reassign it</span>
          </div>
          <div className="p-4"><YamazumiChart stations={stations} takt={playbook.takt} height={240} showAxisLabels={false} /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {stations.map(s => {
            const ct = stationCt(s);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground">{s.id}</span>
                    <span className={cn('text-[8px] font-semibold px-1 py-0.5 rounded border', STATION_TYPE_BADGE[s.type])}>{STATION_TYPE_LABEL[s.type]}</span>
                  </div>
                  <span className={cn('text-[11px] font-mono tabular-nums', s.isBottleneck ? 'text-red-400 font-bold' : 'text-muted-foreground')}>{ct}s</span>
                </div>
                <div className="p-2 flex flex-col gap-1">
                  {s.elements.map(e => {
                    const canMove = e.movable && e.movableTo.length > 0;
                    const chip = (
                      <div className={cn('flex items-center justify-between gap-2 px-2 py-1 rounded border text-[10px]',
                        canMove ? 'border-emerald-500/30 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10' : 'border-border bg-muted/20')}>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className={cn('text-[7px] font-semibold px-1 rounded border', ELEMENT_CATEGORY_BADGE[e.category])}>{e.category}</span>
                          <span className="text-foreground truncate">{e.name}</span>
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums flex items-center gap-1">{e.timeSec}s {canMove && <ArrowRight className="h-2.5 w-2.5 text-emerald-400" />}</span>
                      </div>
                    );
                    if (!canMove) return <div key={e.id}>{chip}</div>;
                    return (
                      <DropdownMenu key={e.id}>
                        <DropdownMenuTrigger asChild><button className="w-full text-left">{chip}</button></DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {e.movableTo.map(t => (
                            <DropdownMenuItem key={t} onClick={() => moveEl(s.id, e.id, t)} className="text-xs">Move to {t}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })}
                  {s.elements.length === 0 && <p className="text-[10px] text-muted-foreground italic px-1 py-2">No elements</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — comparison panel */}
      <div className="w-full lg:w-[320px] flex-shrink-0">
        <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-[150px]">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Original vs Simulated</p>
            {dirty && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </div>
          <div className="divide-y divide-border">
            <Row label="LBR" orig={`${orig.lbr}%`} sim={`${sim.lbr}%`} delta={sim.lbr - orig.lbr} good="up" simClass={lbrTextClass(sim.lbr)} />
            <Row label="UPH" orig={String(orig.uph)} sim={String(sim.uph)} delta={sim.uph - orig.uph} good="up" />
            <Row label="UPPH" orig={String(orig.upph)} sim={String(sim.upph)} delta={sim.upph - orig.upph} good="up" />
            <Row label="LBL" orig={`${orig.lbl}s`} sim={`${sim.lbl}s`} delta={sim.lbl - orig.lbl} good="down" />
            <Row label="Bottleneck CT" orig={`${orig.tBottleneckSec}s`} sim={`${sim.tBottleneckSec}s`} delta={sim.tBottleneckSec - orig.tBottleneckSec} good="down" />
            <Row label="vs TAKT" orig={`${orig.vsTaktPct}%`} sim={`${sim.vsTaktPct}%`} delta={sim.vsTaktPct - orig.vsTaktPct} good="down" />
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bottleneck</span>
              <span className="text-[11px] font-mono text-foreground">{orig.bottleneckStation} <ArrowRight className="inline h-2.5 w-2.5" /> {sim.bottleneckStation}</span>
            </div>
          </div>
          <div className="p-3 flex gap-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={reset} disabled={!dirty} className="flex-1"><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset</Button>
            <Button size="sm" onClick={save} disabled={!dirty} className="flex-1 bg-emerald-500 hover:bg-emerald-600"><Save className="h-3.5 w-3.5 mr-1.5" /> Save</Button>
          </div>
          {saved && <p className="px-3 pb-3 text-[10px] text-emerald-400">{saved}</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, orig, sim, delta, good, simClass }: {
  label: string; orig: string; sim: string; delta: number; good: 'up' | 'down'; simClass?: string;
}) {
  const improved = good === 'up' ? delta > 0 : delta < 0;
  const worse = good === 'up' ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.05;
  return (
    <div className="grid items-center px-4 py-2" style={{ gridTemplateColumns: '1fr 4rem 4rem 3.5rem' }}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-right text-[11px] font-mono text-muted-foreground tabular-nums">{orig}</span>
      <span className={cn('text-right text-[11px] font-mono font-bold tabular-nums', simClass ?? 'text-foreground')}>{sim}</span>
      <span className={cn('text-right text-[10px] font-mono tabular-nums flex items-center justify-end gap-0.5',
        neutral ? 'text-muted-foreground' : improved ? 'text-emerald-400' : worse ? 'text-red-400' : 'text-muted-foreground')}>
        {!neutral && (improved
          ? (good === 'up' ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)
          : (good === 'up' ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />))}
        {neutral ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
      </span>
    </div>
  );
}
