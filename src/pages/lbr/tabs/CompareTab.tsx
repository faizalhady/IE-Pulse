/**
 * CompareTab.tsx — compare 2–3 playbooks of the same assembly side by side.
 * Mini Yamazumi per playbook + a metrics table with the winner flagged per row.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { lbrTextClass } from '@/lib/lbr/lbrConstants';
import type { LBRPlaybook } from '../types';
import YamazumiChart from '../YamazumiChart';
import { Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';

const NONE = '__none__';

interface MetricDef { label: string; get: (p: LBRPlaybook) => number; better: 'max' | 'min'; fmt: (n: number) => string }
const METRICS: MetricDef[] = [
  { label: 'LBR',       get: p => p.lbr,        better: 'max', fmt: n => `${n}%` },
  { label: 'UPH',       get: p => p.uph,        better: 'max', fmt: n => String(n) },
  { label: 'UPPH',      get: p => p.upph,       better: 'max', fmt: n => String(n) },
  { label: 'LBL',       get: p => p.lbl,        better: 'min', fmt: n => `${n}s` },
  { label: 'Operators', get: p => p.operators,  better: 'min', fmt: n => String(n) },
  { label: 'vs TAKT',   get: p => p.vsTaktPct,  better: 'min', fmt: n => `${n}%` },
];

export default function CompareTab({ playbooks, current }: { playbooks: LBRPlaybook[]; current: LBRPlaybook }) {
  const others = playbooks.filter(p => p.id !== current.id);
  const [slots, setSlots] = useState<string[]>([current.id, others[0]?.id ?? NONE, others[1]?.id ?? NONE]);

  const selected = useMemo(
    () => slots.map(id => playbooks.find(p => p.id === id)).filter(Boolean) as LBRPlaybook[],
    [slots, playbooks],
  );

  if (playbooks.length < 2) {
    return <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">This assembly has only one playbook — nothing to compare yet.</div>;
  }

  const setSlot = (i: number, v: string) => setSlots(prev => prev.map((s, idx) => idx === i ? v : s));

  // Winner id per metric.
  const winners = METRICS.map(m => {
    let bestId = ''; let best = m.better === 'max' ? -Infinity : Infinity;
    selected.forEach(p => { const v = m.get(p); if (m.better === 'max' ? v > best : v < best) { best = v; bestId = p.id; } });
    return bestId;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Slot selectors */}
      <div className="flex flex-wrap gap-3">
        {slots.map((slot, i) => (
          <Select key={i} value={slot} onValueChange={v => setSlot(i, v)}>
            <SelectTrigger className="h-9 w-[220px] text-xs"><SelectValue placeholder={`Playbook ${i + 1}`} /></SelectTrigger>
            <SelectContent>
              {i > 0 && <SelectItem value={NONE}>— None —</SelectItem>}
              {playbooks.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Side-by-side mini Yamazumi */}
      <div className={cn('grid gap-4', selected.length === 3 ? 'lg:grid-cols-3' : selected.length === 2 ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        {selected.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="text-[11px] font-semibold text-foreground truncate">{p.name}</p>
              <p className="text-[9px] text-muted-foreground truncate">{p.scenario}</p>
            </div>
            <div className="p-3"><YamazumiChart stations={p.stations} takt={p.takt} height={200} showAxisLabels={false} /></div>
          </div>
        ))}
      </div>

      {/* Metrics table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid items-center bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
          style={{ gridTemplateColumns: `7rem repeat(${selected.length}, 1fr) 5rem` }}>
          <div className="px-3 py-2.5">Metric</div>
          {selected.map(p => <div key={p.id} className="px-3 py-2.5 text-right truncate">{p.name}</div>)}
          <div className="px-3 py-2.5 text-right">Winner</div>
        </div>
        {METRICS.map((m, mi) => (
          <div key={m.label} className="grid items-center border-b border-border last:border-0" style={{ gridTemplateColumns: `7rem repeat(${selected.length}, 1fr) 5rem` }}>
            <div className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
            {selected.map(p => {
              const isWinner = winners[mi] === p.id && selected.length > 1;
              return (
                <div key={p.id} className={cn('px-3 py-2 text-right text-[12px] font-mono tabular-nums',
                  m.label === 'LBR' ? lbrTextClass(p.lbr) : 'text-foreground', isWinner && 'font-bold')}>
                  {m.fmt(m.get(p))}
                  {isWinner && <Trophy className="inline ml-1 h-3 w-3 text-amber-400" />}
                </div>
              );
            })}
            <div className="px-3 py-2 text-right text-[11px] font-semibold text-amber-400 truncate">
              {selected.length > 1 ? (selected.find(p => p.id === winners[mi])?.name.split(' ')[0] ?? '—') : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
