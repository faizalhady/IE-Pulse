/**
 * TimeStudyTab.tsx — THE TOOL.
 * Stopwatch-style element timing. Pick a station, time each element (multiple
 * samples auto-average), then "Generate Playbook from Study". Local state only.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LBRPlaybook } from '../types';
import { Pause, Play, Plus, Timer, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StudyElement { id: string; name: string; samples: number[] }
interface StudyStation { id: string; name: string; elements: StudyElement[] }

let idSeq = 0;
const nextId = (p: string) => `${p}-${++idSeq}`;

const avg = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

export default function TimeStudyTab({ playbook }: { playbook: LBRPlaybook }) {
  // Seed from the current playbook so there's something to study.
  const [stations, setStations] = useState<StudyStation[]>(() =>
    playbook.stations.map(s => ({
      id: s.id, name: s.id,
      elements: s.elements.map(e => ({ id: nextId('el'), name: e.name, samples: [e.timeSec] })),
    })));
  const [selected, setSelected] = useState<string>(playbook.stations[0]?.id ?? '');
  const [active, setActive] = useState<{ elId: string; startedAt: number } | null>(null);
  const [, force] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);

  useEffect(() => {
    if (active) { timerRef.current = setInterval(() => force(t => t + 1), 100); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active]);

  const station = stations.find(s => s.id === selected);

  const toggleTimer = (elId: string) => {
    if (active && active.elId === elId) {
      const secs = Math.round((Date.now() - active.startedAt) / 100) / 10;
      setStations(prev => prev.map(s => s.id !== selected ? s : {
        ...s, elements: s.elements.map(e => e.id === elId ? { ...e, samples: [...e.samples, secs] } : e),
      }));
      setActive(null);
    } else {
      setActive({ elId, startedAt: Date.now() });
    }
    setGenerated(null);
  };

  const liveSecs = active ? Math.round((Date.now() - active.startedAt) / 100) / 10 : 0;

  const addStation = () => {
    const id = nextId('ST');
    setStations(prev => [...prev, { id, name: `Station ${prev.length + 1}`, elements: [] }]);
    setSelected(id);
  };
  const addElement = () => {
    if (!station) return;
    setStations(prev => prev.map(s => s.id !== selected ? s : { ...s, elements: [...s.elements, { id: nextId('el'), name: 'New element', samples: [] }] }));
  };
  const rename = (sid: string, name: string) => setStations(prev => prev.map(s => s.id === sid ? { ...s, name } : s));
  const renameEl = (elId: string, name: string) => setStations(prev => prev.map(s => s.id !== selected ? s : { ...s, elements: s.elements.map(e => e.id === elId ? { ...e, name } : e) }));
  const delEl = (elId: string) => setStations(prev => prev.map(s => s.id !== selected ? s : { ...s, elements: s.elements.filter(e => e.id !== elId) }));

  const generate = () => {
    const totalEls = stations.reduce((n, s) => n + s.elements.length, 0);
    const bottleneck = stations.reduce((m, s) => Math.max(m, s.elements.reduce((t, e) => t + avg(e.samples), 0)), 0);
    setGenerated(`Generated playbook from study · ${stations.length} stations · ${totalEls} elements · bottleneck ${bottleneck.toFixed(1)}s. Local only — no backend in v1.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Time each element with the stopwatch — repeated samples auto-average.</p>
        <Button size="sm" onClick={generate} className="bg-emerald-500 hover:bg-emerald-600"><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Generate Playbook from Study</Button>
      </div>
      {generated && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">{generated}</div>}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT — station list */}
        <div className="w-full lg:w-[260px] flex-shrink-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Stations</p>
          </div>
          {stations.map(s => {
            const total = s.elements.reduce((t, e) => t + avg(e.samples), 0);
            return (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className={cn('w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-border last:border-0 transition-colors',
                  selected === s.id ? 'bg-muted/40' : 'hover:bg-muted/20')}>
                <span className="text-[11px] font-semibold text-foreground truncate">{s.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{total.toFixed(1)}s</span>
              </button>
            );
          })}
          <button onClick={addStation} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-emerald-400 hover:bg-muted/30 transition-colors border-t border-border">
            <Plus className="h-3.5 w-3.5" /> Add Station
          </button>
        </div>

        {/* RIGHT — selected station elements */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            {station ? <Input value={station.name} onChange={e => rename(station.id, e.target.value)} className="h-7 w-48 text-xs font-semibold" /> : <span className="text-[10px] text-muted-foreground">No station selected</span>}
            <Button size="sm" variant="outline" onClick={addElement} disabled={!station}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Element</Button>
          </div>
          {station?.elements.map(e => {
            const isActive = active?.elId === e.id;
            const a = avg(e.samples);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                <button onClick={() => toggleTimer(e.id)}
                  className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                    isActive ? 'bg-red-500 text-white' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25')}>
                  {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <Input value={e.name} onChange={ev => renameEl(e.id, ev.target.value)} className="h-7 flex-1 text-xs" />
                <div className="text-right w-16">
                  <p className="text-[9px] text-muted-foreground uppercase">Avg</p>
                  <p className="text-sm font-mono font-bold text-foreground tabular-nums">{a.toFixed(1)}s</p>
                </div>
                <div className="text-right w-20">
                  <p className="text-[9px] text-muted-foreground uppercase">{isActive ? 'Timing' : `${e.samples.length} sample${e.samples.length !== 1 ? 's' : ''}`}</p>
                  <p className={cn('text-sm font-mono tabular-nums', isActive ? 'text-red-400 font-bold' : 'text-muted-foreground')}>
                    {isActive ? `${liveSecs.toFixed(1)}s` : (e.samples.length ? `${e.samples[e.samples.length - 1]}s` : '—')}
                  </p>
                </div>
                <button onClick={() => delEl(e.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
          {station && station.elements.length === 0 && (
            <div className="px-4 py-10 text-center text-[11px] text-muted-foreground flex flex-col items-center gap-2">
              <Timer className="h-6 w-6 opacity-40" /> No elements yet — add one to start timing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
