/**
 * WorkElementsTab.tsx — flat, filterable table of every work element across stations.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ELEMENT_CATEGORY_BADGE } from '@/lib/lbr/lbrConstants';
import type { LBRPlaybook } from '../types';
import { useMemo, useState } from 'react';

const GRID = '6rem 1fr 5rem 4rem 5rem 8rem';
const HEADERS = ['Station', 'Element', 'Time', 'Cat', 'Movable', 'Move To'];
const ALL = '__all__';

export default function WorkElementsTab({ playbook }: { playbook: LBRPlaybook }) {
  const [station, setStation] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [movable, setMovable] = useState(ALL);

  const flat = useMemo(() =>
    playbook.stations.flatMap(s => s.elements.map(e => ({ ...e, station: s.id }))),
    [playbook]);

  const rows = useMemo(() => {
    return flat
      .filter(e => station === ALL || e.station === station)
      .filter(e => category === ALL || e.category === category)
      .filter(e => movable === ALL || (movable === 'yes' ? e.movable : !e.movable))
      .sort((a, b) => b.timeSec - a.timeSec);
  }, [flat, station, category, movable]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <Filter label="Station" value={station} onChange={setStation} options={[{ v: ALL, l: 'All stations' }, ...playbook.stations.map(s => ({ v: s.id, l: s.id }))]} />
        <Filter label="Category" value={category} onChange={setCategory} options={[{ v: ALL, l: 'All' }, { v: 'VA', l: 'VA' }, { v: 'NVA', l: 'NVA' }]} />
        <Filter label="Movable" value={movable} onChange={setMovable} options={[{ v: ALL, l: 'All' }, { v: 'yes', l: 'Movable' }, { v: 'no', l: 'Fixed' }]} />
        <span className="text-[10px] text-muted-foreground ml-auto">{rows.length} elements · sorted by time</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border" style={{ gridTemplateColumns: GRID }}>
          {HEADERS.map((h, i) => <div key={i} className={cn('px-2 py-2.5', i === 2 && 'text-right')}>{h}</div>)}
        </div>
        {rows.map((e, i) => (
          <div key={`${e.station}-${e.id}-${i}`} className="grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors" style={{ gridTemplateColumns: GRID, minHeight: 40 }}>
            <div className="px-2 text-[11px] font-semibold text-foreground">{e.station}</div>
            <div className="px-2 text-[11px] text-foreground truncate">{e.name}</div>
            <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{e.timeSec}s</div>
            <div className="px-2"><span className={cn('text-[8px] font-semibold px-1 py-0.5 rounded border', ELEMENT_CATEGORY_BADGE[e.category])}>{e.category}</span></div>
            <div className="px-2 text-[10px] text-muted-foreground">{e.movable ? 'Yes' : '—'}</div>
            <div className="px-2 text-[10px] font-mono text-muted-foreground truncate">{e.movableTo.length ? e.movableTo.join(', ') : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}
