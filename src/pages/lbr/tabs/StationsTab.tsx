/**
 * StationsTab.tsx — stations table with expandable work-element rows.
 */

import { cn } from '@/lib/utils';
import {
  ELEMENT_CATEGORY_BADGE, STATION_TYPE_BADGE, STATION_TYPE_LABEL,
} from '@/lib/lbr/lbrConstants';
import { stationCt } from '@/lib/lbr/lbrCalc';
import type { LBRPlaybook } from '../types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const GRID = '2rem 1.5rem 6rem 6rem 6rem 5rem 6rem 5rem';
const HEADERS = ['', '#', 'Station', 'Type', 'Operator', 'Cycle Time', 'Bottleneck', 'Elements'];

export default function StationsTab({ playbook }: { playbook: LBRPlaybook }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border" style={{ gridTemplateColumns: GRID }}>
        {HEADERS.map((h, i) => <div key={i} className={cn('px-2 py-2.5', i >= 5 && 'text-right')}>{h}</div>)}
      </div>
      {playbook.stations.map((s, idx) => {
        const ct = stationCt(s);
        const isOpen = open.has(s.id);
        return (
          <div key={s.id} className="border-b border-border last:border-0">
            <div className="grid items-center hover:bg-muted/20 transition-colors cursor-pointer" style={{ gridTemplateColumns: GRID, minHeight: 44 }} onClick={() => toggle(s.id)}>
              <div className="px-2 flex justify-center text-muted-foreground">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</div>
              <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
              <div className="px-2 text-[11px] font-semibold text-foreground">{s.id}</div>
              <div className="px-2"><span className={cn('text-[8px] font-semibold px-1.5 py-0.5 rounded border', STATION_TYPE_BADGE[s.type])}>{STATION_TYPE_LABEL[s.type]}</span></div>
              <div className="px-2 text-[10px] text-muted-foreground truncate">{s.operator ?? '—'}</div>
              <div className={cn('px-2 text-right text-[11px] font-mono tabular-nums', s.isBottleneck ? 'text-red-400 font-bold' : 'text-foreground')}>{ct}s</div>
              <div className="px-2 text-right text-[10px]">{s.isBottleneck ? <span className="text-red-400 font-semibold">Yes</span> : <span className="text-muted-foreground">—</span>}</div>
              <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{s.elements.length}</div>
            </div>
            {isOpen && (
              <div className="bg-muted/10 border-t border-border px-6 py-3">
                <div className="grid text-[9px] text-muted-foreground uppercase tracking-wider font-semibold pb-1.5" style={{ gridTemplateColumns: '1.5rem 1fr 5rem 4rem 6rem' }}>
                  <div>#</div><div>Element</div><div className="text-right">Time</div><div className="text-right">Cat</div><div className="text-right">Movable</div>
                </div>
                {s.elements.map((e, i) => (
                  <div key={e.id} className="grid items-center py-1 border-t border-border/50" style={{ gridTemplateColumns: '1.5rem 1fr 5rem 4rem 6rem' }}>
                    <div className="text-[10px] text-muted-foreground font-mono">{i + 1}</div>
                    <div className="text-[11px] text-foreground truncate">{e.name}</div>
                    <div className="text-right text-[11px] font-mono text-foreground tabular-nums">{e.timeSec}s</div>
                    <div className="text-right"><span className={cn('text-[8px] font-semibold px-1 py-0.5 rounded border', ELEMENT_CATEGORY_BADGE[e.category])}>{e.category}</span></div>
                    <div className="text-right text-[10px] text-muted-foreground">{e.movable ? (e.movableTo.length ? `→ ${e.movableTo.join(', ')}` : 'yes') : '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
